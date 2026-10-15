import { test, expect, etape, pourChaqueFiche } from '../src/fixtures';
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
 * Chaque test tourne sur les deux fiches du Roll Out (src/fiches.ts) :
 * - ancienne : onglets Description | Size & fit | Materials | Shipping and returns, aucun ouvert au chargement, guide
 *   des tailles dans « Size & fit » ;
 * - nouvelle : onglets Description | Details | Composition | Shipping & Return, Description ouvert, diamètres dans
 *   « Details » et guide des tailles dans la fenêtre « Choose your size ».
 */

/** Onglets attendus de l'ancienne fiche, par clé du thème (data-item), avec leur libellé FR ou EN. « Size & fit » a la clé details. */
const ONGLETS: { cle: string; libelle: RegExp; enClair: string }[] = [
  { cle: 'description', libelle: /^Description$/i, enClair: 'Description' },
  { cle: 'details', libelle: /^(Size & fit|Taille et coupe|Dimensions)$/i, enClair: 'Size & fit' },
  { cle: 'materials', libelle: /^(Materials|Matières)$/i, enClair: 'Materials' },
  { cle: 'shipping', libelle: /^(Shipping and returns|Livraisons? (&|et) retours)$/i, enClair: 'Shipping and returns' },
];

/** Onglets attendus de la nouvelle fiche (rôle tab), avec leur libellé FR ou EN, dans l'ordre. */
const ONGLETS_NOUVELLE: { libelle: RegExp; enClair: string }[] = [
  { libelle: /^Description$/i, enClair: 'Description' },
  { libelle: /^(Details|Détails)$/i, enClair: 'Details' },
  { libelle: /^(Composition|Matières)$/i, enClair: 'Composition' },
  { libelle: /^(Shipping & Returns?|Livraisons? (&|et) retours?)$/i, enClair: 'Shipping & Return' },
];

/** Diamètre d'une taille dans le texte de la fiche : « Size 50: 15.92 mm » (ancienne), « Size 50 diameter: 15.92 mm » (nouvelle). */
const diametre = (taille: string) => new RegExp(`(size|taille)\\s*${taille}\\s*(diameter|diamètre)?\\s*:\\s*(\\d+[.,]\\d+)\\s*mm`, 'i');

/** Sur mobile, le header fixe recouvre un élément amené en haut d'écran : on le centre avant de toucher. */
const centrer = (element: import('@playwright/test').Locator) => element.evaluate(e => e.scrollIntoView({ block: 'center', behavior: 'instant' }));

const produit = produitFixe('QA09');
const tailles = [...produit.tailles!.disponibles, ...produit.tailles!.indisponibles];

async function ouvrirFiche(fiche: ProductPage) {
  await fiche.goto(produit.handle);
  await expect(fiche.mainButton, 'Le bouton principal de la fiche doit s\'afficher').toBeVisible();
}

const LIBELLE_AJOUT = /Add to (cart|bag)|Ajouter au panier/i;

pourChaqueFiche(version => {
  if (version === 'ancienne') {
    test(`Fiche produit · onglets d'information (${produit.id}) @tnr @pdp`, async ({ page, qaEnv, isMobile }, testInfo) => {
      test.skip(qaEnv.name !== 'preprod', 'Produits QA : préprod uniquement');
      const fiche = new ProductPage(page);
      testInfo.annotations.push({ type: 'Produit testé', description: `${produit.id} (${produit.handle})` });

      await etape(page, testInfo, `1. Ouvrir la fiche ${produit.id} : onglets Description, Size & fit, Materials, Shipping and returns, aucun ouvert`, async () => {
        await ouvrirFiche(fiche);
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
      testInfo.annotations.push({ type: 'Produit testé', description: `${produit.id} (${produit.handle}) : tailles ${tailles.join(', ')}` });

      await etape(page, testInfo, `1. Ouvrir la fiche ${produit.id} et l'onglet « Size & fit »`, async () => {
        await ouvrirFiche(fiche);
        const onglet = fiche.infoTab('details');
        await centrer(onglet);
        await onglet.click();
        await expect.poll(() => fiche.displayedInfoContents(), { message: 'Le contenu de « Size & fit » doit être affiché' }).toEqual(['details']);
      });

      await etape(page, testInfo, `2. Vérifier le guide : un diamètre pour chaque taille (${tailles.join(', ')})`, async () => {
        const texte = await fiche.infoContentText('details');
        testInfo.annotations.push({ type: 'Size & fit', description: texte });
        const sansDiametre = tailles.filter(t => !diametre(t).test(texte));
        expect(sansDiametre, `Le guide des tailles doit donner le diamètre de chaque taille vendue. Manquent : ${sansDiametre.join(', ')}`).toEqual([]);
      });
    });
  } else {
    test(`Fiche produit · onglets d'information (${produit.id}) @tnr @pdp`, async ({ page, qaEnv }, testInfo) => {
      test.skip(qaEnv.name !== 'preprod', 'Produits QA : préprod uniquement');
      const fiche = new ProductPage(page);
      const libelles = () => fiche.tabs.evaluateAll(tabs => tabs.map(t => (t.textContent ?? '').replace(/\s+/g, ' ').trim()));
      const onglet = (libelle: RegExp) => fiche.tabs.filter({ hasText: new RegExp(libelle.source.replace(/^\^|\$$/g, ''), 'i') }).first();
      testInfo.annotations.push({ type: 'Produit testé', description: `${produit.id} (${produit.handle})` });

      await etape(page, testInfo, `1. Ouvrir la fiche ${produit.id} : onglets ${ONGLETS_NOUVELLE.map(o => o.enClair).join(', ')}, Description ouvert`, async () => {
        await ouvrirFiche(fiche);
        await expect(fiche.tabs.first(), 'Les onglets d\'information doivent s\'afficher').toBeVisible();
        const trouves = await libelles();
        const attendus = trouves.filter(t => ONGLETS_NOUVELLE.some(o => o.libelle.test(t)));
        expect(attendus.length, `Les onglets ${ONGLETS_NOUVELLE.map(o => o.enClair).join(', ')} doivent être proposés (trouvés : ${trouves.join(', ')})`).toBe(ONGLETS_NOUVELLE.length);
        ONGLETS_NOUVELLE.forEach((o, i) => expect(attendus[i], `Onglet n° ${i + 1} : ${o.enClair}`).toMatch(o.libelle));
        const autres = trouves.filter(t => !ONGLETS_NOUVELLE.some(o => o.libelle.test(t)));
        // Constat 50 : onglet « GOLDEN DATA TEST » en préprod, visible des clients.
        if (autres.length) testInfo.annotations.push({ type: 'Autres onglets', description: autres.join(', ') });
        // Fiche TNR PDP-09 : Description ouvert au chargement.
        await expect(onglet(ONGLETS_NOUVELLE[0].libelle), 'Au chargement, Description doit être ouvert').toHaveAttribute('aria-selected', 'true');
        await expect(fiche.tabPanels, 'Un seul contenu d\'onglet doit être affiché').toHaveCount(1);
      });

      for (const [i, o] of ONGLETS_NOUVELLE.entries()) {
        await etape(page, testInfo, `${i + 2}. Ouvrir l'onglet « ${o.enClair} » : son contenu seul est affiché`, async () => {
          const titre = onglet(o.libelle);
          await centrer(titre);
          await titre.click();
          await expect(titre, `L'onglet « ${o.enClair} » doit être marqué ouvert (aria-selected)`).toHaveAttribute('aria-selected', 'true');
          await expect(fiche.tabPanels, `Seul le contenu de « ${o.enClair} » doit être affiché`).toHaveCount(1);
          await expect(fiche.tabPanels, `Le contenu affiché doit être celui de « ${o.enClair} »`).toHaveAttribute('id', (await titre.getAttribute('aria-controls'))!);
          expect(((await fiche.tabPanels.innerText()) ?? '').trim().length, `Le contenu de « ${o.enClair} » ne doit pas être vide`).toBeGreaterThan(20);
          const selectionnes = await fiche.tabs.evaluateAll(tabs => tabs.filter(t => t.getAttribute('aria-selected') === 'true').length);
          expect(selectionnes, 'Un seul onglet doit être marqué ouvert').toBe(1);
        });
      }

      await etape(page, testInfo, `${ONGLETS_NOUVELLE.length + 2}. Au clavier : Entrée sur « Description » ouvre l'onglet`, async () => {
        const description = onglet(ONGLETS_NOUVELLE[0].libelle);
        await centrer(description);
        await description.focus();
        await page.keyboard.press('Enter');
        await expect(description, 'Entrée doit ouvrir l\'onglet (aria-selected)').toHaveAttribute('aria-selected', 'true');
        await expect(fiche.tabPanels, 'Le contenu de « Description » doit être affiché').toHaveAttribute('id', (await description.getAttribute('aria-controls'))!);
      });
    });

    test(`Fiche produit · guide des tailles (${produit.id}) @tnr @pdp`, async ({ page, qaEnv }, testInfo) => {
      test.skip(qaEnv.name !== 'preprod', 'Produits QA : préprod uniquement');
      const fiche = new ProductPage(page);
      const diametres: Record<string, string> = {};
      testInfo.annotations.push({ type: 'Produit testé', description: `${produit.id} (${produit.handle}) : tailles ${tailles.join(', ')}` });

      await etape(page, testInfo, `1. Ouvrir la fiche ${produit.id} et l'onglet « Details » : un diamètre pour chaque taille (${tailles.join(', ')})`, async () => {
        await ouvrirFiche(fiche);
        const details = fiche.tabs.filter({ hasText: /Details|Détails/i }).first();
        await centrer(details);
        await details.click();
        await expect(details, 'L\'onglet « Details » doit s\'ouvrir').toHaveAttribute('aria-selected', 'true');
        const texte = ((await fiche.tabPanels.innerText()) ?? '').replace(/\s+/g, ' ').trim();
        testInfo.annotations.push({ type: 'Details', description: texte });
        for (const t of tailles) {
          const mm = texte.match(diametre(t))?.[3];
          if (mm) diametres[t] = mm.replace(',', '.');
        }
        const sansDiametre = tailles.filter(t => !diametres[t]);
        expect(sansDiametre, `L'onglet « Details » doit donner le diamètre de chaque taille vendue. Manquent : ${sansDiametre.join(', ')}`).toEqual([]);
      });

      await etape(page, testInfo, '2. Ouvrir « Choose your size » : le guide des tailles donne les mêmes diamètres', async () => {
        await fiche.openSizeModal();
        const guide = fiche.sizeModal.getByRole('table').filter({ visible: true }).first();
        await expect(guide, 'La fenêtre des tailles doit contenir le guide des tailles').toBeVisible();
        const texte = ((await guide.innerText()) ?? '').replace(/\s+/g, ' ').trim();
        testInfo.annotations.push({ type: 'Guide des tailles', description: texte });
        // Une colonne par unité (cm, inch, fr, mm…), chacune dans son propre tableau. Colonne « mm » : un diamètre par
        // taille, dans l'ordre des tailles (15,92 mm en prod, 15.92 mm en préprod).
        const colonneMm = guide.getByRole('table').filter({ has: page.getByRole('columnheader', { name: /^mm$/i }) }).first();
        const enMm = (await colonneMm.getByRole('cell').allTextContents()).map(t => Number(t.replace(/mm/i, '').replace(',', '.').trim()));
        const attendus = [...tailles].sort().map(t => Number(diametres[t]));
        expect(enMm, `Le guide doit donner les diamètres de l'onglet « Details » (${attendus.join(', ')} mm)`).toEqual(attendus);
        await fiche.sizeModal.getByRole('button', { name: /Close modal|Fermer/i }).first().click();
        await expect(fiche.sizeModal, 'La fenêtre des tailles doit se fermer').toBeHidden();
      });
    });
  }

  test(`Fiche produit · double clic sur « Add to cart » : un seul article (${produitFixe('QA01').id}) @tnr @pdp`, async ({ page, qaEnv, isMobile }, testInfo) => {
    test.skip(qaEnv.name !== 'preprod', 'Produits QA : préprod uniquement');
    const enStock = produitFixe('QA01');
    const header = new Header(page, isMobile);
    const fiche = new ProductPage(page);
    testInfo.annotations.push({ type: 'Produit testé', description: `${enStock.id} (${enStock.handle})` });

    await etape(page, testInfo, `1. Ouvrir la fiche ${enStock.id} : bouton « Add to cart »`, async () => {
      await fiche.goto(enStock.handle);
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

  // Les deux fiches ont une barre d'achat fixée en bas de l'écran sur mobile, dès l'ouverture : celle de l'ancienne
  // rappelle le nom et le prix, celle de la nouvelle n'a que le bouton (prod et préprod, 15 octobre 2026).
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
    const contenu = version === 'ancienne' ? 'avec le nom, le prix et « Add to cart »' : 'avec « Add to cart »';

    await etape(page, testInfo, `1. Ouvrir la fiche ${enStock.id} : barre d'achat en bas de l'écran, ${contenu}`, async () => {
      const donnees = await fiche.fetchProductData(enStock.handle);
      await fiche.goto(enStock.handle);
      await verifierEnBas('à l\'ouverture');
      if (version === 'ancienne') {
        await expect(barre, 'La barre doit rappeler le nom du produit').toContainText(/QA Numéro Un/i);
        await fiche.expectPrice(parsePriceToCents(await barre.innerText()), donnees, 'La barre doit afficher le prix du produit');
      }
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
});
