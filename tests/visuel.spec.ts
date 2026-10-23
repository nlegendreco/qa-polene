import { test } from '../src/fixtures';
import { PAGES_VISUELLES, majDesReferences, retirerContributionsQa, verifierPage } from '../src/visuel';

/**
 * Tests visuels : chaque page est capturée et comparée à sa référence, prise en prod (demande QA du 22 octobre 2026).
 * - Préprod : comparée à la capture de la prod, à chaque lancement. Elle échoue tant qu'elle n'est pas à jour avec la
 *   prod (textes en anglais, prix convertis, catalogue) : c'est attendu, la préprod doit à terme suivre la prod.
 * - Prod : seulement pendant une MEP (`MEP=1`, npm run test:visuel:mep), et seulement les pages à contenu fixe
 *   (`contenuFixe`) ; et pour reprendre les références (npm run test:visuel:maj, accord QA), toutes les pages.
 * Sections du thème une à une, référence prise en préprod : tests/sections.spec.ts.
 */
// Pas de vidéo : l'attendu, l'obtenu et la différence suffisent, et l'enregistrement surcharge la machine.
// Densité 1 pixel par point : même mise en page que sur le vrai appareil, mais Safari mobile émulé
// réduit les photos différemment d'un passage à l'autre en densité 3 (écarts sur toute la collection iPhone).
// Les pages qui ne passent par la fiche que pour lire la variante (panier, checkout) prennent la nouvelle.
test.use({ video: 'off', deviceScaleFactor: 1, fiche: 'nouvelle' });

for (const pageVisuelle of PAGES_VISUELLES) {
  const declarer = () => test(`Visuel · ${pageVisuelle.nom} @visuel @${pageVisuelle.typePage}`, async ({ page, qaEnv, isMobile }, testInfo) => {
    const appareil = testInfo.project.name.split(' · ')[1];
    const maj = majDesReferences(testInfo);
    if (qaEnv.name === 'prod') {
      test.skip(!maj && !process.env.MEP, 'Prod : comparée seulement pendant une MEP (npm run test:visuel:mep) ; la préprod est comparée à sa capture');
      test.skip(!maj && !pageVisuelle.contenuFixe, 'Prod, MEP : seulement les pages dont le contenu ne change pas');
    } else {
      // La référence de la préprod est celle de la prod : jamais reprise depuis la préprod.
      test.skip(maj, 'Référence prise en prod : rien à reprendre en préprod');
    }
    test.skip(pageVisuelle.appareils === 'ordinateur' && isMobile, `${pageVisuelle.nom} : ordinateurs seulement (menu au survol)`);
    test.skip(pageVisuelle.appareils === 'telephone' && !isMobile, `${pageVisuelle.nom} : téléphones seulement`);
    testInfo.annotations.push({ type: 'Environnement', description: `${qaEnv.label} (${qaEnv.baseURL})` });
    await verifierPage(page, testInfo, pageVisuelle, {
      projetReference: `prod · ${appareil}`,
      avantCapture: qaEnv.name === 'preprod' ? retirerContributionsQa : undefined,
      message: qaEnv.name === 'preprod'
        ? `La préprod ne correspond pas à la page « ${pageVisuelle.nom} » de la prod (référence) : comparer attendu (prod), obtenu (préprod) et différence ci-dessous`
        : `La page « ${pageVisuelle.nom} » ne correspond plus à la référence : comparer attendu, obtenu et différence ci-dessous`,
    });
  });
  // Même groupe que les autres tests des deux fiches (pourChaqueFiche) : « Nouvelle fiche › Visuel · Fiche produit… ».
  if (pageVisuelle.fiche) {
    test.describe(pageVisuelle.fiche === 'ancienne' ? 'Ancienne fiche' : 'Nouvelle fiche', () => {
      test.use({ fiche: pageVisuelle.fiche });
      declarer();
    });
  } else declarer();
}
