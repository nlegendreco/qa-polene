import { test, expect, etape } from '../src/fixtures';
import { Header } from '../src/pages/header';
import { CollectionPage } from '../src/pages/collection';
import { ProductPage } from '../src/pages/product';
import { produitFixe } from '../src/produits-fixes';
import { appelShopify } from '../src/shopify';

/**
 * Ajout rapide depuis les cartes d'une collection (roadmap phase 2.2, fiche TNR PLP-04), sur la collection QA
 * « titre seul » (C5) de la préprod. On reste sur la collection : le produit part au panier sans ouvrir sa fiche.
 * Aucune commande. États des cartes (rupture, précommande, coming soon, nouveauté) : tests/etats-produit.spec.ts.
 */

const COLLECTION = 'collections/qa-collection-title';

type LignePanier = { handle: string; variant_id: number; quantity: number };
const lirePanier = async (page: import('@playwright/test').Page) =>
  (await (await appelShopify(page, 'La lecture du panier', () => page.request.get('cart.js'))).json() as { items: LignePanier[] }).items;

test(`Carte · ajout rapide d'un produit en stock (${produitFixe('QA01').id}) @tnr @plp`, async ({ page, qaEnv, isMobile }, testInfo) => {
  test.skip(qaEnv.name !== 'preprod', 'Produits QA : préprod uniquement');
  const produit = produitFixe('QA01');
  const header = new Header(page, isMobile);
  const collection = new CollectionPage(page);
  const fiche = new ProductPage(page);
  testInfo.annotations.push({ type: 'Produit testé', description: `${produit.id} (${produit.handle})` });

  await etape(page, testInfo, '1. Ouvrir la collection QA « titre seul » (C5) : panier vide', async () => {
    await page.goto(COLLECTION, { waitUntil: 'domcontentloaded' });
    await expect(collection.card(produit.handle), `La carte de ${produit.id} doit être dans la collection`).toBeVisible();
    expect(await header.cartCount(), 'Le panier doit être vide au départ').toBe(0);
  });

  await etape(page, testInfo, `2. ${isMobile ? 'Toucher l\'icône d\'ajout de la carte' : 'Survoler la carte et cliquer « Add to cart »'}`, async () => {
    const carte = collection.card(produit.handle);
    await carte.evaluate(e => e.scrollIntoView({ block: 'center', behavior: 'instant' }));
    if (!isMobile) await carte.hover();
    const bouton = collection.quickAddButton(produit.handle);
    await expect(bouton, 'La carte doit proposer l\'ajout rapide').toBeVisible();
    await expect(bouton, 'Le bouton doit s\'appeler « Add to cart », avec le nom du produit pour les lecteurs d\'écran sur mobile').toHaveAccessibleName(/Add to (cart|bag)|Ajouter au panier/i);
    await bouton.click();
  });

  await etape(page, testInfo, '3. Notification « ajouté au panier », compteur à 1, toujours sur la collection', async () => {
    await expect(fiche.cartNotification, 'La notification « ajouté au panier » doit apparaître').toBeVisible();
    await expect(fiche.cartNotification, 'La notification doit nommer le produit').toContainText(/QA Numéro Un/i);
    await expect.poll(() => header.cartCount(), { message: 'Le compteur du panier doit passer à 1' }).toBe(1);
    await expect(page, 'L\'ajout rapide ne doit pas quitter la collection').toHaveURL(/\/collections\/qa-collection-title/);
    const lignes = await lirePanier(page);
    expect(lignes.map(l => `${l.handle} × ${l.quantity}`), `Le panier doit contenir ${produit.id}, une fois`).toEqual([`${produit.handle} × 1`]);
  });
});

test(`Carte · ajout rapide d'une taille (${produitFixe('QA09').id}) @tnr @plp`, async ({ page, qaEnv, isMobile }, testInfo) => {
  test.skip(qaEnv.name !== 'preprod', 'Produits QA : préprod uniquement');
  const produit = produitFixe('QA09');
  const taille = produit.tailles!.disponibles[1];
  const header = new Header(page, isMobile);
  const collection = new CollectionPage(page);
  const fiche = new ProductPage(page);
  testInfo.annotations.push({ type: 'Produit testé', description: `${produit.id} (${produit.handle}), taille ${taille}` });
  let varianteAttendue!: number;

  await etape(page, testInfo, `1. Ouvrir la collection C5 : carte de ${produit.id}, tailles ${produit.tailles!.disponibles.join(', ')}`, async () => {
    const donnees = await fiche.fetchProductData(produit.handle);
    varianteAttendue = donnees.variants.find(v => v.option1 === taille)!.id;
    await page.goto(COLLECTION, { waitUntil: 'domcontentloaded' });
    await expect(collection.card(produit.handle), `La carte de ${produit.id} doit être dans la collection`).toBeVisible();
  });

  await etape(page, testInfo, `2. ${isMobile ? 'Toucher l\'icône d\'ajout : fenêtre « Select size »' : 'Survoler la carte : les tailles remplacent « Add to cart »'}, avec toutes les tailles`, async () => {
    const carte = collection.card(produit.handle);
    await carte.evaluate(e => e.scrollIntoView({ block: 'center', behavior: 'instant' }));
    if (isMobile) {
      await collection.quickAddButton(produit.handle).click();
      await expect(collection.quickAddSizeModal, 'L\'ajout rapide doit ouvrir la fenêtre « Select size »').toBeVisible();
    } else {
      // Sur ordinateur, le bouton « Add to cart » d'une carte à tailles est inactif : il faut choisir une taille.
      await expect(carte.locator('.component-quick-add__btn').first(), 'Sans taille choisie, l\'ajout rapide doit être inactif').toBeDisabled();
      await carte.hover();
    }
    for (const t of produit.tailles!.disponibles) {
      await expect(collection.quickAddSize(produit.handle, t, isMobile), `La taille ${t} doit être proposée`).toBeVisible();
    }
  });

  await etape(page, testInfo, `3. Choisir la taille ${taille}`, async () => {
    await collection.quickAddChooseSize(produit.handle, taille, isMobile);
  });

  await etape(page, testInfo, `4. Notification avec la taille ${taille}, compteur à 1, bonne variante au panier`, async () => {
    await expect(fiche.cartNotification, 'La notification « ajouté au panier » doit apparaître').toBeVisible();
    await expect(fiche.cartNotification, `La notification doit donner la taille choisie (${taille})`).toContainText(new RegExp(`(Size|Taille)\\s*:?\\s*${taille}\\b`, 'i'));
    await expect.poll(() => header.cartCount(), { message: 'Le compteur du panier doit passer à 1' }).toBe(1);
    const lignes = await lirePanier(page);
    expect(lignes.map(l => l.variant_id), `Le panier doit contenir la taille ${taille}, et elle seule`).toEqual([varianteAttendue]);
  });
});

test(`Carte · tailles épuisées : « Out of stock », ouvrent « Être prévenu(e) » sans rien ajouter (${produitFixe('QA10').id}) @tnr @plp`, async ({ page, qaEnv, isMobile }, testInfo) => {
  test.skip(qaEnv.name !== 'preprod', 'Produits QA : préprod uniquement');
  const produit = produitFixe('QA10');
  const { disponibles, indisponibles } = produit.tailles!;
  const epuisee = indisponibles[0];
  const header = new Header(page, isMobile);
  const collection = new CollectionPage(page);
  const fiche = new ProductPage(page);
  testInfo.annotations.push({ type: 'Produit testé', description: `${produit.id} (${produit.handle}), en stock : ${disponibles.join(', ')}, épuisées : ${indisponibles.join(', ')}` });

  await etape(page, testInfo, `1. Ouvrir la collection QA (C1) : carte de ${produit.id}, panier vide`, async () => {
    // C1 regroupe tous les produits QA : c'est la seule collection QA où figure ce bijou à tailles partielles.
    await page.goto('collections/qa-collection', { waitUntil: 'domcontentloaded' });
    await expect(collection.card(produit.handle), `La carte de ${produit.id} doit être dans la collection`).toBeVisible();
    expect(await header.cartCount(), 'Le panier doit être vide au départ').toBe(0);
  });

  await etape(page, testInfo, `2. ${isMobile ? 'Toucher l\'icône d\'ajout : fenêtre « Select size »' : 'Survoler la carte'} : tailles en stock à ajouter, tailles épuisées marquées « Out of stock »`, async () => {
    const carte = collection.card(produit.handle);
    await carte.evaluate(e => e.scrollIntoView({ block: 'center', behavior: 'instant' }));
    if (isMobile) {
      await collection.quickAddButton(produit.handle).click();
      await expect(collection.quickAddSizeModal, 'L\'ajout rapide doit ouvrir la fenêtre « Select size »').toBeVisible();
    } else {
      await carte.hover();
    }
    for (const t of disponibles) {
      await expect(collection.quickAddSize(produit.handle, t, isMobile), `La taille ${t} (en stock) doit proposer « Add to cart »`).toBeVisible();
    }
    for (const t of indisponibles) {
      const bouton = collection.quickAddSize(produit.handle, t, isMobile, true);
      await expect(bouton, `La taille ${t} (épuisée) doit être marquée « Out of stock »`).toBeVisible();
      await expect(bouton, `La taille ${t} doit être signalée épuisée au thème (data-state)`).toHaveAttribute('data-state', 'disabled');
    }
  });

  await etape(page, testInfo, `3. Choisir la taille épuisée ${epuisee} : fenêtre « Être prévenu(e) », rien au panier`, async () => {
    await collection.quickAddChooseSize(produit.handle, epuisee, isMobile, true);
    await expect(fiche.backInStockModal, `La taille ${epuisee} doit ouvrir la fenêtre « Être prévenu(e) »`).toBeVisible();
    await expect(fiche.backInStockModal.getByRole('textbox').first(), 'La fenêtre doit demander une adresse email').toBeVisible();
    const lignes = await lirePanier(page);
    expect(lignes, 'Une taille épuisée ne doit rien ajouter au panier').toEqual([]);
  });

  await etape(page, testInfo, '4. Fermer la fenêtre sans rien envoyer : toujours sur la collection', async () => {
    await fiche.backInStockModal.getByRole('button', { name: /Close modal|Fermer/i }).first().click();
    await expect(fiche.backInStockModal, 'La fenêtre doit se fermer').toBeHidden();
    await expect(page, 'On doit rester sur la collection').toHaveURL(/\/collections\/qa-collection/);
    expect(await header.cartCount(), 'Le panier doit rester vide').toBe(0);
  });
});
