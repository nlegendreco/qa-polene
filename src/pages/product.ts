import { expect, type Page } from '@playwright/test';
import { appelShopify } from '../shopify';

export interface ProductData {
  handle: string;
  title: string;
  /** Prix de la première variante disponible, en centimes. */
  priceCents: number;
  /** Variantes du catalogue : identifiant Shopify, valeur de la première option (taille), disponibilité. */
  variants: { id: number; option1: string; available: boolean; price: number }[];
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

  /** Prix affiché sous le nom du produit (pas celui de la barre d'achat qui apparaît au défilement, cachée sur mobile). */
  get price() {
    return this.main.locator('[class*="price"]:not([class*="buy-bar"] *)').first();
  }

  /**
   * Données de référence du produit, lues dans le JSON public de Shopify.
   * Prix de la première variante disponible ; avec `rupture: true`, celui de la première variante (produit en rupture).
   */
  async fetchProductData(handle: string, { rupture = false } = {}): Promise<ProductData> {
    const response = await appelShopify(this.page, `La lecture du JSON du produit ${handle}`, () => this.page.request.get(`products/${handle}.js`));
    const json = await response.json() as { title: string; variants: ProductData['variants'] };
    const variant = rupture ? json.variants[0] : json.variants.find(v => v.available);
    if (!variant) throw new Error(`Le produit ${handle} n'a aucune variante disponible`);
    return { handle, title: json.title, priceCents: variant.price, variants: json.variants };
  }

  /**
   * Menu « Select size » de l'ancienne fiche : un select natif caché (la taille envoyée au panier) et une liste
   * maison, sans rôle ARIA, qui s'ouvre au clic. La nouvelle fiche ouvre à la place une fenêtre « Choose your size ».
   */
  get sizeSelector() {
    return this.main.locator('[data-ref="custom-select"]').filter({ visible: true }).first();
  }

  /** Une taille dans la liste du menu (ouverte ou non). Une taille épuisée porte disabled="true" et « Notify me ». */
  sizeOption(size: string) {
    return this.sizeSelector.locator('span.option').filter({ hasText: new RegExp(`^\\s*${size}\\s*$`) }).locator('xpath=..');
  }

  /** Valeur du select caché : identifiant de la variante choisie, « 0 » tant qu'aucune taille n'est choisie. */
  async selectedVariantId(): Promise<string> {
    return this.sizeSelector.locator('select').inputValue();
  }

  /** Ouvre le menu des tailles s'il est fermé (il se referme après chaque choix), puis touche la taille. */
  async chooseSize(size: string) {
    const option = this.sizeOption(size);
    if (!(await option.isVisible())) {
      await this.sizeSelector.evaluate(e => e.scrollIntoView({ block: 'center', behavior: 'instant' }));
      await this.sizeSelector.click();
      await expect(option, `La taille ${size} doit apparaître dans le menu des tailles`).toBeVisible();
    }
    await option.click();
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
