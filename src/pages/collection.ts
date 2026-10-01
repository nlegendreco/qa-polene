import { expect, type Page } from '@playwright/test';

export class CollectionPage {
  constructor(private readonly page: Page) {}

  get main() {
    return this.page.getByRole('main');
  }

  /** Cartes produit qui proposent un ajout au panier actif, donc en stock. */
  get inStockCards() {
    return this.main.getByRole('listitem').filter({
      has: this.page.getByRole('button', { name: /Ajouter au panier$|Add to (cart|bag)$/i, disabled: false }),
    });
  }

  async expectLoaded() {
    await expect(this.main.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(this.inStockCards.first()).toBeAttached();
  }

  /** Ouvre la première fiche produit en stock et renvoie son handle Shopify. */
  async openFirstInStockProduct(): Promise<string> {
    const productLink = this.inStockCards.first().getByRole('link').first();
    const href = (await productLink.getAttribute('href')) ?? '';
    const handle = href.match(/\/products\/([^/?#]+)/)?.[1];
    if (!handle) throw new Error(`Impossible de lire le handle produit depuis le lien "${href}"`);
    await productLink.click();
    await this.page.waitForURL(new RegExp(`/products/${handle}`));
    return handle;
  }
}
