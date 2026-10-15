import { expect, type Locator, type Page } from '@playwright/test';

/** Une rubrique de la liste des favoris (« In-stock ( 2 ) », « Out of stock ( 1 ) ») et les cartes qu'elle contient. */
export interface RubriqueFavoris {
  titre: string;
  /** Nombre écrit dans le titre de la rubrique. */
  nombreAnnonce: number;
  /** Cartes réellement affichées dans la rubrique : handle et libellé du bouton d'achat. */
  cartes: { handle: string; bouton: string }[];
}

/**
 * Favoris (wishlist) : le cœur des fiches et des cartes, le compteur de l'en-tête, la page des favoris d'un visiteur
 * (`pages/wishlist`, favoris gardés dans le navigateur) et celle d'un client connecté (`account?view=wishlist`,
 * favoris enregistrés par l'application Polène).
 */
export class Wishlist {
  constructor(private readonly page: Page) {}

  /** Cœur de la fiche produit (le premier visible : la fiche en a un dans la barre d'achat sur mobile). */
  get productHeart() {
    return this.page.getByRole('main').locator('[data-ref="wishlist-button"]').filter({ visible: true }).first();
  }

  /** Cœur d'une carte produit (collection, page des favoris, carrousels). */
  cardHeart(card: Locator) {
    return card.locator('[data-ref="wishlist-button"]').first();
  }

  /** Message éphémère après un ajout ou un retrait (« The product has been added to your favorites. »). */
  get snackbar() {
    return this.page.locator('component-snackbar.active');
  }

  /** Compteur de favoris du lien « Wishlist » de l'en-tête. */
  async headerCount(): Promise<number> {
    const lien = this.page.getByRole('banner').getByRole('link', { name: /Wishlist|Favoris/i }).filter({ visible: true }).first();
    return Number(((await lien.textContent()) ?? '').match(/\d+/)?.[0] ?? NaN);
  }

  /**
   * Clique sur un cœur et attend qu'il change d'état, avec le message attendu. Le libellé du cœur ne change pas
   * (« Add to Wishlist » même quand le produit est en favori) : l'état est porté par `aria-pressed`.
   */
  async toggle(coeur: Locator, ajout: boolean) {
    await coeur.evaluate(e => e.scrollIntoView({ block: 'center', behavior: 'instant' }));
    // Sur une carte, le cœur n'est cliquable qu'au survol (avant, le lien de la photo est au-dessus).
    const carte = coeur.locator('xpath=ancestor::*[contains(concat(" ", @class, " "), " component-product-card ")][1]');
    if (await carte.count()) await carte.hover();
    await coeur.click();
    await expect(coeur, ajout ? 'Le cœur doit se remplir (produit en favori)' : 'Le cœur doit se vider (produit retiré des favoris)')
      .toHaveAttribute('aria-pressed', ajout ? 'true' : 'false');
    await expect(this.snackbar.first(), ajout ? 'Un message doit confirmer l\'ajout aux favoris' : 'Un message doit confirmer le retrait des favoris')
      .toContainText(ajout ? /added to your favorites|ajouté à vos favoris/i : /removed from your favorites|(retiré|supprimé) de vos favoris/i);
  }

  /** Retire un produit depuis la page des favoris : message de retrait, puis sa carte disparaît de la liste. */
  async removeFromList(handle: string) {
    const carte = this.page.getByRole('main').locator('component-accordion .component-product-card')
      .filter({ has: this.page.locator(`a[href*="/products/${handle}"]`) }).first();
    const coeur = this.cardHeart(carte);
    await coeur.evaluate(e => e.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await carte.hover();
    await coeur.click();
    await expect(this.snackbar.first(), `Un message doit confirmer le retrait de ${handle}`).toContainText(/removed from your favorites|(retiré|supprimé) de vos favoris/i);
    await expect(carte, `La carte de ${handle} doit disparaître de la page des favoris`).toBeHidden();
  }

  /**
   * Rubriques de la page des favoris, telles qu'affichées. La page est remplie après coup (application Polène, ou
   * favoris du navigateur pour un visiteur) : on attend que la lecture ne change plus.
   */
  async sections(): Promise<RubriqueFavoris[]> {
    const rubriques = this.page.getByRole('main').locator('component-accordion').filter({ has: this.page.locator('[role=region]') });
    await expect(rubriques.or(this.emptyMessage).filter({ visible: true }).first(), 'La page des favoris doit afficher ses produits ou son état vide').toBeVisible({ timeout: 20_000 });
    let precedente = '';
    for (let essai = 0; essai < 15; essai++) {
      const lecture = JSON.stringify(await this.readSections());
      if (lecture === precedente) break;
      precedente = lecture;
      await this.page.waitForTimeout(800);
    }
    return JSON.parse(precedente) as RubriqueFavoris[];
  }

  private readSections(): Promise<RubriqueFavoris[]> {
    const rubriques = this.page.getByRole('main').locator('component-accordion').filter({ has: this.page.locator('[role=region]') });
    return rubriques.evaluateAll(els => els.filter(el => el.checkVisibility()).map(el => {
      const titre = (el.querySelector('button')?.textContent ?? '').replace(/\s+/g, ' ').trim();
      const region = el.querySelector('[role=region]');
      const cartes = [...(region?.querySelectorAll('.component-product-card') ?? [])].map(carte => ({
        handle: carte.querySelector('a[href*="/products/"]')?.getAttribute('href')?.match(/\/products\/([^/?#]+)/)?.[1] ?? '?',
        bouton: (carte.querySelector('.component-quick-add__btn, button[class*="add-to-cart"], .coming-soon-modal-trigger')?.textContent ?? '').replace(/\s+/g, ' ').trim(),
      }));
      return { titre, nombreAnnonce: Number(titre.match(/\(\s*(\d+)\s*\)/)?.[1] ?? NaN), cartes };
    }));
  }

  /** Message de la page des favoris vide (« Your wishlist is empty. »). */
  get emptyMessage() {
    return this.page.getByRole('main').getByText(/Your wishlist is empty|Vos favoris sont vides|Votre wishlist est vide/i);
  }

  /**
   * Vérifie la page des favoris : chaque rubrique annonce autant de produits qu'elle en montre, les produits en stock
   * proposent l'ajout au panier, les produits épuisés sont dans « Out of stock », et la liste contient exactement les
   * produits attendus.
   */
  async expectSections(attendus: string[]) {
    const rubriques = await this.sections();
    for (const r of rubriques) {
      expect.soft(r.nombreAnnonce, `La rubrique « ${r.titre} » annonce ${r.nombreAnnonce} produit(s) mais en montre ${r.cartes.length} (${r.cartes.map(c => c.handle).join(', ') || 'aucun'})`)
        .toBe(r.cartes.length);
      const epuisee = /out of stock|rupture|épuisé/i.test(r.titre);
      for (const c of r.cartes) {
        const enStock = /add to (cart|bag)|ajouter au panier|preorder|précommande/i.test(c.bouton);
        expect.soft(enStock, `${c.handle} est dans « ${r.titre} » avec le bouton « ${c.bouton} »`).toBe(!epuisee);
      }
    }
    const affiches = rubriques.flatMap(r => r.cartes.map(c => c.handle)).sort();
    expect(affiches, 'La page des favoris doit montrer exactement les produits mis en favori').toEqual([...attendus].sort());
    return rubriques;
  }
}
