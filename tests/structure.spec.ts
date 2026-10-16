import { test, expect, etape, pourChaqueFiche } from '../src/fixtures';
import { ficheAffichee } from '../src/fiches';
import { releverStructure, verifierStructure } from '../src/structure';
import {
  PAGES_COMPTE, PAGES_PREPROD, PAGES_PROD, SESSION_COMPTE, conditions, ficheProduit, ouvrir, ouvrirEspaceClient,
  sessionCompte,
} from '../src/pages-testees';

/**
 * Références de structure (phase 2.5, src/structure.ts) : titres, boutons et liens de chaque page, liens et boutons de
 * l'en-tête et du pied de page, comparés à la référence de la page. Mêmes pages que l'accessibilité
 * (src/pages-testees.ts), sans le checkout (page de Shopify). Ordinateur et téléphone (Chrome, iPhone), prod et
 * préprod. Lecture seule, sans commande.
 */

const SUJET = 'Structure';

test('Structure · En-tête et pied de page @tnr @structure @home', async ({ page, qaEnv }, testInfo) => {
  conditions(testInfo, undefined, qaEnv.name, SUJET);
  await etape(page, testInfo, '1. Ouvrir la page d\'accueil', () => ouvrir(page, ''));
  // L'en-tête et le pied de page sont les mêmes sur toutes les pages : relevés une fois, ici.
  await etape(page, testInfo, '2. Comparer les liens et boutons de l\'en-tête (menus compris) à la référence', async () =>
    verifierStructure(testInfo, 'en-tete', await releverStructure(page, 'en-tete')));
  await etape(page, testInfo, '3. Comparer les liens et boutons du pied de page à la référence', async () =>
    verifierStructure(testInfo, 'pied-de-page', await releverStructure(page, 'pied-de-page')));
});

for (const [env, pages] of [['preprod', PAGES_PREPROD], ['prod', PAGES_PROD]] as const) {
  // Même nom de page dans les deux environnements (Accueil, Panier vide…) : un groupe par environnement.
  test.describe(env === 'prod' ? 'Prod' : 'Préprod', () => {
    for (const p of pages) {
      test(`Structure · ${p.nom} @tnr @structure ${p.etiquette}`, async ({ page, qaEnv }, testInfo) => {
        conditions(testInfo, env, qaEnv.name, SUJET);
        await etape(page, testInfo, `1. Ouvrir la page ${p.nom}`, () => ouvrir(page, p.chemin, p.statut));
        await etape(page, testInfo, '2. Comparer les titres, boutons et liens de la page à la référence', async () =>
          verifierStructure(testInfo, p.cle, await releverStructure(page, 'contenu')));
      });
    }
  });
}

pourChaqueFiche(fiche => {
  test('Structure · Fiche produit @tnr @structure @pdp', async ({ page, qaEnv }, testInfo) => {
    conditions(testInfo, undefined, qaEnv.name, SUJET);
    await etape(page, testInfo, '1. Ouvrir la fiche produit', async () => {
      await ouvrir(page, ficheProduit(qaEnv.name));
      expect(await ficheAffichee(page), `Le Roll Out devait servir l'${fiche} fiche`).toBe(fiche);
    });
    await etape(page, testInfo, '2. Comparer les titres, boutons et liens de la fiche à la référence', async () =>
      verifierStructure(testInfo, `fiche-produit-${fiche}`, await releverStructure(page, 'contenu')));
  });
});

test.describe('Espace client', () => {
  if (sessionCompte()) test.use({ storageState: SESSION_COMPTE });
  for (const p of PAGES_COMPTE) {
    test(`Structure · ${p.nom} @tnr @structure @account`, async ({ page, qaEnv }, testInfo) => {
      conditions(testInfo, 'preprod', qaEnv.name, SUJET);
      test.skip(!sessionCompte(), `Pas de session client : lancer « npm run connexion:compte » (${SESSION_COMPTE})`);
      await etape(page, testInfo, `1. Ouvrir la page ${p.nom} de l'espace client`, () => ouvrirEspaceClient(page, p.chemin));
      await etape(page, testInfo, '2. Comparer les titres, boutons et liens de la page à la référence', async () =>
        verifierStructure(testInfo, p.cle, await releverStructure(page, 'contenu')));
    });
  }
});
