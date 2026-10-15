import { expect, test, type Page } from '@playwright/test';
import { formatCents } from '../price';
import { appelShopify } from '../shopify';
import { NOM_FICHE, ficheAffichee, ficheVoulue, type Fiche } from '../fiches';

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

/** Vignettes de coloris de l'ancienne fiche, puis de la nouvelle (diapositives liens vers une autre fiche). */
const COLORIS = '.js-color-option, a.component-carousel__slide[href*="/products/"]';

/** Onglets de l'ancienne fiche : `li[role=button]` jusqu'au 14 octobre 2026, bouton dans le `li` depuis. */
const ONGLETS_ANCIENNE_FICHE = 'ul.product-detail-list > li[role="button"], ul.product-detail-list > li > button';

export class ProductPage {
  constructor(private readonly page: Page) {}

  get main() {
    return this.page.getByRole('main');
  }

  /** Ouvre la fiche, attend le nom du produit et vérifie que c'est la fiche demandée au Roll Out (src/fiches.ts). */
  async goto(handle: string, { waitUntil = 'domcontentloaded' as 'domcontentloaded' | 'load' } = {}) {
    const reponse = await this.page.goto(`products/${handle}`, { waitUntil });
    await expect(this.title, 'Le nom du produit doit s\'afficher').toBeVisible();
    await this.verifierFiche();
    return reponse;
  }

  /** Fiche affichée : l'ancienne (onglets, vignettes, menu « Select size ») ou la nouvelle (« Explore all »…). */
  async fiche(): Promise<Fiche> {
    return ficheAffichee(this.page);
  }

  /** Si le test a demandé une fiche (fixture `fiche`), vérifie que le Roll Out l'a bien servie. */
  async verifierFiche() {
    const voulue = ficheVoulue.get(this.page);
    if (voulue) expect(await this.fiche(), `Le Roll Out devait servir l'${NOM_FICHE[voulue]}`).toBe(voulue);
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

  /** Fenêtre « Coming soon » d'un produit à venir (inscription au lancement), ouverte depuis la fiche ou la carte. */
  get comingSoonModal() {
    return this.page.locator('component-modal.active[data-ref="coming-soon-modal"]');
  }

  get cartNotification() {
    return this.page.locator('component-cart-notification.is-active');
  }

  /**
   * Vignettes de coloris : un lien par fiche de la même famille (métachamp filter.families). Ancienne fiche :
   * `.js-color-option`, classe is-active sur celle du produit affiché. Nouvelle fiche : diapositives d'un carrousel,
   * classe active et aria-current="page", et la liste complète dans la fenêtre « Explore all (N) ».
   */
  get colorOptions() {
    return this.main.locator(COLORIS).filter({ visible: true });
  }

  colorOption(handle: string) {
    return this.main.locator(COLORIS.split(', ').map(s => `${s}[href*="/products/${handle}"]`).join(', ')).filter({ visible: true }).first();
  }

  /** Handles des vignettes de coloris affichées, dans l'ordre, et celui de la vignette active. */
  async colorHandles(): Promise<{ tous: string[]; actif: string[] }> {
    return this.colorOptions.evaluateAll(liens => {
      const handle = (a: Element) => a.getAttribute('href')?.split('/products/')[1]?.split(/[?#]/)[0] ?? '';
      const actif = (a: Element) => a.classList.contains('is-active') || a.getAttribute('aria-current') === 'page';
      return { tous: liens.map(handle), actif: liens.filter(actif).map(handle) };
    });
  }

  /** Nouvelle fiche : bouton « Explore all (N) » qui ouvre la fenêtre de tous les coloris. */
  get exploreAllButton() {
    return this.main.getByRole('button', { name: /^(Explore all|Découvrir tout)\s*\(\d+\)$/i }).filter({ visible: true }).first();
  }

  /** Nouvelle fiche : fenêtre « Select a color » ouverte par « Explore all ». */
  get colorModal() {
    return this.page.getByRole('dialog', { name: /Color selector|coloris|couleur/i }).filter({ visible: true });
  }

  /** Barre d'achat fixée en bas de l'écran sur mobile (titre, prix, bouton). Sur mobile, le bouton principal est le sien. */
  get stickyBuyBar() {
    return this.page.locator('.sticky-buy-bar');
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

  /**
   * Une taille dans la liste du menu (ouverte ou non). Une taille épuisée porte « Notify me » et est marquée
   * indisponible : disabled="true" jusqu'au 14 octobre 2026, role="option" et aria-disabled="true" depuis le
   * 15 octobre 2026 (menu devenu une vraie liste déroulante pour les lecteurs d'écran).
   */
  sizeOption(size: string) {
    return this.sizeSelector.locator('span.option').filter({ hasText: new RegExp(`^\\s*${size}\\s*$`) }).locator('xpath=..');
  }

  /** La taille est-elle marquée indisponible dans le menu (ancien ou nouveau balisage) ? */
  async sizeOptionDisabled(size: string): Promise<boolean> {
    return this.sizeOption(size).evaluate(o => o.getAttribute('disabled') === 'true' || o.getAttribute('aria-disabled') === 'true');
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
   * Nouvelle fiche : fenêtre « Choose your size », ouverte par le bouton principal (data-state="modal"). Une case
   * radio par taille (« 50 », « 52 Out of stock », « M Pre-order »), un bouton d'ajout qui change avec la taille
   * choisie, et le guide des tailles en dessous.
   */
  get sizeModal() {
    return this.page.locator('component-modal.active').filter({ has: this.page.locator('.product-size-selector') });
  }

  /** Case radio d'une taille dans la fenêtre (son nom commence par la taille). */
  sizeRadio(size: string) {
    return this.sizeModal.getByRole('radio', { name: new RegExp(`^${size}(\\s|$)`) });
  }

  /** Bouton d'ajout de la fenêtre des tailles (Add to cart, Notify me, Preorder now). */
  get sizeModalButton() {
    return this.sizeModal.locator('.cta-primary-add-to-cart').filter({ visible: true }).first();
  }

  /** Ouvre la fenêtre des tailles par le bouton principal « Choose your size ». */
  async openSizeModal() {
    await this.mainButton.evaluate(e => e.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await this.mainButton.click();
    await expect(this.sizeModal, 'La fenêtre « Choose your size » doit s\'ouvrir').toBeVisible();
  }

  /** Choisit une taille dans la fenêtre, en touchant son libellé (la case radio est cachée sous le libellé). */
  async chooseSizeInModal(size: string) {
    await this.sizeModal.locator('label').filter({ hasText: new RegExp(`^\\s*${size}(\\s|$)`) }).first().click();
    await expect(this.sizeRadio(size), `La taille ${size} doit être cochée`).toBeChecked();
  }

  /** Nouvelle fiche : onglets Description, Details, Composition, Shipping & Return (rôle tab), Description ouvert. */
  get tabs() {
    return this.main.getByRole('tab').filter({ visible: true });
  }

  /** Nouvelle fiche : contenu de l'onglet sélectionné (un seul tabpanel affiché à la fois). */
  get tabPanels() {
    return this.main.getByRole('tabpanel').filter({ visible: true });
  }

  /**
   * Onglets d'information de l'ancienne fiche (Description, Size & fit, Materials, Shipping and returns) : rangée
   * d'onglets sur ordinateur, accordéon sur mobile. Avec aria-expanded ; seuls ceux affichés. Jusqu'au 14 octobre 2026,
   * `li[role=button]` ; depuis le 15 octobre 2026 (préprod), un vrai bouton dans chaque `li`.
   */
  get infoTabs() {
    return this.main.locator(ONGLETS_ANCIENNE_FICHE).filter({ visible: true });
  }

  /** Un onglet par sa clé (data-item : description, details pour « Size & fit », materials, shipping). */
  infoTab(cle: string) {
    return this.main.locator(ONGLETS_ANCIENNE_FICHE.split(', ').map(s => `${s}[data-item="${cle}"]`).join(', ')).filter({ visible: true }).first();
  }

  /** Clé du contenu de chaque onglet affiché (data-item : description, details pour « Size & fit »…), dans l'ordre. */
  async infoTabKeys(): Promise<{ titre: string; cle: string }[]> {
    return this.infoTabs.evaluateAll(onglets => onglets.map(o => ({
      titre: (o.querySelector('.product-detail-list__toggle-title') ?? o).textContent?.replace(/\s+/g, ' ').trim() ?? '',
      cle: o.getAttribute('data-item') ?? '',
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
