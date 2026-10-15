import { existsSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { test, expect, etape } from '../src/fixtures';
import { Wishlist } from '../src/pages/wishlist';
import { produitFixe } from '../src/produits-fixes';

/**
 * Favoris (wishlist), roadmap phase 2.3, fiches TNR PDP-08/09, PLP-05 et ACCOUNT-14 à 16.
 *
 * - Visiteur (prod et préprod) : les favoris sont gardés dans le navigateur. Un produit mis en favori depuis sa fiche,
 *   un autre depuis sa carte de collection, puis la page des favoris (`pages/wishlist`) : chaque rubrique (« En stock »,
 *   « En rupture de stock ») doit annoncer autant de produits qu'elle en montre, et chaque produit être dans la bonne
 *   rubrique. Un retrait depuis la page met tout à jour. En prod, le test échoue sur ce point (constat 48, bug
 *   annoncé par la QA le 15 octobre 2026 et déjà corrigé en préprod).
 * - Client connecté (préprod, compte de test +qacompte) : mêmes vérifications sur `account?view=wishlist`, où les
 *   favoris sont enregistrés par l'application Polène. Le test vide les favoris du compte au début et à la fin.
 */

/** Produits mis en favori : un en stock et un en rupture en préprod (produits QA), deux vrais produits en prod. */
const PRODUITS: Record<string, { fiche: string; carte: { collection: string; handle?: string } }> = {
  preprod: { fiche: produitFixe('QA01').handle, carte: { collection: 'collections/qa-collection-out-of-stock', handle: produitFixe('QA02').handle } },
  // En prod, l'état des stocks bouge : la vérification ne dépend pas de l'état de chaque produit.
  prod: { fiche: produitFixe('P08').handle, carte: { collection: 'collections/handbags' } },
};

/** Ouvre la page des favoris et laisse l'application Polène la remplir. */
async function ouvrirFavoris(page: Page, chemin: string) {
  const chargement = page.waitForResponse(r => /wishlist/.test(r.url()) && r.request().resourceType() !== 'document', { timeout: 20_000 }).catch(() => null);
  await page.goto(chemin, { waitUntil: 'domcontentloaded' });
  await chargement;
}

test('Favoris · visiteur : cœur de la fiche et de la carte, page des favoris @tnr @pdp @plp', async ({ page, qaEnv }, testInfo) => {
  const produits = PRODUITS[qaEnv.name];
  const favoris = new Wishlist(page);
  const attendus: string[] = [produits.fiche];

  await etape(page, testInfo, `1. Fiche ${produits.fiche} : le cœur ajoute le produit aux favoris, compteur à 1`, async () => {
    await page.goto(`products/${produits.fiche}`, { waitUntil: 'domcontentloaded' });
    await expect(favoris.productHeart, 'Le cœur doit être vide au départ').toHaveAttribute('aria-pressed', 'false');
    await favoris.toggle(favoris.productHeart, true);
    await expect.poll(() => favoris.headerCount(), { message: 'Le compteur des favoris de l\'en-tête doit passer à 1' }).toBe(1);
  });

  await etape(page, testInfo, '2. Collection : le cœur d\'une carte ajoute un second produit, compteur à 2', async () => {
    await page.goto(produits.carte.collection, { waitUntil: 'domcontentloaded' });
    const cartes = page.getByRole('main').locator('.collection__product-grid > component-product-card');
    const carte = produits.carte.handle
      ? cartes.filter({ has: page.locator(`a[href*="/products/${produits.carte.handle}"]`) }).first()
      : cartes.filter({ hasNot: page.locator(`a[href*="/products/${produits.fiche}"]`) }).first();
    await expect(carte, 'La collection doit afficher la carte du produit').toBeAttached();
    const handle = ((await carte.locator('a[href*="/products/"]').first().getAttribute('href')) ?? '').match(/\/products\/([^/?#]+)/)![1];
    attendus.push(handle);
    testInfo.annotations.push({ type: 'Favoris', description: attendus.join(', ') });
    await favoris.toggle(favoris.cardHeart(carte), true);
    await expect.poll(() => favoris.headerCount(), { message: 'Le compteur des favoris de l\'en-tête doit passer à 2' }).toBe(2);
  });

  await etape(page, testInfo, '3. Page des favoris : chaque rubrique annonce autant de produits qu\'elle en montre, dans la bonne rubrique', async () => {
    await ouvrirFavoris(page, 'pages/wishlist');
    await expect(page.getByRole('main').getByRole('link', { name: /^(Sign in|Se connecter)$/i }), 'Un visiteur doit se voir proposer la connexion pour garder ses favoris').toBeVisible();
    const rubriques = await favoris.expectSections(attendus);
    testInfo.annotations.push({ type: 'Rubriques', description: rubriques.map(r => `${r.titre} : ${r.cartes.map(c => c.handle).join(', ') || 'vide'}`).join(' | ') });
    if (qaEnv.name === 'preprod') {
      // Préprod : QA01 en stock, QA02 en rupture, chacun dans sa rubrique.
      expect(rubriques.map(r => r.cartes.map(c => c.handle)), 'QA01 doit être « In-stock », QA02 « Out of stock »').toEqual([[produits.fiche], [produits.carte.handle]]);
    }
  });

  await etape(page, testInfo, `4. Retirer ${produits.fiche} depuis la page des favoris : il disparaît, compteur à 1`, async () => {
    await favoris.removeFromList(produits.fiche);
    await expect.poll(() => favoris.headerCount(), { message: 'Le compteur des favoris de l\'en-tête doit passer à 1' }).toBe(1);
    await ouvrirFavoris(page, 'pages/wishlist');
    await favoris.expectSections(attendus.slice(1));
  });
});

const SESSION = '.auth/compte-client.json';

test.describe('Favoris du client connecté', () => {
  test.use({ storageState: existsSync(SESSION) ? SESSION : undefined });

  test('Favoris · client connecté : ajout depuis les fiches, page des favoris du compte, retrait @tnr @account', async ({ page, qaEnv }, testInfo) => {
    test.skip(qaEnv.name !== 'preprod', 'Espace client : préprod uniquement (pas de connexion en prod pour l\'instant)');
    test.skip(!existsSync(SESSION), `Pas de session client : lancer « npm run connexion:compte » (${SESSION})`);
    // Un seul appareil : les favoris sont ceux du compte, deux navigateurs en même temps se marcheraient dessus.
    test.skip(testInfo.project.name.split(' · ')[1] !== 'desktop-chrome', 'Favoris du compte : Chrome ordinateur seulement (un seul compte de test)');
    const favoris = new Wishlist(page);
    const enStock = produitFixe('QA01');
    const rupture = produitFixe('QA02');

    const ouvrirCompte = async () => {
      await ouvrirFavoris(page, 'account?view=wishlist');
      if (new URL(page.url()).pathname.endsWith('/password')) {
        // Accès à la boutique expiré dans la session du compte (voir tests/compte-client.spec.ts).
        await page.locator('input[name="password"]').fill(process.env.PREPROD_PASSWORD!);
        await page.locator('input[name="password"]').press('Enter');
        await page.waitForURL(url => !url.pathname.endsWith('/password'));
        await ouvrirFavoris(page, 'account?view=wishlist');
      }
      expect(page.url(), 'Session du compte client expirée : relancer « npm run connexion:compte »').not.toMatch(/account\/login|customer_authentication|shopify\.com\/authentication/);
    };
    const viderFavoris = async () => {
      for (const r of await favoris.sections()) for (const c of r.cartes) await favoris.removeFromList(c.handle);
    };

    await etape(page, testInfo, '1. Ouvrir les favoris du compte et les vider s\'il en reste d\'un essai précédent', async () => {
      await ouvrirCompte();
      await expect(page.getByRole('main').getByRole('heading', { name: /Your favorites|Vos favoris/i })).toBeVisible();
      await viderFavoris();
    });

    await etape(page, testInfo, `2. Mettre en favori ${enStock.id} (en stock) et ${rupture.id} (rupture) depuis leurs fiches`, async () => {
      for (const p of [enStock, rupture]) {
        await page.goto(`products/${p.handle}`, { waitUntil: 'domcontentloaded' });
        await favoris.toggle(favoris.productHeart, true);
      }
      await expect.poll(() => favoris.headerCount(), { message: 'Le compteur des favoris de l\'en-tête doit passer à 2' }).toBe(2);
    });

    try {
      await etape(page, testInfo, '3. Favoris du compte : « In-stock ( 1 ) » avec QA01 et l\'ajout au panier, « Out of stock ( 1 ) » avec QA02', async () => {
        await ouvrirCompte();
        const rubriques = await favoris.expectSections([enStock.handle, rupture.handle]);
        expect(rubriques.map(r => r.cartes.map(c => c.handle)), `${enStock.id} doit être « In-stock », ${rupture.id} « Out of stock »`).toEqual([[enStock.handle], [rupture.handle]]);
      });

      await etape(page, testInfo, '4. Retirer les deux produits : la page passe à « Your wishlist is empty », compteur à 0', async () => {
        await viderFavoris();
        await expect.poll(() => favoris.headerCount(), { message: 'Le compteur des favoris de l\'en-tête doit revenir à 0' }).toBe(0);
        await ouvrirCompte();
        await expect(favoris.emptyMessage, 'La page doit afficher l\'état vide').toBeVisible();
        const lien = page.getByRole('main').getByRole('link', { name: /new in|nouveautés/i });
        await expect(lien, 'L\'état vide doit proposer les nouveautés').toHaveAttribute('href', /collections\/new-in/);
      });
    } finally {
      // Le compte de test doit rester sans favori pour les autres tests de l'espace client.
      if (!/account\?view=wishlist/.test(page.url())) await ouvrirCompte().catch(() => {});
      await viderFavoris().catch(() => {});
    }
  });
});
