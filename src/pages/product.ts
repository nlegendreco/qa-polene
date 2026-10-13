import { expect, type Page } from '@playwright/test';
import { appelShopify } from '../shopify';

export interface ProductData {
  handle: string;
  title: string;
  /** Prix de la première variante disponible, en centimes. */
  priceCents: number;
}

export class ProductPage {
  constructor(private readonly page: Page) {}

  get main() {
    return this.page.getByRole('main');
  }

  get title() {
    return this.main.getByRole('heading', { level: 1 }).first();
  }

  get addToCartButton() {
    // Libellé seul ("Ajouter au panier") ou suivi du nom du produit ("Add to cart - Numéro Un Nano - …").
    // On exclut le bouton collant qui affiche aussi le prix ("Add to cart €423,95").
    return this.main.getByRole('button', { name: /^(Ajouter au panier|Add to (cart|bag))( - .+)?$/i });
  }

  /** Bouton principal de la fiche, quel que soit l'état (ajout, précommande, alerte de retour en stock…). Le thème en a un second, collant. */
  get mainButton() {
    return this.main.locator('.cta-primary-add-to-cart:visible').first();
  }

  /** Fenêtre « Être prévenu(e) » d'un produit en rupture (back in stock). */
  get backInStockModal() {
    return this.page.locator('component-modal.active[data-ref="bis-modal"]');
  }

  get cartNotification() {
    return this.page.locator('component-cart-notification.is-active');
  }

  /** Prix affiché sous le nom du produit. */
  get price() {
    return this.main.locator('[class*="price"]').first();
  }

  /**
   * Données de référence du produit, lues dans le JSON public de Shopify.
   * Prix de la première variante disponible ; avec `rupture: true`, celui de la première variante (produit en rupture).
   */
  async fetchProductData(handle: string, { rupture = false } = {}): Promise<ProductData> {
    const response = await appelShopify(this.page, `La lecture du JSON du produit ${handle}`, () => this.page.request.get(`products/${handle}.js`));
    const json = await response.json() as { title: string; variants: { available: boolean; price: number }[] };
    const variant = rupture ? json.variants[0] : json.variants.find(v => v.available);
    if (!variant) throw new Error(`Le produit ${handle} n'a aucune variante disponible`);
    return { handle, title: json.title, priceCents: variant.price };
  }

  async expectPurchasable() {
    await expect(this.title).toBeVisible();
    await expect(this.addToCartButton).toBeVisible();
    await expect(this.addToCartButton).toBeEnabled();
  }

  async addToCart() {
    await this.addToCartButton.click();
    await expect(this.cartNotification, 'La notification "ajouté au panier" doit apparaître').toBeVisible();
  }
}
