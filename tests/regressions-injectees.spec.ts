import { existsSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { test } from '../src/fixtures';
import { PAGES_VISUELLES, verifierPage } from '../src/visuel';

/**
 * Démo POC 2.5 : le test casse lui-même la page (sans toucher au site) juste avant la capture,
 * et la comparaison avec la référence doit le détecter. Chaque test DOIT échouer : un test vert
 * voudrait dire qu'une régression est passée inaperçue.
 */

/**
 * Modifie le style du premier élément visible trouvé, comme le ferait une erreur de CSS dans le thème.
 * Visible : la fiche produit contient aussi la galerie mobile, cachée sur ordinateur (la casser ne changerait rien).
 */
function casser(selecteur: string, style: Partial<CSSStyleDeclaration>) {
  return async (page: Page) => {
    const trouve = await page.evaluate(({ selecteur, style }) => {
      const element = [...document.querySelectorAll<HTMLElement>(selecteur)]
        .find(e => e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden');
      // Sans transition : le thème anime le header (0,8 s) et Safari capture alors l'état de départ.
      if (element) Object.assign(element.style, { transition: 'none' }, style);
      return !!element;
    }, { selecteur, style });
    if (!trouve) throw new Error(`Démo impossible : élément « ${selecteur} » introuvable dans la page (le thème a changé ?)`);
  };
}

// Pas de vidéo : l'attendu, l'obtenu et la différence suffisent, et l'enregistrement surcharge la machine.
// Densité 1 pixel par point : même mise en page que sur le vrai appareil, mais Safari mobile émulé
// réduit les photos différemment d'un passage à l'autre en densité 3 (écarts sur toute la collection iPhone).
test.use({ video: 'off', deviceScaleFactor: 1 });

const REGRESSIONS = [
  { page: 'accueil', libelle: 'Header décalé de 10 px', casser: casser('header.header', { transform: 'translateY(10px)' }) },
  { page: 'fiche-produit', libelle: 'Image du produit absente', casser: casser('.product-packshot__container img', { visibility: 'hidden' }) },
  { page: 'fiche-produit', libelle: 'Prix masqué', casser: casser('.product-main__body__info__hero__price', { visibility: 'hidden' }) },
  { page: 'panier', libelle: 'Titre du produit qui déborde', casser: casser('.cart-item__title', { whiteSpace: 'nowrap', letterSpacing: '0.6em' }) },
];

for (const regression of REGRESSIONS) {
  const pageVisuelle = PAGES_VISUELLES.find(p => p.fichier === regression.page)!;

  test(`Régression injectée · ${regression.libelle} (${pageVisuelle.nom}) @regressions`, async ({ page, qaEnv }, testInfo) => {
    test.skip(qaEnv.name !== 'prod', 'Démo en prod uniquement, comme les tests visuels');
    // Garde-fou : ne jamais enregistrer une page cassée comme référence.
    test.skip(testInfo.config.updateSnapshots === 'all' || testInfo.config.updateSnapshots === 'changed',
      'Démo désactivée pendant la mise à jour des références');
    if (!existsSync(testInfo.snapshotPath(`${pageVisuelle.fichier}.png`))) {
      throw new Error('Référence visuelle absente : lancer d\'abord npm run test:visuel:maj');
    }
    testInfo.annotations.push({ type: 'Régression injectée', description: regression.libelle });

    await verifierPage(page, testInfo, pageVisuelle, {
      message: `Régression « ${regression.libelle} » détectée sur la page « ${pageVisuelle.nom} » : voir la différence en rouge ci-dessous`,
      avantCapture: regression.casser,
    });
  });
}
