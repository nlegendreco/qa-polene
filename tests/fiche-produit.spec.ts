import { test, expect, etape } from '../src/fixtures';
import { Header } from '../src/pages/header';
import { ProductPage } from '../src/pages/product';
import { produitFixe } from '../src/produits-fixes';
import { parsePriceToCents } from '../src/price';
import { appelShopify } from '../src/shopify';

/**
 * Fiche produit (roadmap phase 2.2), sur les produits QA de la préprod : onglets et guide des tailles du bijou QA09
 * (fiches TNR PDP-09 et PDP-06), double clic sur « Add to cart » et barre d'achat fixe sur mobile avec QA01 (PDP-07).
 * Aucune commande : on peut les lancer à tout moment.
 *
 * Écrit pour l'ancienne fiche (onglets Description | Size & fit | Materials | Shipping and returns), seule servie par
 * le Roll Out le 14 octobre 2026. La nouvelle (« Explore all », fenêtre « Choose your size » qui contient le guide
 * des tailles) reste à relever : le test se met alors en « ignoré ».
 */

/** Onglets attendus, par clé du thème (data-item), avec leur libellé FR ou EN. « Size & fit » a la clé details. */
const ONGLETS: { cle: string; libelle: RegExp; enClair: string }[] = [
  { cle: 'description', libelle: /^Description$/i, enClair: 'Description' },
  { cle: 'details', libelle: /^(Size & fit|Taille et coupe|Dimensions)$/i, enClair: 'Size & fit' },
  { cle: 'materials', libelle: /^(Materials|Matières)$/i, enClair: 'Materials' },
  { cle: 'shipping', libelle: /^(Shipping and returns|Livraisons? (&|et) retours)$/i, enClair: 'Shipping and returns' },
];

/** Sur mobile, le header fixe recouvre un élément amené en haut d'écran : on le centre avant de toucher. */
const centrer = (element: import('@playwright/test').Locator) => element.evaluate(e => e.scrollIntoView({ block: 'center', behavior: 'instant' }));

const produit = produitFixe('QA09');

async function ouvrirFiche(page: import('@playwright/test').Page, fiche: ProductPage) {
  await page.goto(`products/${produit.handle}`, { waitUntil: 'domcontentloaded' });
  await expect(fiche.title, 'Le nom du produit doit s\'afficher').toBeVisible();
  await expect(fiche.mainButton, 'Le bouton principal de la fiche doit s\'afficher').toBeVisible();
  const nouvelle = (await fiche.mainButton.getAttribute('data-state')) === 'modal';
  test.skip(nouvelle, 'Nouvelle fiche produit (fenêtre « Choose your size ») : pas encore écrit, à faire quand le Roll Out la remontre');
}

test(`Fiche produit · onglets d'information (${produit.id}) @tnr @pdp`, async ({ page, qaEnv, isMobile }, testInfo) => {
  test.skip(qaEnv.name !== 'preprod', 'Produits QA : préprod uniquement');
  const fiche = new ProductPage(page);
  testInfo.annotations.push({ type: 'Produit testé', description: `${produit.id} (${produit.handle})` });

  await etape(page, testInfo, `1. Ouvrir la fiche ${produit.id} : onglets Description, Size & fit, Materials, Shipping and returns, aucun ouvert`, async () => {
    await ouvrirFiche(page, fiche);
    await expect(fiche.infoTabs.first(), 'Les onglets d\'information doivent s\'afficher').toBeVisible();
    const onglets = await fiche.infoTabKeys();
    const attendus = onglets.filter(o => ONGLETS.some(a => a.cle === o.cle));
    expect(attendus.map(o => o.cle), `Les onglets ${ONGLETS.map(a => a.enClair).join(', ')} doivent être proposés, dans cet ordre (trouvés : ${onglets.map(o => o.titre).join(', ')})`)
      .toEqual(ONGLETS.map(a => a.cle));
    for (const a of ONGLETS) {
      expect(attendus.find(o => o.cle === a.cle)!.titre, `Libellé de l'onglet ${a.enClair}`).toMatch(a.libelle);
    }
    const autres = onglets.filter(o => !ONGLETS.some(a => a.cle === o.cle)).map(o => o.titre);
    if (autres.length) testInfo.annotations.push({ type: 'Autres onglets', description: autres.join(', ') });
    // Ancienne fiche : aucun onglet ouvert au chargement, c'est son fonctionnement normal (QA, 14 octobre 2026). Sur
    // ordinateur, la photo du produit (clé « img ») occupe la place des contenus. La fiche TNR, qui attend Description
    // ouverte, décrit la nouvelle fiche.
    await expect.poll(() => fiche.displayedInfoContents(), { message: `Au chargement, aucun onglet ne doit être ouvert${isMobile ? '' : ' : la photo du produit est affichée'}` })
      .toEqual(isMobile ? [] : ['img']);
  });

  for (const [i, onglet] of ONGLETS.entries()) {
    await etape(page, testInfo, `${i + 2}. Ouvrir l'onglet « ${onglet.enClair} » : son contenu seul est affiché`, async () => {
      const titre = fiche.infoTab(onglet.cle);
      await centrer(titre);
      await titre.click();
      await expect(titre, `L'onglet « ${onglet.enClair} » doit être marqué ouvert (aria-expanded)`).toHaveAttribute('aria-expanded', 'true');
      await expect.poll(() => fiche.displayedInfoContents(), { message: `Seul le contenu de « ${onglet.enClair} » doit être affiché` }).toEqual([onglet.cle]);
      expect((await fiche.infoContentText(onglet.cle)).length, `Le contenu de « ${onglet.enClair} » ne doit pas être vide`).toBeGreaterThan(20);
      const ouverts = await fiche.infoTabs.evaluateAll(lis => lis.filter(li => li.getAttribute('aria-expanded') === 'true').length);
      expect(ouverts, 'Un seul onglet doit être marqué ouvert').toBe(1);
    });
  }

  await etape(page, testInfo, `${ONGLETS.length + 2}. Au clavier : Entrée sur « Description » ouvre l'onglet`, async () => {
    const description = fiche.infoTab('description');
    await centrer(description);
    await description.focus();
    await page.keyboard.press('Enter');
    await expect(description, 'Entrée doit ouvrir l\'onglet (aria-expanded)').toHaveAttribute('aria-expanded', 'true');
    await expect.poll(() => fiche.displayedInfoContents(), { message: 'Le contenu de « Description » doit être affiché' }).toEqual(['description']);
  });
});

test(`Fiche produit · guide des tailles (${produit.id}) @tnr @pdp`, async ({ page, qaEnv }, testInfo) => {
  test.skip(qaEnv.name !== 'preprod', 'Produits QA : préprod uniquement');
  const fiche = new ProductPage(page);
  const tailles = [...produit.tailles!.disponibles, ...produit.tailles!.indisponibles];
  testInfo.annotations.push({ type: 'Produit testé', description: `${produit.id} (${produit.handle}) : tailles ${tailles.join(', ')}` });

  await etape(page, testInfo, `1. Ouvrir la fiche ${produit.id} et l'onglet « Size & fit »`, async () => {
    await ouvrirFiche(page, fiche);
    const onglet = fiche.infoTab('details');
    await centrer(onglet);
    await onglet.click();
    await expect.poll(() => fiche.displayedInfoContents(), { message: 'Le contenu de « Size & fit » doit être affiché' }).toEqual(['details']);
  });

  await etape(page, testInfo, `2. Vérifier le guide : un diamètre pour chaque taille (${tailles.join(', ')})`, async () => {
    const texte = await fiche.infoContentText('details');
    testInfo.annotations.push({ type: 'Size & fit', description: texte });
    const sansDiametre = tailles.filter(t => !new RegExp(`(size|taille)\\s*${t}\\s*:\\s*\\d+[.,]\\d+\\s*mm`, 'i').test(texte));
    expect(sansDiametre, `Le guide des tailles doit donner le diamètre de chaque taille vendue. Manquent : ${sansDiametre.join(', ')}`).toEqual([]);
  });
});

const LIBELLE_AJOUT = /Add to (cart|bag)|Ajouter au panier/i;

test(`Fiche produit · double clic sur « Add to cart » : un seul article (${produitFixe('QA01').id}) @tnr @pdp`, async ({ page, qaEnv, isMobile }, testInfo) => {
  test.skip(qaEnv.name !== 'preprod', 'Produits QA : préprod uniquement');
  const enStock = produitFixe('QA01');
  const header = new Header(page, isMobile);
  const fiche = new ProductPage(page);
  testInfo.annotations.push({ type: 'Produit testé', description: `${enStock.id} (${enStock.handle})` });

  await etape(page, testInfo, `1. Ouvrir la fiche ${enStock.id} : bouton « Add to cart »`, async () => {
    await page.goto(`products/${enStock.handle}`, { waitUntil: 'domcontentloaded' });
    await expect(fiche.title, 'Le nom du produit doit s\'afficher').toBeVisible();
    await expect.poll(() => fiche.mainButton.innerText(), { message: 'Le bouton principal doit proposer l\'ajout au panier' }).toMatch(LIBELLE_AJOUT);
  });

  // Fiche TNR PDP-07, cas limite : un client impatient clique deux fois.
  await etape(page, testInfo, '2. Double-cliquer sur « Add to cart » : un seul ajout, quantité 1', async () => {
    const ajouts: string[] = [];
    page.on('request', r => { if (r.method() === 'POST' && /\/cart\/add/.test(r.url())) ajouts.push(r.url()); });
    await centrer(fiche.mainButton);
    await fiche.mainButton.dblclick();
    await expect(fiche.cartNotification, 'La notification « ajouté au panier » doit apparaître').toBeVisible();
    // Un second ajout partirait juste après le premier : on laisse une seconde au thème pour l'envoyer s'il le faisait.
    await page.waitForTimeout(1_500);
    testInfo.annotations.push({ type: 'Ajouts envoyés à Shopify', description: String(ajouts.length) });
    const contenu = await (await appelShopify(page, 'La lecture du panier', () => page.request.get('cart.js'))).json() as { item_count: number };
    expect(contenu.item_count, 'Le double clic ne doit ajouter qu\'un article au panier').toBe(1);
    await expect.poll(() => header.cartCount(), { message: 'Le compteur du panier doit afficher 1' }).toBe(1);
  });
});

test(`Fiche produit · barre d'achat fixe en bas de l'écran sur mobile (${produitFixe('QA01').id}) @tnr @pdp`, async ({ page, qaEnv, isMobile }, testInfo) => {
  test.skip(qaEnv.name !== 'preprod', 'Produits QA : préprod uniquement');
  test.skip(!isMobile, 'Barre d\'achat fixe : mobile seulement');
  const enStock = produitFixe('QA01');
  const header = new Header(page, isMobile);
  const fiche = new ProductPage(page);
  const barre = fiche.stickyBuyBar;
  const hauteurEcran = page.viewportSize()!.height;
  testInfo.annotations.push({ type: 'Produit testé', description: `${enStock.id} (${enStock.handle})` });
  const verifierEnBas = async (moment: string) => {
    await expect(barre, `La barre d'achat doit être affichée (${moment})`).toBeVisible();
    const zone = (await barre.boundingBox())!;
    expect(Math.abs(zone.y + zone.height - hauteurEcran), `La barre d'achat doit être collée au bas de l'écran (${moment})`).toBeLessThanOrEqual(2);
  };

  await etape(page, testInfo, `1. Ouvrir la fiche ${enStock.id} : barre d'achat en bas de l'écran, avec le nom, le prix et « Add to cart »`, async () => {
    const donnees = await fiche.fetchProductData(enStock.handle);
    await page.goto(`products/${enStock.handle}`, { waitUntil: 'domcontentloaded' });
    await verifierEnBas('à l\'ouverture');
    await expect(barre, 'La barre doit rappeler le nom du produit').toContainText(/QA Numéro Un/i);
    await fiche.expectPrice(parsePriceToCents(await barre.innerText()), donnees, 'La barre doit afficher le prix du produit');
    await expect(barre.locator('.cta-primary-add-to-cart'), 'La barre doit proposer l\'ajout au panier').toContainText(LIBELLE_AJOUT);
  });

  await etape(page, testInfo, '2. Faire défiler la page : la barre reste en bas de l\'écran', async () => {
    await page.evaluate(() => window.scrollTo({ top: 800, behavior: 'instant' }));
    await verifierEnBas('après défilement');
  });

  await etape(page, testInfo, '3. Toucher « Add to cart » dans la barre : notification, compteur à 1', async () => {
    await barre.locator('.cta-primary-add-to-cart').click();
    await expect(fiche.cartNotification, 'La notification « ajouté au panier » doit apparaître').toBeVisible();
    await expect.poll(() => header.cartCount(), { message: 'Le compteur du panier doit passer à 1' }).toBe(1);
  });
});
