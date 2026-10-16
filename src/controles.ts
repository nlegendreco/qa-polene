import type { Page, TestInfo } from '@playwright/test';
import { expect } from './fixtures';

/**
 * Erreurs JS qui ne viennent pas du thème : le blocage d'Elevar sous WebKit ; sous WebKit encore, les cadres isolés
 * des « web pixels » Shopify (web-pixel-sandbox-…, sans allow-same-origin), présents sur toutes les pages ; et les
 * envois de ces mêmes pixels vers les outils que les tests bloquent (« Failed to fetch ») ; et sous WebKit, le refus
 * d'envoyer les mesures techniques de Shopify (`otlp-http-production.shopifysvc.com`, et en prod
 * `.well-known/shopify/monorail`, « access control checks »).
 * Sous Chrome, en prod, le blocage d'Elevar donne « Failed to fetch dynamically imported module: …getelevar.com… ».
 */
export function erreurIgnoree(e: Error): boolean {
  return /Importing a module script failed|Blocked a frame .* sandboxed and lacks the "allow-same-origin" flag|shopifysvc\.com|shopify\/monorail|getelevar\.com/.test(e.message)
    || /web-pixel/.test(e.stack ?? '');
}

/** Message d'une erreur JS avec le fichier qui l'a levée, pour savoir à qui la remonter. */
export function decrireErreur(e: Error): string {
  return `${e.message} (${(e.stack ?? '').match(/https?:\/\/[^\s)]+/)?.[0]?.split('?')[0] ?? 'fichier inconnu'})`;
}

/**
 * La page ne doit pas être plus large que l'écran. Comparée à la largeur de l'appareil, pas à window.innerWidth :
 * Chrome sur Android dézoome toute la page quand elle est trop large, et innerWidth grandit avec elle.
 * Les éléments qui dépassent sont notés dans le rapport.
 */
export async function verifierLargeur(page: Page, testInfo: TestInfo) {
  const ecran = page.viewportSize()!.width;
  const largeurPage = await page.evaluate(() => document.documentElement.scrollWidth);
  if (largeurPage > ecran + 1) {
    const fautifs = await page.evaluate(ecran => [...document.querySelectorAll('main *')]
      .filter(e => e.checkVisibility() && e.getBoundingClientRect().right > ecran + 1)
      .filter((e, _, tous) => !tous.some(autre => autre !== e && e.contains(autre)))
      .slice(0, 5).map(e => `${e.tagName.toLowerCase()}.${String(e.className).split(' ')[0]} « ${(e.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 40)} »`), ecran);
    testInfo.annotations.push({ type: 'Éléments trop larges', description: fautifs.join(' ; ') || 'non identifiés' });
  }
  expect.soft(largeurPage, `La page ne doit pas être plus large que l'écran (${ecran} px) : défilement horizontal ou page dézoomée`).toBeLessThanOrEqual(ecran + 1);
}
