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

  quantity(productHandle: string) {
    return this.line(productHandle).getByRole('spinbutton');
  }

  increaseButton(productHandle: string) {
    return this.line(productHandle).getByRole('button', { name: /^(Increase quantity|Augmenter)/i });
  }

  /**
   * Bouton « − » à gauche de la quantité. À 1, il devient une corbeille « Remove item », qui porte le même nom que la
   * croix de la ligne : on le repère par sa place dans le compteur de quantité.
   */
  decreaseButton(productHandle: string) {
    return this.line(productHandle).locator('.input-counter__button--decrement');
  }

  /** Fenêtre « Remove item ? » qui demande de confirmer la suppression d'un article. */
  get removeDialog() {
    return this.page.getByRole('dialog', { name: /Remove item|Supprimer l'article|Retirer/i });
  }

  get emptyHeading() {
    return this.main.getByRole('heading', { name: /Your (shopping )?(cart|bag) is empty|Votre panier est vide/i });
  }

  /** Remplit le panier par l'adresse /cart/add?id=… plutôt que par l'API (cart/add.js), vite limitée par Shopify (429). */
  async addByUrl(productHandle: string) {
    await this.page.goto(`products/${productHandle}`, { waitUntil: 'domcontentloaded' });
    const variante = await this.page.locator('form[action*="/cart/add"] [name="id"]').first().inputValue();
    expect(variante, `La fiche ${productHandle} doit contenir le formulaire d'ajout au panier`).toMatch(/^\d+$/);
    await this.page.goto(`cart/add?id=${variante}&quantity=1`, { waitUntil: 'load' });
    await this.expectLoaded();
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
