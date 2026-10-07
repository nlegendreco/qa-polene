import type { APIResponse, Page } from '@playwright/test';
import { expect } from './fixtures';

/**
 * Appel direct à la boutique (JSON produit, ajout au panier, page). Shopify limite ces appels par adresse IP
 * (code 429, « local_rate_limited ») quand les lancements s'enchaînent : on réessaie pendant une minute
 * (le premier navigateur bloqué l'était encore après 30 s, les suivants passaient), puis on échoue
 * avec un message clair. `libelle` décrit l'appel : « L'ajout du produit au panier ».
 */
export async function appelShopify(page: Page, libelle: string, appel: () => Promise<APIResponse>): Promise<APIResponse> {
  let reponse = await appel();
  for (let essai = 1; reponse.status() === 429 && essai <= 3; essai++) {
    await page.waitForTimeout(20_000);
    reponse = await appel();
  }
  expect(reponse.status(), reponse.status() === 429
    ? `${libelle} : Shopify refuse temporairement les appels (code 429, trop de lancements rapprochés). Relancer dans quelques minutes. Ce n'est pas un bug du site.`
    : `${libelle} a échoué (code ${reponse.status()})`).toBe(200);
  return reponse;
}
