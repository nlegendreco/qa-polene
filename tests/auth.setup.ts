import { test as setup, expect } from '@playwright/test';
import { environments } from '../src/environments';

/**
 * Saisit une seule fois le mot de passe de la boutique préprod et enregistre la session.
 * Les tests préprod réutilisent ensuite cette session (fichier .auth/preprod.json).
 */
setup('Connexion à la boutique préprod', async ({ page }) => {
  const password = process.env.PREPROD_PASSWORD;
  expect(password, 'PREPROD_PASSWORD est vide : renseignez-le dans le fichier .env').toBeTruthy();

  await page.goto(new URL('/password', environments.preprod.baseURL).href);
  await page.locator('input[name="password"]').fill(password!);
  await page.locator('#login_form [type="submit"], #login_form button').first().click();
  await expect(page, 'Mot de passe préprod refusé').not.toHaveURL(/\/password/);

  await page.context().storageState({ path: '.auth/preprod.json' });
});
