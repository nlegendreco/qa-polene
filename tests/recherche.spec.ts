import type { Page } from '@playwright/test';
import { test, expect, etape } from '../src/fixtures';
import { parsePriceToCents } from '../src/price';
import { HANDLES_QA, produitFixe } from '../src/produits-fixes';

/**
 * Recherche (roadmap phase 2.3) : le champ de l'en-tête, puis la page de résultats. Préprod : le produit QA22 est le
 * seul produit QA visible dans la recherche (« Searchable ») ; il doit sortir en premier, sans les autres produits QA.
 * Prod : « Cyme » doit donner des sacs Cyme en tête. La recherche de Shopify rend aussi des produits « proches » (225
 * résultats pour « Searchable » en préprod), d'où des vérifications sur la tête de liste seulement. Un mot qui n'existe
 * pas donne parfois des produits (constat 14) : pas testé.
 */

/** Mot cherché, et nom attendu des `combien` premiers résultats (un seul produit QA est cherchable en préprod). */
const MOTS: Record<string, { mot: string; enTete: RegExp; combien: number }> = {
  preprod: { mot: 'Searchable', enTete: /QA Numéro Un/i, combien: 1 },
  prod: { mot: 'Cyme', enTete: /^Cyme\b/i, combien: 4 },
};

function lireResultats(page: Page) {
  return page.locator('main component-product-card').evaluateAll(cartes => cartes.map(c => ({
    handle: c.querySelector('a[href*="/products/"]')?.getAttribute('href')?.match(/\/products\/([^/?#]+)/)?.[1] ?? '',
    nom: c.querySelector('.component-product-card__footer__details__label--title')?.textContent?.trim() ?? '',
    prix: c.querySelector('.component-product-card__footer__details__label--price')?.textContent?.trim() ?? '',
    photo: !!c.querySelector('img'),
  })));
}

test('Recherche · depuis l\'en-tête, page de résultats @tnr @search', async ({ page, qaEnv, isMobile }, testInfo) => {
  const { mot, enTete, combien } = MOTS[qaEnv.name];
  testInfo.annotations.push({ type: 'Mot cherché', description: mot });

  await etape(page, testInfo, `1. Ouvrir la recherche de l'en-tête et taper « ${mot} »`, async () => {
    await page.goto('', { waitUntil: 'domcontentloaded' });
    await page.getByRole('banner').getByRole('button', { name: /^(Search|Recherche|Rechercher)$/i }).filter({ visible: true }).first().click();
    const champ = page.getByRole('searchbox').filter({ visible: true }).first();
    await expect(champ, 'Le champ de recherche doit s\'ouvrir').toBeVisible();
    if (!isMobile) await expect(champ, 'Le curseur doit être dans le champ').toBeFocused();
    await champ.fill(mot);
    await champ.press('Enter');
  });

  await etape(page, testInfo, '2. Page de résultats : le mot cherché et le nombre de résultats dans le titre', async () => {
    await expect(page, 'La recherche doit ouvrir la page de résultats').toHaveURL(new RegExp(`/search\\?.*q=${mot}`));
    const titre = page.getByRole('main').getByRole('heading', { level: 1 });
    await expect(titre, 'Le titre doit reprendre le mot cherché').toContainText(new RegExp(`"${mot}"`, 'i'));
    const nombre = Number(((await titre.textContent()) ?? '').match(/\((\d+)\)/)?.[1] ?? NaN);
    testInfo.annotations.push({ type: 'Résultats', description: String(nombre) });
    const resultats = await lireResultats(page);
    expect(resultats.length, 'La page doit afficher des produits').toBeGreaterThan(0);
    expect(nombre, 'Le nombre annoncé ne peut pas être plus petit que le nombre de produits affichés').toBeGreaterThanOrEqual(resultats.length);
  });

  await etape(page, testInfo, '3. Cartes de résultats : nom, prix, photo et lien ; les bons produits en tête', async () => {
    const resultats = await lireResultats(page);
    const incompletes = resultats.filter(r => !r.handle || !r.nom || !parsePriceToCents(r.prix) || !r.photo).map(r => r.handle || r.nom || '?');
    expect.soft(incompletes, 'Cartes sans nom, prix, photo ou lien').toEqual([]);
    expect(resultats.slice(0, combien).map(r => r.nom).filter(n => !enTete.test(n)), `Les ${combien} premiers résultats doivent correspondre à « ${mot} »`).toEqual([]);
    if (qaEnv.name === 'preprod') {
      expect(resultats[0].handle, `${produitFixe('QA22').id} doit être le premier résultat`).toBe(produitFixe('QA22').handle);
      const autresQa = resultats.map(r => r.handle).filter(h => HANDLES_QA.includes(h) && h !== produitFixe('QA22').handle);
      expect(autresQa, 'Les autres produits QA doivent rester cachés de la recherche').toEqual([]);
    }
  });

  await etape(page, testInfo, '4. Cliquer le premier résultat : sa fiche s\'ouvre', async () => {
    const premier = page.locator('main component-product-card').first();
    const handle = (await lireResultats(page))[0].handle;
    await premier.locator('a[href*="/products/"]').first().click();
    await expect(page, `La fiche de ${handle} doit s'ouvrir`).toHaveURL(new RegExp(`/products/${handle}`));
    await expect(page.getByRole('main').getByRole('heading', { level: 1 }).first()).toBeVisible();
  });
});
