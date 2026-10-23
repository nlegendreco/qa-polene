import { existsSync } from 'node:fs';
import type { Locator, Page, TestInfo } from '@playwright/test';
import { test, expect, type Fiche } from './fixtures';
import { CartPage } from './pages/cart';
import { CheckoutPage } from './pages/checkout';
import { ProductPage } from './pages/product';

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
  typePage: 'home' | 'plp' | 'pdp' | 'cart' | 'checkout' | 'account' | 'content';
  /**
   * Contenu qui ne change pas d'une semaine à l'autre (ni campagne, ni stock, ni article) : seules ces pages sont
   * comparées en prod, pendant une MEP (`MEP=1`, demande QA du 22 octobre 2026). Les autres ne servent en prod qu'à
   * prendre la référence de la préprod.
   */
  contenuFixe?: boolean;
  /** Fiche produit que le Roll Out doit servir (src/fiches.ts). Sans valeur : la nouvelle (test.use des tests visuels). */
  fiche?: Fiche;
  ouvrir: (page: Page) => Promise<void>;
  /** Zones qui changent sans que ce soit un bug : recouvertes d'un aplat rose dans la capture. */
  zonesIgnorees?: (page: Page) => { libelle: string; zone: Locator }[];
  /** Appareils concernés : un menu au survol n'existe que sur ordinateur, le menu « burger » que sur téléphone. */
  appareils?: 'ordinateur' | 'telephone';
  /** Action faite une fois la page stable, juste avant la capture (ouvrir un menu : le défilement le refermerait). */
  deplier?: (page: Page) => Promise<void>;
  /**
   * Capture d'une partie seulement : la zone renvoyée, ou l'écran visible si elle renvoie undefined. Sans `cadre`,
   * la page entière.
   */
  cadre?: (page: Page) => Promise<{ x: number; y: number; width: number; height: number } | undefined>;
}

const menuPrincipal = (page: Page) => page.getByRole('banner').getByRole('navigation', { name: /Menu principal|Main menu/i });
const panneauOuvert = (page: Page) => page.locator('.header__menu-panel__wrapper').filter({ visible: true }).first();

/** Attend que les images visibles d'une zone soient chargées et décodées (le menu ne les charge qu'à l'ouverture). */
async function imagesDe(zone: Locator) {
  await expect.poll(() => zone.locator('img').evaluateAll(images => images
    .filter(i => i.getClientRects().length > 0)
    .every(i => (i as HTMLImageElement).complete)), { message: 'Les images du menu doivent se charger', timeout: 15_000 }).toBe(true);
  await zone.locator('img').evaluateAll(images => Promise.all(images.map(i => (i as HTMLImageElement).decode().catch(() => {}))));
}

/** Attend qu'une zone ne bouge plus (fin d'une animation d'ouverture). */
async function immobile(zone: Locator, message: string) {
  await expect.poll(async () => {
    const avant = await zone.boundingBox();
    await zone.page().waitForTimeout(300);
    return JSON.stringify(avant) === JSON.stringify(await zone.boundingBox());
  }, { message }).toBe(true);
}

/** Entrées du menu (onglets), en français pour la prod et en anglais pour la préprod. */
const ENTREES_MENU: { nom: string; fichier: string; libelle: RegExp; ordinateur: boolean }[] = [
  { nom: 'Sacs', fichier: 'sacs', libelle: /^(Sacs|Bags)$/i, ordinateur: true },
  { nom: 'Bijoux', fichier: 'bijoux', libelle: /^(Bijoux|Jewell?ery)$/i, ordinateur: true },
  { nom: 'Accessoires', fichier: 'accessoires', libelle: /^(Accessoires|Accessories)$/i, ordinateur: true },
  { nom: 'Savoir-Faire', fichier: 'savoir-faire', libelle: /^Savoir-Faire$/i, ordinateur: true },
  { nom: 'Boutiques', fichier: 'boutiques', libelle: /^(Boutiques|Stores)$/i, ordinateur: true },
  // Sur ordinateur, le service client n'est pas dans le menu.
  { nom: 'Service client', fichier: 'service-client', libelle: /^(Service client|Customer service)$/i, ordinateur: false },
];

/**
 * Menus ouverts (demande QA du 21 octobre 2026 : le fonctionnement et le contenu du menu étaient testés, pas son
 * aspect ; tous les onglets depuis le 22 octobre 2026). Ouverts sur le panier vide, page légère et sans Roll Out :
 * seul le menu est capturé. Photos de campagne masquées (elles changent à chaque saison), le reste doit être identique :
 * textes, colonnes, alignements, couleurs. Contenu fixe : comparés en prod pendant les MEP.
 */
const MENUS_VISUELS: PageVisuelle[] = [
  // Ordinateur : un panneau par onglet, au survol (lien) ou au clic (bouton : Savoir-Faire, Boutiques).
  ...ENTREES_MENU.filter(e => e.ordinateur).map((entree): PageVisuelle => ({
    nom: `Menu « ${entree.nom} » ouvert`,
    fichier: `menu-${entree.fichier}`,
    typePage: 'home',
    contenuFixe: true,
    appareils: 'ordinateur',
    ouvrir: async page => { await page.goto('cart', { waitUntil: 'load' }); },
    deplier: async page => {
      const banniere = page.getByRole('banner');
      const onglet = banniere.getByRole('link', { name: entree.libelle }).or(banniere.getByRole('button', { name: entree.libelle }))
        .filter({ visible: true }).first();
      await onglet.hover();
      // Un lien ouvre son panneau au survol ; un bouton peut demander un clic (cliquer un lien changerait de page).
      if (!(await panneauOuvert(page).isVisible({ timeout: 2_000 }).catch(() => false))
        && await onglet.evaluate(e => e.tagName === 'BUTTON')) await onglet.click();
      await expect(panneauOuvert(page), `Le panneau du menu « ${entree.nom} » doit s'ouvrir`).toBeVisible();
      await imagesDe(panneauOuvert(page));
      await immobile(panneauOuvert(page), `Le panneau du menu « ${entree.nom} » doit finir de s'ouvrir`);
    },
    // En-tête et panneau seulement : sous le panneau, c'est la page (suggestions du panier, qui changent).
    cadre: async page => {
      const panneau = (await panneauOuvert(page).boundingBox())!;
      return { x: 0, y: 0, width: page.viewportSize()!.width, height: Math.ceil(panneau.y + panneau.height) };
    },
    zonesIgnorees: page => [
      { libelle: 'Photos de campagne du panneau', zone: page.locator('.header__menu-panel__wrapper img') },
    ],
  })),
  {
    nom: 'Menu mobile ouvert',
    fichier: 'menu-mobile',
    typePage: 'home',
    contenuFixe: true,
    appareils: 'telephone',
    ouvrir: async page => { await page.goto('cart', { waitUntil: 'load' }); },
    deplier: async page => {
      await page.getByRole('banner').getByRole('button', { name: /Open main menu|Ouvrir le menu/i }).click();
      await expect(menuPrincipal(page), 'Le menu mobile doit s\'ouvrir').toBeVisible();
      await imagesDe(menuPrincipal(page));
      await immobile(menuPrincipal(page), 'Le menu mobile doit finir de s\'ouvrir');
    },
    // Le menu prend tout l'écran sous l'en-tête : capture de l'écran visible.
    cadre: async () => undefined,
    zonesIgnorees: page => [
      { libelle: 'Photos de campagne (Bestsellers, Nouveautés)', zone: menuPrincipal(page).locator('img') },
      // Le champ propose des recherches qui changent (« Mokki »…).
      { libelle: 'Suggestion du champ de recherche', zone: menuPrincipal(page).locator('input') },
    ],
  },
  // Téléphone : le sous-menu de chaque onglet, ouvert depuis le menu.
  ...ENTREES_MENU.map((entree): PageVisuelle => ({
    nom: `Menu mobile « ${entree.nom} » ouvert`,
    fichier: `menu-mobile-${entree.fichier}`,
    typePage: 'home',
    contenuFixe: true,
    appareils: 'telephone',
    ouvrir: async page => { await page.goto('cart', { waitUntil: 'load' }); },
    deplier: async page => {
      await page.getByRole('banner').getByRole('button', { name: /Open main menu|Ouvrir le menu/i }).click();
      const menu = menuPrincipal(page);
      await expect(menu, 'Le menu mobile doit s\'ouvrir').toBeVisible();
      await menu.getByRole('link', { name: entree.libelle }).or(menu.getByRole('button', { name: entree.libelle }))
        .filter({ visible: true }).first().click();
      // Sous-menu ouvert : son bouton « Retour <onglet> » apparaît.
      const retour = menu.getByRole('button', { name: new RegExp(`^(Retour|Back to) (${entree.libelle.source.replace(/^\^\(?|\)?\$$/g, '')})$`, 'i') });
      await expect(retour.filter({ visible: true }).first(), `Le sous-menu « ${entree.nom} » doit s'ouvrir`).toBeVisible();
      await imagesDe(menu);
      await immobile(retour.filter({ visible: true }).first(), `Le sous-menu « ${entree.nom} » doit finir de s'ouvrir`);
    },
    cadre: async () => undefined,
    zonesIgnorees: page => [
      { libelle: 'Photos de campagne du menu', zone: menuPrincipal(page).locator('img') },
    ],
  })),
];

/** Bloc de suggestions du panier : son titre et ses produits changent. */
const suggestionsPanier = (page: Page) => ({
  libelle: 'Bloc de recommandations « Polène suggère » / « Complétez votre panier »',
  zone: page.locator('product-recommendations'),
});

/** Ajout direct par l'adresse /cart/add?id=… (voir « Panier avec un produit »). */
async function mettreAuPanier(page: Page) {
  await page.goto(`products/${PRODUIT}`, { waitUntil: 'domcontentloaded' });
  const variante = await page.locator('form[action*="/cart/add"] [name="id"]').first().inputValue();
  expect(variante, 'La fiche produit doit contenir le formulaire d\'ajout au panier').toMatch(/^\d+$/);
  await page.goto(`cart/add?id=${variante}&quantity=1`, { waitUntil: 'load' });
  await new CartPage(page).expectLoaded();
}

/**
 * Pages comparées en pixels. Référence : la prod (demande QA du 22 octobre 2026). La préprod est comparée à la
 * capture de la prod, prise sur une prod sans bug et gardée : tant que la préprod n'est pas à jour avec la prod
 * (textes en anglais, prix convertis, catalogue), ses tests échouent, c'est attendu. En prod, seules les pages à contenu
 * fixe sont comparées, pendant une MEP.
 */
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
  // Nouvelle fiche seulement : la référence de l'ancienne a été retirée à la revue de la QA du 22 octobre 2026 (la
  // prod ne la sert plus). goto vérifie aussi que le Roll Out a servi la fiche voulue.
  {
    nom: 'Fiche produit Numéro Un',
    fichier: 'fiche-produit',
    typePage: 'pdp',
    fiche: 'nouvelle',
    ouvrir: async page => { await new ProductPage(page).goto(PRODUIT, { waitUntil: 'load' }); },
  },
  {
    nom: 'Panier avec un produit',
    fichier: 'panier',
    typePage: 'cart',
    contenuFixe: true,
    // Ajout direct par l'adresse /cart/add?id=… : plus rapide que l'interface, et le parcours d'achat teste déjà
    // le bouton. Pas par l'API (products/….js, cart/add.js) : Shopify la limite vite (code 429) quand les séries
    // s'enchaînent, surtout pour Chrome ordinateur, alors que les pages normales restent accessibles.
    ouvrir: mettreAuPanier,
    // Le bloc entier, titre compris : il s'appelle tantôt « Polène suggère », tantôt « Complétez votre panier ».
    // Seulement ce bloc : un sélecteur plus large attrapait aussi les boutons « Ajouter au panier » des produits
    // hors carrousel, invisibles, et masquait une bande du récapitulatif.
    zonesIgnorees: page => [suggestionsPanier(page)],
  },
  // Pages ajoutées le 22 octobre 2026 (QA : « il manque des pages couvertes visuellement »), qui existent en prod et en
  // préprod.
  {
    nom: 'Panier vide',
    fichier: 'panier-vide',
    typePage: 'cart',
    contenuFixe: true,
    ouvrir: async page => { await page.goto('cart', { waitUntil: 'load' }); },
    zonesIgnorees: page => [suggestionsPanier(page)],
  },
  {
    nom: 'Checkout',
    fichier: 'checkout',
    typePage: 'checkout',
    contenuFixe: true,
    ouvrir: async page => {
      await mettreAuPanier(page);
      await new CartPage(page).goToCheckout();
      await new CheckoutPage(page).expectLoaded();
    },
    zonesIgnorees: page => [
      // Cadres des moyens de paiement (PayPal, Google Pay, champs de carte) : dessinés par des tiers.
      { libelle: 'Cadres de paiement (PayPal, Google Pay, Shop Pay, carte)', zone: page.locator('iframe') },
    ],
  },
  {
    nom: 'Page introuvable',
    fichier: 'page-introuvable',
    typePage: 'content',
    contenuFixe: true,
    ouvrir: async page => { await page.goto('pages/qa-page-inexistante', { waitUntil: 'load' }); },
  },
  {
    nom: 'Connexion',
    fichier: 'connexion',
    typePage: 'account',
    contenuFixe: true,
    ouvrir: async page => { await page.goto('account/login', { waitUntil: 'load' }); },
  },
  {
    nom: 'Mot de passe oublié',
    fichier: 'mot-de-passe-oublie',
    typePage: 'account',
    contenuFixe: true,
    ouvrir: async page => { await page.goto('account/login?view=recover', { waitUntil: 'load' }); },
  },
  {
    nom: 'Création de compte',
    fichier: 'creation-de-compte',
    typePage: 'account',
    contenuFixe: true,
    ouvrir: async page => { await page.goto('account/register', { waitUntil: 'load' }); },
  },
  {
    nom: 'Favoris (vide)',
    fichier: 'favoris',
    typePage: 'account',
    contenuFixe: true,
    ouvrir: async page => { await page.goto('pages/wishlist', { waitUntil: 'load' }); },
  },
  // Pages éditoriales : l'équipe peut en changer le contenu, elles ne sont pas comparées en prod pendant les MEP.
  {
    nom: 'Savoir-faire',
    fichier: 'savoir-faire',
    typePage: 'content',
    ouvrir: async page => { await page.goto('pages/craftsmanship', { waitUntil: 'load' }); },
  },
  {
    nom: 'Boutiques',
    fichier: 'boutiques',
    typePage: 'content',
    ouvrir: async page => { await page.goto('blogs/stores', { waitUntil: 'load' }); },
  },
  ...MENUS_VISUELS,
];

/**
 * Contributions de test de la préprod, absentes de la prod : retirées avant la capture de la préprod pour ne pas
 * compter comme un écart de mise en page. Onglet « GOLDEN DATA TEST » de la fiche, contribué volontairement et qui
 * deviendra « QA » (QA, 22 octobre 2026).
 */
export async function retirerContributionsQa(page: Page) {
  await page.evaluate(() => {
    document.querySelectorAll<HTMLElement>('[role="tab"], .product-detail-list li').forEach(onglet => {
      if (/^\s*(GOLDEN DATA TEST|QA)\s*$/i.test(onglet.textContent ?? '')) onglet.style.display = 'none';
    });
  });
}

/**
 * Nom du fichier de référence d'un projet : « prod · iphone » → « prod-·-iphone.png ». Playwright ne corrige pas les
 * espaces d'un nom donné en plusieurs morceaux (il les gardait, 22 octobre 2026), contrairement à {projectName}.
 */
export const nomDeCapture = (projet: string) => `${projet.replace(/ /g, '-')}.png`;

/** Mise à jour des références demandée (`--update-snapshots`, npm run test:visuel:maj). */
export const majDesReferences = (testInfo: TestInfo) => ['all', 'changed'].includes(testInfo.config.updateSnapshots);

/**
 * Ouvre la page, la stabilise et la compare à sa référence, references/<fichier>/<projetReference>.png.
 * `projetReference` : projet qui a pris la référence, le projet du test par défaut ; « prod · iphone » pour la préprod
 * sur iPhone, comparée à la prod. Une référence d'un autre projet n'est jamais écrite par ce test.
 * `avantCapture` sert à la démo des régressions injectées : il modifie la page juste avant la capture.
 */
export async function verifierPage(
  page: Page,
  testInfo: TestInfo,
  pageVisuelle: PageVisuelle,
  options: { message: string; projetReference?: string; avantCapture?: (page: Page) => Promise<void> },
): Promise<void> {
  const projet = options.projetReference ?? testInfo.project.name;
  const nom = [pageVisuelle.fichier, nomDeCapture(projet)];
  if (projet !== testInfo.project.name) {
    testInfo.annotations.push({ type: 'Référence', description: `capture du projet « ${projet} »` });
    // Sans référence, Playwright écrirait la capture de la préprod à la place de celle de la prod.
    expect(existsSync(testInfo.snapshotPath(...nom)), `Pas de référence « ${projet} » pour la page ${pageVisuelle.nom} : la prendre en prod (npm run test:visuel:maj, accord QA)`).toBe(true);
  }
  const zones = pageVisuelle.zonesIgnorees?.(page) ?? [];
  if (zones.length) testInfo.annotations.push({ type: 'Zones ignorées (en rose)', description: zones.map(z => z.libelle).join(', ') });

  // Pas de capture d'étape ici : la capture pleine page de l'étape 2 suffit (et elle est jointe en cas d'écart).
  await test.step(`1. Ouvrir la page ${pageVisuelle.nom}`, async () => {
    await pageVisuelle.ouvrir(page);
    await stabiliserPage(page);
    await pageVisuelle.deplier?.(page);
    await options.avantCapture?.(page);
  });

  await test.step(pageVisuelle.cadre ? '2. Comparer la zone à la référence' : '2. Comparer la page entière à la référence', async () => {
    await expect(page, options.message).toHaveScreenshot(nom, {
      fullPage: !pageVisuelle.cadre,
      clip: await pageVisuelle.cadre?.(page),
      mask: zones.map(z => z.zone),
      timeout: 30_000,
    });
  });
}
