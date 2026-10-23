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

/**
 * Appareils des références de structure (test « bonus », QA, 22 octobre 2026) : Chrome ordinateur et iPhone. Depuis la
 * revue du 22 octobre 2026, l'accessibilité (axe) tourne sur les 4 appareils (avant : ces deux-là, pour ménager les
 * appels limités par Shopify).
 */
export const APPAREILS_STRUCTURE = ['desktop-chrome', 'iphone'];

export interface PageTestee {
  /** Dossier du relevé : references/<type>/<cle>/. */
  cle: string;
  nom: string;
  chemin: string;
  etiquette: string;
  /** Code de réponse attendu, 200 par défaut. */
  statut?: number;
  /** Page sans adresse fixe (détail d'une commande) : on ouvre `chemin`, puis le premier lien dont l'adresse contient `lien`. */
  lien?: string;
}

export const slug = (texte: string) => texte.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const { pages: pagesSections } = JSON.parse(readFileSync(join(__dirname, '..', 'data', 'pages-sections.json'), 'utf8')) as {
  pages: {
    nom: string; chemin?: string; cheminProd?: string; produitFixe?: string; etiquette?: string; statut?: number;
    intitules?: Record<string, string>;
  }[];
};

/**
 * Sections testées une à une (demande QA du 22 octobre 2026), sous le nom de l'intitulé posé au-dessus d'elles sur les
 * pages Sections 1 à 3 (`intitules` de data/pages-sections.json) : tests/sections.spec.ts. Ces pages n'ont plus de
 * relevé d'accessibilité d'ensemble.
 */
export const SECTIONS = pagesSections.filter(p => p.intitules).flatMap(p => Object.entries(p.intitules!).map(([cle, nom]) => ({
  page: p.nom, chemin: p.chemin ?? '', cle, nom, dossier: slug(nom),
})));
export const PAGES_PAR_SECTION = new Set(pagesSections.filter(p => p.intitules).map(p => p.nom));

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

/**
 * Pages préprod et prod réunies par nom (Accueil, Panier vide… existent dans les deux) : un seul test par page, qui
 * prend la version de son environnement (`pageDeLEnv`). Avant le 21 octobre 2026, chaque page avait un test par
 * environnement, du même nom : l'historique du rapport gardait celui qui était ignoré à la place de celui qui jouait.
 */
export const PAGES: { nom: string; etiquette: string; preprod?: PageTestee; prod?: PageTestee }[] =
  [...new Set([...PAGES_PREPROD, ...PAGES_PROD].map(p => p.nom))].map(nom => {
    const preprod = PAGES_PREPROD.find(p => p.nom === nom);
    const prod = PAGES_PROD.find(p => p.nom === nom);
    return { nom, etiquette: (preprod ?? prod)!.etiquette, preprod, prod };
  });

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
  // Demande QA du 22 octobre 2026 : la page d'une commande (la dernière du compte de test). Accessibilité seulement :
  // sa structure dépend de la commande.
  { cle: 'compte-commande', nom: 'Détail d\'une commande', chemin: 'account?view=orders', lien: '/account/orders/', etiquette: '@account' },
  { cle: 'compte-profil', nom: 'Profil', chemin: 'account?view=profile', etiquette: '@account' },
  { cle: 'compte-adresses', nom: 'Adresses', chemin: 'account/addresses', etiquette: '@account' },
  { cle: 'compte-favoris', nom: 'Favoris du compte', chemin: 'account?view=wishlist', etiquette: '@account' },
  { cle: 'compte-alertes', nom: 'Alertes de retour en stock', chemin: 'account?view=back-in-stock', etiquette: '@account' },
  { cle: 'compte-assistance', nom: 'Assistance', chemin: 'account?view=assistance', etiquette: '@account' },
];

/** Page testée seulement dans `envVoulu` (s'il est donné), et sur les `appareils` donnés (tous sinon). */
export function conditions(testInfo: TestInfo, envVoulu: string | undefined, env: string, sujet: string, appareils?: string[]) {
  if (envVoulu) test.skip(env !== envVoulu, `Page testée en ${envVoulu} seulement`);
  if (appareils) test.skip(!appareils.includes(testInfo.project.name.split(' · ')[1]), `${sujet} : ${appareils.join(' et ')} seulement`);
}

/** Version de la page dans l'environnement du test (voir PAGES) ; le test est ignoré si elle n'y existe pas. */
export function pageDeLEnv(testInfo: TestInfo, page: (typeof PAGES)[number], env: string, sujet: string, appareils?: string[]): PageTestee {
  const version = env === 'prod' ? page.prod : page.preprod;
  conditions(testInfo, version ? undefined : (page.preprod ? 'preprod' : 'prod'), env, sujet, appareils);
  return version!;
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

/** Ouvre une page de l'espace client, en suivant son lien si elle n'a pas d'adresse fixe (`lien`). */
export async function ouvrirPageCompte(page: Page, p: PageTestee) {
  await ouvrirEspaceClient(page, p.chemin);
  if (!p.lien) return;
  const lien = page.getByRole('main').locator(`a[href*="${p.lien}"]`).first();
  await expect(lien, `La page ${p.chemin} doit proposer un lien vers ${p.nom.toLowerCase()} (aucune commande sur le compte de test ?)`).toBeAttached({ timeout: 20_000 });
  await ouvrirEspaceClient(page, (await lien.getAttribute('href'))!);
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
