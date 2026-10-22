import { existsSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { test, expect, etape, ficheDeLAppareil } from '../src/fixtures';
import { ProductPage } from '../src/pages/product';
import { Wishlist } from '../src/pages/wishlist';
import { produitFixe } from '../src/produits-fixes';

/**
 * Favoris (wishlist), roadmap phase 2.3, fiches TNR PDP-08/09, PLP-05 et ACCOUNT-14 à 16.
 *
 * - Visiteur (prod et préprod) : les favoris sont gardés dans le navigateur. Un produit mis en favori depuis sa fiche,
 *   deux autres depuis leur carte de collection, puis la page des favoris (`pages/wishlist`) : chaque rubrique (« En
 *   stock », « En rupture de stock ») doit annoncer autant de produits qu'elle en montre, chaque produit être dans la
 *   bonne rubrique, et les produits d'une rubrique côte à côte. Un retrait depuis la page met tout à jour.
 * - Client connecté : mêmes vérifications sur `account?view=wishlist`, où les favoris sont enregistrés par
 *   l'application Polène. Préprod : compte +qacompte (session de `npm run connexion:compte`). Prod : compte +qacompte de
 *   la prod, connexion par email et mot de passe (PROD_COMPTE_EMAIL et PROD_COMPTE_PASSWORD dans .env). Le test vide les
 *   favoris du compte au début et à la fin.
 *
 * Ces tests ont détecté en prod les deux bugs annoncés par la QA le 15 octobre 2026 : nombres et rubriques faux
 * (constat 48), produits les uns sous les autres au lieu d'une grille (constat 51). Corrigés en prod le jour même.
 */

/** Produits mis en favori. Préprod : QA01 et QA08 en stock, QA02 en rupture. Prod : l'état des stocks bouge. */
const PRODUITS: Record<string, { fiche: string; cartes: { collection: string; handle?: string }[] }> = {
  preprod: {
    fiche: produitFixe('QA01').handle,
    cartes: [
      { collection: 'collections/qa-collection-out-of-stock', handle: produitFixe('QA02').handle },
      { collection: 'collections/qa-collection', handle: produitFixe('QA08').handle },
    ],
  },
  prod: { fiche: produitFixe('P08').handle, cartes: [{ collection: 'collections/handbags' }, { collection: 'collections/handbags' }] },
};

/** Ouvre la page des favoris et laisse l'application Polène la remplir. */
async function ouvrirFavoris(page: Page, chemin: string) {
  const chargement = page.waitForResponse(r => /wishlist/.test(r.url()) && r.request().resourceType() !== 'document', { timeout: 20_000 }).catch(() => null);
  await page.goto(chemin, { waitUntil: 'domcontentloaded' });
  await chargement;
}

// Cœur de la fiche : une fiche du Roll Out par appareil (FICHE_PAR_APPAREIL, src/fixtures.ts).
test.use({ fiche: ficheDeLAppareil, ficheDeRepli: true });

/** Rubriques comparées sans tenir compte de l'ordre des produits dans chacune. */
const parRubrique = (rubriques: { cartes: { handle: string }[] }[]) => rubriques.map(r => r.cartes.map(c => c.handle).sort());

test('Favoris · visiteur : cœur de la fiche et de la carte, page des favoris @tnr @pdp @plp', async ({ page, qaEnv, isMobile }, testInfo) => {
  const produits = PRODUITS[qaEnv.name];
  const favoris = new Wishlist(page);
  const attendus: string[] = [produits.fiche];

  await etape(page, testInfo, `1. Fiche ${produits.fiche} : le cœur ajoute le produit aux favoris, compteur à 1`, async () => {
    await new ProductPage(page).goto(produits.fiche);
    await expect(favoris.productHeart, 'Le cœur doit être vide au départ').toHaveAttribute('aria-pressed', 'false');
    await favoris.toggle(favoris.productHeart, true);
    await expect.poll(() => favoris.headerCount(), { message: 'Le compteur des favoris de l\'en-tête doit passer à 1' }).toBe(1);
  });

  await etape(page, testInfo, '2. Collections : le cœur d\'une carte ajoute deux autres produits, compteur à 3', async () => {
    for (const carteVoulue of produits.cartes) {
      if (!new URL(page.url()).pathname.endsWith(`/${carteVoulue.collection}`)) await page.goto(carteVoulue.collection, { waitUntil: 'domcontentloaded' });
      const cartes = page.getByRole('main').locator('.collection__product-grid > component-product-card');
      let carte = cartes.filter({ has: page.locator(`a[href*="/products/${carteVoulue.handle}"]`) }).first();
      // Prod : la première carte qui n'est pas déjà en favori.
      if (!carteVoulue.handle) carte = cartes.filter({ hasNot: page.locator(attendus.map(h => `a[href*="/products/${h}"]`).join(', ')) }).first();
      await expect(carte, 'La collection doit afficher la carte du produit').toBeAttached();
      const handle = ((await carte.locator('a[href*="/products/"]').first().getAttribute('href')) ?? '').match(/\/products\/([^/?#]+)/)![1];
      attendus.push(handle);
      await favoris.toggle(favoris.cardHeart(carte), true);
      await expect.poll(() => favoris.headerCount(), { message: `Le compteur des favoris de l'en-tête doit passer à ${attendus.length}` }).toBe(attendus.length);
    }
    testInfo.annotations.push({ type: 'Favoris', description: attendus.join(', ') });
  });

  await etape(page, testInfo, '3. Page des favoris : rubriques justes, produits côte à côte', async () => {
    await ouvrirFavoris(page, 'pages/wishlist');
    await expect(page.getByRole('main').getByRole('link', { name: /^(Sign in|Se connecter)$/i }), 'Un visiteur doit se voir proposer la connexion pour garder ses favoris').toBeVisible();
    const rubriques = await favoris.expectSections(attendus);
    testInfo.annotations.push({ type: 'Rubriques', description: rubriques.map(r => `${r.titre} : ${r.cartes.map(c => c.handle).join(', ') || 'vide'}`).join(' | ') });
    if (qaEnv.name === 'preprod') {
      expect(parRubrique(rubriques), 'QA01 et QA08 doivent être « In-stock », QA02 « Out of stock »')
        .toEqual([[produits.fiche, produits.cartes[1].handle!].sort(), [produits.cartes[0].handle!]]);
    }
    const grille = await favoris.expectGrid(isMobile);
    testInfo.annotations.push({ type: 'Grille', description: grille.map(l => `${l.titre} : ${l.parLigne} par ligne sur ${l.produits}`).join(' | ') });
  });

  await etape(page, testInfo, `4. Retirer ${produits.fiche} depuis la page des favoris : il disparaît, compteur à 2`, async () => {
    await favoris.removeFromList(produits.fiche);
    await expect.poll(() => favoris.headerCount(), { message: 'Le compteur des favoris de l\'en-tête doit passer à 2' }).toBe(2);
    await ouvrirFavoris(page, 'pages/wishlist');
    await favoris.expectSections(attendus.slice(1));
  });
});

const SESSION = '.auth/compte-client.json';

/** Favoris du compte : préprod, un en stock (deux pour juger la grille) et un en rupture ; prod, trois sacs. */
const PRODUITS_COMPTE: Record<string, string[]> = {
  preprod: [produitFixe('QA01').handle, produitFixe('QA08').handle, produitFixe('QA02').handle],
  // Produits connus de la prod (P08 et deux sacs du carrousel du panier) : l'état de leur stock ne compte pas.
  prod: [produitFixe('P08').handle, 'cyme-textured-camel', 'numero-neuf-mini-textured-black'],
};

test.describe('Favoris du client connecté', () => {
  test.use({ storageState: existsSync(SESSION) ? SESSION : undefined });
  // Pas de choix de fiche : il remplacerait le cookie de la session client enregistrée. Les deux fiches sont acceptées.
  test.use({ fiche: async ({}, use) => use(undefined) });

  test('Favoris · client connecté : ajout depuis les fiches, page des favoris du compte, retrait @tnr @account', async ({ page, qaEnv, isMobile }, testInfo) => {
    if (qaEnv.name === 'preprod') test.skip(!existsSync(SESSION), `Pas de session client : lancer « npm run connexion:compte » (${SESSION})`);
    else test.skip(!process.env.PROD_COMPTE_EMAIL || !process.env.PROD_COMPTE_PASSWORD, 'Compte de prod : PROD_COMPTE_EMAIL et PROD_COMPTE_PASSWORD absents de .env');
    // Un seul appareil : les favoris sont ceux du compte, deux navigateurs en même temps se marcheraient dessus.
    test.skip(testInfo.project.name.split(' · ')[1] !== 'desktop-chrome', 'Favoris du compte : Chrome ordinateur seulement (un seul compte de test)');
    const favoris = new Wishlist(page);
    const produits = PRODUITS_COMPTE[qaEnv.name];

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

    if (qaEnv.name === 'prod') {
      await etape(page, testInfo, '0. Prod : se connecter au compte de test (email et mot de passe)', async () => {
        await page.goto('account/login', { waitUntil: 'domcontentloaded' });
        const main = page.getByRole('main');
        await main.getByRole('textbox', { name: /Email/i }).fill(process.env.PROD_COMPTE_EMAIL!);
        await main.getByRole('textbox', { name: /Mot de passe|Password/i }).fill(process.env.PROD_COMPTE_PASSWORD!);
        await main.getByRole('button', { name: /^(Soumettre|Submit|Se connecter|Sign in)$/i }).click();
        await page.waitForURL(url => !url.pathname.endsWith('/account/login'), { timeout: 20_000 }).catch(() => {});
        const refus = await main.getByText(/incorrect|Too many attempts|trop de tentatives/i).first().textContent().catch(() => null);
        expect(page.url(), refus
          ? `Connexion refusée par la prod (« ${refus.trim()} ») : compte pas encore créé, mot de passe changé, ou trop d'essais`
          : 'La connexion doit mener à l\'espace client (vérification anti-robot ?)').toMatch(/\/account(\?|$)/);
      });
    }

    await etape(page, testInfo, '1. Ouvrir les favoris du compte et les vider s\'il en reste d\'un essai précédent', async () => {
      await ouvrirCompte();
      await expect(page.getByRole('main').getByRole('heading', { name: /Your favorites|Vos favoris/i })).toBeVisible();
      await viderFavoris();
    });

    await etape(page, testInfo, `2. Mettre en favori ${produits.join(', ')} depuis leurs fiches`, async () => {
      for (const handle of produits) {
        await page.goto(`products/${handle}`, { waitUntil: 'domcontentloaded' });
        await favoris.toggle(favoris.productHeart, true);
      }
      await expect.poll(() => favoris.headerCount(), { message: `Le compteur des favoris de l'en-tête doit passer à ${produits.length}` }).toBe(produits.length);
    });

    try {
      await etape(page, testInfo, '3. Favoris du compte : rubriques justes, produits côte à côte', async () => {
        await ouvrirCompte();
        const rubriques = await favoris.expectSections(produits);
        testInfo.annotations.push({ type: 'Rubriques', description: rubriques.map(r => `${r.titre} : ${r.cartes.map(c => c.handle).join(', ') || 'vide'}`).join(' | ') });
        if (qaEnv.name === 'preprod') {
          expect(parRubrique(rubriques), 'QA01 et QA08 doivent être « In-stock », QA02 « Out of stock »').toEqual([[produits[0], produits[1]].sort(), [produits[2]]]);
        }
        const grille = await favoris.expectGrid(isMobile);
        testInfo.annotations.push({ type: 'Grille', description: grille.map(l => `${l.titre} : ${l.parLigne} par ligne sur ${l.produits}`).join(' | ') });
      });

      await etape(page, testInfo, '4. Retirer tous les produits : la page passe à l\'état vide, compteur à 0', async () => {
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
