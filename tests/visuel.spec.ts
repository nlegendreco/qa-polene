import { test } from '../src/fixtures';
import { PAGES_VISUELLES, verifierPage } from '../src/visuel';

/**
 * Tests visuels (POC 2) : chaque page est capturée en entier et comparée à la référence validée par la QA.
 * Prod uniquement pour l'instant : la préprod n'a ni les mêmes textes ni les mêmes prix.
 */
// Pas de vidéo : l'attendu, l'obtenu et la différence suffisent, et l'enregistrement surcharge la machine.
// Densité 1 pixel par point : même mise en page que sur le vrai appareil, mais Safari mobile émulé
// réduit les photos différemment d'un passage à l'autre en densité 3 (écarts sur toute la collection iPhone).
// Fiche produit : chaque fiche du Roll Out a sa référence (nouvelle : 2 octobre 2026, ancienne : 15 octobre 2026).
// Les autres pages ne passent par la fiche que pour lire la variante (panier) : la nouvelle, comme à l'origine.
test.use({ video: 'off', deviceScaleFactor: 1, fiche: 'nouvelle' });

for (const pageVisuelle of PAGES_VISUELLES) {
  const declarer = () => test(`Visuel · ${pageVisuelle.nom} @visuel @${pageVisuelle.typePage}`, async ({ page, qaEnv, isMobile }, testInfo) => {
    test.skip(qaEnv.name !== 'prod', 'Tests visuels en prod uniquement pour l\'instant');
    test.skip(pageVisuelle.appareils === 'ordinateur' && isMobile, `${pageVisuelle.nom} : ordinateurs seulement (menu au survol)`);
    test.skip(pageVisuelle.appareils === 'telephone' && !isMobile, `${pageVisuelle.nom} : téléphones seulement`);
    testInfo.annotations.push({ type: 'Environnement', description: `${qaEnv.label} (${qaEnv.baseURL})` });
    await verifierPage(page, testInfo, pageVisuelle, {
      message: `La page « ${pageVisuelle.nom}${pageVisuelle.fiche ? ` (${pageVisuelle.fiche} fiche)` : ''} » ne correspond plus à la référence : comparer attendu, obtenu et différence ci-dessous`,
    });
  });
  // Même groupe que les autres tests des deux fiches (pourChaqueFiche) : « Ancienne fiche › Visuel · Fiche produit… ».
  if (pageVisuelle.fiche) {
    test.describe(pageVisuelle.fiche === 'ancienne' ? 'Ancienne fiche' : 'Nouvelle fiche', () => {
      test.use({ fiche: pageVisuelle.fiche });
      declarer();
    });
  } else declarer();
}
