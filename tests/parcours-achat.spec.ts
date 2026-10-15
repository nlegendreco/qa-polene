import { test, expect, etape, ficheDeLAppareil } from '../src/fixtures';
import { Header } from '../src/pages/header';
import { CollectionPage } from '../src/pages/collection';
import { ProductPage, type ProductData } from '../src/pages/product';
import { CartPage } from '../src/pages/cart';
import { CheckoutPage } from '../src/pages/checkout';
import { formatCents } from '../src/price';
import { loadClientTest } from '../src/client-test';
import { produitFixe } from '../src/produits-fixes';

/**
 * Parcours d'achat nominal : un visiteur arrive sur la home, va dans une collection,
 * ouvre un produit en stock (préprod : toujours QA01), l'ajoute au panier et arrive au checkout.
 * - Prod : arrêt avant le paiement.
 * - Préprod : paiement de test jusqu'à la confirmation de commande.
 *
 * Fiche produit : l'ancienne sur Chrome ordinateur et iPhone, la nouvelle sur Safari ordinateur et Android
 * (FICHE_PAR_APPAREIL, src/fixtures.ts) : les deux fiches du Roll Out à chaque lancement, toujours 4 commandes.
 */
test.use({ fiche: ficheDeLAppareil });

test('Parcours d\'achat nominal @smoke @tnr @journey', async ({ page, qaEnv, isMobile }, testInfo) => {
  const header = new Header(page, isMobile);
  const collection = new CollectionPage(page);
  const product = new ProductPage(page);
  const cart = new CartPage(page);
  const checkout = new CheckoutPage(page);
  let productData: ProductData;

  testInfo.annotations.push({ type: 'Environnement', description: `${qaEnv.label} (${qaEnv.baseURL})` });

  await etape(page, testInfo, '1. Ouvrir la page d\'accueil', async () => {
    await page.goto('./', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveTitle(/Polène/i);
    await expect(header.logo).toBeVisible();
    expect(await header.cartCount(), 'Le panier doit être vide au départ').toBe(0);
  });

  await etape(page, testInfo, '2. Aller dans la collection Sacs depuis le menu', async () => {
    await header.openCategory(qaEnv.collection.menuLabel);
    await expect(page).toHaveURL(new RegExp(qaEnv.collection.path));
    await collection.expectLoaded();
  });

  const produitAchat = qaEnv.produitAchat ? produitFixe(qaEnv.produitAchat) : undefined;
  const libelleEtape3 = produitAchat ? `3. Ouvrir la fiche du produit ${produitAchat.id} (en stock)` : '3. Ouvrir une fiche produit en stock';
  await etape(page, testInfo, libelleEtape3, async () => {
    let handle: string;
    if (produitAchat) {
      handle = produitAchat.handle;
      await page.goto(`products/${handle}`, { waitUntil: 'domcontentloaded' });
    } else {
      handle = await collection.openFirstInStockProduct();
    }
    await product.verifierFiche();
    productData = await product.fetchProductData(handle);
    testInfo.annotations.push({ type: 'Produit testé', description: `${productData.title} (${handle}) – ${formatCents(productData.priceCents)}` });
    await product.expectPurchasable();
  });

  await etape(page, testInfo, '4. Ajouter le produit au panier', async () => {
    await product.addToCart();
    await expect(product.cartNotification).toContainText(productData.title.split(' - ')[0], { ignoreCase: true });
    await expect.poll(() => header.cartCount(), { message: 'Le compteur du panier doit passer à 1' }).toBe(1);
  });

  await etape(page, testInfo, '5. Vérifier le panier', async () => {
    await page.goto('cart', { waitUntil: 'domcontentloaded' });
    await cart.expectLoaded();
    await expect(cart.lines).toHaveCount(1);
    await expect(cart.line(productData.handle)).toBeVisible();
    await product.expectPrice(await cart.subtotalCents(), productData, 'Le sous-total doit être égal au prix du produit');
  });

  await etape(page, testInfo, '6. Passer au checkout', async () => {
    await cart.goToCheckout();
    await checkout.expectLoaded();
    await checkout.expectProductInSummary(productData.title);
    await checkout.expectTotalVisible(productData.priceCents);
    await checkout.expectPaymentMethods(qaEnv.paymentMethods);
  });

  if (!qaEnv.completePurchase) {
    testInfo.annotations.push({ type: 'Arrêt volontaire', description: 'Prod : le test s\'arrête avant le paiement.' });
    return;
  }

  const client = loadClientTest();

  await etape(page, testInfo, '7. Renseigner contact et adresse de livraison', async () => {
    await checkout.fillContactAndAddress(client);
    await checkout.expectShippingMethodsOffered();
  });

  await etape(page, testInfo, '8. Payer avec la carte de test', async () => {
    await checkout.payWithCard({
      number: process.env.PREPROD_CARD_NUMBER ?? '4242424242424242',
      expiry: process.env.PREPROD_CARD_EXPIRY ?? '12/30',
      cvv: process.env.PREPROD_CARD_CVV ?? '123',
      name: process.env.PREPROD_CARD_NAME ?? 'QA Polene',
    });
  });

  await etape(page, testInfo, '9. Vérifier la confirmation de commande', async () => {
    const confirmation = await checkout.expectOrderConfirmed();
    testInfo.annotations.push({ type: 'Commande de test', description: `Confirmation n° ${confirmation}` });
  });

  await etape(page, testInfo, '10. Répondre au questionnaire « Comment avez-vous connu Polène Paris ? »', async () => {
    await checkout.answerAcquisitionSurvey(client.acquisitionSource);
    testInfo.annotations.push({ type: 'Source d\'acquisition', description: client.acquisitionSource });
  });
});
