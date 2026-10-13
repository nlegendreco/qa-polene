import { existsSync, readFileSync } from 'node:fs';
import type { Page, TestInfo } from '@playwright/test';
import { test, expect, etape } from '../src/fixtures';
import { Header } from '../src/pages/header';
import { ProductPage, type ProductData } from '../src/pages/product';
import { CartPage } from '../src/pages/cart';
import { CheckoutPage } from '../src/pages/checkout';
import { produitFixe } from '../src/produits-fixes';
import { decrireErreur, erreurIgnoree, verifierLargeur } from '../src/controles';

/**
 * Espace client de la préprod, connecté au compte de test +qacompte (sections du thème main-account, main-addresses,
 * main-order). La préprod se connecte par un code reçu par email : la QA se connecte une fois avec
 * `npm run connexion:compte`, la session est gardée dans .auth/compte-client.json (hors Git) et sert à ces tests.
 * Lecture seule : aucun formulaire n'est envoyé, et surtout pas « Log out », qui fermerait la session.
 * Seule exception : la commande du compte, lancée à part (COMMANDE_COMPTE=1), une fois.
 */

const SESSION = '.auth/compte-client.json';
const sessionPresente = existsSync(SESSION);
if (sessionPresente) test.use({ storageState: SESSION });

/** Adresse du compte de test, lue hors Git (jamais écrite dans le dépôt). */
const emailCompte = (): string => JSON.parse(readFileSync('.auth/compte-preprod.json', 'utf8')).email;

/** Appels limités par Shopify : ordinateur et téléphone, les 4 appareils sont gardés pour les parcours critiques. */
const APPAREILS = ['desktop-chrome', 'iphone'];

/** Menu de l'espace client, présent sur chaque page. */
const MENU = [/Overview|Aperçu/i, /Orders|Commandes/i, /Profile|Profil/i, /Addresses|Adresses/i,
  /Wishlist|Favoris/i, /back in stock|retour en stock/i, /Assistance/i];

function conditions(qaEnv: { name: string }, testInfo: TestInfo) {
  test.skip(qaEnv.name !== 'preprod', 'Espace client : préprod uniquement (pas de test de connexion en prod pour l\'instant)');
  test.skip(!sessionPresente, `Pas de session client : lancer « npm run connexion:compte » (${SESSION})`);
  test.skip(!APPAREILS.includes(testInfo.project.name.split(' · ')[1]), `Espace client : ${APPAREILS.join(' et ')} seulement`);
}

/** Ouvre une page de l'espace client ; échoue clairement si la session a expiré. */
async function ouvrir(page: Page, chemin: string) {
  const reponse = await page.goto(chemin, { waitUntil: 'domcontentloaded' });
  expect(page.url(), 'Session du compte client expirée (renvoi vers la connexion) : relancer « npm run connexion:compte »')
    .not.toMatch(/account\/login|customer_authentication|shopify\.com\/authentication/);
  expect(reponse?.status(), `La page ${chemin} doit répondre (code 200)`).toBe(200);
}

/** Contrôles communs : section principale affichée, menu complet, ni erreur Shopify, ni erreur JS, ni débordement. */
async function verifierPage(page: Page, testInfo: TestInfo, erreursJs: string[]) {
  const section = page.locator('[id^="shopify-section-template--"][id$="__main"]');
  await expect(section, 'La section principale de l\'espace client doit s\'afficher').toBeVisible();
  const menu = page.locator('main a[href*="/account"]');
  for (const entree of MENU) await expect.soft(menu.filter({ hasText: entree }).first(), `Entrée du menu ${entree}`).toBeAttached();
  const texte = await page.locator('main').innerText();
  expect.soft(texte.match(/Liquid error[^\n]*|translation missing[^\n]*/gi) ?? [], 'Texte d\'erreur Shopify visible dans la page').toEqual([]);
  expect.soft(erreursJs, 'Erreur(s) JavaScript sur la page').toEqual([]);
  await verifierLargeur(page, testInfo);
}

function suivreErreursJs(page: Page): string[] {
  const erreurs: string[] = [];
  page.on('pageerror', e => { if (!erreurIgnoree(e)) erreurs.push(decrireErreur(e)); });
  return erreurs;
}

/**
 * Ouvre « Orders » et renvoie les lignes de l'historique des commandes. L'historique n'est pas dans la page : il est
 * chargé ensuite par l'application Polène (`apps/polene-theme-features/order-history`), on attend sa réponse.
 */
async function ouvrirCommandes(page: Page): Promise<string[]> {
  const chargement = page.waitForResponse(r => r.url().includes('/order-history'), { timeout: 30_000 });
  await ouvrir(page, 'account?view=orders');
  const reponse = await chargement;
  expect(reponse.ok(), `L'historique des commandes n'a pas pu être chargé (statut ${reponse.status()})`).toBe(true);
  await page.waitForTimeout(500);
  return page.locator('main table tr:has(td)').evaluateAll(lignes => lignes.map(l => (l.textContent ?? '').replace(/\s+/g, ' ').trim()));
}

const titre = (page: Page, nom: RegExp) => page.locator('main').getByRole('heading', { name: nom }).first();

/** Pages simples de l'espace client : chemin et titre attendu. */
const VUES = [
  { nom: 'Accueil du compte', chemin: 'account', titre: /^Welcome|^Bienvenue/i },
  { nom: 'Profil', chemin: 'account?view=profile', titre: /Your Profile|Votre profil/i },
  { nom: 'Favoris', chemin: 'account?view=wishlist', titre: /Your favorites|Vos favoris/i },
  { nom: 'Alertes de retour en stock', chemin: 'account?view=back-in-stock', titre: /Your Alerts|Vos alertes/i },
  { nom: 'Assistance', chemin: 'account?view=assistance', titre: /Need Assistance|Besoin d.aide/i },
];

for (const vue of VUES) {
  test(`Espace client · ${vue.nom} @tnr @account`, async ({ page, qaEnv }, testInfo) => {
    conditions(qaEnv, testInfo);
    const erreursJs = suivreErreursJs(page);
    await etape(page, testInfo, `1. Ouvrir ${vue.nom.toLowerCase()} (client connecté)`, async () => {
      await ouvrir(page, vue.chemin);
      await expect(titre(page, vue.titre)).toBeVisible();
    });
    if (vue.chemin === 'account' || vue.chemin === 'account?view=profile') {
      await etape(page, testInfo, '2. Vérifier que le compte affiché est celui du client de test', async () => {
        await expect(page.locator('main'), 'L\'adresse du compte de test doit être affichée').toContainText(emailCompte(), { ignoreCase: true });
        if (vue.chemin === 'account?view=profile') {
          for (const champ of [/First name|Prénom/i, /Last name|Nom/i]) await expect(page.locator('main').getByRole('textbox', { name: champ }).first()).toBeVisible();
        }
      });
    }
    const numero = vue.chemin === 'account' || vue.chemin === 'account?view=profile' ? 3 : 2;
    await etape(page, testInfo, `${numero}. Vérifier la page : section, menu, ni erreur ni débordement`, async () => {
      await verifierPage(page, testInfo, erreursJs);
    });
  });
}

test('Espace client · Adresses : liste, ajout, modification @tnr @account', async ({ page, qaEnv }, testInfo) => {
  conditions(qaEnv, testInfo);
  const erreursJs = suivreErreursJs(page);
  const main = page.locator('main');
  let lienModifier = '';

  await etape(page, testInfo, '1. Ouvrir la liste des adresses', async () => {
    await ouvrir(page, 'account/addresses');
    await expect(titre(page, /Your addresses|Vos adresses/i)).toBeVisible();
    const modifier = main.locator('a[href*="view=edit"]');
    await expect(modifier.first(), 'Le compte de test doit avoir au moins une adresse, avec un lien « Edit »').toBeVisible();
    lienModifier = (await modifier.first().getAttribute('href'))!;
    await expect(main.locator('a[href*="view=add"]').first(), 'Lien « Add address »').toBeVisible();
    await verifierPage(page, testInfo, erreursJs);
  });

  const champsAdresse = [/First name|Prénom/i, /Last name|Nom/i, /Address 1|Adresse/i, /Postal|Code postal/i, /City|Ville/i];

  await etape(page, testInfo, '2. Ouvrir le formulaire d\'ajout (sans l\'envoyer)', async () => {
    await ouvrir(page, 'account/addresses?view=add');
    await expect(titre(page, /Add address|Ajouter une adresse/i)).toBeVisible();
    for (const champ of champsAdresse) await expect(main.getByRole('textbox', { name: champ }).first(), `Champ ${champ}`).toBeVisible();
    await expect(main.getByRole('button', { name: /^(Save|Enregistrer)$/i })).toBeVisible();
    await verifierPage(page, testInfo, erreursJs);
  });

  await etape(page, testInfo, '3. Ouvrir le formulaire de modification : l\'adresse est pré-remplie (sans l\'envoyer)', async () => {
    await ouvrir(page, lienModifier.replace(/^\/(fr-fr\/)?/, ''));
    await expect(titre(page, /Update address|Modifier l.adresse/i)).toBeVisible();
    for (const champ of champsAdresse) {
      await expect(main.getByRole('textbox', { name: champ }).first(), `Champ ${champ} pré-rempli`).not.toHaveValue('');
    }
    await expect(main.getByRole('button', { name: /Update address|Mettre à jour/i })).toBeVisible();
    await verifierPage(page, testInfo, erreursJs);
  });
});

test('Espace client · Commandes et détail d\'une commande @tnr @account', async ({ page, qaEnv }, testInfo) => {
  conditions(qaEnv, testInfo);
  const erreursJs = suivreErreursJs(page);
  const main = page.locator('main');
  let lienCommande = '';

  await etape(page, testInfo, '1. Ouvrir la liste des commandes : dernière commande et historique', async () => {
    const historique = await ouvrirCommandes(page);
    const derniere = main.locator('a[href*="/account/orders/"]');
    await expect(derniere.first(), 'Le compte de test doit avoir au moins une commande (sinon : COMMANDE_COMPTE=1, voir le test « Commande d\'un client connecté »)').toBeAttached();
    lienCommande = (await derniere.first().getAttribute('href'))!;
    expect(historique.length, 'L\'historique des commandes (chargé par l\'application Polène) doit lister au moins une commande').toBeGreaterThan(0);
    testInfo.annotations.push({ type: 'Commandes du compte', description: `${historique.length} : ${historique.slice(0, 5).join(' ; ')}` });
    await verifierPage(page, testInfo, erreursJs);
  });

  await etape(page, testInfo, '2. Ouvrir le détail de la dernière commande', async () => {
    await ouvrir(page, lienCommande.replace(/^\/(fr-fr\/)?/, ''));
    await expect(main, 'Le détail doit montrer le numéro de la commande').toContainText(/#\s?\w+|Order|Commande/i);
    await expect(main.locator('a[href*="/products/"], img').first(), 'Le détail doit montrer au moins un produit').toBeAttached();
    await expect(main.getByText(/[€$£]\s*\d|\d\s*[€$£]/).filter({ visible: true }).first(), 'Le détail doit montrer un montant').toBeVisible();
    await verifierPage(page, testInfo, erreursJs);
  });
});

/**
 * Commande d'un client connecté : crée une vraie commande de test (préprod), à lancer à part, une fois, avec
 * l'accord de la QA : `COMMANDE_COMPTE=1 npx playwright test compte-client --project "preprod · desktop-chrome" --grep "Commande d"`.
 * Elle donne au compte une commande pour les tests de l'espace client, et vérifie au passage le checkout connecté
 * (adresse email et adresse de livraison reprises du compte).
 */
test('Espace client · Commande d\'un client connecté @journey @account', async ({ page, qaEnv, isMobile }, testInfo) => {
  test.skip(!process.env.COMMANDE_COMPTE, 'Crée une commande : seulement avec COMMANDE_COMPTE=1 (accord QA)');
  test.skip(qaEnv.name !== 'preprod' || !qaEnv.completePurchase, 'Préprod uniquement');
  test.skip(!sessionPresente, `Pas de session client : lancer « npm run connexion:compte » (${SESSION})`);
  test.skip(testInfo.project.name.split(' · ')[1] !== 'desktop-chrome', 'Une seule commande : Chrome ordinateur');
  const header = new Header(page, isMobile);
  const product = new ProductPage(page);
  const cart = new CartPage(page);
  const checkout = new CheckoutPage(page);
  const produit = produitFixe(qaEnv.produitAchat ?? 'QA01');
  let productData: ProductData;
  let commandesAvant = 0;

  await etape(page, testInfo, '1. Ouvrir l\'espace client et compter les commandes', async () => {
    commandesAvant = (await ouvrirCommandes(page)).length;
    // Le panier d'un client connecté est gardé d'une session à l'autre : on le vide.
    await page.request.post('cart/clear.js');
  });

  await etape(page, testInfo, `2. Ajouter le produit ${produit.id} au panier`, async () => {
    await page.goto(`products/${produit.handle}`, { waitUntil: 'domcontentloaded' });
    productData = await product.fetchProductData(produit.handle);
    testInfo.annotations.push({ type: 'Produit testé', description: `${productData.title} (${produit.handle})` });
    await product.expectPurchasable();
    await product.addToCart();
    await expect.poll(() => header.cartCount(), { message: 'Le compteur du panier doit passer à 1' }).toBe(1);
  });

  await etape(page, testInfo, '3. Passer au checkout : email et adresse repris du compte', async () => {
    await page.goto('cart', { waitUntil: 'domcontentloaded' });
    await cart.expectLoaded();
    await cart.goToCheckout();
    await expect(page).toHaveTitle(/Paiement|Checkout/i);
    await checkout.expectProductInSummary(productData.title);
    const main = page.locator('main');
    await expect(main, 'L\'adresse email du compte doit être reprise').toContainText(emailCompte(), { ignoreCase: true, timeout: 20_000 });
    await expect(page.getByRole('textbox', { name: /Adresse e-mail|Email/i }), 'Pas de champ email à remplir pour un client connecté').toHaveCount(0);
    // Client connecté : Shopify montre un résumé (« Expédier à », « Expédition ») au lieu des champs d'adresse.
    const resume = page.getByRole('region', { name: /Contact/i });
    await expect(resume.getByRole('heading', { name: /Expédier à|Ship to/i }), 'L\'adresse de livraison du compte doit être reprise').toBeVisible();
    await expect(resume.getByRole('heading', { name: /^(Expédition|Shipping)$/i })).toBeVisible();
    await expect(resume.getByText(/\d.*[€$£]|[€$£].*\d|Gratuit|Free/i).first(), 'Un mode d\'expédition avec son prix doit être choisi').toBeVisible();
  });

  await etape(page, testInfo, '4. Payer avec la carte de test', async () => {
    await checkout.payWithCard({
      number: process.env.PREPROD_CARD_NUMBER ?? '4242424242424242',
      expiry: process.env.PREPROD_CARD_EXPIRY ?? '12/30',
      cvv: process.env.PREPROD_CARD_CVV ?? '123',
      name: process.env.PREPROD_CARD_NAME ?? 'QA Polene',
    });
    const confirmation = await checkout.expectOrderConfirmed();
    testInfo.annotations.push({ type: 'Commande de test', description: `Confirmation n° ${confirmation}` });
  });

  await etape(page, testInfo, '5. Retrouver la commande dans l\'espace client', async () => {
    await expect.poll(async () => (await ouvrirCommandes(page)).length,
      { message: 'La nouvelle commande doit apparaître dans l\'historique de « Orders »', timeout: 90_000, intervals: [5_000] }).toBe(commandesAvant + 1);
  });
});
