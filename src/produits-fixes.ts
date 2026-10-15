import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Produits fixes de la préprod (roadmap phase 1) : de vrais produits de la prod, au même handle,
 * dont le statut est forcé en préprod pour que les tests trouvent toujours le même cas.
 * Liste dans data/produits-fixes.json, raisons du choix dans docs/produits-fixes.md.
 */
export type EtatProduit = 'en-stock' | 'tailles' | 'rupture' | 'coming-soon' | 'precommande';

export interface ProduitFixe {
  id: string;
  /** Cas couvert, en clair : « Tailles partielles ». */
  role: string;
  handle: string;
  /** État affiché par la fiche : bouton principal et ce qu'il propose. */
  etat: EtatProduit;
  /** Produit à tailles : tailles qu'on doit pouvoir acheter, et celles qui doivent être épuisées. */
  tailles?: { disponibles: string[]; indisponibles: string[] };
  /** Étiquette « Nouveauté » (tag LABEL:NEW). */
  nouveaute?: boolean;
  /** Nombre minimum de coloris proposés par « Découvrir tout ». */
  colorisMinimum?: number;
  /** Prix maximum, en euros, pour le cas « petit prix ». */
  prixMaximumEuros?: number;
  /** Tags exacts attendus (produits QA : `qa-fixture` et ceux du cas, rien d'autre). */
  tags?: string[];
  /** Produit QA en précommande : date d'expédition prévue (métachamp `preorder.date` de toutes les variantes), « 2030-12-31 ». */
  datePrecommande?: string;
  /** Produit QA à tailles dont certaines seulement sont en précommande : date par taille, { "M": "2030-12-31" }. */
  precommandeParTaille?: Record<string, string>;
  /**
   * Produit QA : prix de base en centimes de dollar, devise de la boutique préprod. Fixe, contrairement au prix en euros
   * de /fr-fr/, que Shopify convertit au taux du jour.
   */
  prixDollars?: number;
}

const racine = join(__dirname, '..', 'data');

const fixes = (JSON.parse(readFileSync(join(racine, 'produits-fixes.json'), 'utf8')) as { produits: ProduitFixe[] }).produits;

/**
 * Données QA de la préprod (data/donnees-qa.json, créées par `npm run donnees:qa`) : des copies des vrais
 * produits, à nous, que les réimports prod → préprod ne touchent pas. Plan : docs/plan-donnees-qa.md.
 */
interface ProduitQa {
  id: string;
  titre: string;
  handle: string;
  cas: string;
  etat: EtatProduit;
  tags: string[];
  /** Stock en ligne : un nombre, ou un stock par taille ({ "50": 20, "52": 0 }). */
  stock: number | Record<string, number>;
  /** Prix de toutes les variantes, en dollars : « 580.00 ». */
  prix?: string;
  sansTagQa?: boolean;
  visibleRecherche?: boolean;
  /** Métachamps posés sur les variantes : « * » pour toutes, ou par taille. */
  metafieldsVariantes?: Record<string, { namespace: string; key: string; value: string }[]>;
}

interface DonneesQa {
  tagQa: string;
  /** Tags remis par une automatisation de la préprod : acceptés en plus des tags attendus. */
  tagsToleres?: string[];
  produits: ProduitQa[];
  remplissage?: Omit<ProduitQa, 'id'> & { nombre: number };
  collections: { id: string; titre: string; handle: string; cas: string; contenu: { tags?: string[]; produits?: string[] } }[];
}

export const DONNEES_QA = JSON.parse(readFileSync(join(racine, 'donnees-qa.json'), 'utf8')) as DonneesQa;

const tagsQa = (p: ProduitQa) => (p.sansTagQa ? p.tags : [DONNEES_QA.tagQa, ...p.tags]);

/** Produits de remplissage (QA Filler 01…) : pas testés un par un, seulement comptés dans les collections. */
const remplissage = DONNEES_QA.remplissage;
const FILLERS: ProduitQa[] = Array.from({ length: remplissage?.nombre ?? 0 }, (_, i) => {
  const n = String(i + 1).padStart(2, '0');
  return { ...remplissage!, id: `F${n}`, titre: remplissage!.titre.replace('{n}', n), handle: remplissage!.handle.replace('{n}', n) };
});

const datePreorder = (champs?: { namespace: string; key: string; value: string }[]) =>
  champs?.find(m => m.namespace === 'preorder' && m.key === 'date')?.value;

export const PRODUITS_QA: ProduitFixe[] =DONNEES_QA.produits.map(p => ({
  // Les tags exacts couvrent aussi l'étiquette « Nouveauté » (LABEL:NEW) : pas de champ `nouveaute`, sinon double message.
  id: p.id, role: p.cas, handle: p.handle, etat: p.etat, tags: tagsQa(p),
  datePrecommande: datePreorder(p.metafieldsVariantes?.['*']),
  ...(p.prix ? { prixDollars: Math.round(Number(p.prix) * 100) } : {}),
  ...(p.metafieldsVariantes && Object.keys(p.metafieldsVariantes).some(t => t !== '*') ? {
    precommandeParTaille: Object.fromEntries(Object.entries(p.metafieldsVariantes)
      .filter(([taille, champs]) => taille !== '*' && datePreorder(champs))
      .map(([taille, champs]) => [taille, datePreorder(champs)!])),
  } : {}),
  ...(typeof p.stock === 'object' ? {
    tailles: {
      disponibles: Object.keys(p.stock).filter(t => (p.stock as Record<string, number>)[t] > 0),
      indisponibles: Object.keys(p.stock).filter(t => (p.stock as Record<string, number>)[t] === 0),
    },
  } : {}),
}));

/** Produits QA visibles dans la recherche (les autres sont cachés). */
export const HANDLES_CHERCHABLES = DONNEES_QA.produits.filter(p => p.visibleRecherche).map(p => p.handle);

/** Handles attendus dans une collection QA : par tag (y compris le remplissage) ou liste manuelle. */
export function contenuCollectionQa(collection: DonneesQa['collections'][number]): string[] {
  const tous = [...DONNEES_QA.produits, ...FILLERS];
  if (collection.contenu.tags) return tous.filter(p => tagsQa(p).some(t => collection.contenu.tags!.includes(t))).map(p => p.handle);
  return (collection.contenu.produits ?? []).map(id => tous.find(p => p.id === id)!.handle);
}

/** Collection QA de data/donnees-qa.json (C1, C5…) et handles des produits qu'elle doit contenir. */
export function collectionQa(id: string): { id: string; titre: string; handle: string; cas: string; handles: string[] } {
  const collection = DONNEES_QA.collections.find(c => c.id === id);
  if (!collection) throw new Error(`Collection QA inconnue : ${id}. Voir data/donnees-qa.json`);
  return { id, titre: collection.titre, handle: collection.handle, cas: collection.cas, handles: contenuCollectionQa(collection) };
}

/** Tous les handles QA (cas et remplissage). */
export const HANDLES_QA = [...DONNEES_QA.produits, ...FILLERS].map(p => p.handle);

export const PRODUITS_FIXES = [...fixes, ...PRODUITS_QA];

export function produitFixe(id: string): ProduitFixe {
  const produit = PRODUITS_FIXES.find(p => p.id === id);
  if (!produit) throw new Error(`Produit fixe inconnu : ${id}. Voir data/produits-fixes.json et data/donnees-qa.json`);
  return produit;
}
