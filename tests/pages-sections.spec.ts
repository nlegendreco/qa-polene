import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect, etape } from '../src/fixtures';
import { produitFixe } from '../src/produits-fixes';
import { decrireErreur, erreurIgnoree, verifierLargeur } from '../src/controles';

/**
 * Pages de sections de la préprod (data/pages-sections.json) : les pages où l'équipe a posé les sections du thème,
 * pour voir leur comportement, et les pages réelles qui portent les sections impossibles à poser sur un article
 * (accueil, fiche produit, panier, compte…). On vérifie que chaque section attendue est là, s'affiche, que ses images
 * chargent, sans erreur JavaScript, sans texte d'erreur Shopify et sans débordement de l'écran. Lecture seule.
 * Les pages réelles qui existent aussi en prod (`cheminProd`) y passent les mêmes contrôles (16 octobre 2026).
 * Les 4 appareils depuis le 22 octobre 2026 (demande QA ; avant : Chrome ordinateur et iPhone). Pages Sections 1 à 3 :
 * chaque section est aussi testée à part, sous son intitulé (tests/sections.spec.ts) ; ici, leur présence, leur ordre,
 * les erreurs JS et la largeur de la page.
 */

interface PageSections {
  id: string;
  nom: string;
  /** Chemin de la page, ou fiche du produit QA `produitFixe`. */
  chemin?: string;
  produitFixe?: string;
  /** Page réelle qui existe aussi en prod : son chemin en prod (souvent le même). Absent : préprod seulement. */
  cheminProd?: string;
  role: string;
  /** Pages de sections de la QA : sections attendues, dans l'ordre. Absent pour une page réelle (contenu modifié par l'équipe). */
  sections?: string[];
  /** Page réelle : sections du thème qu'elle permet de tester (docs/sections-theme.md). */
  couvre?: string[];
  /** Étiquette de page (@home, @pdp…), @sections par défaut. */
  etiquette?: string;
  /** Code de réponse attendu, 200 par défaut (404 pour la page introuvable). */
  statut?: number;
  /** Sections testées une à une sous leur intitulé (tests/sections.spec.ts) : ici, seulement leur présence et leur ordre. */
  intitules?: Record<string, string>;
}

const { pages } = JSON.parse(readFileSync(join(__dirname, '..', 'data', 'pages-sections.json'), 'utf8')) as { pages: PageSections[] };


/** Intitulés posés au-dessus de chaque section (« Carousel », « Mosaic »…) et réglage de couleur de fond : pas suivis. */
const SECTION_TECHNIQUE = /^(text|setting_background_color)_[A-Za-z0-9]{6}$/;
/** Sections sans hauteur par nature. */
const SANS_HAUTEUR = /^setting_background_color_/;

/**
 * Erreurs JS déjà connues de la préprod : notées dans le rapport, sans faire échouer le test. On les reconnaît au
 * fichier du thème qui les lève ; Safari ne donne pas ce fichier, on prend alors son message, sur la même page.
 */
const ERREURS_CONNUES = [
  {
    chemin: '',
    fichier: /include-home\.js/,
    messageSafari: /^SyntaxError: The string did not match the expected pattern\.$/,
    constat: 'Constat 31 : bloc Instagram de l\'accueil vide en préprod (Instafeed répond sans contenu au compte de la prod)',
  },
];

for (const pageSections of pages) {
  const statut = pageSections.statut ?? 200;
  test(`Sections · ${pageSections.nom} @tnr @controles ${pageSections.etiquette ?? '@sections'}`, async ({ page, qaEnv }, testInfo) => {
    const enProd = pageSections.cheminProd !== undefined;
    test.skip(qaEnv.name === 'prod' && !enProd, 'Page de la préprod uniquement');
    const chemin = qaEnv.name === 'prod' ? pageSections.cheminProd! : pageSections.produitFixe ? `products/${produitFixe(pageSections.produitFixe).handle}` : pageSections.chemin ?? '';
    testInfo.annotations.push({ type: 'Page', description: `${chemin || 'accueil'} : ${pageSections.role}` });
    if (pageSections.couvre) testInfo.annotations.push({ type: 'Sections du thème', description: pageSections.couvre.join(', ') });
    const erreursJs: string[] = [];
    const erreursConnues = new Set<string>();
    page.on('pageerror', e => {
      if (erreurIgnoree(e)) return;
      const connue = ERREURS_CONNUES.find(c => c.chemin === chemin && (c.fichier.test(e.stack ?? '') || c.messageSafari.test(e.message)));
      if (connue) erreursConnues.add(connue.constat);
      else erreursJs.push(decrireErreur(e));
    });
    const sections = page.locator('[id^="shopify-section-template--"]');

    await etape(page, testInfo, `1. Ouvrir la page ${pageSections.nom}`, async () => {
      const reponse = await page.goto(chemin, { waitUntil: 'domcontentloaded' });
      expect(reponse?.status(), `La page ${chemin || 'd\'accueil'} doit répondre (code ${statut})`).toBe(statut);
    });

    const attendues = pageSections.sections;
    if (!attendues) {
      // Page réelle : l'équipe en change le contenu, on ne suit pas une liste figée.
      await etape(page, testInfo, '2. Vérifier que la page affiche ses sections', async () => {
        expect(await sections.count(), 'La page n\'affiche aucune section du thème').toBeGreaterThan(0);
      });
    } else await etape(page, testInfo, '2. Vérifier que chaque section attendue est là, dans l\'ordre', async () => {
      const trouvees = (await sections.evaluateAll(s => s.map(e => e.id))).map(id => id.replace(/^shopify-section-template--\d+__/, ''));
      const manquantes = attendues.filter(s => !trouvees.includes(s));
      const nouvelles = trouvees.filter(s => !attendues.includes(s) && !SECTION_TECHNIQUE.test(s));
      expect.soft(manquantes, `Section(s) disparue(s) de la page : ${manquantes.join(', ')}. Retirée(s) volontairement ? Mettre à jour data/pages-sections.json`).toEqual([]);
      if (nouvelles.length) {
        testInfo.annotations.push({ type: 'Nouvelle(s) section(s)', description: `${nouvelles.join(', ')} : à ajouter à data/pages-sections.json pour la suivre` });
      }
      const ordre = trouvees.filter(s => attendues.includes(s));
      if (!manquantes.length) expect.soft(ordre, 'Les sections ne sont plus dans le même ordre').toEqual(attendues);
    });

    await etape(page, testInfo, '3. Parcourir la page : chaque section s\'affiche et ses images chargent', async () => {
      // Défilement jusqu'en bas, par écrans, pour déclencher le chargement des images et des sections différées.
      // Hauteur prise au départ : la recherche et les collections ajoutent des produits en bas de page (9 000 →
      // 26 000 px sur iPhone pour « sac »), on ne les suit pas.
      await page.evaluate(async () => {
        // Collection : première page de produits seulement, comme les tests visuels. En bas de page, le défilement
        // infini ajoutait des produits dont les photos ne se chargent qu'à l'écran (collection Sacs de la prod).
        // Il est vérifié par tests/collections.spec.ts.
        document.querySelector('collection-infinite-scroll')?.remove();
        const hauteur = document.documentElement.scrollHeight;
        for (let y = 0; y < hauteur; y += window.innerHeight * 0.8) {
          window.scrollTo({ top: y, behavior: 'instant' });
          await new Promise(r => setTimeout(r, 120));
        }
      });
      await page.waitForLoadState('load');
      // Images différées passées trop vite (longues pages, résultats de recherche) : chaque image affichée mais pas
      // encore chargée est ramenée à l'écran et attendue jusqu'à 2 s (une image différée ne se charge qu'à l'écran :
      // une pause fixe la laissait de côté sur un Mac chargé), 40 s au total ; puis on leur laisse 8 s. Seules celles
      // qui ne chargent toujours pas comptent.
      await page.evaluate(async () => {
        const pause = (ms: number) => new Promise(r => setTimeout(r, ms));
        const chargee = (i: HTMLImageElement) => i.complete && i.naturalWidth > 0;
        const enAttente = () => [...document.querySelectorAll<HTMLImageElement>('[id^="shopify-section-template--"] img')].filter(i => {
          const r = i.getBoundingClientRect();
          return i.checkVisibility({ opacityProperty: true, visibilityProperty: true }) && r.width > 1 && r.height > 1
            && r.right > 0 && r.left < window.innerWidth && !chargee(i);
        });
        // Plusieurs passages : la grille d'une collection peut être redessinée pendant ce temps (nouvelles images).
        const finPassage = Date.now() + 40_000;
        for (let passage = 0, vues = 0; passage < 5 && vues < 150 && Date.now() < finPassage; passage++) {
          const liste = enAttente();
          if (!liste.length) break;
          for (const image of liste) {
            if (Date.now() > finPassage || ++vues > 150) break;
            if (chargee(image)) continue;
            image.scrollIntoView({ block: 'center', behavior: 'instant' });
            const finImage = Date.now() + 2_000;
            while (!chargee(image) && Date.now() < finImage) await pause(100);
          }
        }
        const fin = Date.now() + 8000;
        while (enAttente().length && Date.now() < fin) await pause(250);
      });
      await page.waitForTimeout(500);

      const problemes = (await sections.evaluateAll((liste, sansHauteur) => liste.map(s => {
        const cle = s.id.replace(/^shopify-section-template--\d+__/, '');
        const hauteur = s.getBoundingClientRect().height;
        // Images réellement affichées : visibles (ni masquées ni transparentes, comme la 2e photo d'une carte produit
        // qui n'apparaît qu'au survol) et dans la largeur de l'écran (les diapositives hors écran d'un carrousel et
        // les versions mobile / ordinateur masquées ne comptent pas). Photos Instagram de l'accueil exclues : contenu de
        // tiers (Instafeed), lent à arriver, déjà ignoré par les tests visuels.
        const images = [...s.querySelectorAll('img')].filter(i => {
          const r = i.getBoundingClientRect();
          return i.checkVisibility({ opacityProperty: true, visibilityProperty: true }) && r.width > 1 && r.height > 1 && r.right > 0 && r.left < window.innerWidth
            && !/cdninstagram|fbcdn/.test(i.currentSrc || i.src);
        });
        const cassees = images.filter(i => !i.complete || i.naturalWidth === 0).map(i => (i.currentSrc || i.src).split('?')[0].split('/').pop());
        return {
          cle,
          vide: hauteur < 1 && !new RegExp(sansHauteur).test(cle),
          cassees,
        };
      }).filter(p => p.vide || p.cassees.length), SANS_HAUTEUR.source))
        // Sections testées une à une (tests/sections.spec.ts) : leurs images et leur affichage y sont vérifiés.
        .filter(p => !pageSections.intitules?.[p.cle]);

      for (const p of problemes) {
        await testInfo.attach(`🧩 section ${p.cle}`, { body: await page.locator(`[id$="__${p.cle}"]`).screenshot().catch(() => Buffer.from('')), contentType: 'image/png' });
      }
      const vides = problemes.filter(p => p.vide).map(p => p.cle);
      if (attendues) expect.soft(vides, 'Section(s) qui ne s\'affichent pas (hauteur nulle)').toEqual([]);
      else if (vides.length) {
        // Page réelle : une section peut n'avoir rien à montrer (panier vide, pas de favoris, bloc d'application caché).
        testInfo.annotations.push({ type: 'Section(s) vide(s)', description: `${vides.join(', ')} : rien à afficher sur cette page, normal si elle n'a pas de contenu` });
      }
      expect.soft(problemes.filter(p => p.cassees.length).map(p => `${p.cle} : ${p.cassees.join(', ')}`), 'Image(s) affichée(s) mais non chargée(s)').toEqual([]);

      const texte = await page.locator('body').innerText();
      expect.soft(texte.match(/Liquid error[^\n]*|translation missing[^\n]*/gi) ?? [], 'Texte d\'erreur Shopify visible dans la page').toEqual([]);
    });

    await etape(page, testInfo, '4. Vérifier l\'absence d\'erreur JavaScript et de débordement horizontal', async () => {
      expect.soft(erreursJs, 'Erreur(s) JavaScript sur la page').toEqual([]);
      for (const constat of erreursConnues) testInfo.annotations.push({ type: 'Erreur JS connue', description: constat });
      await verifierLargeur(page, testInfo);
    });
  });
}
