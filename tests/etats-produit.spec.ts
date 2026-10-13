import { test, expect, etape } from '../src/fixtures';
import { Header } from '../src/pages/header';
import { ProductPage } from '../src/pages/product';
import { produitFixe } from '../src/produits-fixes';
import { formatCents, parsePriceToCents } from '../src/price';

/**
 * États produit (roadmap phase 2.2), sur les produits QA de la préprod (data/donnees-qa.json).
 * Aucun envoi de formulaire, aucun ajout au panier, aucune commande : on peut les lancer à tout moment.
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
