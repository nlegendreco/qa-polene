import { defineConfig, devices, type Project } from '@playwright/test';
import 'dotenv/config';
import { environments, getEnvironment } from './src/environments';

/** Les 4 appareils du POC. */
const DEVICES = {
  'desktop-chrome': { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
  'desktop-safari': { ...devices['Desktop Safari'], viewport: { width: 1440, height: 900 } },
  'iphone': { ...devices['iPhone 15'] },
  'android': { ...devices['Pixel 7'] },
};

const requestedEnvs = (process.env.QA_ENVS ?? 'prod,preprod').split(',').map(e => e.trim()).filter(Boolean);
const envs = requestedEnvs.filter(name => {
  const env = getEnvironment(name);
  if (env.passwordProtected && !process.env.PREPROD_PASSWORD) {
    // La config est relue par chaque worker : on n'affiche l'avertissement qu'une fois.
    if (!process.env.TEST_WORKER_INDEX) console.warn(`⚠️  ${env.label} ignorée : PREPROD_PASSWORD absent du fichier .env`);
    return false;
  }
  return true;
});

const excludedTags = [
  !process.env.DEMO_ECHEC && '@demo-echec',
  !process.env.VISUEL && '@visuel',
  !process.env.REGRESSIONS && '@regressions',
].filter(Boolean);

const projects: Project[] = [];
for (const name of envs) {
  const env = getEnvironment(name);
  if (env.passwordProtected) {
    projects.push({ name: `${env.name} · connexion`, testMatch: /auth\.setup\.ts/ });
  }
  for (const [deviceName, device] of Object.entries(DEVICES)) {
    projects.push({
      name: `${env.name} · ${deviceName}`,
      testMatch: /.*\.spec\.ts/,
      metadata: { env: env.name },
      dependencies: env.passwordProtected ? [`${env.name} · connexion`] : [],
      use: {
        ...device,
        baseURL: env.baseURL,
        locale: 'fr-FR',
        timezoneId: 'Europe/Paris',
        storageState: env.passwordProtected ? '.auth/preprod.json' : undefined,
      },
    });
  }
}

export default defineConfig({
  testDir: './tests',
  outputDir: './test-results',
  timeout: 120_000,
  expect: {
    timeout: 15_000,
    // Tests visuels (POC 2) : 1 pixel de capture par pixel CSS (fichiers plus légers), animations coupées,
    // curseur de saisie masqué, widgets tiers masqués par src/visuel.css.
    // Seuil de couleur 0,2 par pixel (valeur par défaut de Playwright). Il était à 0,3 pour absorber le bruit de Safari
    // sur les vignettes des collections, qui ne sont plus comparées en pixels. À 0,3, le header blanc décalé de 10 px
    // sur le ciel clair de l'accueil iPhone passait inaperçu (42 pixels, pris pour du lissage) ; à 0,2 : 443 pixels.
    // Aucune tolérance en nombre de pixels : un prix masqué ne change que quelques dizaines de pixels.
    toHaveScreenshot: { scale: 'css', animations: 'disabled', caret: 'hide', stylePath: './src/visuel.css', threshold: 0.2 },
  },
  // Références visuelles : references/<page>/<projet>.png, versionnées avec les tests.
  snapshotPathTemplate: '{testDir}/../references/{arg}/{projectName}{ext}',
  fullyParallel: true,
  workers: 4,
  retries: 0,
  // Les démos (échec POC 1.6, régressions injectées POC 2.5) et les tests visuels ne tournent que si on les demande.
  grepInvert: excludedTags.length ? new RegExp(excludedTags.join('|')) : undefined,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    // Rapport Polène : tableau de bord et détail des tests, en français (npm run rapport:polene).
    ['./src/rapport/reporter.ts'],
  ],
  use: {
    actionTimeout: 15_000,
    navigationTimeout: 45_000,
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects,
  metadata: { 'Environnements': envs.map(e => environments[e as keyof typeof environments].label).join(', ') },
});
