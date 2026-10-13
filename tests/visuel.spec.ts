import { test } from '../src/fixtures';
import { PAGES_VISUELLES, verifierPage } from '../src/visuel';

/**
 * Tests visuels (POC 2) : chaque page est capturée en entier et comparée à la référence validée par la QA.
 * Prod uniquement pour l'instant : la préprod n'a ni les mêmes textes ni les mêmes prix.
 */
// Pas de vidéo : l'attendu, l'obtenu et la différence suffisent, et l'enregistrement surcharge la machine.
// Densité 1 pixel par point : même mise en page que sur le vrai appareil, mais Safari mobile émulé
// réduit les photos différemment d'un passage à l'autre en densité 3 (écarts sur toute la collection iPhone).
test.use({ video: 'off', deviceScaleFactor: 1 });

for (const pageVisuelle of PAGES_VISUELLES) {
  test(`Visuel · ${pageVisuelle.nom} @visuel @${pageVisuelle.typePage}`, async ({ page, qaEnv }, testInfo) => {
    test.skip(qaEnv.name !== 'prod', 'Tests visuels en prod uniquement pour l\'instant');
    testInfo.annotations.push({ type: 'Environnement', description: `${qaEnv.label} (${qaEnv.baseURL})` });
    await verifierPage(page, testInfo, pageVisuelle, {
      message: `La page « ${pageVisuelle.nom} » ne correspond plus à la référence : comparer attendu, obtenu et différence ci-dessous`,
    });
  });
}
