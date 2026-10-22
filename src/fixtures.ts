import { test as base, expect, type Page, type TestInfo } from '@playwright/test';
import { getEnvironment, type QaEnvironment } from './environments';
import { FICHES, NOM_FICHE, ficheVoulue, preparerFiche, type Fiche } from './fiches';

/**
 * Domaines bloqués pendant les tests :
 * - AB Tasty, pour que tous les tests voient la même version du site ;
 * - pixels publicitaires et analytics, pour ne pas polluer les données marketing
 *   avec le trafic de test (et accélérer les pages) ;
 * - Klaviyo, pour éviter les popups newsletter qui recouvrent la page.
 */
const BLOCKED_HOSTS = [
  'abtasty.com',
  'googletagmanager.com', 'google-analytics.com', 'analytics.google.com', 'doubleclick.net', 'googleadservices.com',
  'facebook.com', 'facebook.net', 'tiktok.com', 'tiktokw.us', 'snapchat.com', 'sc-static.net',
  'pinterest.com', 'pinimg.com', 'criteo.com', 'criteo.net', 'adsrvr.org', 'adnxs.com', 'w55c.net',
  'naver.com', 'naver.net', 'pstatic.net', 'daum.net', 'daumcdn.net', 'kakaocdn.net',
  'vibe.co', 'creativecdn.com', 'mixpanel.com', 'polaranalytics.com', 'segmentstream.com',
  'getelevar.com', 'ravm.tv', 'myshlf.us', 'baback.co',
  'klaviyo.com',
];

function isBlocked(url: URL): boolean {
  const host = url.hostname;
  return BLOCKED_HOSTS.some(h => host === h || host.endsWith(`.${h}`));
}

/**
 * Étape nommée du rapport, avec une capture d'écran jointe à la fin de l'étape.
 */
export async function etape<T>(page: Page, testInfo: TestInfo, name: string, body: () => Promise<T>): Promise<T> {
  return base.step(name, async () => {
    const result = await body();
    // Pas de point dans le nom : Playwright prendrait la suite ("8. Payer…") pour une extension de fichier
    // et l'image ne s'afficherait pas dans certains navigateurs.
    await testInfo.attach(`📸 ${name.replace(/\./g, '')}`, { body: await page.screenshot(), contentType: 'image/png' });
    return result;
  }, { box: true });
}

type Fixtures = {
  qaEnv: QaEnvironment;
  /**
   * Fiche produit que le Roll Out doit servir pendant le test (src/fiches.ts). Sans valeur, Shopify choisit au
   * hasard. Posée par `pourChaqueFiche` ou `test.use({ fiche: 'nouvelle' })`.
   */
  fiche: Fiche | undefined;
  /**
   * Si le Roll Out ne sert plus `fiche`, prendre l'autre au lieu d'ignorer le test. Pour les tests qui passent
   * seulement par la fiche (`ficheDeLAppareil` : parcours d'achat, panier, favoris), pas pour ceux qui la testent.
   */
  ficheDeRepli: boolean;
};

/** Fiche réellement servie à un contexte (l'autre que `fiche` quand le repli a joué). */
const ficheDuContexte = new WeakMap<object, Fiche>();

export const test = base.extend<Fixtures>({
  qaEnv: async ({}, use, testInfo) => {
    const envName = (testInfo.project.metadata as { env?: string }).env;
    if (!envName) throw new Error(`Le projet "${testInfo.project.name}" n'a pas d'environnement (metadata.env).`);
    await use(getEnvironment(envName));
  },

  fiche: [undefined, { option: true }],
  ficheDeRepli: [false, { option: true }],

  context: async ({ context, qaEnv, fiche, ficheDeRepli }, use, testInfo) => {
    // Bandeau cookies (Consentmo) : on pose directement le choix pour qu'il n'apparaisse jamais.
    await context.addCookies([
      { name: 'cookieconsent_status', value: 'allow', domain: qaEnv.cookieDomain, path: '/' },
    ]);
    await context.route(isBlocked, route => route.abort('blockedbyclient'));
    if (fiche) {
      let servie = fiche;
      let tirages = await preparerFiche(context, qaEnv, fiche);
      // Le Roll Out ne sert plus cette fiche (il a pris fin, ou une seule fiche reste en ligne). Un test qui passe
      // seulement par la fiche prend l'autre (en prod le 22 octobre 2026, le parcours d'achat ne tournait plus que sur
      // 2 appareils) ; un test de la fiche elle-même n'a plus d'objet.
      if (tirages === null && ficheDeRepli) {
        servie = FICHES.find(f => f !== fiche)!;
        tirages = await preparerFiche(context, qaEnv, servie);
        if (tirages !== null) testInfo.annotations.push({ type: 'Fiche de repli', description: `Le Roll Out ne sert plus l'${NOM_FICHE[fiche]} : test joué sur l'${NOM_FICHE[servie]}` });
      }
      testInfo.skip(tirages === null, `Le Roll Out ne sert plus l'${NOM_FICHE[fiche]} : test sans objet tant qu'elle n'est pas remise en ligne`);
      testInfo.annotations.push({ type: 'Fiche produit', description: NOM_FICHE[servie] });
      ficheDuContexte.set(context, servie);
    }
    await use(context);
  },

  page: async ({ page, fiche }, use, testInfo) => {
    if (fiche) ficheVoulue.set(page, ficheDuContexte.get(page.context()) ?? fiche);
    // Filet de sécurité si le bandeau cookies s'affiche malgré tout.
    await page.addLocatorHandler(
      page.locator('button[data-csm-button-type="accept"]'),
      button => button.click(),
      { noWaitAfter: true },
    );
    // Bandeau cookies natif de Shopify (« Consentement aux cookies », préprod le 21 octobre 2026, prod le 22 à la
    // place de Consentmo), en bas à droite sur ordinateur : masqué dès l'ouverture de chaque page. Cliquer « Refuser »
    // ne suffisait pas : le bandeau restait dans les captures, les relevés d'axe et de structure tant qu'aucune action
    // n'était jouée.
    await page.addInitScript(() => {
      const masquer = () => {
        const style = document.createElement('style');
        style.textContent = '#shopify-pc__banner { display: none !important; }';
        document.documentElement.append(style);
      };
      if (document.documentElement) masquer();
      else document.addEventListener('DOMContentLoaded', masquer, { once: true });
    });
    // Préprod : fenêtre « It looks like you're in France… » qui propose une autre boutique et recouvre la page
    // (theme-geo-suggestion, puis theme-store-redirect-modal depuis le 7 octobre 2026). On la ferme.
    await page.addLocatorHandler(
      page.locator('theme-geo-suggestion component-modal.active [role=dialog], component-modal.active[data-ref="theme-store-redirect-modal"] [role=dialog]'),
      // Pendant son animation d'ouverture, la fenêtre est déjà « active » mais encore sous la photo du produit, qui
      // reçoit le clic : on déclenche alors directement le bouton de fermeture, sans viser l'écran. Elle peut aussi se
      // refermer seule : on n'insiste pas, sinon le test échouerait sur cette fenêtre et non sur la page testée.
      async fenetre => {
        const fermer = fenetre.getByRole('button', { name: /Close modal|Fermer/i });
        await fermer.click({ timeout: 3_000 }).catch(() => fermer.dispatchEvent('click', undefined, { timeout: 2_000 })).catch(() => {});
      },
      { noWaitAfter: true },
    );

    // Suivi des requêtes réseau, pour expliquer un échec dû à une page qui ne finit pas de charger.
    const started = new Map<object, { url: string; type: string; start: number }>();
    const slow: string[] = [];
    page.on('request', request => {
      started.set(request, { url: request.url(), type: request.resourceType(), start: Date.now() });
    });
    const finish = (request: object) => {
      const entry = started.get(request);
      if (!entry) return;
      const duration = Date.now() - entry.start;
      if (duration > 5_000) slow.push(`${(duration / 1000).toFixed(1)} s  [${entry.type}]  ${entry.url}`);
      started.delete(request);
    };
    page.on('requestfinished', finish);
    page.on('requestfailed', finish);

    await use(page);

    if (testInfo.status !== testInfo.expectedStatus) {
      const now = Date.now();
      const pending = [...started.values()].map(e => `${((now - e.start) / 1000).toFixed(1)} s  [${e.type}]  ${e.url}`);
      await testInfo.attach('🐢 requêtes lentes ou bloquées', {
        contentType: 'text/plain',
        body: [
          `Requêtes encore en cours au moment de l'échec (${pending.length}) :`, ...pending, '',
          `Requêtes terminées en plus de 5 s (${slow.length}) :`, ...slow,
        ].join('\n'),
      });
    }
  },
});

/**
 * Déclare les tests de `corps` deux fois, une par fiche produit du Roll Out : « Ancienne fiche › … » et
 * « Nouvelle fiche › … ». Pour un test qui vérifie la fiche elle-même (@pdp).
 */
export function pourChaqueFiche(corps: (fiche: Fiche) => void) {
  for (const fiche of FICHES) {
    test.describe(fiche === 'ancienne' ? 'Ancienne fiche' : 'Nouvelle fiche', () => {
      test.use({ fiche });
      corps(fiche);
    });
  }
}

/**
 * Une fiche par appareil, pour les tests qui passent seulement par la fiche (parcours d'achat, panier) : chaque
 * fiche est vue sur un ordinateur et un téléphone à chaque lancement, sans doubler les tests (ni les commandes).
 */
export const FICHE_PAR_APPAREIL: Record<string, Fiche> = {
  'desktop-chrome': 'ancienne',
  'desktop-safari': 'nouvelle',
  'iphone': 'ancienne',
  'android': 'nouvelle',
};

/** À appeler en tête de fichier : `test.use({ fiche: ficheDeLAppareil, ficheDeRepli: true })`. */
export const ficheDeLAppareil = async ({}, use: (f: Fiche | undefined) => Promise<void>, testInfo: TestInfo) => {
  await use(FICHE_PAR_APPAREIL[testInfo.project.name.split(' · ')[1]]);
};

export { expect };
export type { Fiche };
