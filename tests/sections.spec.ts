import type { Locator, Page, TestInfo } from '@playwright/test';
import { test, expect, etape } from '../src/fixtures';
import { verifierAccessibilite } from '../src/accessibilite';
import { SECTIONS, preparer } from '../src/pages-testees';

/**
 * Sections du thème une à une (demande QA du 22 octobre 2026) : sur les pages Sections 1 à 3 de la préprod, la QA a
 * posé au-dessus de chaque section un intitulé (« Carousel », « Mosaic »…) ; chaque test porte le nom de cet intitulé,
 * quelle que soit la page. Pour chaque section : contrôles (affichée, images chargées, pas de texte d'erreur) et
 * accessibilité (axe limité à la section, relevé references/accessibilite/sections/<section>/) ; capture dans
 * tests/visuel-sections.spec.ts. Les 4 appareils.
 * L'ordre des sections, les erreurs JS et la largeur de la page restent vérifiés par page (tests/pages-sections.spec.ts).
 * Interactions propres à chaque section (carrousel, vidéo…) : à venir, liste à valider par la QA (docs/sections-theme.md).
 */

/** Intitulé posé par la QA : section « text » au texte court (une section « text » de contenu a un vrai paragraphe). */
const INTITULE = /^text_[A-Za-z0-9]{6}$/;

const zoneDe = (cle: string) => `[id^="shopify-section-template--"][id$="__${cle}"]`;

async function ouvrirPage(page: Page, chemin: string) {
  const reponse = await page.goto(chemin, { waitUntil: 'domcontentloaded' });
  expect(reponse?.status(), `La page ${chemin} doit répondre (code 200)`).toBe(200);
}

/** Intitulé de la section : texte de la section « text_… » courte la plus proche au-dessus d'elle. */
async function intituleAuDessus(section: Locator): Promise<string | null> {
  return section.evaluate((s, motif) => {
    for (let e = s.previousElementSibling; e; e = e.previousElementSibling) {
      const cle = e.id.replace(/^shopify-section-template--\d+__/, '');
      const texte = (e.textContent ?? '').replace(/\s+/g, ' ').trim();
      if (new RegExp(motif).test(cle) && texte.length < 60) return texte;
      if (e.id.startsWith('shopify-section-template--') && !/^setting_background_color_/.test(cle)) return null;
    }
    return null;
  }, INTITULE.source);
}

/** Amène la section à l'écran par morceaux (sections hautes), puis attend ses images affichées, 2 s chacune au plus. */
async function parcourirSection(section: Locator) {
  await section.evaluate(async s => {
    const pause = (ms: number) => new Promise(r => setTimeout(r, ms));
    const haut = s.getBoundingClientRect().top + window.scrollY;
    const hauteur = s.getBoundingClientRect().height;
    for (let y = haut - 100; y < haut + hauteur; y += window.innerHeight * 0.8) {
      window.scrollTo({ top: y, behavior: 'instant' });
      await pause(150);
    }
    const chargee = (i: HTMLImageElement) => i.complete && i.naturalWidth > 0;
    const affichees = () => [...s.querySelectorAll('img')].filter(i => {
      const r = i.getBoundingClientRect();
      return i.checkVisibility({ opacityProperty: true, visibilityProperty: true }) && r.width > 1 && r.height > 1
        && r.right > 0 && r.left < window.innerWidth;
    });
    for (const image of affichees().filter(i => !chargee(i)).slice(0, 40)) {
      image.scrollIntoView({ block: 'center', behavior: 'instant' });
      const fin = Date.now() + 2_000;
      while (!chargee(image) && Date.now() < fin) await pause(100);
    }
  });
}

function conditions(testInfo: TestInfo, env: string, page: string, chemin: string) {
  test.skip(env !== 'preprod', 'Pages de sections : préprod uniquement');
  testInfo.annotations.push({ type: 'Page', description: `${page} (${chemin})` });
}

for (const s of SECTIONS) {
  const zone = zoneDe(s.cle);

  test(`Section · ${s.nom} @tnr @controles @sections`, async ({ page, qaEnv }, testInfo) => {
    conditions(testInfo, qaEnv.name, s.page, s.chemin);
    const section = page.locator(zone);

    await etape(page, testInfo, `1. Ouvrir la page ${s.page}`, () => ouvrirPage(page, s.chemin));

    await etape(page, testInfo, `2. Retrouver la section sous son intitulé « ${s.nom} »`, async () => {
      await expect(section, `La section ${s.cle} (« ${s.nom} ») doit être sur la page ${s.page}. Retirée volontairement ? Mettre à jour data/pages-sections.json`).toHaveCount(1);
      const intitule = await intituleAuDessus(section);
      if (intitule !== s.nom) {
        // Sections 3 : la section Text est posée sous l'intitulé « Split Screen Media » (data/pages-sections.json).
        testInfo.annotations.push({ type: 'Intitulé', description: `Au-dessus de la section : ${intitule ? `« ${intitule} »` : 'aucun intitulé'} (attendu « ${s.nom} ») : la section n'est pas sous son intitulé sur la page` });
      }
    });

    await etape(page, testInfo, '3. La section s\'affiche, ses images chargent, sans texte d\'erreur Shopify', async () => {
      await parcourirSection(section);
      await section.scrollIntoViewIfNeeded();
      const bilan = await section.evaluate(s => {
        const images = [...s.querySelectorAll('img')].filter(i => {
          const r = i.getBoundingClientRect();
          return i.checkVisibility({ opacityProperty: true, visibilityProperty: true }) && r.width > 1 && r.height > 1
            && r.right > 0 && r.left < window.innerWidth;
        });
        return {
          hauteur: s.getBoundingClientRect().height,
          cassees: images.filter(i => !i.complete || i.naturalWidth === 0).map(i => (i.currentSrc || i.src).split('?')[0].split('/').pop()),
          texte: (s as HTMLElement).innerText,
        };
      });
      expect.soft(bilan.hauteur, 'La section doit s\'afficher (hauteur nulle)').toBeGreaterThan(0);
      expect.soft(bilan.cassees, 'Image(s) affichée(s) mais non chargée(s)').toEqual([]);
      expect.soft(bilan.texte.match(/Liquid error[^\n]*|translation missing[^\n]*/gi) ?? [], 'Texte d\'erreur Shopify visible dans la section').toEqual([]);
      if (bilan.hauteur > 0) await testInfo.attach(`🧩 section ${s.nom}`, { body: await section.screenshot().catch(() => Buffer.from('')), contentType: 'image/png' });
    });
  });

  test(`Accessibilité (axe) · Section ${s.nom} @tnr @accessibilite @sections`, async ({ page, qaEnv }, testInfo) => {
    conditions(testInfo, qaEnv.name, s.page, s.chemin);
    await etape(page, testInfo, `1. Ouvrir la page ${s.page}`, async () => {
      await ouvrirPage(page, s.chemin);
      await preparer(page);
    });
    await etape(page, testInfo, `2. Relever l'accessibilité de la section « ${s.nom} » et la comparer à son relevé`, async () => {
      await expect(page.locator(zone), `La section ${s.cle} doit être sur la page`).toHaveCount(1);
      await verifierAccessibilite(page, testInfo, `sections/${s.dossier}`, zone);
    });
  });
}
