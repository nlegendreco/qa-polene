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
  expect: { timeout: 15_000 },
  fullyParallel: true,
  workers: 4,
  retries: 0,
  // La démo d'échec (POC 1.6) ne tourne que si on la demande explicitement.
  grepInvert: process.env.DEMO_ECHEC ? undefined : /@demo-echec/,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
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
