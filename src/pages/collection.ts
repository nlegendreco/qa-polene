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

  /** Carte d'un produit de la grille. */
  card(handle: string) {
    return this.main.locator('.component-product-card').filter({ has: this.page.locator(`a[href*="/products/${handle}"]`) }).first();
  }

  /**
   * Bouton d'ajout rapide d'une carte : « Add to cart » au survol sur ordinateur, icône nommée « <titre> - Add to cart »
   * sur mobile. Sur une carte à tailles, il ouvre sur mobile la fenêtre « Select size » ; sur ordinateur, il est inactif
   * et les tailles s'affichent à sa place au survol.
   */
  quickAddButton(handle: string) {
    return this.card(handle).locator('.component-quick-add__btn').filter({ visible: true }).first();
  }

  /** Fenêtre « Select size » de l'ajout rapide sur mobile. */
  get quickAddSizeModal() {
    return this.page.locator('component-modal.active').filter({ hasText: /Select size|Choisi\w* (votre|une) taille/i }).first();
  }

  /** Bouton d'une taille dans l'ajout rapide (« 52 - Add to cart »), sur la carte ou dans la fenêtre mobile. */
  quickAddSize(handle: string, size: string, isMobile: boolean) {
    const nom = { name: new RegExp(`^${size} - (Add to (cart|bag)|Ajouter au panier)$`, 'i') };
    return isMobile ? this.quickAddSizeModal.getByRole('button', nom) : this.card(handle).getByRole('button', nom);
  }

  /**
   * Ajoute une taille au panier depuis la carte. Sur ordinateur, les tailles n'apparaissent qu'au survol, avec une
   * transition : tant qu'elle n'est pas finie, le libellé « Add to cart » est encore au-dessus et le clic de Playwright
   * est refusé. On amène donc la souris sur la taille comme un client, on attend qu'elle soit au premier plan, puis on clique.
   */
  async quickAddChooseSize(handle: string, size: string, isMobile: boolean) {
    const carte = this.card(handle);
    await carte.evaluate(e => e.scrollIntoView({ block: 'center', behavior: 'instant' }));
    if (isMobile) {
      if (!(await this.quickAddSizeModal.isVisible())) await this.quickAddButton(handle).click();
      await expect(this.quickAddSizeModal, 'L\'ajout rapide doit ouvrir la fenêtre « Select size »').toBeVisible();
      await this.quickAddSize(handle, size, true).click();
      return;
    }
    await carte.hover();
    const taille = this.quickAddSize(handle, size, false);
    const zone = await taille.boundingBox();
    if (!zone) throw new Error(`La taille ${size} n'a pas de place sur la carte ${handle}`);
    const x = zone.x + zone.width / 2;
    const y = zone.y + zone.height / 2;
    await this.page.mouse.move(x, y, { steps: 5 });
    await expect.poll(() => taille.evaluate((e, [px, py]) => e.contains(document.elementFromPoint(px, py)), [x, y]), {
      message: `Au survol de la carte, la taille ${size} doit passer au premier plan`,
    }).toBe(true);
    await this.page.mouse.down();
    await this.page.mouse.up();
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
