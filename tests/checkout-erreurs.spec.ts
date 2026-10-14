import { test, expect, etape } from '../src/fixtures';
import { CartPage } from '../src/pages/cart';
import { CheckoutPage } from '../src/pages/checkout';
import { CollectionPage } from '../src/pages/collection';
import { loadClientTest } from '../src/client-test';
import { produitFixe } from '../src/produits-fixes';

/**
 * Erreurs du checkout (roadmap phase 2.2, fiches TNR CHECKOUT-03 à CHECKOUT-06). Aucune commande :
 * - formulaire vide ou faux : aucun numéro de carte n'est saisi, le paiement est impossible ;
 * - cartes refusées : cartes de test Shopify qui sont toujours refusées (accord QA du 14 octobre 2026, Chrome ordinateur
 *   seul). Si l'une passait, le test échoue en le disant : une commande aurait été créée.
 * - lien des CGV : lu au checkout, en prod aussi (arrivée au checkout seulement, rien n'est saisi).
 * Code promo (CHECKOUT-07) : pas testé pour l'instant (décision QA du 14 octobre 2026).
 */

const PAGE_CONFIRMATION = /thank[-_]you|\/orders\//;

/** Messages attendus sous les champs obligatoires quand on paie sans rien remplir. */
const ERREURS_FORMULAIRE_VIDE: [string, RegExp][] = [
  ['adresse e-mail', /adresse e-mail|email/i],
  ['civilité', /civilité|title/i],
  ['prénom', /prénom|first name/i],
  ['nom', /\bnom\b|last name/i],
  ['adresse', /une adresse|an address/i],
  ['code postal', /code postal|postal code|ZIP/i],
  ['ville', /ville|city/i],
  ['téléphone', /téléphone|phone/i],
  ['numéro de carte', /numéro de carte|card number/i],
  ['date d\'expiration', /expiration/i],
  ['code de sécurité', /CVV|code de sécurité|security code/i],
  ['nom sur la carte', /tel qu.il est écrit|name .*card/i],
];

test(`Checkout · formulaire vide ou faux : un message sous chaque champ, aucune commande (${produitFixe('QA01').id}) @tnr @checkout`, async ({ page, qaEnv }, testInfo) => {
  test.skip(qaEnv.name !== 'preprod', 'Préprod uniquement : en prod, on ne touche pas au bouton « Payer »');
  const produit = produitFixe('QA01');
  const panier = new CartPage(page);
  const checkout = new CheckoutPage(page);
  testInfo.annotations.push({ type: 'Produit testé', description: `${produit.id} (${produit.handle})` });

  await etape(page, testInfo, `1. Mettre ${produit.id} au panier et arriver au checkout`, async () => {
    await panier.addByUrl(produit.handle);
    await panier.goToCheckout();
    await checkout.expectLoaded();
  });

  await etape(page, testInfo, '2. « Payer maintenant » sans rien remplir : un message sous chaque champ obligatoire', async () => {
    // Le checkout réagit seulement une fois son script chargé : sur un Mac chargé, le premier clic peut partir trop
    // tôt et ne rien faire. On reclique tant qu'aucun message n'apparaît (sans carte, aucun paiement possible).
    await expect(async () => {
      await checkout.payButton.click();
      expect((await checkout.errorMessages()).length, 'Des messages d\'erreur doivent apparaître sous les champs').toBeGreaterThanOrEqual(ERREURS_FORMULAIRE_VIDE.length);
    }).toPass({ timeout: 30_000 });
    const messages = await checkout.errorMessages();
    testInfo.annotations.push({ type: 'Messages affichés', description: messages.join(' · ') });
    const manquants = ERREURS_FORMULAIRE_VIDE.filter(([, attendu]) => !messages.some(m => attendu.test(m))).map(([champ]) => champ);
    expect(manquants, `Chaque champ obligatoire vide doit avoir son message. Sans message : ${manquants.join(', ')}`).toEqual([]);
    await expect(checkout.emailField, 'Le champ email doit être marqué en erreur').toHaveAttribute('aria-invalid', 'true');
    await expect(page, 'On doit rester sur le checkout').not.toHaveURL(PAGE_CONFIRMATION);
  });

  // Le checkout enregistre la saisie un instant après la frappe : sous Safari et Android, un clic sur « Payer » trop
  // rapide vérifie encore le champ vide. On quitte le champ (Tab) puis on reclique jusqu'au nouveau message.
  const saisirPuisPayer = async (champ: import('@playwright/test').Locator, valeur: string, message: RegExp, consigne: string) => {
    await champ.fill(valeur);
    await champ.press('Tab');
    await expect(async () => {
      await checkout.payButton.click();
      await expect(champ, consigne).toHaveAccessibleDescription(message, { timeout: 3_000 });
    }).toPass({ timeout: 20_000 });
  };

  await etape(page, testInfo, '3. Email « test@ » : « Entrez une adresse e-mail valide »', async () => {
    await saisirPuisPayer(checkout.emailField, 'test@', /e-mail valide|valid email/i, 'Le message sous l\'email doit demander une adresse valide');
    await expect(checkout.emailField, 'Le champ email doit rester en erreur').toHaveAttribute('aria-invalid', 'true');
  });

  await etape(page, testInfo, '4. Code postal « ABCDE » : « Entrez un code postal valide pour France »', async () => {
    await saisirPuisPayer(checkout.postalCodeField, 'ABCDE', /code postal valide|valid (postal|ZIP) code/i, 'Le message sous le code postal doit demander un code valide pour la France');
    await expect(checkout.postalCodeField, 'Le champ code postal doit être marqué en erreur').toHaveAttribute('aria-invalid', 'true');
    await expect(page, 'Aucune commande : on doit rester sur le checkout').not.toHaveURL(PAGE_CONFIRMATION);
  });
});

/** Cartes de test Shopify Payments toujours refusées, et le message attendu. */
const CARTES_REFUSEES: { cas: string; numero: string; message: RegExp }[] = [
  { cas: 'carte refusée', numero: '4000000000000002', message: /refusée|declined/i },
  { cas: 'carte expirée', numero: '4000000000000069', message: /a expiré|expirée|has expired|is expired/i },
  // Message générique, qui ne dit pas que c'est le code de sécurité (14 octobre 2026) : « Les informations de votre
  // paiement n'ont pas pu être vérifiées. Vérifiez les informations de votre carte et réessayez. »
  { cas: 'carte au code de sécurité faux', numero: '4000000000000127', message: /code de sécurité|CVV|CVC|security code|pas pu être vérifiées|could not be verified/i },
];

/**
 * Bandeau d'erreur du paiement (« Votre carte a été refusée… », « Votre carte a expiré… »). Pas un simple « carte » ou
 * « code de sécurité » : ces mots sont aussi dans les libellés des champs et dans le bloc « Paiement 100 % sécurisé ».
 */
const BANDEAU_REFUS = /votre carte (a été refusée|a expiré|est (refusée|expirée|invalide))|code de sécurité .*(incorrect|invalide|erroné)|card (was declined|has expired)|security code .*(incorrect|invalid)|paiement (a été )?refusé|paiement n.ont pas pu être vérifiées|payment (details )?could not be verified/i;

test('Checkout · cartes refusées : message clair, aucune commande @tnr @checkout', async ({ page, qaEnv }, testInfo) => {
  test.skip(qaEnv.name !== 'preprod', 'Préprod uniquement : jamais de paiement en prod');
  test.skip(!testInfo.project.name.endsWith('desktop-chrome'), 'Chrome ordinateur seulement (accord QA du 14 octobre 2026)');
  const produit = produitFixe('QA01');
  const panier = new CartPage(page);
  const checkout = new CheckoutPage(page);
  const client = loadClientTest();
  testInfo.annotations.push({ type: 'Produit testé', description: `${produit.id} (${produit.handle})` });

  await etape(page, testInfo, `1. Mettre ${produit.id} au panier, arriver au checkout, remplir contact et adresse`, async () => {
    await panier.addByUrl(produit.handle);
    await panier.goToCheckout();
    await checkout.expectLoaded();
    await checkout.fillContactAndAddress(client);
    await checkout.expectShippingMethodsOffered();
  });

  for (const [i, carte] of CARTES_REFUSEES.entries()) {
    await etape(page, testInfo, `${i + 2}. Payer avec une ${carte.cas} (${carte.numero.slice(-4)}) : paiement refusé, on reste au checkout`, async () => {
      const bandeau = page.getByText(BANDEAU_REFUS).filter({ visible: true }).first();
      const lire = async () => ((await bandeau.innerText({ timeout: 500 }).catch(() => '')) ?? '').replace(/\s+/g, ' ').trim();
      // Le bandeau de la carte précédente reste affiché jusqu'à la réponse suivante : on attend un nouveau message.
      const avant = await lire();
      await checkout.payWithCard({
        number: carte.numero,
        expiry: process.env.PREPROD_CARD_EXPIRY ?? '12/30',
        cvv: process.env.PREPROD_CARD_CVV ?? '123',
        name: process.env.PREPROD_CARD_NAME ?? 'QA Polene',
      });
      let message = '';
      await expect.poll(async () => {
        if (PAGE_CONFIRMATION.test(page.url())) return 'confirmation';
        message = await lire();
        return message && message !== avant ? 'refus' : 'en attente';
      }, { message: `Un nouveau message doit expliquer le refus (${carte.cas})`, timeout: 45_000 }).not.toBe('en attente');
      expect(PAGE_CONFIRMATION.test(page.url()), `La ${carte.cas} a été acceptée : une commande a été créée, à annuler dans l'admin`).toBe(false);
      testInfo.annotations.push({ type: `Message (${carte.cas})`, description: message });
      expect(message, `Le message doit correspondre au cas (${carte.cas})`).toMatch(carte.message);
      await expect(page, 'On doit rester sur le checkout').toHaveURL(/\/checkouts?\//);
      await expect(checkout.payButton, 'Le bouton « Payer maintenant » doit rester disponible pour réessayer').toBeVisible();
    });
  }
});

test('Checkout · lien vers les conditions générales de vente @tnr @checkout', async ({ page, qaEnv }, testInfo) => {
  const panier = new CartPage(page);
  const checkout = new CheckoutPage(page);
  let lien = '';

  await etape(page, testInfo, '1. Mettre un produit en stock au panier et arriver au checkout, sans rien saisir', async () => {
    let handle = qaEnv.produitAchat ? produitFixe(qaEnv.produitAchat).handle : '';
    if (!handle) {
      await page.goto(qaEnv.collection.path.replace(/^\//, ''), { waitUntil: 'domcontentloaded' });
      handle = await new CollectionPage(page).openFirstInStockProduct();
    }
    testInfo.annotations.push({ type: 'Produit', description: handle });
    await panier.addByUrl(handle);
    await panier.goToCheckout();
    await checkout.expectLoaded();
  });

  await etape(page, testInfo, '2. Vérifier la mention « En cliquant sur Payer, j\'accepte les Conditions Générales de Vente »', async () => {
    await expect(page.getByText(/En cliquant sur Payer, j.accepte les Conditions Générales de Vente|By (clicking|placing).*terms/i).filter({ visible: true }).first(), 'La mention des CGV doit être affichée près du bouton « Payer »').toBeVisible();
    const cgv = page.getByRole('link', { name: /Conditions Générales de Vente|Terms of (sale|service)/i }).filter({ visible: true }).first();
    await expect(cgv, 'Le lien vers les CGV doit être affiché').toBeVisible();
    lien = (await cgv.getAttribute('href')) ?? '';
    testInfo.annotations.push({ type: 'Lien des CGV', description: lien });
    expect(lien, 'Le lien doit mener à une page de politique de la boutique (/policies/…)').toMatch(/\/policies\//);
  });

  await etape(page, testInfo, '3. Ouvrir la page des CGV : titre et texte des conditions', async () => {
    // Lue dans un nouvel onglet, pour ne pas quitter le checkout.
    const onglet = await page.context().newPage();
    await onglet.goto(lien, { waitUntil: 'domcontentloaded' });
    // Titre de niveau 2 en prod, 1 en préprod (constat 12 : pas de h1 sur une partie des pages).
    await expect(onglet.getByRole('heading', { name: /^(Conditions générales de vente|Terms of (sale|service))$/i }).first(), 'La page doit s\'intituler « Conditions générales de vente »').toBeVisible();
    // textContent : sur mobile, la fenêtre de géolocalisation de la préprod (pas fermée dans ce nouvel onglet) masque
    // le reste de la page, et innerText ne compte plus que son texte.
    const longueur = await onglet.locator('.shopify-policy__container, main').first().evaluate(e => (e.textContent ?? '').replace(/\s+/g, ' ').length);
    expect(longueur, 'La page des CGV ne doit pas être vide').toBeGreaterThan(5000);
    // Constat 39 : la préprod mène à /policies/terms-of-service (en anglais), la prod à /policies/terms-of-sale (en français).
    if (!/terms-of-sale/.test(lien)) {
      testInfo.annotations.push({ type: 'Constat 39', description: `Le lien des CGV mène à ${lien.replace(/^https?:\/\/[^/]+/, '')}, la prod à /policies/terms-of-sale (langue de la page : ${await onglet.locator('html').getAttribute('lang')})` });
    }
    await testInfo.attach('📸 Page des CGV', { body: await onglet.screenshot(), contentType: 'image/png' });
    await onglet.close();
  });
});
