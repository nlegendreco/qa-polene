import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page, TestInfo } from '@playwright/test';
import { test, expect } from './fixtures';
import { produitFixe } from './produits-fixes';

/**
 * Pages relevées une à une par les tests d'accessibilité (axe) et de structure : celles de data/pages-sections.json
 * en préprod, celles qui existent aussi en prod (`cheminProd`), la fiche produit (à part, pour chacune des deux
 * fiches du Roll Out) et l'espace client de la préprod. Chaque page a son relevé de référence,
 * references/<type de relevé>/<cle>/<projet>.json.
 */

/** Appels limités par Shopify : les 4 appareils sont gardés pour les parcours critiques (décision QA du 12 octobre 2026). */
export const APPAREILS = ['desktop-chrome', 'iphone'];

export interface PageTestee {
  /** Dossier du relevé : references/<type>/<cle>/. */
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
export const PAGES_PREPROD: PageTestee[] = pagesSections.filter(p => !p.produitFixe).map(p => ({
  cle: slug(p.nom), nom: p.nom, chemin: p.chemin ?? '', etiquette: p.etiquette ?? '@sections', statut: p.statut,
}));
export const PAGES_PROD: PageTestee[] = pagesSections.filter(p => !p.produitFixe && p.cheminProd !== undefined).map(p => ({
  cle: p.cheminProd === (p.chemin ?? '') ? slug(p.nom) : slug(p.cheminProd!), nom: p.nom, chemin: p.cheminProd!,
  etiquette: p.etiquette ?? '@sections', statut: p.statut,
}));

/** Fiche produit de chaque environnement : QA01 en préprod, Cyme Mini camel (P08) en prod. */
export const ficheProduit = (env: string) => env === 'preprod' ? `products/${produitFixe('QA01').handle}` : 'products/cyme-mini-textured-camel';
/** Produit mis au panier pour ouvrir le checkout. */
export const produitPanier = (env: string) => env === 'preprod' ? produitFixe('QA01').handle : 'cyme-mini-textured-camel';

/** Espace client de la préprod, connecté au compte de test (session de `npm run connexion:compte`, voir tests/compte-client.spec.ts). */
export const SESSION_COMPTE = '.auth/compte-client.json';
export const sessionCompte = () => existsSync(SESSION_COMPTE);
export const PAGES_COMPTE: PageTestee[] = [
  { cle: 'compte-accueil', nom: 'Accueil du compte', chemin: 'account', etiquette: '@account' },
  { cle: 'compte-commandes', nom: 'Commandes', chemin: 'account?view=orders', etiquette: '@account' },
  { cle: 'compte-profil', nom: 'Profil', chemin: 'account?view=profile', etiquette: '@account' },
  { cle: 'compte-adresses', nom: 'Adresses', chemin: 'account/addresses', etiquette: '@account' },
  { cle: 'compte-favoris', nom: 'Favoris du compte', chemin: 'account?view=wishlist', etiquette: '@account' },
  { cle: 'compte-alertes', nom: 'Alertes de retour en stock', chemin: 'account?view=back-in-stock', etiquette: '@account' },
  { cle: 'compte-assistance', nom: 'Assistance', chemin: 'account?view=assistance', etiquette: '@account' },
];

/** Page testée seulement dans `envVoulu` (s'il est donné), et sur les appareils de APPAREILS. */
export function conditions(testInfo: TestInfo, envVoulu: string | undefined, env: string, sujet: string) {
  if (envVoulu) test.skip(env !== envVoulu, `Page testée en ${envVoulu} seulement`);
  test.skip(!APPAREILS.includes(testInfo.project.name.split(' · ')[1]), `${sujet} : ${APPAREILS.join(' et ')} seulement (appels Shopify gardés pour les parcours critiques)`);
}

/**
 * Page prête à relever : parcourue jusqu'en bas (images et sections différées), revenue en haut. La fenêtre de
 * géolocalisation de la préprod est fermée par le gestionnaire de src/fixtures.ts dès la première action.
 */
export async function preparer(page: Page) {
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
  // Contenu chargé après coup (articles de La Maison, page par page, 19 articles en 5 s le 16 octobre 2026) : on
  // attend que la page ne change plus (même nombre d'éléments pendant 1,5 s), 15 s au plus.
  await page.evaluate(async () => {
    const taille = () => document.querySelectorAll('main *').length;
    let avant = taille(), stable = 0;
    for (const fin = Date.now() + 15_000; stable < 3 && Date.now() < fin;) {
      await new Promise(r => setTimeout(r, 500));
      const maintenant = taille();
      stable = maintenant === avant ? stable + 1 : 0;
      avant = maintenant;
    }
  });
}

export async function ouvrir(page: Page, chemin: string, statut = 200) {
  const reponse = await page.goto(chemin, { waitUntil: 'domcontentloaded' });
  expect(reponse?.status(), `La page ${chemin || 'd\'accueil'} doit répondre (code ${statut})`).toBe(statut);
  await preparer(page);
}

/** Ouvre une page de l'espace client (test déclaré avec `test.use({ storageState: SESSION_COMPTE })`). */
export async function ouvrirEspaceClient(page: Page, chemin: string) {
  await page.goto(chemin, { waitUntil: 'domcontentloaded' });
  if (new URL(page.url()).pathname.endsWith('/password')) {
    // L'accès à la boutique expire avant la session du client : on ressaisit le mot de passe de la boutique.
    await page.locator('input[name="password"]').fill(process.env.PREPROD_PASSWORD ?? '');
    await page.locator('input[name="password"]').press('Enter');
    await page.waitForURL(url => !url.pathname.endsWith('/password'));
    await page.goto(chemin, { waitUntil: 'domcontentloaded' });
  }
  expect(page.url(), 'Session du compte client expirée (renvoi vers la connexion) : relancer « npm run connexion:compte »')
    .not.toMatch(/account\/login|customer_authentication|shopify\.com\/authentication/);
  // Historique des commandes, alertes, favoris : chargés après la page par l'application Polène.
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
  await preparer(page);
}
