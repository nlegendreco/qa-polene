import { test, expect, etape } from '../src/fixtures';
import { Header } from '../src/pages/header';
import { CartPage } from '../src/pages/cart';
import { produitFixe } from '../src/produits-fixes';
import { formatCents, parsePriceToCents } from '../src/price';

/**
 * Panier (roadmap phase 2.2, fiches TNR CART-01, CART-03 et CART-04, toutes « Bloquant »), sur les produits QA de
 * la préprod. Aucune commande : on ne va pas jusqu'au checkout. Le panier est rempli par l'adresse /cart/add?id=…,
 * pas par l'API que Shopify limite vite (429).
 */

/** Sur mobile, le header fixe recouvre un bouton amené en haut d'écran : on le centre avant de toucher. */
const centrer = (element: import('@playwright/test').Locator) => element.evaluate(e => e.scrollIntoView({ block: 'center', behavior: 'instant' }));

test(`Panier · quantité, suppression et panier vide (${produitFixe('QA01').id}) @tnr @cart`, async ({ page, qaEnv, isMobile }, testInfo) => {
  test.skip(qaEnv.name !== 'preprod', 'Produits QA : préprod uniquement');
  const produit = produitFixe('QA01');
  const header = new Header(page, isMobile);
  const panier = new CartPage(page);
  testInfo.annotations.push({ type: 'Produit testé', description: `${produit.id} (${produit.handle})` });
  let prix!: number;

  await etape(page, testInfo, `1. Mettre ${produit.id} au panier : une ligne, quantité 1, sous-total = prix`, async () => {
    await panier.addByUrl(produit.handle);
    await expect(panier.lines, 'Le panier doit contenir une seule ligne').toHaveCount(1);
    await expect(panier.quantity(produit.handle), 'La quantité doit être 1').toHaveValue('1');
    prix = parsePriceToCents(await panier.line(produit.handle).innerText())!;
    expect(prix, 'La ligne doit afficher le prix du produit').toBeGreaterThan(0);
    expect(await panier.subtotalCents(), `Le sous-total doit être égal au prix de la ligne (${formatCents(prix)})`).toBe(prix);
  });

  await etape(page, testInfo, '2. « + » : quantité 2, sous-total doublé', async () => {
    await centrer(panier.increaseButton(produit.handle));
    await panier.increaseButton(produit.handle).click();
    await expect(panier.quantity(produit.handle), 'La quantité doit passer à 2').toHaveValue('2');
    await expect.poll(() => panier.subtotalCents(), { message: `Le sous-total doit passer à ${formatCents(2 * prix)}` }).toBe(2 * prix);
    await expect.poll(() => header.cartCount(), { message: 'Le compteur du panier doit passer à 2' }).toBe(2);
  });

  await etape(page, testInfo, '3. « − » : retour à 1, sous-total = prix', async () => {
    await panier.decreaseButton(produit.handle).click();
    await expect(panier.quantity(produit.handle), 'La quantité doit revenir à 1').toHaveValue('1');
    await expect.poll(() => panier.subtotalCents(), { message: `Le sous-total doit revenir à ${formatCents(prix)}` }).toBe(prix);
  });

  await etape(page, testInfo, '4. « − » à 1 : la fenêtre « Remove item ? » demande confirmation, la fermer ne supprime rien', async () => {
    await expect(panier.decreaseButton(produit.handle), 'À 1, le bouton « − » doit proposer de retirer l\'article').toHaveAccessibleName(/Remove item|Supprimer|Retirer/i);
    await panier.decreaseButton(produit.handle).click();
    await expect(panier.removeDialog, 'Une fenêtre doit demander de confirmer la suppression').toBeVisible();
    await expect(panier.removeDialog, 'La fenêtre doit rappeler le produit et son prix').toContainText(/QA Numéro Un/i);
    await expect(panier.removeDialog.getByRole('button', { name: /Yes, remove|Oui, (supprimer|retirer)/i }), 'La fenêtre doit proposer de confirmer').toBeVisible();
    await panier.removeDialog.getByRole('button', { name: /Close modal|Fermer/i }).click();
    await expect(panier.removeDialog, 'La fenêtre doit se fermer').toBeHidden();
    await expect(panier.lines, 'Fermer la fenêtre ne doit pas retirer l\'article').toHaveCount(1);
    await expect(panier.quantity(produit.handle), 'La quantité doit rester à 1').toHaveValue('1');
  });

  await etape(page, testInfo, '5. Confirmer la suppression : panier vide, compteur à 0', async () => {
    await panier.decreaseButton(produit.handle).click();
    await panier.removeDialog.getByRole('button', { name: /Yes, remove|Oui, (supprimer|retirer)/i }).click();
    await expect(panier.emptyHeading, 'Le panier doit annoncer qu\'il est vide').toBeVisible();
    await expect(panier.lines, 'Plus aucune ligne ne doit rester').toHaveCount(0);
    await expect.poll(() => header.cartCount(), { message: 'Le compteur du panier doit revenir à 0' }).toBe(0);
  });

  await etape(page, testInfo, '6. Panier vide : le bouton « Discover Polène selection » mène au catalogue', async () => {
    const decouvrir = panier.main.getByRole('link', { name: /Discover Polène selection|Découvrir la sélection/i });
    await expect(decouvrir, 'Le panier vide doit proposer de découvrir la sélection').toBeVisible();
    const lien = (await decouvrir.getAttribute('href')) ?? '';
    testInfo.annotations.push({ type: 'Lien du panier vide', description: lien });
    await centrer(decouvrir);
    await decouvrir.click();
    await expect(page, 'Le bouton doit quitter le panier').not.toHaveURL(/\/cart(\?|$)/);
    await expect(page.getByRole('main').getByRole('heading', { level: 1 }), 'La page d\'arrivée doit avoir un titre').toBeVisible();
  });
});

test(`Panier · dernière pièce, quantité bloquée à 1 (${produitFixe('QA03').id}) @tnr @cart`, async ({ page, qaEnv, isMobile }, testInfo) => {
  test.skip(qaEnv.name !== 'preprod', 'Produits QA : préprod uniquement');
  const produit = produitFixe('QA03');
  const header = new Header(page, isMobile);
  const panier = new CartPage(page);
  testInfo.annotations.push({ type: 'Produit testé', description: `${produit.id} (${produit.handle}), stock en ligne : 1` });
  let prix!: number;

  await etape(page, testInfo, `1. Mettre la dernière pièce ${produit.id} au panier`, async () => {
    await panier.addByUrl(produit.handle);
    await expect(panier.quantity(produit.handle), 'La quantité doit être 1').toHaveValue('1');
    prix = (await panier.subtotalCents())!;
  });

  await etape(page, testInfo, '2. « + » : la quantité reste à 1, le sous-total ne bouge pas', async () => {
    const refus = page.waitForResponse(r => /\/cart\/change/.test(r.url()), { timeout: 15_000 }).catch(() => null);
    await centrer(panier.increaseButton(produit.handle));
    await panier.increaseButton(produit.handle).click();
    const reponse = await refus;
    if (reponse) testInfo.annotations.push({ type: 'Réponse de Shopify', description: `cart/change : code ${reponse.status()} (422 = stock insuffisant)` });
    await expect(panier.quantity(produit.handle), 'Une seule pièce est en stock : la quantité doit rester à 1').toHaveValue('1');
    expect(await panier.subtotalCents(), `Le sous-total doit rester à ${formatCents(prix)}`).toBe(prix);
    expect(await header.cartCount(), 'Le compteur du panier doit rester à 1').toBe(1);
    // Message de Shopify sous la ligne : « Un article seulement a été ajouté à votre panier en raison de la disponibilité. »
    await expect(panier.line(produit.handle).getByRole('alert'), 'Le client doit être prévenu que le stock est épuisé')
      .toContainText(/disponibilit|availab|stock/i);
  });
});
