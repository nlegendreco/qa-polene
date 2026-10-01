import { expect, type Page } from '@playwright/test';

export class Header {
  constructor(private readonly page: Page, private readonly isMobile: boolean) {}

  get banner() {
    return this.page.getByRole('banner');
  }

  get logo() {
    return this.banner.getByRole('link', { name: /Logo Polène|Polène logo/i });
  }

  get cartLink() {
    return this.banner.getByRole('link', { name: /Shopping cart with \d+ items?/i });
  }

  async cartCount(): Promise<number> {
    // Le nombre est dans un texte masqué : "Shopping cart with 1 items".
    const text = (await this.cartLink.first().textContent()) ?? '';
    return Number(text.match(/with (\d+) items?/i)?.[1] ?? NaN);
  }

  /** Ouvre une catégorie depuis le menu principal (burger sur mobile, barre de navigation sur desktop). */
  async openCategory(label: RegExp) {
    if (this.isMobile) {
      await this.banner.getByRole('button', { name: /Open main menu/i }).click();
      const nav = this.banner.getByRole('navigation', { name: /Menu principal|Main menu/i });
      await expect(nav).toBeVisible();
      // Sur mobile, la catégorie ouvre un sous-menu : il faut ensuite toucher "Voir tout".
      await nav.getByRole('link', { name: label }).first().click();
      const submenu = nav.getByRole('region', { name: label });
      await expect(submenu, 'Le sous-menu de la catégorie doit s\'ouvrir').toBeVisible();
      await submenu.getByRole('link', { name: /^(Voir tout|View all|Shop all)$/i }).click();
    } else {
      await this.banner.getByRole('navigation', { name: /Menu principal|Main menu/i })
        .getByRole('link', { name: label }).first().click();
    }
  }
}
