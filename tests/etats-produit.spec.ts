import { test, expect, etape } from '../src/fixtures';
import { Header } from '../src/pages/header';
import { ProductPage } from '../src/pages/product';
import { CartPage } from '../src/pages/cart';
import { CheckoutPage } from '../src/pages/checkout';
import { produitFixe } from '../src/produits-fixes';
import { parsePriceToCents } from '../src/price';
import { appelShopify } from '../src/shopify';

/**
 * États produit (roadmap phase 2.2), sur les produits QA de la préprod (data/donnees-qa.json).
 * Aucun envoi de formulaire, aucune commande : on peut les lancer à tout moment. Les tests de précommande ajoutent
 * le produit au panier et s'arrêtent à l'arrivée sur le checkout, sans payer.
 */

/** Sur mobile, le header fixe recouvre un bouton amené en haut d'écran : on le centre avant de toucher. */
const centrer = (element: import('@playwright/test').Locator) => element.evaluate(e => e.scrollIntoView({ block: 'center', behavior: 'instant' }));

test.describe('Rupture', () => {
  const produit = produitFixe('QA02');

  test(`Rupture · fiche produit (${produit.id}) @tnr @pdp`, async ({ page, qaEnv, isMobile }, testInfo) => {
    test.skip(qaEnv.name !== 'preprod', 'Produits QA : préprod uniquement');
    const header = new Header(page, isMobile);
    const fiche = new ProductPage(page);
    testInfo.annotations.push({ type: 'Produit testé', description: `${produit.id} (${produit.handle})` });

    await etape(page, testInfo, `1. Ouvrir la fiche du produit en rupture ${produit.id}`, async () => {
      const donnees = await fiche.fetchProductData(produit.handle, { rupture: true });
      await page.goto(`products/${produit.handle}`, { waitUntil: 'domcontentloaded' });
      await expect(fiche.title, 'Le nom du produit doit s\'afficher').toBeVisible();
      await expect(fiche.price, 'Le prix doit rester affiché sur un produit en rupture').toBeVisible();
      await fiche.expectPrice(parsePriceToCents(await fiche.price.innerText()), donnees, 'Le prix affiché doit être celui du produit');
    });

    await etape(page, testInfo, '2. Vérifier le bouton « Être prévenu(e) » à la place de « Ajouter au panier »', async () => {
      // Texte affiché seulement (innerText) : le bouton contient aussi les libellés cachés des autres états.
      await expect.poll(() => fiche.mainButton.innerText(), { message: 'Le bouton principal doit proposer d\'être prévenu du retour en stock' })
        .toMatch(/Notify me|Être prévenu/i);
      await expect(fiche.mainButton, 'Le bouton doit être dans l\'état « rupture » (data-state="disabled")').toHaveAttribute('data-state', 'disabled');
      await expect(fiche.addToCartButton, 'Aucun bouton « Ajouter au panier » ne doit être proposé').toHaveCount(0);
    });

    await etape(page, testInfo, '3. Ouvrir la fenêtre « Être prévenu(e) »', async () => {
      await centrer(fiche.mainButton);
      await fiche.mainButton.click();
      const fenetre = fiche.backInStockModal;
      await expect(fenetre, 'La fenêtre d\'alerte de retour en stock doit s\'ouvrir').toBeVisible();
      await expect(fenetre, 'La fenêtre doit dire qu\'on sera prévenu du retour en stock').toContainText(/back in stock|retour en stock|de nouveau disponible/i);
      await expect(fenetre.getByRole('textbox', { name: /email/i }), 'Le champ email doit être là, vide').toHaveValue('');
      await expect(fenetre.getByRole('button', { name: /Notify me|Être prévenu|M'avertir/i }), 'Le bouton d\'envoi doit être là').toBeVisible();
      // Constat 13 : la case newsletter est cochée par défaut (consentement RGPD non valable). Noté, pas bloquant tant
      // que l'équipe ne l'a pas corrigé : passer en vérification le jour où elle doit être décochée.
      const newsletter = fenetre.getByRole('checkbox', { name: /newsletter/i });
      if (await newsletter.isChecked()) {
        testInfo.annotations.push({ type: 'Constat 13', description: 'Case newsletter de la fenêtre « Être prévenu(e) » cochée par défaut' });
      }
    });

    await etape(page, testInfo, '4. Fermer la fenêtre sans rien envoyer', async () => {
      await fiche.backInStockModal.getByRole('button', { name: /Close modal|Fermer/i }).click();
      await expect(fiche.backInStockModal, 'La fenêtre doit se fermer').toBeHidden();
      expect(await header.cartCount(), 'Le panier doit rester vide').toBe(0);
    });
  });

  test(`Rupture · carte de collection (${produit.id}) @tnr @plp`, async ({ page, qaEnv }, testInfo) => {
    test.skip(qaEnv.name !== 'preprod', 'Produits QA : préprod uniquement');
    const fiche = new ProductPage(page);
    const carte = page.getByRole('main').getByRole('listitem').filter({ has: page.locator(`a[href*="/products/${produit.handle}"]`) });
    const boutonCarte = carte.getByRole('button', { name: /Notify me|Être prévenu/i });

    await etape(page, testInfo, '1. Ouvrir la collection des produits en rupture (C7)', async () => {
      await page.goto('collections/qa-collection-out-of-stock', { waitUntil: 'domcontentloaded' });
      await expect(carte, `La carte de ${produit.id} doit être dans la collection`).toBeVisible();
    });

    await etape(page, testInfo, '2. Vérifier la carte : « Out of stock - Notify me », pas d\'ajout au panier', async () => {
      await expect(carte, 'La carte doit annoncer la rupture').toContainText(/Out of stock|Rupture|Épuisé/i);
      await expect(carte.locator('[data-tracking-state]').first(), 'La carte doit être dans l\'état « rupture »').toHaveAttribute('data-tracking-state', 'disabled');
      await expect(boutonCarte, 'La carte doit proposer d\'être prévenu').toBeVisible();
      await expect(carte.getByRole('button', { name: /Ajouter au panier$|Add to (cart|bag)$/i }), 'La carte ne doit pas proposer d\'ajout au panier').toHaveCount(0);
    });

    await etape(page, testInfo, '3. Ouvrir la fenêtre « Être prévenu(e) » depuis la carte, puis la fermer', async () => {
      await centrer(boutonCarte);
      await boutonCarte.click();
      await expect(fiche.backInStockModal, 'La fenêtre d\'alerte de retour en stock doit s\'ouvrir depuis la carte').toBeVisible();
      await fiche.backInStockModal.getByRole('button', { name: /Close modal|Fermer/i }).click();
      await expect(fiche.backInStockModal, 'La fenêtre doit se fermer').toBeHidden();
    });
  });
});

const MOIS = [
  ['janvier', 'january'], ['février', 'february'], ['mars', 'march'], ['avril', 'april'], ['mai', 'may'], ['juin', 'june'],
  ['juillet', 'july'], ['août', 'august'], ['septembre', 'september'], ['octobre', 'october'], ['novembre', 'november'], ['décembre', 'december'],
];

/**
 * Date d'expédition telle que le thème l'affiche, sans l'année : « Shipping on décembre, 31 » (constat 25),
 * ou en français « 31 décembre ». Accepte le mois en français ou en anglais.
 */
function dateAffichee(dateIso: string): RegExp {
  const [, mois, jour] = dateIso.split('-').map(Number);
  const noms = MOIS[mois - 1].join('|');
  return new RegExp(`(${noms})\\W+0?${jour}\\b|\\b0?${jour}\\W+(${noms})`, 'i');
}

const MENTION_PRECOMMANDE = /Pre-?order|Précommand/i;

test.describe('Précommande', () => {
  const produit = produitFixe('QA05');
  const dateExpedition = produit.datePrecommande!;

  test(`Précommande · de la fiche au checkout (${produit.id}) @tnr @journey`, async ({ page, qaEnv, isMobile }, testInfo) => {
    test.skip(qaEnv.name !== 'preprod', 'Produits QA : préprod uniquement');
    const header = new Header(page, isMobile);
    const fiche = new ProductPage(page);
    const panier = new CartPage(page);
    const checkout = new CheckoutPage(page);
    const date = dateAffichee(dateExpedition);
    testInfo.annotations.push({ type: 'Produit testé', description: `${produit.id} (${produit.handle}), expédition prévue le ${dateExpedition}` });
    let donnees!: Awaited<ReturnType<ProductPage['fetchProductData']>>;

    await etape(page, testInfo, `1. Ouvrir la fiche du produit en précommande ${produit.id}`, async () => {
      donnees = await fiche.fetchProductData(produit.handle);
      await page.goto(`products/${produit.handle}`, { waitUntil: 'domcontentloaded' });
      await expect(fiche.title, 'Le nom du produit doit s\'afficher').toBeVisible();
      await fiche.expectPrice(parsePriceToCents(await fiche.price.innerText()), donnees, 'Le prix affiché doit être celui du produit');
    });

    await etape(page, testInfo, '2. Vérifier le bouton « Précommander » et la date d\'expédition', async () => {
      // Texte affiché seulement (innerText) : le bouton contient aussi les libellés cachés des autres états.
      await expect.poll(() => fiche.mainButton.innerText(), { message: 'Le bouton principal doit proposer de précommander' }).toMatch(MENTION_PRECOMMANDE);
      // Ancienne fiche (vignettes de coloris) : data-state="preorder" ; nouvelle (« Explore all ») : "submit" (Roll Out Shopify).
      expect(['preorder', 'submit'], 'Le bouton doit être dans l\'état « précommande »').toContain(await fiche.mainButton.getAttribute('data-state'));
      await expect(fiche.addToCartButton, 'Aucun bouton « Ajouter au panier » ne doit être proposé à la place').toHaveCount(0);
      const mention = fiche.main.getByText(/Shipping on|Expédition/i).filter({ visible: true }).first();
      await expect(mention, 'La date d\'expédition de la précommande doit être affichée sur la fiche').toBeVisible();
      await expect(mention, `La date d'expédition affichée doit être celle prévue (${dateExpedition})`).toContainText(date);
      // Constat 32 : la barre d'achat qui apparaît au défilement dit « Add to cart » même sur une précommande. Remonté
      // par la QA : noté sans échec, à passer en vérification quand l'équipe l'aura corrigé.
      const barre = (await page.locator('.buy-bar__add-to-cart').first().textContent().catch(() => null))?.replace(/\s+/g, ' ').trim();
      if (barre && !MENTION_PRECOMMANDE.test(barre)) {
        testInfo.annotations.push({ type: 'Constat 32', description: `Barre d'achat au défilement : « ${barre} » sur un produit en précommande` });
      }
    });

    await etape(page, testInfo, '3. Précommander : notification avec la date, compteur du panier à 1', async () => {
      await centrer(fiche.mainButton);
      await fiche.mainButton.click();
      const notification = fiche.cartNotification;
      await expect(notification, 'La notification « ajouté au panier » doit apparaître').toBeVisible();
      await expect(notification, 'La notification doit nommer le produit').toContainText(donnees.title.split(' - ')[0], { ignoreCase: true });
      await expect(notification, 'La notification doit dire qu\'il s\'agit d\'une précommande').toContainText(MENTION_PRECOMMANDE);
      await expect(notification, `La notification doit donner la date d'expédition (${dateExpedition})`).toContainText(date);
      await expect.poll(() => header.cartCount(), { message: 'Le compteur du panier doit passer à 1' }).toBe(1);
    });

    await etape(page, testInfo, '4. Vérifier la ligne du panier : mention précommande, date, prix', async () => {
      await page.goto('cart', { waitUntil: 'domcontentloaded' });
      await panier.expectLoaded();
      await expect(panier.lines, 'Le panier doit contenir une seule ligne').toHaveCount(1);
      const ligne = panier.line(produit.handle);
      await expect(ligne, 'La ligne doit dire qu\'il s\'agit d\'une précommande').toContainText(MENTION_PRECOMMANDE);
      await expect(ligne, `La ligne doit donner la date d'expédition (${dateExpedition})`).toContainText(date);
      await fiche.expectPrice(await panier.subtotalCents(), donnees, 'Le sous-total doit être égal au prix du produit');
      // Ce que le panier transmettra à la commande : propriétés cachées lues par l'équipe et par Shipup.
      const contenu = await (await appelShopify(page, 'La lecture du panier', () => page.request.get('cart.js'))).json() as { items: { handle: string; properties: Record<string, string> | null }[] };
      const proprietes = contenu.items.find(i => i.handle === produit.handle)?.properties ?? {};
      expect(proprietes._is_preorder, 'L\'article du panier doit être marqué comme précommande (_is_preorder)').toBe('true');
      expect(proprietes._preorder_date, 'L\'article du panier doit porter la date de précommande prévue (_preorder_date)').toBe(dateExpedition);
    });

    await etape(page, testInfo, '5. Arriver au checkout, sans payer', async () => {
      await panier.goToCheckout();
      await checkout.expectLoaded();
      await checkout.expectProductInSummary(donnees.title);
      await checkout.expectTotalVisible(donnees.priceCents);
    });
  });

  test(`Précommande · carte de collection (${produit.id}) @tnr @plp`, async ({ page, qaEnv }, testInfo) => {
    test.skip(qaEnv.name !== 'preprod', 'Produits QA : préprod uniquement');
    const carte = page.getByRole('main').getByRole('listitem').filter({ has: page.locator(`a[href*="/products/${produit.handle}"]`) });

    await etape(page, testInfo, '1. Ouvrir la collection QA « titre seul » (C5)', async () => {
      await page.goto('collections/qa-collection-title', { waitUntil: 'domcontentloaded' });
      await expect(carte, `La carte de ${produit.id} doit être dans la collection`).toBeVisible();
    });

    await etape(page, testInfo, '2. Vérifier la carte : précommande, date, bouton « Précommander »', async () => {
      await expect(carte.locator('[data-tracking-state]').first(), 'La carte doit être dans l\'état « précommande »').toHaveAttribute('data-tracking-state', 'preorder');
      // textContent (toContainText) et non innerText : WebKit renvoie un innerText vide pour une carte hors écran.
      await expect(carte, 'La carte doit annoncer la précommande').toContainText(MENTION_PRECOMMANDE);
      await expect(carte, `La carte doit donner la date d'expédition (${dateExpedition})`).toContainText(dateAffichee(dateExpedition));
      await expect(carte.getByRole('button', { name: /Preorder now|Précommander/i }), 'La carte doit proposer de précommander').toBeVisible();
      await expect(carte.getByRole('button', { name: /Ajouter au panier$|Add to (cart|bag)$/i }), 'La carte ne doit pas proposer d\'ajout au panier').toHaveCount(0);
    });
  });
});

test.describe('Tailles', () => {
  const LIBELLE_AJOUT = /Add to (cart|bag)|Ajouter au panier/i;

  /**
   * Le choix de taille est écrit pour l'ancienne fiche (menu « Select size »), seule servie par le Roll Out le
   * 13 octobre 2026. La nouvelle (fenêtre « Choose your size », data-state="modal") reste à relever.
   */
  const passerSiNouvelleFiche = async (fiche: ProductPage) => {
    const nouvelle = (await fiche.mainButton.getAttribute('data-state')) === 'modal';
    test.skip(nouvelle, 'Nouvelle fiche produit (fenêtre « Choose your size ») : choix de taille pas encore écrit, à faire quand le Roll Out la remontre');
  };

  const ouvrirFiche = async (page: import('@playwright/test').Page, fiche: ProductPage, handle: string) => {
    const donnees = await fiche.fetchProductData(handle);
    await page.goto(`products/${handle}`, { waitUntil: 'domcontentloaded' });
    await expect(fiche.title, 'Le nom du produit doit s\'afficher').toBeVisible();
    await expect(fiche.mainButton, 'Le bouton principal de la fiche doit s\'afficher').toBeVisible();
    await passerSiNouvelleFiche(fiche);
    return donnees;
  };

  test(`Tailles · choisir une taille disponible (${produitFixe('QA10').id}) @tnr @pdp`, async ({ page, qaEnv, isMobile }, testInfo) => {
    test.skip(qaEnv.name !== 'preprod', 'Produits QA : préprod uniquement');
    const produit = produitFixe('QA10');
    const { disponibles, indisponibles } = produit.tailles!;
    const [epuisee] = indisponibles;
    const choisie = disponibles[disponibles.length - 1];
    const header = new Header(page, isMobile);
    const fiche = new ProductPage(page);
    testInfo.annotations.push({ type: 'Produit testé', description: `${produit.id} (${produit.handle}) : tailles ${disponibles.join(', ')} en stock, ${indisponibles.join(', ')} épuisées` });
    let donnees!: Awaited<ReturnType<ProductPage['fetchProductData']>>;

    await etape(page, testInfo, `1. Ouvrir la fiche du produit à tailles ${produit.id} : aucune taille choisie`, async () => {
      donnees = await ouvrirFiche(page, fiche, produit.handle);
      await expect(fiche.mainButton, 'Tant qu\'aucune taille n\'est choisie, le bouton doit être inactif').toHaveAttribute('data-state', 'inactive');
      await expect(fiche.sizeSelector, 'Le menu des tailles doit inviter à choisir une taille').toContainText(/Select size|Choisi\w* (votre|une) taille/i);
      expect(await fiche.selectedVariantId(), 'Aucune taille ne doit être choisie d\'office').toBe('0');
    });

    await etape(page, testInfo, '2. Ouvrir le menu des tailles : tailles en stock proposées, tailles épuisées marquées « Notify me »', async () => {
      await centrer(fiche.sizeSelector);
      await fiche.sizeSelector.click();
      for (const taille of disponibles) {
        await expect(fiche.sizeOption(taille), `La taille ${taille} (en stock) doit être proposée`).toBeVisible();
        await expect(fiche.sizeOption(taille), `La taille ${taille} (en stock) ne doit pas être grisée`).not.toHaveAttribute('disabled');
      }
      for (const taille of indisponibles) {
        await expect(fiche.sizeOption(taille), `La taille ${taille} (épuisée) doit être grisée`).toHaveAttribute('disabled', 'true');
        await expect(fiche.sizeOption(taille), `La taille ${taille} (épuisée) doit proposer d'être prévenu`).toContainText(/Notify me|Être prévenu/i);
      }
    });

    await etape(page, testInfo, `3. Toucher la taille épuisée ${epuisee} : elle ne se sélectionne pas`, async () => {
      await fiche.sizeOption(epuisee).click();
      expect(await fiche.selectedVariantId(), `La taille épuisée ${epuisee} ne doit pas pouvoir être choisie`).toBe('0');
      await expect(fiche.mainButton, 'Le bouton doit rester inactif').toHaveAttribute('data-state', 'inactive');
    });

    await etape(page, testInfo, `4. Choisir la taille ${choisie} : le bouton « Add to cart » s'active`, async () => {
      const variante = donnees.variants.find(v => v.option1 === choisie)!;
      await fiche.chooseSize(choisie);
      await expect(fiche.sizeSelector, `Le menu doit afficher la taille choisie (${choisie})`).toContainText(choisie);
      expect(await fiche.selectedVariantId(), `La variante envoyée au panier doit être celle de la taille ${choisie}`).toBe(String(variante.id));
      await expect(fiche.mainButton, 'Le bouton ne doit plus être inactif').not.toHaveAttribute('data-state', 'inactive');
      await expect.poll(() => fiche.mainButton.innerText(), { message: 'Le bouton doit proposer d\'ajouter au panier' }).toMatch(LIBELLE_AJOUT);
    });

    await etape(page, testInfo, `5. Ajouter au panier : notification avec la taille ${choisie}, compteur à 1`, async () => {
      await centrer(fiche.mainButton);
      await fiche.mainButton.click();
      await expect(fiche.cartNotification, 'La notification « ajouté au panier » doit apparaître').toBeVisible();
      await expect(fiche.cartNotification, `La notification doit donner la taille choisie (${choisie})`).toContainText(new RegExp(`(Size|Taille)\\s*:?\\s*${choisie}\\b`, 'i'));
      await expect.poll(() => header.cartCount(), { message: 'Le compteur du panier doit passer à 1' }).toBe(1);
      const contenu = await (await appelShopify(page, 'La lecture du panier', () => page.request.get('cart.js'))).json() as { items: { variant_id: number; quantity: number }[] };
      const variante = donnees.variants.find(v => v.option1 === choisie)!;
      expect(contenu.items.map(i => i.variant_id), `Le panier doit contenir la taille ${choisie}, et elle seule`).toEqual([variante.id]);
    });
  });

  test(`Tailles · une taille en précommande (${produitFixe('QA12').id}) @tnr @pdp`, async ({ page, qaEnv }, testInfo) => {
    test.skip(qaEnv.name !== 'preprod', 'Produits QA : préprod uniquement');
    const produit = produitFixe('QA12');
    const [[tailleEnPrecommande, dateExpedition]] = Object.entries(produit.precommandeParTaille!);
    const tailleEnStock = produit.tailles!.disponibles.find(t => t !== tailleEnPrecommande)!;
    const fiche = new ProductPage(page);
    const mention = fiche.main.getByText(/Shipping on|Expédition/i).filter({ visible: true });
    testInfo.annotations.push({ type: 'Produit testé', description: `${produit.id} (${produit.handle}) : taille ${tailleEnPrecommande} en précommande (expédition le ${dateExpedition})` });

    await etape(page, testInfo, `1. Ouvrir la fiche ${produit.id} et le menu des tailles : ${tailleEnPrecommande} marquée « Pre-order »`, async () => {
      await ouvrirFiche(page, fiche, produit.handle);
      await centrer(fiche.sizeSelector);
      await fiche.sizeSelector.click();
      await expect(fiche.sizeOption(tailleEnPrecommande), `La taille ${tailleEnPrecommande} doit être marquée en précommande`).toContainText(MENTION_PRECOMMANDE);
      await expect(fiche.sizeOption(tailleEnStock), `La taille ${tailleEnStock} (en stock) ne doit pas être marquée en précommande`).not.toContainText(MENTION_PRECOMMANDE);
    });

    await etape(page, testInfo, `2. Choisir ${tailleEnPrecommande} : bouton « Preorder now » et date d'expédition`, async () => {
      await fiche.chooseSize(tailleEnPrecommande);
      await expect.poll(() => fiche.mainButton.innerText(), { message: 'Le bouton doit proposer de précommander' }).toMatch(MENTION_PRECOMMANDE);
      await expect(fiche.mainButton, 'Le bouton doit être dans l\'état « précommande »').toHaveAttribute('data-state', 'preorder');
      await expect(mention.first(), `La date d'expédition prévue (${dateExpedition}) doit s'afficher`).toContainText(dateAffichee(dateExpedition));
    });

    await etape(page, testInfo, `3. Choisir ${tailleEnStock} : retour à « Add to cart », sans date d'expédition`, async () => {
      await fiche.chooseSize(tailleEnStock);
      await expect.poll(() => fiche.mainButton.innerText(), { message: 'Le bouton doit de nouveau proposer d\'ajouter au panier' }).toMatch(LIBELLE_AJOUT);
      await expect(fiche.mainButton, 'Le bouton ne doit plus être en précommande').not.toHaveAttribute('data-state', 'preorder');
      await expect(mention, 'La date d\'expédition de la précommande ne doit plus s\'afficher').toHaveCount(0);
    });
  });

  test(`Tailles · toutes les tailles épuisées (${produitFixe('QA11').id}) @tnr @pdp`, async ({ page, qaEnv }, testInfo) => {
    test.skip(qaEnv.name !== 'preprod', 'Produits QA : préprod uniquement');
    const produit = produitFixe('QA11');
    const fiche = new ProductPage(page);
    testInfo.annotations.push({ type: 'Produit testé', description: `${produit.id} (${produit.handle}) : toutes les tailles à 0` });

    await etape(page, testInfo, `1. Ouvrir la fiche ${produit.id} : « Notify me » à la place de l'ajout au panier`, async () => {
      await page.goto(`products/${produit.handle}`, { waitUntil: 'domcontentloaded' });
      await expect(fiche.title, 'Le nom du produit doit s\'afficher').toBeVisible();
      await expect.poll(() => fiche.mainButton.innerText(), { message: 'Le bouton principal doit proposer d\'être prévenu du retour en stock' }).toMatch(/Notify me|Être prévenu/i);
      await expect(fiche.mainButton, 'Le bouton doit être dans l\'état « rupture » (data-state="disabled")').toHaveAttribute('data-state', 'disabled');
      await expect(fiche.addToCartButton, 'Aucun bouton « Ajouter au panier » ne doit être proposé').toHaveCount(0);
    });
  });
});
