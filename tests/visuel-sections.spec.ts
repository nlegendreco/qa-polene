import { existsSync } from 'node:fs';
import { test, expect } from '../src/fixtures';
import { SECTIONS } from '../src/pages-testees';
import { majDesReferences, nomDeCapture, stabiliserPage } from '../src/visuel';

/**
 * Capture de chaque section des pages Sections 1 à 3 (demande QA du 22 octobre 2026), sous le nom de son intitulé
 * (tests/sections.spec.ts). Référence prise en préprod, references/sections/<section>/<projet>.png : ces pages
 * n'existent pas en prod. La reprendre seulement avec l'accord de la QA (npm run test:visuel:maj).
 */
// Comme les autres tests visuels (tests/visuel.spec.ts) : ni vidéo, ni densité 3.
test.use({ video: 'off', deviceScaleFactor: 1 });

for (const s of SECTIONS) {
  test(`Visuel · Section ${s.nom} @visuel @sections`, async ({ page, qaEnv }, testInfo) => {
    test.skip(qaEnv.name !== 'preprod', 'Pages de sections : préprod uniquement');
    testInfo.annotations.push({ type: 'Page', description: `${s.page} (${s.chemin})` });
    const section = page.locator(`[id^="shopify-section-template--"][id$="__${s.cle}"]`);
    const nom = ['sections', s.dossier, nomDeCapture(testInfo.project.name)];
    if (!majDesReferences(testInfo) && !existsSync(testInfo.snapshotPath(...nom))) {
      testInfo.annotations.push({ type: 'Référence', description: 'première capture de la section : à valider par la QA' });
    }

    await test.step(`1. Ouvrir la page ${s.page}`, async () => {
      const reponse = await page.goto(s.chemin, { waitUntil: 'load' });
      expect(reponse?.status(), `La page ${s.chemin} doit répondre (code 200)`).toBe(200);
      await stabiliserPage(page);
    });
    // Prix en euros de la préprod = dollars convertis au taux du jour : ils bougent d'un euro dans la journée.
    const prix = section.locator('.price-label, .component-product-card__footer__details__label--price');
    if (await prix.count()) testInfo.annotations.push({ type: 'Zones ignorées (en rose)', description: 'prix (taux de change de la préprod)' });
    await test.step(`2. Comparer la section « ${s.nom} » à sa référence (préprod)`, async () => {
      // L'en-tête fixe et son bandeau d'annonce (texte qui défile) passeraient par-dessus le haut de la section
      // amenée à l'écran : cachés, sans changer la mise en page.
      await page.addStyleTag({ content: '.shopify-section-group-header-group { visibility: hidden !important; }' });
      await expect(section, `La section ${s.cle} doit être sur la page`).toHaveCount(1);
      await expect(section, `La section « ${s.nom} » ne correspond plus à sa référence : comparer attendu, obtenu et différence ci-dessous`)
        .toHaveScreenshot(nom, { mask: [prix], timeout: 30_000 });
    });
  });
}
