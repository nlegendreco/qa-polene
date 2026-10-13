import type { Page } from '@playwright/test';
import { test, expect, etape } from '../src/fixtures';
import { parsePriceToCents } from '../src/price';
import { appelShopify } from '../src/shopify';

/**
 * Structure des collections (décision QA du 6 octobre 2026) : en prod, les mentions de stock des cartes
 * (« Être prévenu(e) », « Précommande le … ») changent plusieurs fois par jour, une comparaison de pixels
 * y donnerait sans cesse de fausses alertes. On vérifie donc ce qui ne doit jamais casser :
 * chaque carte a sa photo, son nom, son prix et son lien, la grille a le bon nombre de colonnes,
 * rien ne déborde de l'écran, et les « PLP breaks » (sections posées dans la grille) s'affichent.
 *
 * Prod uniquement pour l'instant : la préprod n'a pas les mêmes collections.
 */

const COLLECTIONS = [
  { nom: 'Sacs', handle: 'handbags', avecBreak: false },
  // Grande photo demi-largeur en 3e position (Boky Cerise Noire, 6 octobre 2026).
  { nom: 'Crossbody', handle: 'crossbody', avecBreak: true },
];

/** Cartes produit et PLP breaks de la grille, lus dans la page (textContent : WebKit renvoie un innerText vide hors écran). */
function lireGrille(page: Page) {
  return page.evaluate(() => {
    const grille = document.querySelector('.collection__product-grid');
    const total = Number(grille?.getAttribute('data-total-products') ?? NaN);
    const boite = (el: Element) => { const b = el.getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y + scrollY), largeur: Math.round(b.width), hauteur: Math.round(b.height) }; };
    const image = (el: Element) => {
      const img = [...el.querySelectorAll('img')].find(i => i.getClientRects().length > 0);
      return img ? { chargee: img.complete && img.naturalWidth > 0, src: img.currentSrc || img.src } : null;
    };
    const cartes = [...(grille?.querySelectorAll(':scope > component-product-card') ?? [])].map((carte, index) => ({
      position: index + 1,
      nom: carte.querySelector('.component-product-card__footer__details__label--title')?.textContent?.trim() ?? '',
      edition: carte.querySelector('.component-product-card__footer__details__label--edition')?.textContent?.trim() ?? '',
      prix: carte.querySelector('.component-product-card__footer__details__label--price')?.textContent?.trim() ?? '',
      lien: carte.querySelector('a[href*="/products/"]')?.getAttribute('href') ?? '',
      image: image(carte),
      ...boite(carte),
    }));
    const breaks = [...(grille?.querySelectorAll(':scope > .collection-break') ?? [])]
      .filter(b => b.getClientRects().length > 0)
      .map(b => ({
        position: [...grille!.children].filter(c => c.tagName !== 'STYLE').indexOf(b) + 1,
        lien: b.querySelector('a')?.getAttribute('href') ?? '',
        image: image(b),
        ...boite(b),
      }));
    return {
      total,
      cartes,
      breaks,
      largeurEcran: window.innerWidth,
      largeurPage: document.documentElement.scrollWidth,
    };
  });
}

/** Fait charger toutes les photos de la grille (elles ne se chargent qu'à l'approche de l'écran). */
async function chargerToutesLesImages(page: Page) {
  await page.evaluate(async () => {
    // Le nombre de produits de la collection n'est écrit que sur le défilement infini : on le garde sur la grille
    // avant de retirer l'élément (sinon il charge la suite de la collection pendant qu'on défile).
    const defilement = document.querySelector('collection-infinite-scroll');
    const total = defilement?.getAttribute('data-total-products');
    if (total) document.querySelector('.collection__product-grid')?.setAttribute('data-total-products', total);
    defilement?.remove();
    // En desktop, le thème ne met pas en page les cartes loin de l'écran : leurs photos auraient l'air absentes.
    const dessinComplet = document.createElement('style');
    dessinComplet.textContent = '* { content-visibility: visible !important; }';
    document.head.append(dessinComplet);
    document.querySelectorAll<HTMLImageElement>('main img[loading="lazy"]').forEach(img => { img.loading = 'eager'; });
    for (let y = 0; y < document.documentElement.scrollHeight; y += window.innerHeight) {
      window.scrollTo({ top: y, behavior: 'instant' });
      await new Promise(resolve => setTimeout(resolve, 80));
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
  });
  await page.waitForFunction(() => [...document.querySelectorAll<HTMLImageElement>('.collection__product-grid img')]
    .filter(img => img.getClientRects().length > 0)
    .every(img => img.complete), undefined, { timeout: 30_000 }).catch(() => {});
}

const liste = (elements: string[]) => elements.slice(0, 10).join(', ') + (elements.length > 10 ? `… (${elements.length} en tout)` : '');

for (const collection of COLLECTIONS) {
  test(`Structure · Collection ${collection.nom} @tnr @plp`, async ({ page, qaEnv, isMobile }, testInfo) => {
    test.skip(qaEnv.name !== 'prod', 'Prod uniquement pour l\'instant : la préprod n\'a pas les mêmes collections');
    testInfo.annotations.push({ type: 'Environnement', description: `${qaEnv.label} (${qaEnv.baseURL})` });
    let grille!: Awaited<ReturnType<typeof lireGrille>>;

    await etape(page, testInfo, '1. Ouvrir la collection', async () => {
      const reponse = await page.goto(`collections/${collection.handle}`, { waitUntil: 'load' });
      expect(reponse?.status(), `La collection ${collection.nom} doit répondre (code 200)`).toBe(200);
      await expect(page.getByRole('main').getByRole('heading', { level: 1 }), 'La collection doit avoir un titre').toBeVisible();
      await expect(page.getByRole('main').getByRole('button', { name: /^(Filtres|Filters)\b/i }), 'Le bouton Filtres doit être visible').toBeVisible();
    });

    await etape(page, testInfo, '2. Vérifier les cartes produit', async () => {
      await chargerToutesLesImages(page);
      grille = await lireGrille(page);
      testInfo.annotations.push({ type: 'Produits', description: `${grille.cartes.length} cartes affichées${Number.isFinite(grille.total) ? ` sur ${grille.total} produits` : ''}` });

      expect(grille.cartes.length, 'La collection doit afficher des produits').toBeGreaterThan(0);
      if (Number.isFinite(grille.total)) {
        expect.soft(grille.cartes.length, `La première page doit afficher ${Math.min(48, grille.total)} produits (48 au plus, ${grille.total} dans la collection)`)
          .toBe(Math.min(48, grille.total));
      }
      const sansNom = grille.cartes.filter(c => !c.nom).map(c => `n° ${c.position}`);
      const sansPrix = grille.cartes.filter(c => !(parsePriceToCents(c.prix) ?? 0)).map(c => `${c.nom || `n° ${c.position}`} (« ${c.prix} »)`);
      const sansLien = grille.cartes.filter(c => !c.lien).map(c => c.nom || `n° ${c.position}`);
      const sansImage = grille.cartes.filter(c => !c.image?.chargee).map(c => `${c.nom} ${c.edition}`.trim() || `n° ${c.position}`);
      expect.soft(sansNom, `Cartes sans nom de produit : ${liste(sansNom)}`).toEqual([]);
      expect.soft(sansPrix, `Cartes sans prix lisible : ${liste(sansPrix)}`).toEqual([]);
      expect.soft(sansLien, `Cartes sans lien vers la fiche produit : ${liste(sansLien)}`).toEqual([]);
      expect.soft(sansImage, `Cartes dont la photo ne s'affiche pas : ${liste(sansImage)}`).toEqual([]);
    });

    await etape(page, testInfo, '3. Vérifier la mise en page', async () => {
      // Nombre de colonnes = cartes alignées sur la première ligne.
      const premiereLigne = grille.cartes.filter(c => c.y === grille.cartes[0].y);
      const colonnesAttendues = isMobile ? 2 : 4;
      const colonnes = new Set(premiereLigne.map(c => c.x)).size;
      // Un break en début de grille prend la place de cartes : on ne compte que si la ligne est complète.
      if (premiereLigne.length >= colonnesAttendues || grille.breaks.every(b => b.position > colonnesAttendues)) {
        expect.soft(colonnes, `La grille doit avoir ${colonnesAttendues} colonnes sur cet appareil`).toBe(colonnesAttendues);
      }
      const largeurs = new Set(grille.cartes.map(c => c.largeur));
      expect.soft(largeurs.size, `Toutes les cartes doivent avoir la même largeur (largeurs trouvées : ${[...largeurs].join(', ')} px)`).toBe(1);
      const hors = grille.cartes.filter(c => c.x < 0 || c.x + c.largeur > grille.largeurEcran + 1).map(c => c.nom || `n° ${c.position}`);
      expect.soft(hors, `Cartes qui dépassent de l'écran : ${liste(hors)}`).toEqual([]);
      expect.soft(grille.largeurPage, `La page ne doit pas être plus large que l'écran (${grille.largeurEcran} px)`).toBeLessThanOrEqual(grille.largeurEcran);
    });

    await etape(page, testInfo, collection.avecBreak ? '4. Vérifier les PLP breaks' : '4. Vérifier l\'absence de PLP break', async () => {
      if (!collection.avecBreak) {
        // Rien à vérifier de plus : on note seulement si un break est apparu.
        if (grille.breaks.length) testInfo.annotations.push({ type: 'PLP break', description: `${grille.breaks.length} trouvé(s), non attendu(s) : ajouter des vérifications ?` });
        return;
      }
      expect(grille.breaks.length, 'La collection doit contenir au moins un PLP break (grande photo dans la grille)').toBeGreaterThan(0);
      for (const brk of grille.breaks) {
        testInfo.annotations.push({ type: 'PLP break', description: `Position ${brk.position}, ${brk.largeur} × ${brk.hauteur} px, lien ${brk.lien || 'aucun'}` });
        expect.soft(brk.image?.chargee, `La photo du PLP break en position ${brk.position} doit s'afficher`).toBe(true);
        expect.soft(brk.largeur, `Le PLP break en position ${brk.position} doit être plus large qu'une carte produit`).toBeGreaterThan(grille.cartes[0].largeur);
        if (brk.lien) {
          await appelShopify(page, `Le lien du PLP break (${brk.lien})`, () => page.request.get(brk.lien.replace(/^\//, '')));
        }
      }
    });
  });
}
