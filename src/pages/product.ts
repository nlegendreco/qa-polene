import { expect, test, type Page } from '@playwright/test';
import { formatCents } from '../price';
import { appelShopify } from '../shopify';

export interface ProductData {
  handle: string;
  title: string;
  /** Variante de référence : la première disponible (ou la première, pour un produit en rupture). */
  variantId: number;
  /** Prix de la variante de référence, en centimes. */
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
    return { handle, title: json.title, variantId: variant.id, priceCents: variant.price, variants: json.variants };
  }

  /**
   * Vérifie qu'un prix lu (fiche, panier…) est celui du produit. En préprod, les prix en euros sont des dollars convertis
   * au taux du jour, que Shopify change plusieurs fois par jour (un euro d'écart). Si le prix lu diffère, on relit le
   * JSON du produit une fois : s'il donne le prix lu, c'est le taux qui a changé pendant le test. On le note et on garde
   * le nouveau prix pour la suite (`donnees` est mis à jour). Sinon, échec.
   */
  async expectPrice(lu: number | null, donnees: ProductData, message: string) {
    if (lu !== null && lu !== donnees.priceCents) {
      const relu = await this.fetchProductData(donnees.handle, { rupture: true });
      if (relu.variants.find(v => v.id === donnees.variantId)?.price === lu) {
        test.info().annotations.push({ type: 'Taux de change', description: `Prix passé de ${formatCents(donnees.priceCents)} à ${formatCents(lu)} pendant le test : Shopify a changé son taux de conversion des dollars en euros` });
        donnees.priceCents = lu;
        donnees.variants = relu.variants;
      }
    }
    expect(lu, `${message} (${formatCents(donnees.priceCents)})`).toBe(donnees.priceCents);
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

  /**
   * Onglets d'information de l'ancienne fiche (Description, Size & fit, Materials, Shipping and returns) : rangée
   * d'onglets sur ordinateur, accordéon sur mobile. Éléments `li[role=button]` avec aria-expanded ; seuls ceux affichés.
   */
  get infoTabs() {
    return this.main.locator('ul.product-detail-list > li[role="button"]').filter({ visible: true });
  }

  /** Un onglet par sa clé (data-item : description, details pour « Size & fit », materials, shipping). */
  infoTab(cle: string) {
    return this.main.locator(`ul.product-detail-list > li[role="button"][data-item="${cle}"]`).filter({ visible: true }).first();
  }

  /** Clé du contenu de chaque onglet affiché (data-item : description, details pour « Size & fit »…), dans l'ordre. */
  async infoTabKeys(): Promise<{ titre: string; cle: string }[]> {
    return this.infoTabs.evaluateAll(lis => lis.map(li => ({
      titre: li.querySelector('.product-detail-list__toggle-title')?.textContent?.trim() ?? '',
      cle: li.getAttribute('data-item') ?? '',
    })));
  }

  /**
   * Contenus d'onglet réellement affichés (hauteur non nulle, opaques), par clé. Sur ordinateur, le contenu prend
   * la place de la photo du produit (clé « img ») dans un bloc à part, où les contenus inactifs sont transparents.
   */
  async displayedInfoContents(): Promise<string[]> {
    return this.main.locator('[data-item-content]').evaluateAll(els => [...new Set(els.filter(e => {
      const r = e.getBoundingClientRect();
      const s = getComputedStyle(e);
      return r.height > 0 && s.visibility !== 'hidden' && Number(s.opacity) > 0.5;
    }).map(e => e.getAttribute('data-item-content') ?? ''))]);
  }

  /** Texte affiché d'un onglet (le contenu visible portant sa clé). */
  async infoContentText(cle: string): Promise<string> {
    const textes = await this.main.locator(`[data-item-content="${cle}"]`).evaluateAll(els => els
      .filter(e => e.getBoundingClientRect().height > 0 && Number(getComputedStyle(e).opacity) > 0.5)
      .map(e => (e as HTMLElement).innerText));
    return (textes[0] ?? '').replace(/\s+/g, ' ').trim();
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
