import { test, expect, etape } from '../src/fixtures';
import { ProductPage } from '../src/pages/product';

/**
 * POC 1.6 : démonstration d'un échec, pour juger si le rapport permet de comprendre le problème.
 * Le test masque lui-même le bouton "Ajouter au panier" (rien n'est modifié sur le site),
 * comme le ferait une régression du thème.
 *
 * Lancement : npm run test:demo-echec
 */
test('Démo : bouton "Ajouter au panier" disparu @demo-echec', async ({ page }, testInfo) => {
  const product = new ProductPage(page);
  const handle = 'boky-textured-black';

  await etape(page, testInfo, '1. Ouvrir une fiche produit en stock', async () => {
    await page.goto(`products/${handle}`, { waitUntil: 'domcontentloaded' });
    await expect(product.title).toBeVisible();
  });

  await etape(page, testInfo, '2. Simuler la régression (bouton masqué par CSS)', async () => {
    await page.addStyleTag({ content: '.cta-primary-add-to-cart { display: none !important; }' });
  });

  await etape(page, testInfo, '3. Vérifier que le produit est achetable', async () => {
    await expect(product.addToCartButton, 'Le bouton "Ajouter au panier" doit être visible sur une fiche produit en stock').toBeVisible({ timeout: 5_000 });
  });
});
