import { test, expect, etape } from '../src/fixtures';
import { Header } from '../src/pages/header';
import { ProductPage } from '../src/pages/product';
import { CartPage } from '../src/pages/cart';
import { CheckoutPage } from '../src/pages/checkout';
import { produitFixe } from '../src/produits-fixes';
import { formatCents, parsePriceToCents } from '../src/price';
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
      expect(parsePriceToCents(await fiche.price.innerText()), `Le prix affiché doit être ${formatCents(donnees.priceCents)}`).toBe(donnees.priceCents);
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
      expect(parsePriceToCents(await fiche.price.innerText()), `Le prix affiché doit être ${formatCents(donnees.priceCents)}`).toBe(donnees.priceCents);
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
      expect(await panier.subtotalCents(), 'Le sous-total doit être égal au prix du produit').toBe(donnees.priceCents);
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
