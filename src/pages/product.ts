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

  get cartNotification() {
    return this.page.locator('component-cart-notification.is-active');
  }

  /** Données de référence du produit, lues dans le JSON public de Shopify. */
  async fetchProductData(handle: string): Promise<ProductData> {
    const response = await appelShopify(this.page, `La lecture du JSON du produit ${handle}`, () => this.page.request.get(`products/${handle}.js`));
    const json = await response.json() as { title: string; variants: { available: boolean; price: number }[] };
    const variant = json.variants.find(v => v.available);
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
