import { readFileSync, writeFileSync } from 'node:fs';
import type { BrowserContext, Cookie, Page } from '@playwright/test';
import type { QaEnvironment } from './environments';

/**
 * Deux fiches produit, servies au hasard par le Roll Out de Shopify, en prod (50/50 depuis le 15 octobre 2026) comme
 * en préprod : l'ancienne (onglets Description | Size & fit…, vignettes de coloris, menu « Select size ») et la
 * nouvelle (accordéons, « Explore all », fenêtre « Choose your size »).
 *
 * Shopify choisit la fiche d'après le cookie `_shopify_essential` du navigateur (relevé le 15 octobre 2026 : le même
 * cookie redonne toujours la même fiche, un navigateur sans ce cookie en reçoit un nouveau et tombe sur l'une ou
 * l'autre). Pour tester les deux fiches à chaque lancement, on tire des cookies jusqu'à obtenir la fiche voulue,
 * puis on garde le gagnant dans `.auth/fiche-<env>-<fiche>.json` (hors Git) pour les tests suivants.
 * Le panier a son propre cookie (`cart`) : deux tests qui partagent ce cookie ne partagent pas leur panier.
 * En préprod, ce cookie porte aussi l'accès par mot de passe : on ressaisit le mot de passe après chaque tirage.
 */
export type Fiche = 'ancienne' | 'nouvelle';
export const FICHES: Fiche[] = ['ancienne', 'nouvelle'];
export const NOM_FICHE: Record<Fiche, string> = {
  ancienne: 'ancienne fiche (onglets, vignettes de coloris, menu « Select size »)',
  nouvelle: 'nouvelle fiche (accordéons, « Explore all », fenêtre « Choose your size »)',
};

const COOKIE = '_shopify_essential';
/** Produit témoin, en ligne en prod et en préprod (P08), avec ses 24 coloris : « Explore all » sur la nouvelle fiche. */
const TEMOIN = 'products/cyme-mini-textured-camel';
/** À 50/50, 12 tirages ratés de suite arrivent moins d'une fois sur 4 000 : au-delà, le Roll Out a pris fin. */
const TIRAGES = 12;

/** Fiche voulue par page, posée par la fixture `fiche` (src/fixtures.ts) et vérifiée à l'ouverture d'une fiche. */
export const ficheVoulue = new WeakMap<Page, Fiche>();

/** Cookie gagnant par environnement et par fiche, pour les tests suivants du même worker. */
const gagnants = new Map<string, Cookie>();
/**
 * Fiches que le Roll Out ne sert plus (tous les tirages ratés), par environnement : les tests suivants du même worker
 * ne retirent pas. Sans ça, chaque test refaisait ses 12 tirages et la prod finissait par répondre 503 (22 octobre 2026).
 */
const absentes = new Set<string>();

/** Fiche affichée par la page : l'ancienne a la liste d'onglets `ul.product-detail-list`, la nouvelle des accordéons. */
export async function ficheAffichee(page: Page): Promise<Fiche> {
  return (await page.locator('main ul.product-detail-list').count()) > 0 ? 'ancienne' : 'nouvelle';
}

/** Fiche servie au cookie actuel du contexte, lue dans le HTML du produit témoin (sans ouvrir de page). */
async function ficheServie(context: BrowserContext, qaEnv: QaEnvironment): Promise<Fiche | 'mot de passe'> {
  const url = new URL(TEMOIN, qaEnv.baseURL).href;
  let reponse = await context.request.get(url, { maxRedirects: 0 });
  // 429 (trop d'appels) ou 503 (service indisponible, vu en prod après une série de tirages) : on attend et on refait.
  for (let essai = 1; [429, 503].includes(reponse.status()) && essai <= 3; essai++) {
    await new Promise(r => setTimeout(r, 20_000));
    reponse = await context.request.get(url, { maxRedirects: 0 });
  }
  if (reponse.status() === 429) throw new Error('Choix de la fiche produit : Shopify refuse temporairement les appels (code 429, trop de lancements rapprochés). Relancer dans quelques minutes. Ce n\'est pas un bug du site.');
  if (reponse.status() >= 300 && reponse.status() < 400 && /\/password/.test(reponse.headers().location ?? '')) return 'mot de passe';
  if (reponse.status() !== 200) throw new Error(`Choix de la fiche produit : la fiche témoin ${url} a répondu ${reponse.status()}`);
  const html = await reponse.text();
  if (html.includes('product-detail-list')) return 'ancienne';
  if (/Explore all|Découvrir tout/i.test(html)) return 'nouvelle';
  throw new Error(`Choix de la fiche produit : ${url} n'a ni les onglets de l'ancienne fiche ni le bouton « Explore all » de la nouvelle. Le thème a changé : revoir src/fiches.ts.`);
}

/** Préprod : ressaisit le mot de passe de la boutique, perdu avec le cookie. */
async function saisirMotDePasse(context: BrowserContext, qaEnv: QaEnvironment) {
  const motDePasse = process.env.PREPROD_PASSWORD;
  if (!motDePasse) throw new Error('PREPROD_PASSWORD est vide : renseignez-le dans le fichier .env');
  await context.request.post(new URL('/password', qaEnv.baseURL).href, {
    form: { form_type: 'storefront_password', utf8: '✓', password: motDePasse },
    maxRedirects: 0,
  });
}

/**
 * Donne au contexte un cookie qui lui fait servir la fiche voulue. Renvoie le nombre de tirages faits (0 si un cookie
 * gardé a suffi), ou `null` si le Roll Out ne sert plus cette fiche.
 */
export async function preparerFiche(context: BrowserContext, qaEnv: QaEnvironment, fiche: Fiche): Promise<number | null> {
  const cle = `${qaEnv.name}-${fiche}`;
  const fichier = `.auth/fiche-${cle}.json`;
  if (absentes.has(cle)) return null;
  const enMemoire = gagnants.get(cle);
  if (enMemoire) {
    await context.addCookies([enMemoire]);
    return 0;
  }
  // Cookie gardé par un lancement précédent ou un autre worker : on vérifie qu'il donne toujours la bonne fiche.
  try {
    const garde = JSON.parse(readFileSync(fichier, 'utf8')) as Cookie;
    await context.addCookies([garde]);
    if (await ficheServie(context, qaEnv) === fiche) {
      gagnants.set(cle, garde);
      return 0;
    }
  } catch {
    // Pas de cookie gardé (ou fichier en cours d'écriture par un autre worker) : on tire.
  }
  for (let tirage = 1; tirage <= TIRAGES; tirage++) {
    await context.clearCookies({ name: COOKIE });
    if (qaEnv.passwordProtected) await saisirMotDePasse(context, qaEnv);
    let servie = await ficheServie(context, qaEnv);
    if (servie === 'mot de passe') {
      await saisirMotDePasse(context, qaEnv);
      servie = await ficheServie(context, qaEnv);
      if (servie === 'mot de passe') throw new Error('Choix de la fiche produit : mot de passe préprod refusé');
    }
    if (servie === fiche) {
      const cookie = (await context.cookies(qaEnv.baseURL)).find(c => c.name === COOKIE);
      if (!cookie) throw new Error(`Choix de la fiche produit : Shopify n'a pas posé de cookie ${COOKIE}`);
      gagnants.set(cle, cookie);
      writeFileSync(fichier, JSON.stringify(cookie));
      return tirage;
    }
  }
  absentes.add(cle);
  return null;
}
