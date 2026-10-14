// Crée et remet en état les données QA de la préprod (produits, collections, entrées de menu)
// à partir de data/donnees-qa.json. Montre d'abord la liste des changements, puis attend « oui ».
// Sans terminal interactif (ou avec --apercu), il montre la liste et s'arrête sans rien modifier.
// Passe par la CLI Shopify du projet, connectée avec le compte de la QA (`shopify store auth`).
// Plan et décisions : docs/plan-donnees-qa.md.

import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline/promises';

const VERSION_API = '2026-07';
const donnees = JSON.parse(readFileSync('data/donnees-qa.json', 'utf8'));
const BOUTIQUE = donnees.boutique;
const apercuSeul = process.argv.includes('--apercu') || !process.stdin.isTTY;

const DROITS = 'read_products,write_products,read_inventory,write_inventory,read_locations,read_publications,'
  + 'write_publications,read_online_store_navigation,write_online_store_navigation,read_metaobjects';

// ---------- Appels à l'admin par la CLI ----------

process.on('uncaughtException', (erreur) => {
  console.error(`\n✗ ${erreur.message}\n\nRien n'a été modifié dans la préprod.`);
  process.exit(1);
});

const dossierTemp = mkdtempSync(join(tmpdir(), 'donnees-qa-'));
process.on('exit', () => rmSync(dossierTemp, { recursive: true, force: true }));

function admin(requete, variables = {}, { modification = false } = {}) {
  const fichierRequete = join(dossierTemp, 'requete.graphql');
  const fichierVariables = join(dossierTemp, 'variables.json');
  const fichierSortie = join(dossierTemp, 'sortie.json');
  writeFileSync(fichierRequete, requete);
  writeFileSync(fichierVariables, JSON.stringify(variables));
  rmSync(fichierSortie, { force: true });
  const args = ['store', 'execute', '--store', BOUTIQUE, '--version', VERSION_API, '--json',
    '--query-file', fichierRequete, '--variable-file', fichierVariables, '--output-file', fichierSortie];
  if (modification) args.push('--allow-mutations');
  try {
    execFileSync('node_modules/.bin/shopify', args, { stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (erreur) {
    // Sans la ligne « Loading stored store auth » que la CLI affiche à chaque appel.
    const message = `${erreur.stdout ?? ''}${erreur.stderr ?? ''}`.replace(/Loading stored store auth[^\n]*/g, '').replace(/\x1b\[[0-9;]*[A-Za-z]/g, '').trim();
    if (/ACCESS_DENIED|access scope|not approved|re-?authenticate|expired|No stored/i.test(message)) {
      throw new Error(`La CLI Shopify n'a pas les droits nécessaires ou sa connexion a expiré. Relancer la connexion :\n`
        + `npx shopify store auth --store ${BOUTIQUE} --scopes ${DROITS}`);
    }
    throw new Error(`Appel à l'admin Shopify refusé.\n${message}`);
  }
  return JSON.parse(readFileSync(fichierSortie, 'utf8'));
}

/** Lance une modification et s'arrête net si Shopify renvoie une erreur métier (userErrors). */
function modifier(libelle, requete, variables) {
  const reponse = admin(requete, variables, { modification: true });
  const resultat = Object.values(reponse)[0];
  const erreurs = resultat?.userErrors ?? [];
  if (erreurs.length) {
    throw new Error(`${libelle} : refusé par Shopify.\n${erreurs.map((e) => `- ${e.message} (${(e.field ?? []).join('.')})`).join('\n')}`);
  }
  console.log(`  ✓ ${libelle}`);
  return resultat;
}

/** Pause sans rendre la main (le script est synchrone, comme les appels à la CLI). */
function attendre(secondes) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, secondes * 1000);
}

const meta = (namespace, key, type, value) => ({ namespace, key, type, value: String(value) });
const cleMeta = (m) => `${m.namespace}.${m.key}`;
const memes = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());

// ---------- Ce qu'on attend ----------

const remplissage = donnees.remplissage;
const PRODUITS = [
  ...donnees.produits,
  ...Array.from({ length: remplissage?.nombre ?? 0 }, (_, i) => {
    const n = String(i + 1).padStart(2, '0');
    return { ...remplissage, id: `F${n}`, titre: remplissage.titre.replace('{n}', n), handle: remplissage.handle.replace('{n}', n), remplissage: true };
  }),
];
const parId = new Map(PRODUITS.map((p) => [p.id, p]));

const tagsVoulus = (attendu) => (attendu.sansTagQa ? [...attendu.tags] : [donnees.tagQa, ...attendu.tags]);
// Tags posés par une automatisation de la boutique qu'on ne maîtrise pas (data/donnees-qa.json, tagsToleres) :
// ni comptés comme écart, ni retirés, puisqu'ils reviennent.
const toleres = new Set(donnees.tagsToleres ?? []);
const sansToleres = (tags) => tags.filter((t) => !toleres.has(t));
const tagsAEcrire = (attendu, produit) => [...tagsVoulus(attendu), ...produit.tags.filter((t) => toleres.has(t))];

/** Collections QA manuelles : handle → produits attendus (ids). */
const manuellesQa = new Map(donnees.collections.filter((c) => c.contenu.produits).map((c) => [c.handle, c.contenu.produits]));

function stockVoulu(attendu, variante, locationId) {
  if (locationId !== emplacement.id) return 0;
  return typeof attendu.stock === 'number' ? attendu.stock : (attendu.stock[variante.title] ?? 0);
}

const skuVoulu = (attendu, produit, variante) => (produit.variants.nodes.length === 1 ? attendu.id : `${attendu.id}-${variante.title}`);

// ---------- Lecture de l'état actuel ----------

const CHAMPS_PRODUIT = `
  id title handle status tags
  seo { title description }
  metafields(first: 100) { nodes { namespace key type value } }
  resourcePublicationsV2(first: 20) { nodes { isPublished publication { id name } } }
  collections(first: 50) { nodes { id handle title ruleSet { appliedDisjunctively } } }
  variants(first: 20) { nodes { id title sku price
    metafields(first: 20, namespace: "preorder") { nodes { namespace key type value } }
    inventoryItem { id measurement { weight { value unit } }
      inventoryLevels(first: 20) { nodes { location { id name } quantities(names: ["available"]) { quantity } } } } } }`;

const ids = new Map(); // handle → identifiant Shopify, rempli au fil des lectures et des créations

function lireProduit(handle) {
  const p = admin(`query($h: String!) { p: productByIdentifier(identifier: {handle: $h}) { ${CHAMPS_PRODUIT} } }`, { h: handle }).p;
  if (p) ids.set(p.handle, p.id);
  return p;
}

/**
 * Produit QA par son handle, ou à défaut par son titre : une copie interrompue juste après sa création garde le
 * handle du vrai produit (« numero-un-textured-black-1 ») ; on la retrouve et on la répare au lieu d'en refaire une.
 */
function lireProduitQa(attendu) {
  const parHandle = lireProduit(attendu.handle);
  if (parHandle) return parHandle;
  const trouves = admin(`query($q: String!) { products(first: 5, query: $q) { nodes { handle title } } }`,
    { q: `title:"${attendu.titre.replace(/"/g, '\\"')}"` }).products.nodes.filter((p) => p.title === attendu.titre);
  return trouves.length ? lireProduit(trouves[0].handle) : null;
}

/** Identifiant d'un produit QA (par son id QA01…), lu au besoin. null s'il n'existe pas encore. */
function idProduitQa(id) {
  const attendu = parId.get(id);
  if (!attendu) throw new Error(`Produit QA inconnu dans data/donnees-qa.json : ${id}`);
  if (!ids.has(attendu.handle)) lireProduit(attendu.handle);
  return ids.get(attendu.handle) ?? null;
}

function lireCollection(handle) {
  const c = admin(`query($h: String!) { c: collectionByIdentifier(identifier: {handle: $h}) {
    id title handle sortOrder ruleSet { appliedDisjunctively rules { column relation condition } }
    metafields(first: 50) { nodes { namespace key type value } }
    products(first: 100) { nodes { id handle } }
    resourcePublicationsV2(first: 20) { nodes { isPublished publication { id name } } } } }`, { h: handle }).c;
  if (c) ids.set(`collection:${c.handle}`, c.id);
  return c;
}

const sources = new Map();
function lireSource(handle) {
  if (!sources.has(handle)) sources.set(handle, lireProduit(handle));
  return sources.get(handle);
}

const ENTREE_MENU = 'id title type resourceId url tags';
const general = admin(`{
  locations(first: 100) { nodes { id name } }
  publications(first: 30) { nodes { id name } }
  menus(first: 100) { nodes { id handle title items { ${ENTREE_MENU} items { ${ENTREE_MENU} } } } }
}`);

const emplacement = general.locations.nodes.find((l) => l.name === donnees.emplacementEnLigne);
const boutiqueEnLigne = general.publications.nodes.find((p) => p.name === 'Online Store');
if (!emplacement) throw new Error(`Emplacement « ${donnees.emplacementEnLigne} » introuvable dans la préprod.`);
if (!boutiqueEnLigne) throw new Error('Canal de vente « Online Store » introuvable dans la préprod.');

// ---------- Produits ----------

/** Réglages du produit attendus : caché de la recherche, réglages du cas, recommandations (produits QA). */
function metasVoulues(attendu) {
  const metas = attendu.visibleRecherche ? [] : [meta('seo', 'hidden', 'number_integer', 1)];
  for (const m of attendu.metafields ?? []) metas.push(meta(m.namespace, m.key, m.type, m.value));
  const reco = attendu.recommandations;
  if (reco) {
    for (const [cle, liste] of [['complementary_products', reco.complementaires], ['related_products', reco.similaires]]) {
      const refs = (liste ?? []).map(idProduitQa);
      // Un produit recommandé pas encore créé : la recommandation sera posée au prochain lancement.
      if (refs.length && refs.every(Boolean)) metas.push(meta('shopify--discovery--product_recommendation', cle, 'list.product_reference', JSON.stringify(refs)));
    }
  }
  return metas;
}

const metasARetirer = (attendu) => [...(attendu.retirerMetafields ?? []), ...(attendu.visibleRecherche ? ['seo.hidden'] : [])];

const metasVariante = (attendu, variante) => [...(attendu.metafieldsVariantes?.['*'] ?? []), ...(attendu.metafieldsVariantes?.[variante.title] ?? [])]
  .map((m) => meta(m.namespace, m.key, m.type, m.value));

/** Collections manuelles où le produit n'a rien à faire : la copie Shopify reprend celles du vrai produit. */
function collectionsManuellesEnTrop(attendu, produit) {
  return produit.collections.nodes.filter((c) => !c.ruleSet && !manuellesQa.get(c.handle)?.includes(attendu.id));
}

const publiees = (produit) => produit.resourcePublicationsV2.nodes.filter((n) => n.isPublished).map((n) => n.publication);

/** Changements à faire sur un produit QA qui existe déjà. */
function ecartsProduit(attendu, produit) {
  const ecarts = [];
  const tags = tagsVoulus(attendu);
  if (produit.handle !== attendu.handle) ecarts.push(`adresse products/${attendu.handle} (aujourd'hui ${produit.handle}, copie interrompue)`);
  if (produit.title !== attendu.titre) ecarts.push(`titre « ${attendu.titre} »`);
  if (!memes(sansToleres(produit.tags), tags)) ecarts.push(`tags : ${tags.join(', ')} seulement (aujourd'hui ${produit.tags.join(', ') || 'aucun'})`);
  // Titre de référencement vide = Shopify reprend le titre du produit.
  if ((produit.seo.title ?? produit.title) !== attendu.titre) ecarts.push(`titre de référencement : « ${attendu.titre} »`);
  for (const m of metasVoulues(attendu)) {
    if (produit.metafields.nodes.find((n) => cleMeta(n) === cleMeta(m))?.value !== m.value) ecarts.push(`réglage ${cleMeta(m)} = ${m.value}`);
  }
  for (const cle of metasARetirer(attendu)) {
    if (produit.metafields.nodes.some((n) => cleMeta(n) === cle)) ecarts.push(`réglage ${cle} retiré`);
  }
  const manuelles = collectionsManuellesEnTrop(attendu, produit);
  if (manuelles.length) ecarts.push(`retiré des collections manuelles (${manuelles.map((c) => c.handle).join(', ')})`);
  for (const variante of produit.variants.nodes) {
    const nom = produit.variants.nodes.length > 1 ? ` (${variante.title})` : '';
    if (variante.inventoryItem.measurement.weight?.value !== 0) ecarts.push(`poids 0${nom}`);
    if (variante.sku !== skuVoulu(attendu, produit, variante)) ecarts.push(`référence (SKU) ${skuVoulu(attendu, produit, variante)}`);
    if (attendu.prix && Number(variante.price) !== Number(attendu.prix)) ecarts.push(`prix ${attendu.prix} $${nom} (aujourd'hui ${variante.price})`);
    const voulues = metasVariante(attendu, variante);
    for (const m of voulues) {
      if (variante.metafields.nodes.find((n) => cleMeta(n) === cleMeta(m))?.value !== m.value) ecarts.push(`${cleMeta(m)} = ${m.value}${nom}`);
    }
    for (const n of variante.metafields.nodes) {
      if (!voulues.some((m) => cleMeta(m) === cleMeta(n))) ecarts.push(`${cleMeta(n)} retiré${nom} (repris du vrai produit)`);
    }
    const niveaux = variante.inventoryItem.inventoryLevels.nodes;
    if (!niveaux.some((n) => n.location.id === emplacement.id)) ecarts.push(`stock activé sur « ${emplacement.name} »${nom}`);
    for (const niveau of niveaux) {
      const voulu = stockVoulu(attendu, variante, niveau.location.id);
      if (niveau.quantities[0].quantity !== voulu) ecarts.push(`stock « ${niveau.location.name} » : ${voulu}${nom} (aujourd'hui ${niveau.quantities[0].quantity})`);
    }
  }
  const publications = publiees(produit);
  if (!publications.some((p) => p.id === boutiqueEnLigne.id)) ecarts.push('publié sur la boutique en ligne');
  const enTrop = publications.filter((p) => p.id !== boutiqueEnLigne.id);
  if (enTrop.length) ecarts.push(`retiré des autres canaux (${enTrop.map((p) => p.name).join(', ')})`);
  if (produit.status !== 'ACTIVE') ecarts.push('mis en ligne (statut actif)');
  return ecarts;
}

const aRevoir = new Set(); // produits modifiés pendant ce lancement : on vérifie à la fin qu'aucune automatisation n'est repassée

function corrigerProduit(attendu, produit) {
  const id = produit.id;
  modifier(`${attendu.id} : adresse, titre, tags, réglages`, `mutation($p: ProductUpdateInput!) {
    productUpdate(product: $p) { product { id } userErrors { field message } } }`, {
    p: {
      id, handle: attendu.handle, title: attendu.titre, tags: tagsAEcrire(attendu, produit),
      seo: { title: attendu.titre, description: produit.seo.description },
      metafields: metasVoulues(attendu),
    },
  });
  ids.set(attendu.handle, id);
  const aRetirer = metasARetirer(attendu).filter((cle) => produit.metafields.nodes.some((n) => cleMeta(n) === cle));
  const aRetirerVariantes = produit.variants.nodes.flatMap((v) => v.metafields.nodes
    .filter((n) => !metasVariante(attendu, v).some((m) => cleMeta(m) === cleMeta(n)))
    .map((n) => ({ ownerId: v.id, namespace: n.namespace, key: n.key })));
  if (aRetirer.length || aRetirerVariantes.length) {
    modifier(`${attendu.id} : réglages retirés (${[...aRetirer, ...aRetirerVariantes.map(cleMeta)].join(', ')})`, `mutation($m: [MetafieldIdentifierInput!]!) {
      metafieldsDelete(metafields: $m) { deletedMetafields { key } userErrors { field message } } }`, {
      m: [...aRetirer.map((cle) => ({ ownerId: id, namespace: cle.split('.')[0], key: cle.split('.').slice(1).join('.') })), ...aRetirerVariantes],
    });
  }
  for (const collection of collectionsManuellesEnTrop(attendu, produit)) {
    modifier(`${attendu.id} : retiré de la collection « ${collection.title} » (${collection.handle})`, `mutation($id: ID!, $produits: [ID!]!) {
      collectionRemoveProducts(id: $id, productIds: $produits) { job { id } userErrors { field message } } }`,
    { id: collection.id, produits: [id] });
  }
  modifier(`${attendu.id} : référence, poids 0${attendu.prix ? `, prix ${attendu.prix} $` : ''}${attendu.metafieldsVariantes ? ', dates de précommande' : ''}`,
    `mutation($id: ID!, $v: [ProductVariantsBulkInput!]!) {
    productVariantsBulkUpdate(productId: $id, variants: $v) { userErrors { field message } } }`, {
      id,
      v: produit.variants.nodes.map((v) => ({
        id: v.id,
        ...(attendu.prix ? { price: attendu.prix } : {}),
        ...(metasVariante(attendu, v).length ? { metafields: metasVariante(attendu, v) } : {}),
        inventoryItem: { sku: skuVoulu(attendu, produit, v), measurement: { weight: { value: 0, unit: 'KILOGRAMS' } } },
      })),
    });
  for (const variante of produit.variants.nodes) {
    if (!variante.inventoryItem.inventoryLevels.nodes.some((n) => n.location.id === emplacement.id)) {
      modifier(`${attendu.id} : stock activé sur « ${emplacement.name} »`, `mutation($item: ID!, $loc: ID!) {
        inventoryActivate(inventoryItemId: $item, locationId: $loc) { inventoryLevel { id } userErrors { field message } } }`,
      { item: variante.inventoryItem.id, loc: emplacement.id });
    }
  }
  // On relit les stocks après l'activation, pour partir des quantités réelles.
  const relu = lireProduit(attendu.handle);
  const quantites = [];
  for (const variante of relu.variants.nodes) {
    for (const niveau of variante.inventoryItem.inventoryLevels.nodes) {
      const voulu = stockVoulu(attendu, variante, niveau.location.id);
      const actuel = niveau.quantities[0].quantity;
      if (actuel !== voulu) quantites.push({ inventoryItemId: variante.inventoryItem.id, locationId: niveau.location.id, quantity: voulu, changeFromQuantity: actuel });
    }
  }
  if (quantites.length) {
    modifier(`${attendu.id} : stocks remis (${quantites.length} emplacement(s))`, `mutation($input: InventorySetQuantitiesInput!) {
      inventorySetQuantities(input: $input) @idempotent(key: "${randomUUID()}") { inventoryAdjustmentGroup { id } userErrors { field message } } }`,
    { input: { name: 'available', reason: 'correction', quantities: quantites } });
  }
  if (relu.status !== 'ACTIVE') {
    modifier(`${attendu.id} : mis en ligne`, `mutation($p: ProductUpdateInput!) {
      productUpdate(product: $p) { product { id } userErrors { field message } } }`, { p: { id, status: 'ACTIVE' } });
  }
  // Publication après la mise en ligne : publier un produit le publie sur tous les canaux (constaté le 9 octobre 2026).
  corrigerPublications(attendu, lireProduit(attendu.handle));
  aRevoir.add(attendu);
}

function corrigerPublications(attendu, produit) {
  let publications = publiees(produit);
  if (!publications.some((p) => p.id === boutiqueEnLigne.id)) {
    modifier(`${attendu.id} : publié sur la boutique en ligne`, `mutation($id: ID!, $input: [PublicationInput!]!) {
      publishablePublish(id: $id, input: $input) { userErrors { field message } } }`,
    { id: produit.id, input: [{ publicationId: boutiqueEnLigne.id }] });
    publications = publiees(lireProduit(attendu.handle));
  }
  const enTrop = publications.filter((p) => p.id !== boutiqueEnLigne.id);
  if (enTrop.length) {
    modifier(`${attendu.id} : retiré des autres canaux (${enTrop.map((p) => p.name).join(', ')})`, `mutation($id: ID!, $input: [PublicationInput!]!) {
      publishableUnpublish(id: $id, input: $input) { userErrors { field message } } }`,
    { id: produit.id, input: enTrop.map((p) => ({ publicationId: p.id })) });
  }
}

function creerProduit(attendu) {
  const source = lireSource(attendu.copieDe);
  if (!source) throw new Error(`${attendu.id} : produit à copier « ${attendu.copieDe} » introuvable dans la préprod.`);
  const copie = modifier(`${attendu.id} : copie de « ${source.title} » (en brouillon)`, `mutation($id: ID!, $titre: String!) {
    productDuplicate(productId: $id, newTitle: $titre, newStatus: DRAFT, includeImages: true, synchronous: true) {
      newProduct { id handle } userErrors { field message } } }`, { id: source.id, titre: attendu.titre });
  corrigerProduit(attendu, lireProduit(copie.newProduct.handle));
}

const etapes = []; // { libelle, faire: () => void }
const fillersACreer = [];

for (const attendu of PRODUITS) {
  const existant = lireProduitQa(attendu);
  if (existant) {
    const ecarts = ecartsProduit(attendu, existant);
    if (ecarts.length) etapes.push({ libelle: `Produit ${attendu.id} « ${attendu.titre} » existe déjà, à remettre en état :\n${ecarts.map((e) => `      - ${e}`).join('\n')}`, faire: () => corrigerProduit(attendu, existant) });
    continue;
  }
  if (attendu.remplissage) { fillersACreer.push(attendu); continue; }
  // Le modèle peut être un produit QA créé plus haut dans ce même lancement : il n'existe pas encore pendant l'aperçu.
  const modeleQa = PRODUITS.find((p) => p.handle === attendu.copieDe);
  const source = modeleQa ? null : lireSource(attendu.copieDe);
  if (!modeleQa && !source) throw new Error(`${attendu.id} : produit à copier « ${attendu.copieDe} » introuvable dans la préprod.`);
  const stock = typeof attendu.stock === 'number' ? attendu.stock : Object.entries(attendu.stock).map(([t, n]) => `${t} : ${n}`).join(', ');
  const details = [
    attendu.prix && `prix ${attendu.prix} $ (converti en euros pour la France)`,
    attendu.metafields && `réglages ${attendu.metafields.map((m) => `${cleMeta(m)} = ${m.value}`).join(', ')}`,
    attendu.metafieldsVariantes && `variantes : ${Object.entries(attendu.metafieldsVariantes).map(([v, ms]) => `${v === '*' ? 'toutes' : v} → ${ms.map((m) => `${cleMeta(m)} = ${m.value}`).join(', ')}`).join(' ; ')}`,
    attendu.retirerMetafields && `réglages retirés : ${attendu.retirerMetafields.join(', ')}`,
    attendu.recommandations && `recommandations : complémentaires ${attendu.recommandations.complementaires.join(', ')}, similaires ${attendu.recommandations.similaires.join(', ')}`,
  ].filter(Boolean).map((d) => `\n      - ${d}`).join('');
  etapes.push({
    libelle: `Produit ${attendu.id} « ${attendu.titre} » (products/${attendu.handle}), à créer :
      - copie de « ${source?.title ?? modeleQa.titre} »
      - tags : ${tagsVoulus(attendu).join(', ')} seulement
      - ${attendu.visibleRecherche ? 'VISIBLE dans la recherche' : 'caché de la recherche'}, poids 0, référence ${attendu.id}
      - stock « ${emplacement.name} » : ${stock}, 0 ailleurs${details}
      - cas testé : ${attendu.cas}`,
    faire: () => creerProduit(attendu),
  });
}

if (fillersACreer.length) {
  const premier = fillersACreer[0];
  etapes.push({
    libelle: `${fillersACreer.length} produits de remplissage à créer (${premier.titre} à ${fillersACreer.at(-1).titre}) :
      - copies de ${premier.copieDe}, tag ${tagsVoulus(premier).join(', ')} seulement (pas ${donnees.tagQa} : ils restent hors de « QA Collection »)
      - cachés de la recherche, stock « ${emplacement.name} » : ${premier.stock}
      - cas testé : ${premier.cas}`,
    faire: () => fillersACreer.forEach(creerProduit),
  });
}

// ---------- Collections ----------

// En-tête carrousel repris de la collection modèle (aucun nouveau métaobjet, décision QA du 9 octobre 2026).
const modele = lireCollection(donnees.modeleCarrousel);
const CLES_CARROUSEL = ['custom.plp_header_variant', 'custom.plp_carousel_image', 'custom.plp_header_split_by_words', 'plp.carousel'];

function metasCollection(attendue) {
  const metas = [meta('seo', 'hidden', 'number_integer', 1), meta('custom', 'infinite_scroll', 'boolean', attendue.defilementInfini)];
  if (attendue.entete === 'carrousel') {
    for (const cle of CLES_CARROUSEL) {
      const m = modele.metafields.nodes.find((n) => cleMeta(n) === cle);
      if (!m) throw new Error(`La collection modèle « ${donnees.modeleCarrousel} » n'a plus le réglage ${cle} : vérifier son en-tête.`);
      metas.push(meta(m.namespace, m.key, m.type, m.value));
    }
  } else if (attendue.entete === 'titre') {
    metas.push(meta('custom', 'plp_header_variant', 'single_line_text_field', 'title'));
  }
  return metas;
}

const regles = (attendue) => ({ appliedDisjunctively: true, rules: attendue.contenu.tags.map((t) => ({ column: 'TAG', relation: 'EQUALS', condition: t })) });
const contenuEnClair = (attendue) => (attendue.contenu.tags
  ? `automatique : les produits qui ont le tag ${attendue.contenu.tags.join(' ou ')}`
  : `manuelle : ${attendue.contenu.produits.length ? attendue.contenu.produits.join(', ') : 'aucun produit'}`);

for (const attendue of donnees.collections) {
  const metas = metasCollection(attendue);
  const existante = lireCollection(attendue.handle);
  if (existante) {
    const ecarts = metas.filter((m) => existante.metafields.nodes.find((n) => cleMeta(n) === cleMeta(m))?.value !== m.value);
    const publiee = existante.resourcePublicationsV2.nodes.some((n) => n.isPublished && n.publication.id === boutiqueEnLigne.id);
    let manquants = [];
    let enTrop = [];
    if (attendue.contenu.produits) {
      const voulus = attendue.contenu.produits.map((id) => parId.get(id).handle);
      const presents = existante.products.nodes.map((p) => p.handle);
      manquants = attendue.contenu.produits.filter((id) => !presents.includes(parId.get(id).handle));
      enTrop = existante.products.nodes.filter((p) => !voulus.includes(p.handle));
    }
    const lignes = [
      ...ecarts.map((m) => `réglage ${cleMeta(m)} = ${m.value}`),
      ...(publiee ? [] : ['publiée sur la boutique en ligne']),
      ...(manquants.length ? [`produits ajoutés : ${manquants.join(', ')}`] : []),
      ...(enTrop.length ? [`produits retirés : ${enTrop.map((p) => p.handle).join(', ')}`] : []),
    ];
    if (lignes.length) {
      etapes.push({
        libelle: `Collection ${attendue.id} « ${attendue.titre} » existe déjà, à remettre en état :\n${lignes.map((l) => `      - ${l}`).join('\n')}`,
        faire: () => {
          if (ecarts.length) modifier(`${attendue.id} : réglages`, `mutation($m: [MetafieldsSetInput!]!) {
            metafieldsSet(metafields: $m) { metafields { id } userErrors { field message } } }`, { m: ecarts.map((m) => ({ ...m, ownerId: existante.id })) });
          if (!publiee) modifier(`${attendue.id} : publiée sur la boutique en ligne`, `mutation($id: ID!, $input: [PublicationInput!]!) {
            publishablePublish(id: $id, input: $input) { userErrors { field message } } }`, { id: existante.id, input: [{ publicationId: boutiqueEnLigne.id }] });
          const aAjouter = manquants.map(idProduitQa).filter(Boolean);
          if (aAjouter.length) modifier(`${attendue.id} : produits ajoutés (${manquants.join(', ')})`, `mutation($id: ID!, $produits: [ID!]!) {
            collectionAddProducts(id: $id, productIds: $produits) { collection { id } userErrors { field message } } }`, { id: existante.id, produits: aAjouter });
          if (enTrop.length) modifier(`${attendue.id} : produits retirés`, `mutation($id: ID!, $produits: [ID!]!) {
            collectionRemoveProducts(id: $id, productIds: $produits) { job { id } userErrors { field message } } }`, { id: existante.id, produits: enTrop.map((p) => p.id) });
        },
      });
    }
    continue;
  }
  etapes.push({
    libelle: `Collection ${attendue.id} « ${attendue.titre} » (collections/${attendue.handle}), à créer :
      - ${contenuEnClair(attendue)}
      - triée par titre (A → Z), ${attendue.defilementInfini ? 'avec' : 'sans'} défilement infini
      - en-tête ${{ carrousel: `carrousel d'images, celui de « ${modele.title} »`, titre: 'titre seul', aucun: 'par défaut' }[attendue.entete]}
      - cachée de la recherche, publiée sur la boutique en ligne seulement${attendue.menu ? `\n      - ajoutée au menu « ${donnees.menu} »` : ''}
      - cas testé : ${attendue.cas}`,
    faire: () => {
      const creee = modifier(`${attendue.id} : création`, `mutation($input: CollectionInput!) {
        collectionCreate(input: $input) { collection { id } userErrors { field message } } }`, {
        input: {
          title: attendue.titre, handle: attendue.handle, sortOrder: attendue.tri, metafields: metas,
          ...(attendue.contenu.tags ? { ruleSet: regles(attendue) } : { products: attendue.contenu.produits.map(idProduitQa).filter(Boolean) }),
        },
      });
      ids.set(`collection:${attendue.handle}`, creee.collection.id);
      modifier(`${attendue.id} : publiée sur la boutique en ligne`, `mutation($id: ID!, $input: [PublicationInput!]!) {
        publishablePublish(id: $id, input: $input) { userErrors { field message } } }`, { id: creee.collection.id, input: [{ publicationId: boutiqueEnLigne.id }] });
    },
  });
}

// ---------- Entrées de menu ----------

// Le header du site est fait de blocs du thème, mais chaque colonne d'un panneau affiche un menu Shopify ordinaire
// (menu-v3-…). Les collections QA vont dans la colonne « Leather Stationery » d'Accessories (décision QA du 9 octobre 2026).

/** Reprend une entrée de menu telle quelle (même identifiant : traductions gardées). */
function reprendre(entree) {
  const copie = { id: entree.id, title: entree.title, type: entree.type, items: (entree.items ?? []).map(reprendre) };
  if (entree.resourceId) copie.resourceId = entree.resourceId;
  if (entree.url) copie.url = entree.url;
  if (entree.tags?.length) copie.tags = entree.tags;
  return copie;
}

if (donnees.menu) {
  const menu = general.menus.nodes.find((m) => m.handle === donnees.menu);
  if (!menu) throw new Error(`Menu « ${donnees.menu} » introuvable dans la préprod (Contenu → Menus).`);
  const absentes = donnees.collections.filter((c) => c.menu && !menu.items.some((i) => i.url?.endsWith(`/collections/${c.handle}`)));
  if (absentes.length) {
    etapes.push({
      libelle: `Menu « ${menu.title} » : ${absentes.map((c) => `« ${c.titre} »`).join(', ')} ajoutée(s) à la fin
      - les ${menu.items.length} entrées actuelles (${menu.items.map((i) => i.title).join(', ')}) restent telles quelles
      - copie du menu actuel enregistrée avant dans archives/menus/`,
      faire: () => {
        mkdirSync('archives/menus', { recursive: true });
        const sauvegarde = `archives/menus/${menu.handle}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
        writeFileSync(sauvegarde, JSON.stringify(menu, null, 2));
        const nouvelles = absentes.map((c) => {
          const id = ids.get(`collection:${c.handle}`) ?? lireCollection(c.handle)?.id;
          if (!id) throw new Error(`Collection ${c.handle} introuvable pour le menu.`);
          return { title: c.titre, type: 'COLLECTION', resourceId: id, url: `/collections/${c.handle}`, items: [] };
        });
        modifier(`Menu « ${menu.title} » : ${absentes.map((c) => c.titre).join(', ')} ajoutée(s) (copie : ${sauvegarde})`,
          `mutation($id: ID!, $title: String!, $handle: String!, $items: [MenuItemUpdateInput!]!) {
          menuUpdate(id: $id, title: $title, handle: $handle, items: $items) { menu { id } userErrors { field message } } }`,
          { id: menu.id, title: menu.title, handle: menu.handle, items: [...menu.items.map(reprendre), ...nouvelles] });
      },
    });
  }
}

// ---------- Affichage, accord, application ----------

console.log(`\nPréprod ${BOUTIQUE} · données QA (data/donnees-qa.json)\n`);
if (!etapes.length) {
  console.log('Tout est déjà en place et dans l\'état prévu. Rien à modifier.');
  process.exit(0);
}
console.log('Changements prévus :\n');
etapes.forEach((e, i) => console.log(`  ${i + 1}. ${e.libelle}\n`));
console.log('Rien d\'autre n\'est modifié dans la préprod.\n');

if (apercuSeul) {
  console.log('Aperçu seulement : rien n\'a été modifié.');
  process.exit(0);
}
const lecteur = createInterface({ input: process.stdin, output: process.stdout });
const reponse = (await lecteur.question('Appliquer ces changements dans la préprod ? Taper « oui » pour confirmer : ')).trim().toLowerCase();
lecteur.close();
if (reponse !== 'oui') {
  console.log('Annulé : rien n\'a été modifié.');
  process.exit(0);
}

console.log('');
const debut = Date.now();
try {
  for (const etape of etapes) etape.faire();
  // Une automatisation de la boutique ajoute LABEL:NEW quelques secondes après la mise en ligne d'un nouveau produit
  // (9 octobre 2026). On attend, on relit les produits modifiés, et on remet tags et canaux si elle est passée.
  if (aRevoir.size) {
    console.log(`\n  … vérification finale des ${aRevoir.size} produit(s) modifié(s) (une automatisation de la boutique peut repasser derrière)`);
    attendre(15);
    for (const attendu of aRevoir) {
      const produit = lireProduit(attendu.handle);
      const tags = tagsAEcrire(attendu, produit);
      if (!memes(produit.tags, tags)) {
        const ajoutes = produit.tags.filter((t) => !tags.includes(t));
        modifier(`${attendu.id} : tag(s) ${ajoutes.join(', ') || 'manquant(s)'} remis en ordre (automatisation de la boutique)`, `mutation($p: ProductUpdateInput!) {
          productUpdate(product: $p) { product { id } userErrors { field message } } }`, { p: { id: produit.id, tags } });
      }
      corrigerPublications(attendu, produit);
    }
  }
} catch (erreur) {
  console.error(`\n✗ Arrêt : ${erreur.message}\n\nCe qui est marqué ✓ au-dessus a bien été fait. Relancer la commande reprend là où ça s'est arrêté.`);
  process.exit(1);
}
console.log(`\nTerminé en ${Math.round((Date.now() - debut) / 60000)} min. Relancer la commande doit maintenant dire « Rien à modifier ».`);
