import { test as base, expect, type Page, type TestInfo } from '@playwright/test';
import { getEnvironment, type QaEnvironment } from './environments';

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
};

export const test = base.extend<Fixtures>({
  qaEnv: async ({}, use, testInfo) => {
    const envName = (testInfo.project.metadata as { env?: string }).env;
    if (!envName) throw new Error(`Le projet "${testInfo.project.name}" n'a pas d'environnement (metadata.env).`);
    await use(getEnvironment(envName));
  },

  context: async ({ context, qaEnv }, use) => {
    // Bandeau cookies (Consentmo) : on pose directement le choix pour qu'il n'apparaisse jamais.
    await context.addCookies([
      { name: 'cookieconsent_status', value: 'allow', domain: qaEnv.cookieDomain, path: '/' },
    ]);
    await context.route(isBlocked, route => route.abort('blockedbyclient'));
    await use(context);
  },

  page: async ({ page }, use, testInfo) => {
    // Filet de sécurité si le bandeau cookies s'affiche malgré tout.
    await page.addLocatorHandler(
      page.locator('button[data-csm-button-type="accept"]'),
      button => button.click(),
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

export { expect };
