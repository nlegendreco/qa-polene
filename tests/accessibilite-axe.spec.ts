import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page, TestInfo } from '@playwright/test';
import { test, expect, etape, pourChaqueFiche } from '../src/fixtures';
import { ficheAffichee } from '../src/fiches';
import { produitFixe } from '../src/produits-fixes';
import { CartPage } from '../src/pages/cart';
import { CheckoutPage } from '../src/pages/checkout';
import { verifierAccessibilite } from '../src/accessibilite';

/**
 * Accessibilité relevée par axe, page par page, comparée au relevé de chaque page (src/accessibilite.ts) : seul un
 * problème absent du relevé fait échouer le test, ceux en cours de correction sont notés. Préprod : pages de sections
 * et pages réelles (data/pages-sections.json), espace client, checkout ; prod : les pages principales. Ordinateur et
 * téléphone (Chrome, iPhone), comme les pages de sections. Lecture seule, sans commande.
 */

/** Appels limités par Shopify : les 4 appareils sont gardés pour les parcours critiques (décision QA du 12 octobre 2026). */
const APPAREILS = ['desktop-chrome', 'iphone'];

interface PageTestee {
  /** Dossier du relevé : references/accessibilite/<cle>/. */
  cle: string;
  nom: string;
  chemin: string;
  etiquette: string;
  /** Code de réponse attendu, 200 par défaut. */
  statut?: number;
}

const slug = (texte: string) => texte.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const { pages: pagesSections } = JSON.parse(readFileSync(join(__dirname, '..', 'data', 'pages-sections.json'), 'utf8')) as {
  pages: { nom: string; chemin?: string; cheminProd?: string; produitFixe?: string; etiquette?: string; statut?: number }[];
};

/**
 * Pages de data/pages-sections.json, sauf la fiche produit, testée à part pour chaque fiche. Préprod : toutes ; prod :
 * celles qui y existent (`cheminProd`). Une page qui n'est pas la même en prod (collection QA → Sacs) a son propre relevé.
 */
const PAGES_PREPROD: PageTestee[] = pagesSections.filter(p => !p.produitFixe).map(p => ({
  cle: slug(p.nom), nom: p.nom, chemin: p.chemin ?? '', etiquette: p.etiquette ?? '@sections', statut: p.statut,
}));
const PAGES_PROD: PageTestee[] = pagesSections.filter(p => !p.produitFixe && p.cheminProd !== undefined).map(p => ({
  cle: p.cheminProd === (p.chemin ?? '') ? slug(p.nom) : slug(p.cheminProd!), nom: p.nom, chemin: p.cheminProd!,
  etiquette: p.etiquette ?? '@sections', statut: p.statut,
}));

/** Fiche produit de chaque environnement : QA01 en préprod, Cyme Mini camel (P08) en prod. */
const ficheProduit = (env: string) => env === 'preprod' ? `products/${produitFixe('QA01').handle}` : 'products/cyme-mini-textured-camel';
/** Produit mis au panier pour ouvrir le checkout. */
const produitPanier = (env: string) => env === 'preprod' ? produitFixe('QA01').handle : 'cyme-mini-textured-camel';

function conditions(testInfo: TestInfo, envVoulu: string | undefined, env: string) {
  if (envVoulu) test.skip(env !== envVoulu, `Page testée en ${envVoulu} seulement`);
  test.skip(!APPAREILS.includes(testInfo.project.name.split(' · ')[1]), `Accessibilité : ${APPAREILS.join(' et ')} seulement (appels Shopify gardés pour les parcours critiques)`);
}

/**
 * Page prête pour axe : parcourue jusqu'en bas (images et sections différées), revenue en haut. La fenêtre de
 * géolocalisation de la préprod est fermée par le gestionnaire de src/fixtures.ts dès la première action.
 */
async function preparer(page: Page) {
  await page.waitForLoadState('load');
  await page.evaluate(async () => {
    const hauteur = document.documentElement.scrollHeight;
    for (let y = 0; y < hauteur; y += window.innerHeight * 0.8) {
      window.scrollTo({ top: y, behavior: 'instant' });
      await new Promise(r => setTimeout(r, 120));
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
  });
  await page.locator('body').press('Shift');
  await page.waitForTimeout(1_000);
}

async function ouvrir(page: Page, chemin: string, statut = 200) {
  const reponse = await page.goto(chemin, { waitUntil: 'domcontentloaded' });
  expect(reponse?.status(), `La page ${chemin || 'd\'accueil'} doit répondre (code ${statut})`).toBe(statut);
  await preparer(page);
}

for (const [env, pages] of [['preprod', PAGES_PREPROD], ['prod', PAGES_PROD]] as const) {
  // Même nom de page dans les deux environnements (Accueil, Panier vide…) : un groupe par environnement.
  test.describe(env === 'prod' ? 'Prod' : 'Préprod', () => {
    for (const p of pages) {
      test(`Accessibilité (axe) · ${p.nom} @tnr @accessibilite ${p.etiquette}`, async ({ page, qaEnv }, testInfo) => {
        conditions(testInfo, env, qaEnv.name);
        await etape(page, testInfo, `1. Ouvrir la page ${p.nom}`, () => ouvrir(page, p.chemin, p.statut));
        await etape(page, testInfo, '2. Relever l\'accessibilité et la comparer au relevé de la page', () => verifierAccessibilite(page, testInfo, p.cle));
      });
    }
  });
}

pourChaqueFiche(fiche => {
  test('Accessibilité (axe) · Fiche produit @tnr @accessibilite @pdp', async ({ page, qaEnv }, testInfo) => {
    conditions(testInfo, undefined, qaEnv.name);
    await etape(page, testInfo, '1. Ouvrir la fiche produit', async () => {
      await ouvrir(page, ficheProduit(qaEnv.name));
      expect(await ficheAffichee(page), `Le Roll Out devait servir l'${fiche} fiche`).toBe(fiche);
    });
    await etape(page, testInfo, '2. Relever l\'accessibilité et la comparer au relevé de la page', () => verifierAccessibilite(page, testInfo, `fiche-produit-${fiche}`));
  });
});

test('Accessibilité (axe) · Checkout @tnr @accessibilite @checkout', async ({ page, qaEnv }, testInfo) => {
  conditions(testInfo, undefined, qaEnv.name);
  const checkout = new CheckoutPage(page);
  await etape(page, testInfo, '1. Mettre un produit au panier et ouvrir le checkout, sans rien saisir', async () => {
    const panier = new CartPage(page);
    await panier.addByUrl(produitPanier(qaEnv.name));
    await panier.goToCheckout();
    await checkout.expectLoaded();
    await preparer(page);
  });
  await etape(page, testInfo, '2. Relever l\'accessibilité et la comparer au relevé de la page', () => verifierAccessibilite(page, testInfo, 'checkout'));
});

/** Espace client de la préprod, connecté au compte de test (session de `npm run connexion:compte`, voir tests/compte-client.spec.ts). */
const SESSION = '.auth/compte-client.json';
const PAGES_COMPTE = [
  { cle: 'compte-accueil', nom: 'Accueil du compte', chemin: 'account' },
  { cle: 'compte-commandes', nom: 'Commandes', chemin: 'account?view=orders' },
  { cle: 'compte-profil', nom: 'Profil', chemin: 'account?view=profile' },
  { cle: 'compte-adresses', nom: 'Adresses', chemin: 'account/addresses' },
  { cle: 'compte-favoris', nom: 'Favoris du compte', chemin: 'account?view=wishlist' },
  { cle: 'compte-alertes', nom: 'Alertes de retour en stock', chemin: 'account?view=back-in-stock' },
  { cle: 'compte-assistance', nom: 'Assistance', chemin: 'account?view=assistance' },
];

test.describe('Espace client', () => {
  if (existsSync(SESSION)) test.use({ storageState: SESSION });
  for (const p of PAGES_COMPTE) {
    test(`Accessibilité (axe) · ${p.nom} @tnr @accessibilite @account`, async ({ page, qaEnv }, testInfo) => {
      conditions(testInfo, 'preprod', qaEnv.name);
      test.skip(!existsSync(SESSION), `Pas de session client : lancer « npm run connexion:compte » (${SESSION})`);
      await etape(page, testInfo, `1. Ouvrir la page ${p.nom} de l'espace client`, async () => {
        await page.goto(p.chemin, { waitUntil: 'domcontentloaded' });
        if (new URL(page.url()).pathname.endsWith('/password')) {
          // L'accès à la boutique expire avant la session du client : on ressaisit le mot de passe de la boutique.
          await page.locator('input[name="password"]').fill(process.env.PREPROD_PASSWORD ?? '');
          await page.locator('input[name="password"]').press('Enter');
          await page.waitForURL(url => !url.pathname.endsWith('/password'));
          await page.goto(p.chemin, { waitUntil: 'domcontentloaded' });
        }
        expect(page.url(), 'Session du compte client expirée (renvoi vers la connexion) : relancer « npm run connexion:compte »')
          .not.toMatch(/account\/login|customer_authentication|shopify\.com\/authentication/);
        // Historique des commandes, alertes, favoris : chargés après la page par l'application Polène.
        await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
        await preparer(page);
      });
      await etape(page, testInfo, '2. Relever l\'accessibilité et la comparer au relevé de la page', () => verifierAccessibilite(page, testInfo, p.cle));
    });
  }
});
