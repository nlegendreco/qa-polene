// Connexion au compte client de test de la préprod, faite à la main par la QA, enregistrée pour les tests.
//
// La préprod utilise la connexion Shopify sans mot de passe : un code arrive par email. Ce script ouvre un navigateur
// sur la page de connexion ; la QA saisit l'adresse du compte de test (+qacompte), puis le code reçu. Dès que l'espace
// client s'affiche, la session est enregistrée dans .auth/compte-client.json (hors Git) et le navigateur se ferme.
// À relancer quand la session a expiré (les tests de l'espace client le signalent).
//
//   npm run connexion:compte
import 'dotenv/config';
import { existsSync, readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const BOUTIQUE = 'https://asia-polene.myshopify.com';
const SORTIE = '.auth/compte-client.json';
const DELAI_MINUTES = 10;

const navigateur = await chromium.launch({ headless: false });
const contexte = await navigateur.newContext({
  viewport: { width: 1280, height: 860 },
  locale: 'fr-FR',
  // Session de la boutique préprod (mot de passe déjà saisi par les tests), si elle existe.
  storageState: existsSync('.auth/preprod.json') ? '.auth/preprod.json' : undefined,
});
const page = await contexte.newPage();

await page.goto(`${BOUTIQUE}/fr-fr/`);
if (page.url().includes('/password')) {
  // Boutique encore fermée par son mot de passe : même saisie que tests/auth.setup.ts.
  if (!process.env.PREPROD_PASSWORD) throw new Error('PREPROD_PASSWORD est vide : renseignez-le dans le fichier .env');
  await page.locator('input[name="password"]').fill(process.env.PREPROD_PASSWORD);
  await page.locator('input[name="password"]').press('Enter');
  await page.waitForURL(url => !url.pathname.includes('/password'));
}

// Même lien que l'icône « Account » de l'en-tête.
await page.goto(`${BOUTIQUE}/customer_authentication/login?return_to=%2Ffr-fr%2Faccount`);

// Adresse du compte de test pré-remplie si on la connaît (.auth/compte-preprod.json, hors Git) : Shopify envoie le code.
let email = null;
try { email = JSON.parse(readFileSync('.auth/compte-preprod.json', 'utf8')).email; } catch { /* la QA la saisira */ }
const champ = page.getByRole('textbox', { name: /e-?mail/i });
if (email && await champ.isVisible({ timeout: 15_000 }).catch(() => false)) {
  await champ.fill(email);
  await champ.press('Enter');
  console.log(`\nNavigateur ouvert, adresse du compte de test saisie : saisis le code reçu par email.`);
} else {
  console.log(`\nNavigateur ouvert : saisis l'adresse du compte de test (+qacompte), puis le code reçu par email.`);
}
console.log(`J'attends l'arrivée sur l'espace client (${DELAI_MINUTES} min au plus)…\n`);

// Espace client : pages Shopify (shopify.com/<boutique>/account…) ou pages du thème (/account, hors connexion).
const estEspaceClient = url => (url.hostname === 'shopify.com' && /^\/\d+\/account/.test(url.pathname))
  || (url.hostname === 'asia-polene.myshopify.com' && /^\/(fr-fr\/)?account(\/(?!login|register)|$)/.test(url.pathname));
await page.waitForURL(estEspaceClient, { timeout: DELAI_MINUTES * 60_000 });
await page.waitForLoadState('load');

await contexte.storageState({ path: SORTIE });
console.log(`✅ Session enregistrée dans ${SORTIE}`);
console.log(`   Espace client ouvert sur : ${page.url().split('?')[0]}`);
await navigateur.close();
