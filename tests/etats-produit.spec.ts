import type { Locator, Page } from '@playwright/test';
import { test, expect, etape, pourChaqueFiche } from '../src/fixtures';
import { Header } from '../src/pages/header';
import { ProductPage } from '../src/pages/product';
import { CartPage } from '../src/pages/cart';
import { CheckoutPage } from '../src/pages/checkout';
import { CollectionPage } from '../src/pages/collection';
import { DONNEES_QA, produitFixe } from '../src/produits-fixes';
import { formatCents, parsePriceToCents } from '../src/price';
import { appelShopify } from '../src/shopify';
import { verifierLargeur } from '../src/controles';

/**
 * États produit (roadmap phase 2.2), sur les produits QA de la préprod (data/donnees-qa.json).
 * Aucun envoi de formulaire, aucune commande : on peut les lancer à tout moment. Les tests de précommande ajoutent
 * le produit au panier et s'arrêtent à l'arrivée sur le checkout, sans payer.
 *
 * Les tests de la fiche tournent sur les deux fiches du Roll Out (src/fiches.ts) : « Ancienne fiche › … » et
 * « Nouvelle fiche › … ». Elles diffèrent surtout pour les tailles (menu « Select size » contre fenêtre « Choose your
 * size ») et les coloris (vignettes contre carrousel et « Explore all »).
 */

/** Sur mobile, le header fixe recouvre un bouton amené en haut d'écran : on le centre avant de toucher. */
const centrer = (element: Locator) => element.evaluate(e => e.scrollIntoView({ block: 'center', behavior: 'instant' }));

/**
 * Fenêtres d'inscription (« Être prévenu(e) », « Coming soon ») : un envoi sans email puis avec « test@ » doit afficher
 * « Please type a valid e-mail » et ne rien envoyer. La fenêtre reste ouverte, sans message de réussite.
 */
async function verifierEmailRefuse(page: Page, fenetre: Locator, envoyer: Locator) {
  const envois: string[] = [];
  const noter = (r: import('@playwright/test').Request) => { if (r.method() === 'POST' && /klaviyo|subscri|back.?in.?stock|notify|coming/i.test(r.url())) envois.push(r.url().split('?')[0]); };
  page.on('request', noter);
  const erreur = fenetre.getByText(/type a valid e-?mail|adresse e-?mail valide/i).filter({ visible: true });
  const email = fenetre.getByRole('textbox', { name: /email/i });
  await expect(email, 'Le champ email doit être vide à l\'ouverture').toHaveValue('');
  await envoyer.click();
  await expect(erreur, 'Sans email, la fenêtre doit demander une adresse valide').toBeVisible();
  await email.fill('test@');
  await envoyer.click();
  await expect(erreur, 'Avec « test@ », la fenêtre doit demander une adresse valide').toBeVisible();
  await expect(fenetre, 'La fenêtre doit rester ouverte').toBeVisible();
  await expect(fenetre, 'Aucun message de réussite ne doit s\'afficher').not.toContainText(/we will (let you know|notify)|nous vous tiendrons|thank you|merci/i);
  page.off('request', noter);
  expect(envois, 'Aucune inscription ne doit partir avec une adresse invalide').toEqual([]);
}

test.describe('Rupture', () => {
  const produit = produitFixe('QA02');

  pourChaqueFiche(() => {
    // Ancienne fiche : en échec à l'étape 3 depuis le 13 octobre 2026 (constat 33, bug confirmé).
    test(`Rupture · fiche produit (${produit.id}) @tnr @pdp`, async ({ page, qaEnv, isMobile }, testInfo) => {
      test.skip(qaEnv.name !== 'preprod', 'Produits QA : préprod uniquement');
      const header = new Header(page, isMobile);
      const fiche = new ProductPage(page);
      testInfo.annotations.push({ type: 'Produit testé', description: `${produit.id} (${produit.handle})` });

      await etape(page, testInfo, `1. Ouvrir la fiche du produit en rupture ${produit.id}`, async () => {
        const donnees = await fiche.fetchProductData(produit.handle, { rupture: true });
        await fiche.goto(produit.handle);
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

    await etape(page, testInfo, '3. Ouvrir la fenêtre « Être prévenu(e) » depuis la carte', async () => {
      await centrer(boutonCarte);
      await boutonCarte.click();
      await expect(fiche.backInStockModal, 'La fenêtre d\'alerte de retour en stock doit s\'ouvrir depuis la carte').toBeVisible();
    });

    // Fiches TNR PLP-07 et PDP-08 : message d'adresse invalide. Rien ne part : le thème refuse avant tout envoi, et
    // Klaviyo, qui recevrait l'inscription, est bloqué pendant les tests.
    await etape(page, testInfo, '4. Envoyer sans email, puis avec « test@ » : « Please type a valid e-mail », rien n\'est envoyé', async () => {
      const fenetre = fiche.backInStockModal;
      await verifierEmailRefuse(page, fenetre, fenetre.getByRole('button', { name: /Notify me|Être prévenu|M'avertir/i }));
    });

    await etape(page, testInfo, '5. Fermer la fenêtre', async () => {
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
const MENTION_EXPEDITION = /Shipping on|Expédition/i;
const LIBELLE_AJOUT = /Add to (cart|bag)|Ajouter au panier/i;

test.describe('Précommande', () => {
  const produit = produitFixe('QA05');
  const dateExpedition = produit.datePrecommande!;

  pourChaqueFiche(() => test(`Précommande · de la fiche au checkout (${produit.id}) @tnr @journey`, async ({ page, qaEnv, isMobile }, testInfo) => {
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
      await fiche.goto(produit.handle);
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
  }));

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

/** Tailles : ouvre la fiche et renvoie les données du produit (variantes, prix). */
async function ouvrirFicheATailles(fiche: ProductPage, handle: string, { rupture = false } = {}) {
  const donnees = await fiche.fetchProductData(handle, { rupture });
  await fiche.goto(handle);
  await expect(fiche.mainButton, 'Le bouton principal de la fiche doit s\'afficher').toBeVisible();
  return donnees;
}

/** Tailles, ancienne fiche : menu « Select size » (liste maison au-dessus d'un select caché). */
test.describe('Ancienne fiche', () => {
  test.use({ fiche: 'ancienne' });
  const ouvrirFiche = (_page: Page, fiche: ProductPage, handle: string) => ouvrirFicheATailles(fiche, handle);

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
        expect(await fiche.sizeOptionDisabled(taille), `La taille ${taille} (en stock) ne doit pas être grisée`).toBe(false);
      }
      for (const taille of indisponibles) {
        expect(await fiche.sizeOptionDisabled(taille), `La taille ${taille} (épuisée) doit être grisée`).toBe(true);
        await expect(fiche.sizeOption(taille), `La taille ${taille} (épuisée) doit proposer d'être prévenu`).toContainText(/Notify me|Être prévenu/i);
      }
    });

    await etape(page, testInfo, `3. Toucher la taille épuisée ${epuisee} : elle ne se sélectionne pas`, async () => {
      // force : depuis le 15 octobre 2026, la taille épuisée est marquée aria-disabled et Playwright refuserait de
      // la toucher. On la touche quand même, comme le ferait une cliente.
      await fiche.sizeOption(epuisee).click({ force: true });
      // Depuis le 15 octobre 2026, toucher la taille épuisée ouvre aussi la fenêtre « Être prévenu(e) ». On la referme.
      if (await fiche.backInStockModal.waitFor({ timeout: 3_000 }).then(() => true, () => false)) {
        testInfo.annotations.push({ type: 'Taille épuisée', description: `Toucher ${epuisee} ouvre la fenêtre « Être prévenu(e) »` });
        await fiche.backInStockModal.getByRole('button', { name: /Close modal|Fermer/i }).click();
        await expect(fiche.backInStockModal, 'La fenêtre « Être prévenu(e) » doit se fermer').toBeHidden();
      }
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
      await fiche.goto(produit.handle);
      await expect.poll(() => fiche.mainButton.innerText(), { message: 'Le bouton principal doit proposer d\'être prévenu du retour en stock' }).toMatch(/Notify me|Être prévenu/i);
      await expect(fiche.mainButton, 'Le bouton doit être dans l\'état « rupture » (data-state="disabled")').toHaveAttribute('data-state', 'disabled');
      await expect(fiche.addToCartButton, 'Aucun bouton « Ajouter au panier » ne doit être proposé').toHaveCount(0);
    });
  });
});

/**
 * Tailles, nouvelle fiche : le bouton principal « Choose your size » (data-state="modal") ouvre une fenêtre, une case
 * radio par taille (« 52 Out of stock », « M Pre-order »). Une taille épuisée se coche, et le bouton de la fenêtre
 * devient « Notify me » ; l'ancienne fiche, elle, refuse de la sélectionner.
 */
test.describe('Nouvelle fiche', () => {
  test.use({ fiche: 'nouvelle' });
  const LIBELLE_TAILLES = /Choose your size|Choisi\w* (votre|une) taille|Sélectionner une taille/i;
  const EPUISEE = /Out of stock|Épuisé|Rupture/i;

  const ouvrirFenetre = async (fiche: ProductPage) => {
    await expect(fiche.mainButton, 'Le bouton principal doit ouvrir la fenêtre des tailles (data-state="modal")').toHaveAttribute('data-state', 'modal');
    await expect.poll(() => fiche.mainButton.innerText(), { message: 'Le bouton principal doit inviter à choisir une taille' }).toMatch(LIBELLE_TAILLES);
    await fiche.openSizeModal();
  };

  test(`Tailles · choisir une taille disponible (${produitFixe('QA10').id}) @tnr @pdp`, async ({ page, qaEnv, isMobile }, testInfo) => {
    test.skip(qaEnv.name !== 'preprod', 'Produits QA : préprod uniquement');
    const produit = produitFixe('QA10');
    const { disponibles, indisponibles } = produit.tailles!;
    const [epuisee] = indisponibles;
    const choisie = disponibles[disponibles.length - 1];
    const header = new Header(page, isMobile);
    const fiche = new ProductPage(page);
    // Le message affiché sous les tailles ; le même texte est aussi annoncé aux lecteurs d'écran (role=alert, caché).
    const erreur = fiche.sizeModal.locator('[data-ref="error-no-size-selected"]').filter({ hasText: /Please select a size|(Sélectionnez|Choisissez) une taille/i });
    testInfo.annotations.push({ type: 'Produit testé', description: `${produit.id} (${produit.handle}) : tailles ${disponibles.join(', ')} en stock, ${indisponibles.join(', ')} épuisées` });
    let donnees!: Awaited<ReturnType<ProductPage['fetchProductData']>>;

    await etape(page, testInfo, `1. Ouvrir la fiche du produit à tailles ${produit.id} : bouton « Choose your size », pas d'ajout direct`, async () => {
      donnees = await ouvrirFicheATailles(fiche, produit.handle);
      await expect(fiche.addToCartButton, 'Aucun bouton « Ajouter au panier » ne doit être proposé avant le choix d\'une taille').toHaveCount(0);
    });

    await etape(page, testInfo, '2. Ouvrir la fenêtre des tailles : tailles en stock proposées, tailles épuisées marquées « Out of stock », aucune cochée', async () => {
      await ouvrirFenetre(fiche);
      for (const taille of disponibles) {
        await expect(fiche.sizeRadio(taille), `La taille ${taille} (en stock) doit être proposée, sans mention de rupture`).toHaveAccessibleName(new RegExp(`^${taille}$`));
        await expect(fiche.sizeRadio(taille), `La taille ${taille} (en stock) doit être dans l'état « ajout au panier »`).toHaveAttribute('data-state', 'active');
      }
      for (const taille of indisponibles) {
        await expect(fiche.sizeRadio(taille), `La taille ${taille} (épuisée) doit être marquée « Out of stock »`).toHaveAccessibleName(EPUISEE);
        await expect(fiche.sizeRadio(taille), `La taille ${taille} (épuisée) doit être dans l'état « rupture »`).toHaveAttribute('data-state', 'disabled');
      }
      for (const taille of [...disponibles, ...indisponibles]) await expect(fiche.sizeRadio(taille), 'Aucune taille ne doit être cochée d\'office').not.toBeChecked();
    });

    await etape(page, testInfo, '3. Valider sans taille : « Please select a size », rien n\'est ajouté', async () => {
      await fiche.sizeModalButton.click();
      await expect(erreur, 'La fenêtre doit demander de choisir une taille').toBeVisible();
      await expect(fiche.cartNotification, 'Rien ne doit être ajouté au panier').toBeHidden();
    });

    await etape(page, testInfo, `4. Choisir la taille épuisée ${epuisee} : « Notify me » à la place de l'ajout au panier`, async () => {
      await fiche.chooseSizeInModal(epuisee);
      await expect.poll(() => fiche.sizeModalButton.innerText(), { message: 'Le bouton de la fenêtre doit proposer d\'être prévenu' }).toMatch(/Notify me|Être prévenu/i);
      await expect(fiche.sizeModalButton, 'Le bouton doit être dans l\'état « rupture »').toHaveAttribute('data-state', 'disabled');
    });

    await etape(page, testInfo, `5. Choisir la taille ${choisie} : le bouton « Add to cart » s'active`, async () => {
      await fiche.chooseSizeInModal(choisie);
      await expect.poll(() => fiche.sizeModalButton.innerText(), { message: 'Le bouton doit proposer d\'ajouter au panier' }).toMatch(LIBELLE_AJOUT);
      await expect(fiche.sizeModalButton, 'Le bouton doit être dans l\'état « ajout au panier »').toHaveAttribute('data-state', 'active');
    });

    await etape(page, testInfo, `6. Ajouter au panier : notification avec la taille ${choisie}, compteur à 1`, async () => {
      await fiche.sizeModalButton.click();
      await expect(fiche.cartNotification, 'La notification « ajouté au panier » doit apparaître').toBeVisible();
      await expect(fiche.cartNotification, `La notification doit donner la taille choisie (${choisie})`).toContainText(new RegExp(`(Size|Taille)\\s*:?\\s*${choisie}\\b`, 'i'));
      // Sur ordinateur, la fenêtre se ferme après l'ajout ; sur téléphone, elle prend tout l'écran et reste ouverte
      // (préprod, 15 octobre 2026) : on la ferme pour voir le compteur de l'en-tête.
      if (isMobile) await fiche.sizeModal.getByRole('button', { name: /Close modal|Fermer/i }).first().click();
      await expect(fiche.sizeModal, 'La fenêtre des tailles doit se fermer').toBeHidden();
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
    const mention = fiche.sizeModal.getByText(MENTION_EXPEDITION).filter({ visible: true });
    testInfo.annotations.push({ type: 'Produit testé', description: `${produit.id} (${produit.handle}) : taille ${tailleEnPrecommande} en précommande (expédition le ${dateExpedition})` });

    await etape(page, testInfo, `1. Ouvrir la fiche ${produit.id} et la fenêtre des tailles : ${tailleEnPrecommande} marquée « Pre-order »`, async () => {
      await ouvrirFicheATailles(fiche, produit.handle);
      await ouvrirFenetre(fiche);
      await expect(fiche.sizeRadio(tailleEnPrecommande), `La taille ${tailleEnPrecommande} doit être marquée en précommande`).toHaveAccessibleName(MENTION_PRECOMMANDE);
      await expect(fiche.sizeRadio(tailleEnStock), `La taille ${tailleEnStock} (en stock) ne doit pas être marquée en précommande`).not.toHaveAccessibleName(MENTION_PRECOMMANDE);
    });

    await etape(page, testInfo, `2. Choisir ${tailleEnPrecommande} : bouton « Preorder now » et date d'expédition`, async () => {
      await fiche.chooseSizeInModal(tailleEnPrecommande);
      await expect.poll(() => fiche.sizeModalButton.innerText(), { message: 'Le bouton doit proposer de précommander' }).toMatch(MENTION_PRECOMMANDE);
      await expect(fiche.sizeModalButton, 'Le bouton doit être dans l\'état « précommande »').toHaveAttribute('data-state', 'preorder');
      await expect(mention.first(), `La date d'expédition prévue (${dateExpedition}) doit s'afficher`).toContainText(dateAffichee(dateExpedition));
    });

    await etape(page, testInfo, `3. Choisir ${tailleEnStock} : retour à « Add to cart », sans date d'expédition`, async () => {
      await fiche.chooseSizeInModal(tailleEnStock);
      await expect.poll(() => fiche.sizeModalButton.innerText(), { message: 'Le bouton doit de nouveau proposer d\'ajouter au panier' }).toMatch(LIBELLE_AJOUT);
      await expect(fiche.sizeModalButton, 'Le bouton ne doit plus être en précommande').not.toHaveAttribute('data-state', 'preorder');
      await expect(mention, 'La date d\'expédition de la précommande ne doit plus s\'afficher').toHaveCount(0);
    });
  });

  test(`Tailles · toutes les tailles épuisées (${produitFixe('QA11').id}) @tnr @pdp`, async ({ page, qaEnv }, testInfo) => {
    test.skip(qaEnv.name !== 'preprod', 'Produits QA : préprod uniquement');
    const produit = produitFixe('QA11');
    const tailles = produit.tailles!.indisponibles;
    const fiche = new ProductPage(page);
    testInfo.annotations.push({ type: 'Produit testé', description: `${produit.id} (${produit.handle}) : toutes les tailles à 0` });

    // L'ancienne fiche affiche directement « Notify me » ; la nouvelle propose de choisir une taille, puis « Notify me ».
    await etape(page, testInfo, `1. Ouvrir la fiche ${produit.id} et la fenêtre des tailles : toutes marquées « Out of stock »`, async () => {
      await ouvrirFicheATailles(fiche, produit.handle, { rupture: true });
      await expect(fiche.addToCartButton, 'Aucun bouton « Ajouter au panier » ne doit être proposé').toHaveCount(0);
      await ouvrirFenetre(fiche);
      for (const taille of tailles) {
        await expect(fiche.sizeRadio(taille), `La taille ${taille} doit être marquée « Out of stock »`).toHaveAccessibleName(EPUISEE);
      }
    });

    await etape(page, testInfo, `2. Choisir la taille ${tailles[0]} : « Notify me », le panier reste vide`, async () => {
      await fiche.chooseSizeInModal(tailles[0]);
      await expect.poll(() => fiche.sizeModalButton.innerText(), { message: 'Le bouton de la fenêtre doit proposer d\'être prévenu' }).toMatch(/Notify me|Être prévenu/i);
      await expect(fiche.sizeModalButton, 'Le bouton doit être dans l\'état « rupture »').toHaveAttribute('data-state', 'disabled');
      // Panier lu chez Shopify : la fenêtre ouverte cache l'en-tête et son compteur.
      const contenu = await (await appelShopify(page, 'La lecture du panier', () => page.request.get('cart.js'))).json() as { item_count: number };
      expect(contenu.item_count, 'Le panier doit rester vide').toBe(0);
    });
  });
});


test.describe('Coming soon', () => {
  const produit = produitFixe('QA04');
  const LIBELLE_COMING_SOON = /Coming soon|Bientôt disponible/i;
  const boutonEnvoi = (fenetre: Locator) => fenetre.getByRole('button', { name: /Sign up|S'inscrire|Inscri/i });

  pourChaqueFiche(() => test(`Coming soon · fiche produit (${produit.id}) @tnr @pdp`, async ({ page, qaEnv, isMobile }, testInfo) => {
    test.skip(qaEnv.name !== 'preprod', 'Produits QA : préprod uniquement');
    const header = new Header(page, isMobile);
    const fiche = new ProductPage(page);
    testInfo.annotations.push({ type: 'Produit testé', description: `${produit.id} (${produit.handle}), métachamp coming_soon.enabled` });

    await etape(page, testInfo, `1. Ouvrir la fiche du produit à venir ${produit.id}`, async () => {
      const donnees = await fiche.fetchProductData(produit.handle);
      await fiche.goto(produit.handle);
      await fiche.expectPrice(parsePriceToCents(await fiche.price.innerText()), donnees, 'Le prix affiché doit être celui du produit');
    });

    await etape(page, testInfo, '2. Vérifier le bouton « Coming soon — Sign up » à la place de « Ajouter au panier »', async () => {
      await expect.poll(() => fiche.mainButton.innerText(), { message: 'Le bouton principal doit annoncer le lancement à venir' }).toMatch(LIBELLE_COMING_SOON);
      await expect(fiche.mainButton, 'Le bouton doit être dans l\'état « coming soon »').toHaveAttribute('data-state', 'coming-soon');
      await expect(fiche.addToCartButton, 'Aucun bouton « Ajouter au panier » ne doit être proposé').toHaveCount(0);
    });

    await etape(page, testInfo, '3. Ouvrir la fenêtre d\'inscription au lancement', async () => {
      await centrer(fiche.mainButton);
      await fiche.mainButton.click();
      const fenetre = fiche.comingSoonModal;
      await expect(fenetre, 'La fenêtre « Coming soon » doit s\'ouvrir').toBeVisible();
      await expect(fenetre, 'La fenêtre doit proposer d\'être prévenu du lancement').toContainText(/first to know|launch|lancement/i);
      await expect(boutonEnvoi(fenetre), 'Le bouton d\'inscription doit être là').toBeVisible();
      // Constat 37 : case newsletter cochée par défaut, comme dans la fenêtre « Être prévenu(e) » (constat 13).
      if (await fenetre.getByRole('checkbox').first().isChecked()) {
        testInfo.annotations.push({ type: 'Constat 37', description: 'Case newsletter de la fenêtre « Coming soon » cochée par défaut' });
      }
    });

    await etape(page, testInfo, '4. Envoyer sans email, puis avec « test@ » : « Please type a valid e-mail », rien n\'est envoyé', async () => {
      await verifierEmailRefuse(page, fiche.comingSoonModal, boutonEnvoi(fiche.comingSoonModal));
    });

    await etape(page, testInfo, '5. Fermer la fenêtre : rien dans le panier', async () => {
      await fiche.comingSoonModal.getByRole('button', { name: /Close modal|Fermer/i }).click();
      await expect(fiche.comingSoonModal, 'La fenêtre doit se fermer').toBeHidden();
      expect(await header.cartCount(), 'Le panier doit rester vide').toBe(0);
    });
  }));

  test(`Coming soon · carte de collection (${produit.id}) @tnr @plp`, async ({ page, qaEnv, isMobile }, testInfo) => {
    test.skip(qaEnv.name !== 'preprod', 'Produits QA : préprod uniquement');
    const fiche = new ProductPage(page);
    const carte = new CollectionPage(page).card(produit.handle);
    const bouton = carte.locator('.coming-soon-modal-trigger').filter({ visible: true }).first();

    await etape(page, testInfo, '1. Ouvrir la collection QA « titre seul » (C5)', async () => {
      await page.goto('collections/qa-collection-title', { waitUntil: 'domcontentloaded' });
      await expect(carte, `La carte de ${produit.id} doit être dans la collection`).toBeVisible();
    });

    await etape(page, testInfo, '2. Vérifier la carte : « Coming soon », pas d\'ajout au panier', async () => {
      await expect(carte.locator('[data-tracking-state]').first(), 'La carte doit être dans l\'état « coming soon »').toHaveAttribute('data-tracking-state', 'coming-soon');
      await centrer(carte);
      if (!isMobile) await carte.hover();
      await expect(bouton, 'La carte doit proposer de s\'inscrire au lancement').toBeVisible();
      await expect(bouton, 'Le bouton de la carte doit annoncer le lancement (« Coming soon — Sign up », « Sign up » sur mobile)').toContainText(/Coming soon|Sign up|S'inscrire/i);
      await expect(carte.getByRole('button', { name: /Ajouter au panier$|Add to (cart|bag)$/i }), 'La carte ne doit pas proposer d\'ajout au panier').toHaveCount(0);
    });

    await etape(page, testInfo, '3. Ouvrir la fenêtre « Coming soon » depuis la carte, puis la fermer', async () => {
      await bouton.click();
      await expect(fiche.comingSoonModal, 'La fenêtre « Coming soon » doit s\'ouvrir depuis la carte').toBeVisible();
      await fiche.comingSoonModal.getByRole('button', { name: /Close modal|Fermer/i }).click();
      await expect(fiche.comingSoonModal, 'La fenêtre doit se fermer').toBeHidden();
    });
  });
});

test(`Nouveauté · étiquette « New in » sur la carte (${produitFixe('QA08').id}) @tnr @plp`, async ({ page, qaEnv }, testInfo) => {
  test.skip(qaEnv.name !== 'preprod', 'Produits QA : préprod uniquement');
  const nouveau = produitFixe('QA08');
  const ancien = produitFixe('QA01');
  const collection = new CollectionPage(page);
  const etiquette = (handle: string) => collection.card(handle).locator('.component-product-card__tags').first();
  testInfo.annotations.push({ type: 'Produits testés', description: `${nouveau.id} (tag LABEL:NEW), ${ancien.id} (sans le tag)` });

  await etape(page, testInfo, '1. Ouvrir la collection QA « titre seul » (C5)', async () => {
    await page.goto('collections/qa-collection-title', { waitUntil: 'domcontentloaded' });
    await expect(collection.card(nouveau.handle), `La carte de ${nouveau.id} doit être dans la collection`).toBeVisible();
  });

  await etape(page, testInfo, `2. « New in » sur la carte de ${nouveau.id}, pas sur celle de ${ancien.id}`, async () => {
    // textContent (toContainText) et non innerText : WebKit renvoie un innerText vide pour une carte hors écran.
    await expect(etiquette(nouveau.handle), `La carte de ${nouveau.id} doit porter l'étiquette « New in »`).toContainText(/New in|Nouveau/i);
    await expect(etiquette(ancien.handle), `La carte de ${ancien.id} ne doit pas porter l'étiquette « New in »`).not.toContainText(/New in|Nouveau/i);
  });
});

test.describe('Précommande expirée et retardée', () => {
  pourChaqueFiche(() => test(`Précommande expirée · le produit redevient normal (${produitFixe('QA07').id}) @tnr @pdp`, async ({ page, qaEnv, isMobile }, testInfo) => {
    test.skip(qaEnv.name !== 'preprod', 'Produits QA : préprod uniquement');
    const produit = produitFixe('QA07');
    const header = new Header(page, isMobile);
    const fiche = new ProductPage(page);
    testInfo.annotations.push({ type: 'Produit testé', description: `${produit.id} (${produit.handle}), date de précommande passée (${produit.datePrecommande})` });

    await etape(page, testInfo, `1. Ouvrir la fiche ${produit.id} : « Add to cart », sans date d'expédition`, async () => {
      const donnees = await fiche.fetchProductData(produit.handle);
      await fiche.goto(produit.handle);
      await fiche.expectPrice(parsePriceToCents(await fiche.price.innerText()), donnees, 'Le prix affiché doit être celui du produit');
      await expect.poll(() => fiche.mainButton.innerText(), { message: 'Une précommande expirée doit redevenir un ajout au panier normal' }).toMatch(LIBELLE_AJOUT);
      await expect(fiche.mainButton, 'Le bouton ne doit plus être en précommande').not.toHaveAttribute('data-state', 'preorder');
      await expect(fiche.main.getByText(MENTION_EXPEDITION).filter({ visible: true }), 'Aucune date d\'expédition de précommande ne doit s\'afficher').toHaveCount(0);
    });

    await etape(page, testInfo, '2. Ajouter au panier : notification sans précommande, article sans propriété de précommande', async () => {
      await centrer(fiche.mainButton);
      await fiche.mainButton.click();
      await expect(fiche.cartNotification, 'La notification « ajouté au panier » doit apparaître').toBeVisible();
      // Texte affiché (innerText), lu tout de suite : la notification contient aussi les libellés cachés de la
      // précommande, et se ferme seule après quelques secondes. Sans le nom d'édition du produit QA, « Expired Preorder ».
      const texte = (await fiche.cartNotification.innerText()).replace(/Expired Preorder/gi, '');
      expect(texte, 'La notification ne doit pas parler de précommande').not.toMatch(MENTION_PRECOMMANDE);
      expect(texte, 'La notification ne doit pas donner de date d\'expédition').not.toMatch(MENTION_EXPEDITION);
      await expect.poll(() => header.cartCount(), { message: 'Le compteur du panier doit passer à 1' }).toBe(1);
      const contenu = await (await appelShopify(page, 'La lecture du panier', () => page.request.get('cart.js'))).json() as { items: { handle: string; properties: Record<string, string> | null }[] };
      const proprietes = contenu.items.find(i => i.handle === produit.handle)?.properties ?? {};
      expect(proprietes._is_preorder, 'L\'article ne doit pas être marqué comme précommande (_is_preorder)').not.toBe('true');
      expect(proprietes._preorder_date, 'L\'article ne doit pas porter de date de précommande').toBeUndefined();
    });
  }));

  pourChaqueFiche(() => test(`Précommande retardée · date affichée sur la fiche (${produitFixe('QA06').id}) @tnr @pdp`, async ({ page, qaEnv }, testInfo) => {
    test.skip(qaEnv.name !== 'preprod', 'Produits QA : préprod uniquement');
    const produit = produitFixe('QA06');
    const date = produit.datePrecommande!;
    const dateRetardee = DONNEES_QA.produits.find(p => p.id === produit.id)!.metafieldsVariantes!['*'].find(m => m.key === 'delayed_date')!.value;
    const fiche = new ProductPage(page);
    testInfo.annotations.push({ type: 'Produit testé', description: `${produit.id} (${produit.handle}) : preorder.date ${date}, preorder.delayed_date ${dateRetardee}` });

    await etape(page, testInfo, `1. Ouvrir la fiche ${produit.id} : bouton « Preorder now »`, async () => {
      await fiche.goto(produit.handle);
      await expect.poll(() => fiche.mainButton.innerText(), { message: 'Le bouton principal doit proposer de précommander' }).toMatch(MENTION_PRECOMMANDE);
    });

    // Constat 25 : la date retardée servirait seulement à Shipup, pour les clients qui ont déjà commandé (QA, 12 octobre
    // 2026, à confirmer). La fiche affiche donc la première date.
    await etape(page, testInfo, `2. La fiche annonce l'expédition au ${date} (preorder.date), pas au ${dateRetardee} (date retardée)`, async () => {
      const mention = fiche.main.getByText(MENTION_EXPEDITION).filter({ visible: true }).first();
      await expect(mention, 'La date d\'expédition de la précommande doit être affichée').toBeVisible();
      await expect(mention, `La date affichée doit être preorder.date (${date})`).toContainText(dateAffichee(date));
      await expect(mention, `La date retardée (${dateRetardee}) ne doit pas être affichée sur la fiche`).not.toContainText(dateAffichee(dateRetardee));
      testInfo.annotations.push({ type: 'Date affichée', description: ((await mention.innerText()) ?? '').trim() });
    });
  }));
});

pourChaqueFiche(version => test(`Coloris · passer d'un coloris à l'autre (${['QA13', 'QA14', 'QA15'].join(', ')}) @tnr @pdp`, async ({ page, qaEnv, isMobile }, testInfo) => {
  test.skip(qaEnv.name !== 'preprod', 'Produits QA : préprod uniquement');
  const [camel, noir, ebene] = ['QA13', 'QA14', 'QA15'].map(produitFixe);
  const famille = [camel, noir, ebene].map(p => p.handle);
  const fiche = new ProductPage(page);
  testInfo.annotations.push({ type: 'Produits testés', description: `${camel.id} camel (en stock), ${noir.id} noir (rupture), ${ebene.id} ébène (autre matière) : famille qa-cyme-mini` });

  const allerAuColoris = async (produit: typeof camel) => {
    const vignette = fiche.colorOption(produit.handle);
    await centrer(vignette);
    await vignette.click();
    await page.waitForURL(new RegExp(`/products/${produit.handle}`));
    await expect.poll(async () => (await fiche.colorHandles()).actif, { message: `La vignette de ${produit.id} doit devenir la vignette active` }).toEqual([produit.handle]);
  };

  await etape(page, testInfo, `1. Ouvrir la fiche ${camel.id} : les 3 coloris de la famille, celui de la fiche actif`, async () => {
    await fiche.goto(camel.handle);
    await expect(fiche.colorOptions.first(), 'Les vignettes de coloris doivent s\'afficher').toBeVisible();
    const { tous, actif } = await fiche.colorHandles();
    expect([...tous].sort(), 'Les vignettes doivent proposer les 3 coloris de la famille, et eux seuls').toEqual([...famille].sort());
    expect(actif, `La vignette active doit être celle de ${camel.id}`).toEqual([camel.handle]);
    // Fiche TNR PDP-04 : nom, prix, coloris, bouton, onglets, de haut en bas (le bouton est en bas d'écran sur mobile).
    const haut = async (l: Locator) => (await l.boundingBox())?.y ?? NaN;
    const onglets = version === 'ancienne' ? fiche.infoTabs.first() : fiche.tabs.first();
    const ordre = [['nom', fiche.title], ['prix', fiche.price], ['coloris', fiche.colorOptions.first()], ...(isMobile ? [] : [['bouton', fiche.mainButton]]), ['onglets', onglets]] as [string, Locator][];
    const positions = await Promise.all(ordre.map(async ([nom, l]) => [nom, await haut(l)] as const));
    const rangs = [...positions].sort((a, b) => a[1] - b[1]).map(([nom]) => nom);
    expect(rangs, 'Ordre des éléments de la fiche, de haut en bas').toEqual(ordre.map(([nom]) => nom));
    // Constat 38 (ancienne fiche) : avec peu de coloris, les vignettes ne sont pas atteignables au clavier
    // (tabindex="-1") et leur nom lu par les lecteurs d'écran est incomplet (« …, of »). Sur un vrai produit à
    // 24 coloris : tabindex="0", « 1 of 24 ». La nouvelle fiche donne « …, 1 of 3 », atteignable au clavier.
    const accessibilite = await fiche.colorOptions.evaluateAll(liens => liens.map(a => ({ tab: a.getAttribute('tabindex'), nom: a.getAttribute('aria-label') ?? '' })));
    if (accessibilite.some(a => a.tab === '-1' || /,\s*of\s*$/.test(a.nom))) {
      testInfo.annotations.push({ type: 'Constat 38', description: `Vignettes de coloris : ${accessibilite.map(a => `« ${a.nom.trim()} » tabindex=${a.tab}`).join(' ; ')}` });
    }
  });

  if (version === 'nouvelle') {
    await etape(page, testInfo, `2. « Explore all (3) » : la fenêtre des coloris propose les 3 coloris, ${camel.id} en premier plan`, async () => {
      await expect(fiche.exploreAllButton, 'Le bouton « Explore all » doit annoncer les 3 coloris').toHaveAccessibleName(/\(3\)/);
      await centrer(fiche.exploreAllButton);
      await fiche.exploreAllButton.click();
      await expect(fiche.colorModal, 'La fenêtre des coloris doit s\'ouvrir').toBeVisible();
      const liens = fiche.colorModal.getByRole('link').filter({ visible: true });
      const handles = await liens.evaluateAll(as => as.map(a => a.getAttribute('href')?.split('/products/')[1]?.split(/[?#]/)[0] ?? ''));
      expect([...handles].sort(), 'La fenêtre doit proposer les 3 coloris de la famille, et eux seuls').toEqual([...famille].sort());
      const actif = await liens.evaluateAll(as => as.filter(a => a.classList.contains('active')).map(a => a.getAttribute('href')?.split('/products/')[1] ?? ''));
      expect(actif, `Le coloris marqué actif dans la fenêtre doit être celui de ${camel.id}`).toEqual([camel.handle]);
      await fiche.colorModal.getByRole('button', { name: /Close modal|Fermer/i }).first().click();
      await expect(fiche.colorModal, 'La fenêtre des coloris doit se fermer').toBeHidden();
    });
  }
  const n = version === 'nouvelle' ? 3 : 2;

  await etape(page, testInfo, `${n}. Toucher le coloris noir (${noir.id}) : sa fiche, en rupture`, async () => {
    await allerAuColoris(noir);
    await fiche.verifierFiche();
    await expect.poll(() => fiche.mainButton.innerText(), { message: `La fiche de ${noir.id} doit proposer d'être prévenu (rupture)` }).toMatch(/Notify me|Être prévenu/i);
  });

  await etape(page, testInfo, `${n + 1}. Toucher le coloris ébène (${ebene.id}, autre matière) : sa fiche, achetable, à son prix`, async () => {
    const donnees = await fiche.fetchProductData(ebene.handle);
    await allerAuColoris(ebene);
    await expect.poll(() => fiche.mainButton.innerText(), { message: `La fiche de ${ebene.id} doit proposer l'ajout au panier` }).toMatch(LIBELLE_AJOUT);
    await expect.poll(async () => parsePriceToCents(await fiche.price.innerText()), { message: `Le prix doit être celui de ${ebene.id} (${formatCents(donnees.priceCents)})` }).toBe(donnees.priceCents);
  });
}));

/**
 * Textes d'un bloc qui en sortent (ou sortent de l'écran), et textes coupés (« … », sans retour à la ligne). Seuls les
 * éléments qui portent eux-mêmes du texte et sont affichés.
 */
async function textesQuiDebordent(bloc: Locator): Promise<{ dehors: string[]; coupes: string[] }> {
  return bloc.evaluate(b => {
    const cadre = b.getBoundingClientRect();
    const droite = Math.min(cadre.right, document.documentElement.clientWidth) + 1;
    // Sans les fenêtres fermées que le bloc contient (« Remove item ? » dans une ligne du panier).
    const textes = [...b.querySelectorAll('*')].filter(e => !e.closest('component-modal, [role="dialog"]')
      && e.checkVisibility({ opacityProperty: true, visibilityProperty: true })
      && [...e.childNodes].some(n => n.nodeType === Node.TEXT_NODE && n.textContent!.trim()));
    const nom = (e: Element) => (e.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 60);
    return {
      dehors: textes.filter(e => { const r = e.getBoundingClientRect(); return r.right > droite || r.left < cadre.left - 1; }).map(nom),
      // Sans les textes réservés aux lecteurs d'écran (1 px de large), « coupés » exprès.
      coupes: textes.filter(e => getComputedStyle(e).display !== 'inline' && e.clientWidth > 1 && e.scrollWidth > e.clientWidth + 1).map(nom),
    };
  });
}

pourChaqueFiche(() => test(`Titre long · fiche, carte, panier et checkout sans débordement (${produitFixe('QA21').id}) @tnr @journey`, async ({ page, qaEnv }, testInfo) => {
  test.skip(qaEnv.name !== 'preprod', 'Produits QA : préprod uniquement');
  const produit = produitFixe('QA21');
  const fiche = new ProductPage(page);
  const panier = new CartPage(page);
  const checkout = new CheckoutPage(page);
  const TITRE_LONG = /Very Long Edition Name/i;
  testInfo.annotations.push({ type: 'Produit testé', description: `${produit.id} (${produit.handle})` });
  const verifierBloc = async (bloc: Locator, ou: string) => {
    const { dehors, coupes } = await textesQuiDebordent(bloc);
    expect(dehors, `${ou} : aucun texte ne doit sortir du bloc ni de l'écran`).toEqual([]);
    if (coupes.length) testInfo.annotations.push({ type: `Texte coupé (${ou})`, description: coupes.join(' ; ') });
  };

  await etape(page, testInfo, `1. Fiche ${produit.id} : le nom et l'édition passent à la ligne, rien ne dépasse`, async () => {
    await fiche.goto(produit.handle);
    await expect(fiche.main.getByText(TITRE_LONG).filter({ visible: true }).first(), 'Le nom d\'édition long doit s\'afficher').toBeVisible();
    await verifierBloc(fiche.title.locator('xpath=..'), 'Fiche');
    await verifierLargeur(page, testInfo);
  });

  await etape(page, testInfo, '2. Carte de la collection QA de référence (C1) : rien ne dépasse', async () => {
    await page.goto('collections/qa-collection', { waitUntil: 'domcontentloaded' });
    const carte = new CollectionPage(page).card(produit.handle);
    await expect(carte, `La carte de ${produit.id} doit être dans la collection`).toBeVisible();
    await centrer(carte);
    await verifierBloc(carte, 'Carte');
    await verifierLargeur(page, testInfo);
  });

  await etape(page, testInfo, '3. Ligne du panier : rien ne dépasse', async () => {
    await panier.addByUrl(produit.handle);
    await expect(panier.line(produit.handle), 'La ligne doit donner le nom d\'édition long').toContainText(TITRE_LONG);
    await verifierBloc(panier.line(produit.handle), 'Panier');
    await verifierLargeur(page, testInfo);
  });

  await etape(page, testInfo, '4. Résumé du checkout : rien ne dépasse', async () => {
    await panier.goToCheckout();
    await checkout.expectLoaded();
    await checkout.openOrderSummaryIfCollapsed();
    const ligne = page.getByRole('row').filter({ hasText: TITRE_LONG }).filter({ visible: true }).first();
    await expect(ligne, 'Le résumé de commande doit donner le nom complet du produit').toBeVisible();
    await verifierBloc(ligne, 'Checkout');
    await verifierLargeur(page, testInfo);
  });
}));

pourChaqueFiche(() => test(`Prix · petit prix et prix au-dessus de 1 000 € (${produitFixe('QA17').id}, ${produitFixe('QA18').id}) @tnr @pdp`, async ({ page, qaEnv }, testInfo) => {
  test.skip(qaEnv.name !== 'preprod', 'Produits QA : préprod uniquement');
  const petit = produitFixe('QA17');
  const grand = produitFixe('QA18');
  const fiche = new ProductPage(page);
  const collection = new CollectionPage(page);
  const donnees: Record<string, Awaited<ReturnType<ProductPage['fetchProductData']>>> = {};

  for (const [i, [produit, cas]] of ([[petit, 'moins de 100 €'], [grand, 'plus de 1 000 €']] as const).entries()) {
    await etape(page, testInfo, `${i + 1}. Fiche ${produit.id} (${cas}) : prix affiché = prix du produit`, async () => {
      donnees[produit.id] = await fiche.fetchProductData(produit.handle);
      await fiche.goto(produit.handle);
      await expect(fiche.price, 'Le prix doit s\'afficher').toBeVisible();
      const texte = (await fiche.price.innerText()).replace(/\s+/g, ' ').trim();
      testInfo.annotations.push({ type: `Prix affiché (${produit.id})`, description: texte });
      await fiche.expectPrice(parsePriceToCents(texte), donnees[produit.id], `Le prix de ${produit.id} doit être celui du produit`);
      if (produit === petit) expect(donnees[produit.id].priceCents, `${produit.id} doit rester sous 100 €`).toBeLessThan(10_000);
      else expect(texte, 'Au-dessus de 1 000 €, les milliers doivent être séparés (1 287,95 ou 1.287,95)').toMatch(/\b1[\s.  ]\d{3},\d{2}\b/);
    });
  }

  await etape(page, testInfo, '3. Cartes de la collection C5 : les mêmes prix', async () => {
    await page.goto('collections/qa-collection-title', { waitUntil: 'domcontentloaded' });
    for (const produit of [petit, grand]) {
      const carte = collection.card(produit.handle);
      await expect(carte, `La carte de ${produit.id} doit être dans la collection`).toBeVisible();
      // textContent : WebKit renvoie un innerText vide pour une carte hors écran.
      const prix = parsePriceToCents((await carte.locator('[class*="price"]').first().textContent()) ?? '');
      await fiche.expectPrice(prix, donnees[produit.id], `La carte de ${produit.id} doit afficher le prix du produit`);
    }
  });
}));
