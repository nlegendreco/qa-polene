import { expect, type Page } from '@playwright/test';
import { parsePriceToCents } from '../price';

export class CartPage {
  constructor(private readonly page: Page) {}

  get main() {
    return this.page.getByRole('main');
  }

  get lines() {
    return this.main.getByRole('listitem').filter({ has: this.page.getByRole('spinbutton') });
  }

  get checkoutButton() {
    return this.main.getByRole('button', { name: /^(Continuer|Checkout|Continue)$/i });
  }

  async expectLoaded() {
    // Titre exact : le bloc de recommandations s'appelle « Complétez votre panier ».
    await expect(this.main.getByRole('heading', { name: /^(Votre panier|Your (shopping )?(cart|bag))$/i })).toBeVisible();
  }

  line(productHandle: string) {
    return this.lines.filter({ has: this.page.locator(`a[href*="/products/${productHandle}"]`) });
  }

  async subtotalCents(): Promise<number | null> {
    // Le libellé et le montant sont dans des éléments séparés : on lit le plus petit bloc qui contient les deux.
    const block = this.main.locator('*', { hasText: /Sous total|Subtotal/i }).filter({ hasText: /€/ }).last();
    const text = await block.innerText();
    return parsePriceToCents(text.split(/Sous total|Subtotal/i)[1] ?? '');
  }

  async goToCheckout() {
    await this.checkoutButton.click();
    await this.page.waitForURL(/\/checkouts?\//, { timeout: 30_000 });
  }
}
