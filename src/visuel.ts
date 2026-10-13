import type { Locator, Page, TestInfo } from '@playwright/test';
import { test, expect } from './fixtures';
import { CartPage } from './pages/cart';

/**
 * Prépare une page pour une capture visuelle stable :
 * images chargées jusqu'en bas de page, polices prêtes, vidéos arrêtées.
 */
export async function stabiliserPage(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    // Collection : pas de défilement infini, on garde la première page de produits.
    document.querySelector('collection-infinite-scroll')?.remove();

    // Le thème laisse le navigateur sauter le dessin de ce qui est loin de l'écran (cartes produit des collections
    // en desktop) : dans une capture pleine page, ces cartes sortiraient en cases blanches. On force leur dessin
    // dès maintenant, pour que leurs photos soient chargées et décodées avec les autres.
    const dessinComplet = document.createElement('style');
    dessinComplet.textContent = '* { content-visibility: visible !important; }';
    document.head.append(dessinComplet);

    // Images chargées tout de suite plutôt qu'au défilement.
    document.querySelectorAll<HTMLImageElement>('img[loading="lazy"]').forEach(img => { img.loading = 'eager'; });

    // Défilement jusqu'en bas pour déclencher ce que le thème charge à l'apparition, puis retour en haut.
    // Défilement instantané : le thème défile en douceur, la capture partirait en plein mouvement.
    document.documentElement.style.scrollBehavior = 'auto';
    for (let y = 0; y < document.documentElement.scrollHeight; y += window.innerHeight / 2) {
      window.scrollTo({ top: y, behavior: 'instant' });
      await pause(100);
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
    await pause(300);
    await document.fonts.ready;
  });

  // Images visibles toutes chargées (les images masquées sur cet appareil ne comptent pas).
  const imagesChargees = () => page.waitForFunction(() => [...document.images]
    .filter(img => img.getClientRects().length > 0)
    .every(img => img.complete), undefined, { timeout: 30_000 });
  await imagesChargees();
  // Le thème affiche d'abord une version basse définition de certaines photos, puis la remplace :
  // on attend la fin des téléchargements (au plus 15 s, certaines pages n'arrêtent jamais tout à fait).
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
  await imagesChargees();
  // Décodage complet de chaque image visible : sinon Safari peut afficher une version provisoire moins nette.
  await page.evaluate(() => Promise.all([...document.images]
    .filter(img => img.getClientRects().length > 0)
    .map(img => { img.decoding = 'sync'; return img.decode().catch(() => {}); })));

  // Vidéos : lecture coupée pour soulager la machine. Elles sont masquées à la capture (src/visuel.css) :
  // l'image fixe placée dessous est vérifiée à la place, une image de vidéo n'étant jamais dessinée deux fois pareil.
  await page.evaluate(() => {
    HTMLMediaElement.prototype.play = () => Promise.resolve();
    document.querySelectorAll('video').forEach(video => video.pause());
  });
}

/** Fiche produit de référence : le Numéro Un noir grainé, en ligne depuis 2017, une seule variante. */
export const PRODUIT = 'numero-un-textured-black';

export interface PageVisuelle {
  nom: string;
  /** Nom des captures de référence (references/<fichier>/). */
  fichier: string;
  /** Type de page, en anglais comme chez Polène : étiquette @home, @pdp, @cart… */
  typePage: 'home' | 'plp' | 'pdp' | 'cart' | 'checkout';
  ouvrir: (page: Page) => Promise<void>;
  /** Zones qui changent sans que ce soit un bug : recouvertes d'un aplat rose dans la capture. */
  zonesIgnorees?: (page: Page) => { libelle: string; zone: Locator }[];
}

export const PAGES_VISUELLES: PageVisuelle[] = [
  {
    nom: 'Accueil',
    fichier: 'accueil',
    typePage: 'home',
    ouvrir: async page => { await page.goto('./', { waitUntil: 'load' }); },
    // Les photos Instagram (derniers posts, changent à chaque publication) sont cachées par src/visuel.css.
  },
  // Pas de collection : les mentions de stock (« Être prévenu(e) », « Précommande le … ») changent plusieurs fois
  // par jour en prod, une capture n'y reste jamais valable. Les collections sont vérifiées par leur structure
  // (tests/structure-collections.spec.ts, décision QA du 6 octobre 2026).
  {
    nom: 'Fiche produit Numéro Un',
    fichier: 'fiche-produit',
    typePage: 'pdp',
    ouvrir: async page => { await page.goto(`products/${PRODUIT}`, { waitUntil: 'load' }); },
  },
  {
    nom: 'Panier avec un produit',
    fichier: 'panier',
    typePage: 'cart',
    ouvrir: async page => {
      // Ajout direct par l'adresse /cart/add?id=… : plus rapide que l'interface, et le parcours d'achat teste déjà
      // le bouton. Pas par l'API (products/….js, cart/add.js) : Shopify la limite vite (code 429) quand les séries
      // s'enchaînent, surtout pour Chrome ordinateur, alors que les pages normales restent accessibles.
      await page.goto(`products/${PRODUIT}`, { waitUntil: 'domcontentloaded' });
      const variante = await page.locator('form[action*="/cart/add"] [name="id"]').first().inputValue();
      expect(variante, 'La fiche produit doit contenir le formulaire d\'ajout au panier').toMatch(/^\d+$/);
      await page.goto(`cart/add?id=${variante}&quantity=1`, { waitUntil: 'load' });
      await new CartPage(page).expectLoaded();
    },
    zonesIgnorees: page => [
      // Le bloc entier, titre compris : il s'appelle tantôt « Polène suggère », tantôt « Complétez votre panier ».
      // Seulement ce bloc : un sélecteur plus large attrapait aussi les boutons « Ajouter au panier » des produits
      // hors carrousel, invisibles, et masquait une bande du récapitulatif.
      { libelle: 'Bloc de recommandations « Polène suggère » / « Complétez votre panier »', zone: page.locator('product-recommendations') },
    ],
  },
];

/**
 * Ouvre la page, la stabilise et la compare en entier à sa référence (references/<fichier>/<projet>.png).
 * `avantCapture` sert à la démo des régressions injectées : il modifie la page juste avant la capture.
 */
export async function verifierPage(
  page: Page,
  testInfo: TestInfo,
  pageVisuelle: PageVisuelle,
  options: { message: string; avantCapture?: (page: Page) => Promise<void> },
): Promise<void> {
  const zones = pageVisuelle.zonesIgnorees?.(page) ?? [];
  if (zones.length) testInfo.annotations.push({ type: 'Zones ignorées (en rose)', description: zones.map(z => z.libelle).join(', ') });

  // Pas de capture d'étape ici : la capture pleine page de l'étape 2 suffit (et elle est jointe en cas d'écart).
  await test.step(`1. Ouvrir la page ${pageVisuelle.nom}`, async () => {
    await pageVisuelle.ouvrir(page);
    await stabiliserPage(page);
    await options.avantCapture?.(page);
  });

  await test.step('2. Comparer la page entière à la référence', async () => {
    await expect(page, options.message).toHaveScreenshot(`${pageVisuelle.fichier}.png`, {
      fullPage: true,
      mask: zones.map(z => z.zone),
      timeout: 30_000,
    });
  });
}
