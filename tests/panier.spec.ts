import { test, expect, etape } from '../src/fixtures';
import { Header } from '../src/pages/header';
import { CartPage } from '../src/pages/cart';
import { CheckoutPage } from '../src/pages/checkout';
import { ProductPage } from '../src/pages/product';
import { produitFixe } from '../src/produits-fixes';
import { formatCents, parsePriceToCents } from '../src/price';
import { appelShopify } from '../src/shopify';

/**
 * Panier (roadmap phase 2.2, fiches TNR CART-01 à CART-04, toutes « Bloquant »), sur les produits QA de la préprod.
 * Aucune commande : on s'arrête au plus à l'arrivée sur le checkout, sans rien saisir. Le panier est rempli par
 * l'adresse /cart/add?id=…, pas par l'API que Shopify limite vite (429), sauf une précommande : seul le bouton de
 * la fiche pose ses propriétés (_is_preorder, _preorder_date).
 */

const MENTION_PRECOMMANDE = /Pre-?order|Précommand/i;

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

test(`Panier · mixte, en stock et précommande (${produitFixe('QA01').id} + ${produitFixe('QA05').id}) @tnr @cart`, async ({ page, qaEnv, isMobile }, testInfo) => {
  test.skip(qaEnv.name !== 'preprod', 'Produits QA : préprod uniquement');
  const enStock = produitFixe('QA01');
  const precommande = produitFixe('QA05');
  const header = new Header(page, isMobile);
  const fiche = new ProductPage(page);
  const panier = new CartPage(page);
  const checkout = new CheckoutPage(page);
  testInfo.annotations.push({ type: 'Produits testés', description: `${enStock.id} (${enStock.handle}) en stock, ${precommande.id} (${precommande.handle}) en précommande, expédition le ${precommande.datePrecommande}` });
  const prixLigne = async (handle: string) => (await panier.linePriceCents(handle))!;
  let sousTotal!: number;

  await etape(page, testInfo, `1. Mettre ${enStock.id} au panier : une ligne, « 1 product »`, async () => {
    await panier.addByUrl(enStock.handle);
    await expect(panier.lines, 'Le panier doit contenir une seule ligne').toHaveCount(1);
    await expect(panier.itemCountLabel, 'Le compteur du panier doit dire « 1 product » (singulier)').toHaveText(/^\s*1\s+(product|produit|article|item)\s*$/i);
  });

  await etape(page, testInfo, `2. Précommander ${precommande.id} depuis sa fiche`, async () => {
    await page.goto(`products/${precommande.handle}`, { waitUntil: 'domcontentloaded' });
    await expect.poll(() => fiche.mainButton.innerText(), { message: 'Le bouton principal doit proposer de précommander' }).toMatch(MENTION_PRECOMMANDE);
    await centrer(fiche.mainButton);
    await fiche.mainButton.click();
    await expect(fiche.cartNotification, 'La notification « ajouté au panier » doit apparaître').toBeVisible();
    await expect(fiche.cartNotification, 'La notification doit dire qu\'il s\'agit d\'une précommande').toContainText(MENTION_PRECOMMANDE);
    await expect.poll(() => header.cartCount(), { message: 'Le compteur du panier doit passer à 2' }).toBe(2);
  });

  await etape(page, testInfo, '3. Vérifier le panier : deux lignes, précommande sur la seule ligne concernée, sous-total = somme des lignes', async () => {
    await page.goto('cart', { waitUntil: 'domcontentloaded' });
    await panier.expectLoaded();
    await expect(panier.lines, 'Le panier doit contenir deux lignes').toHaveCount(2);
    await expect(panier.itemCountLabel, 'Le compteur du panier doit dire « 2 products » (pluriel)').toHaveText(/^\s*2\s+(products|produits|articles|items)\s*$/i);
    await expect(panier.line(precommande.handle), `La ligne ${precommande.id} doit dire qu'il s'agit d'une précommande`).toContainText(MENTION_PRECOMMANDE);
    await expect(panier.line(precommande.handle), `La ligne ${precommande.id} doit donner la date d'expédition`).toContainText(/Shipping on|Expédition/i);
    await expect(panier.line(enStock.handle), `La ligne ${enStock.id} (en stock) ne doit pas parler de précommande`).not.toContainText(/Pre-?order:|Précommande\s*:|Shipping on|Expédition le/i);
    sousTotal = (await panier.subtotalCents())!;
    const lignes = { [enStock.id]: await prixLigne(enStock.handle), [precommande.id]: await prixLigne(precommande.handle) };
    testInfo.annotations.push({ type: 'Prix des lignes', description: Object.entries(lignes).map(([id, p]) => `${id} ${formatCents(p)}`).join(', ') });
    expect(sousTotal, `Le sous-total doit être la somme des deux lignes (${formatCents(lignes[enStock.id] + lignes[precommande.id])})`).toBe(lignes[enStock.id] + lignes[precommande.id]);
    // Ce que le panier transmettra à la commande : seule la précommande porte les propriétés cachées.
    const contenu = await (await appelShopify(page, 'La lecture du panier', () => page.request.get('cart.js'))).json() as { items: { handle: string; properties: Record<string, string> | null }[] };
    const proprietes = (handle: string) => contenu.items.find(i => i.handle === handle)?.properties ?? {};
    expect(proprietes(precommande.handle)._is_preorder, `${precommande.id} doit être marqué comme précommande (_is_preorder)`).toBe('true');
    expect(proprietes(precommande.handle)._preorder_date, `${precommande.id} doit porter sa date de précommande (_preorder_date)`).toBe(precommande.datePrecommande);
    expect(proprietes(enStock.handle)._is_preorder, `${enStock.id} (en stock) ne doit pas être marqué comme précommande`).toBeUndefined();
  });

  await etape(page, testInfo, '4. Arriver au checkout, sans rien saisir : les deux produits et le même total', async () => {
    await panier.goToCheckout();
    await checkout.expectLoaded();
    await checkout.expectProductInSummary('QA Numéro Un');
    await checkout.expectProductInSummary('QA Solé');
    await checkout.expectTotalVisible(sousTotal);
  });

  await etape(page, testInfo, `5. Retirer ${precommande.id} avec la croix : reste ${enStock.id}, « 1 product »`, async () => {
    await page.goto('cart', { waitUntil: 'domcontentloaded' });
    await panier.expectLoaded();
    const prixRestant = await prixLigne(enStock.handle);
    await centrer(panier.removeButton(precommande.handle));
    await panier.removeButton(precommande.handle).click();
    // La croix demande confirmation, comme la corbeille du « − » à 1 (fenêtre lente à venir sous Safari).
    await expect(panier.removeDialog, 'La croix doit ouvrir la fenêtre « Remove item ? »').toBeVisible();
    await expect(panier.removeDialog, `La fenêtre doit rappeler le produit retiré (${precommande.id})`).toContainText(/QA Sol/i);
    await panier.removeDialog.getByRole('button', { name: /Yes, remove|Oui, (supprimer|retirer)/i }).click();
    await expect(panier.lines, `Seule la ligne ${enStock.id} doit rester`).toHaveCount(1);
    await expect(panier.line(enStock.handle)).toBeVisible();
    await expect(panier.itemCountLabel, 'Le compteur du panier doit revenir à « 1 product »').toHaveText(/^\s*1\s+(product|produit|article|item)\s*$/i);
    await expect.poll(() => panier.subtotalCents(), { message: `Le sous-total doit revenir au prix de ${enStock.id} (${formatCents(prixRestant)})` }).toBe(prixRestant);
    await expect.poll(() => header.cartCount(), { message: 'Le compteur de l\'en-tête doit revenir à 1' }).toBe(1);
  });
});
