import { test, expect, etape, pourChaqueFiche } from '../src/fixtures';
import { ficheAffichee } from '../src/fiches';
import { CartPage } from '../src/pages/cart';
import { CheckoutPage } from '../src/pages/checkout';
import { verifierAccessibilite } from '../src/accessibilite';
import {
  PAGES_COMPTE, PAGES_PREPROD, PAGES_PROD, SESSION_COMPTE, conditions, ficheProduit, ouvrir, ouvrirEspaceClient, preparer,
  produitPanier, sessionCompte,
} from '../src/pages-testees';

/**
 * Accessibilité relevée par axe, page par page, comparée au relevé de chaque page (src/accessibilite.ts) : seul un
 * problème absent du relevé fait échouer le test, ceux en cours de correction sont notés. Préprod : pages de sections
 * et pages réelles (data/pages-sections.json), espace client, checkout ; prod : les pages réelles qui y existent.
 * Ordinateur et téléphone (Chrome, iPhone), comme les pages de sections (src/pages-testees.ts). Lecture seule, sans commande.
 */

const SUJET = 'Accessibilité';

for (const [env, pages] of [['preprod', PAGES_PREPROD], ['prod', PAGES_PROD]] as const) {
  // Même nom de page dans les deux environnements (Accueil, Panier vide…) : un groupe par environnement.
  test.describe(env === 'prod' ? 'Prod' : 'Préprod', () => {
    for (const p of pages) {
      test(`Accessibilité (axe) · ${p.nom} @tnr @accessibilite ${p.etiquette}`, async ({ page, qaEnv }, testInfo) => {
        conditions(testInfo, env, qaEnv.name, SUJET);
        await etape(page, testInfo, `1. Ouvrir la page ${p.nom}`, () => ouvrir(page, p.chemin, p.statut));
        await etape(page, testInfo, '2. Relever l\'accessibilité et la comparer au relevé de la page', () => verifierAccessibilite(page, testInfo, p.cle));
      });
    }
  });
}

pourChaqueFiche(fiche => {
  test('Accessibilité (axe) · Fiche produit @tnr @accessibilite @pdp', async ({ page, qaEnv }, testInfo) => {
    conditions(testInfo, undefined, qaEnv.name, SUJET);
    await etape(page, testInfo, '1. Ouvrir la fiche produit', async () => {
      await ouvrir(page, ficheProduit(qaEnv.name));
      expect(await ficheAffichee(page), `Le Roll Out devait servir l'${fiche} fiche`).toBe(fiche);
    });
    await etape(page, testInfo, '2. Relever l\'accessibilité et la comparer au relevé de la page', () => verifierAccessibilite(page, testInfo, `fiche-produit-${fiche}`));
  });
});

test('Accessibilité (axe) · Checkout @tnr @accessibilite @checkout', async ({ page, qaEnv }, testInfo) => {
  conditions(testInfo, undefined, qaEnv.name, SUJET);
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

test.describe('Espace client', () => {
  if (sessionCompte()) test.use({ storageState: SESSION_COMPTE });
  for (const p of PAGES_COMPTE) {
    test(`Accessibilité (axe) · ${p.nom} @tnr @accessibilite @account`, async ({ page, qaEnv }, testInfo) => {
      conditions(testInfo, 'preprod', qaEnv.name, SUJET);
      test.skip(!sessionCompte(), `Pas de session client : lancer « npm run connexion:compte » (${SESSION_COMPTE})`);
      await etape(page, testInfo, `1. Ouvrir la page ${p.nom} de l'espace client`, () => ouvrirEspaceClient(page, p.chemin));
      await etape(page, testInfo, '2. Relever l\'accessibilité et la comparer au relevé de la page', () => verifierAccessibilite(page, testInfo, p.cle));
    });
  }
});
