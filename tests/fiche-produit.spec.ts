import { test, expect, etape } from '../src/fixtures';
import { ProductPage } from '../src/pages/product';
import { produitFixe } from '../src/produits-fixes';

/**
 * Fiche produit (roadmap phase 2.2, fiches TNR PDP-09 « onglets » et PDP-06 « guide des tailles »), sur le bijou à
 * tailles QA09 de la préprod. Aucun ajout au panier, aucune commande : on peut les lancer à tout moment.
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
