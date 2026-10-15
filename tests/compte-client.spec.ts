import { existsSync, readFileSync } from 'node:fs';
import type { Page, TestInfo } from '@playwright/test';
import { test, expect, etape } from '../src/fixtures';
import { Header } from '../src/pages/header';
import { ProductPage, type ProductData } from '../src/pages/product';
import { CartPage } from '../src/pages/cart';
import { CheckoutPage } from '../src/pages/checkout';
import { produitFixe } from '../src/produits-fixes';
import { decrireErreur, erreurIgnoree, verifierLargeur } from '../src/controles';

/**
 * Espace client de la préprod, connecté au compte de test +qacompte (sections du thème main-account, main-addresses,
 * main-order). La préprod se connecte par un code reçu par email : la QA se connecte une fois avec
 * `npm run connexion:compte`, la session est gardée dans .auth/compte-client.json (hors Git) et sert à ces tests.
 * Lecture seule : aucun formulaire n'est envoyé, et surtout pas « Log out », qui fermerait la session.
 * Seule exception : la commande du compte, lancée à part (COMMANDE_COMPTE=1), une fois.
 */

const SESSION = '.auth/compte-client.json';
const sessionPresente = existsSync(SESSION);
if (sessionPresente) test.use({ storageState: SESSION });

/** Adresse du compte de test, lue hors Git (jamais écrite dans le dépôt). */
const emailCompte = (): string => JSON.parse(readFileSync('.auth/compte-preprod.json', 'utf8')).email;

/** Appels limités par Shopify : ordinateur et téléphone, les 4 appareils sont gardés pour les parcours critiques. */
const APPAREILS = ['desktop-chrome', 'iphone'];

/** Menu de l'espace client, présent sur chaque page. */
const MENU = [/Overview|Aperçu/i, /Orders|Commandes/i, /Profile|Profil/i, /Addresses|Adresses/i,
  /Wishlist|Favoris/i, /back in stock|retour en stock/i, /Assistance/i];

function conditions(qaEnv: { name: string }, testInfo: TestInfo) {
  test.skip(qaEnv.name !== 'preprod', 'Espace client : préprod uniquement (pas de test de connexion en prod pour l\'instant)');
  test.skip(!sessionPresente, `Pas de session client : lancer « npm run connexion:compte » (${SESSION})`);
  test.skip(!APPAREILS.includes(testInfo.project.name.split(' · ')[1]), `Espace client : ${APPAREILS.join(' et ')} seulement`);
}

/** Ouvre une page de l'espace client ; échoue clairement si la session a expiré. */
async function ouvrir(page: Page, chemin: string) {
  let reponse = await page.goto(chemin, { waitUntil: 'domcontentloaded' });
  if (new URL(page.url()).pathname.endsWith('/password')) {
    // La session du compte garde aussi l'accès à la boutique, qui expire avant elle (15 octobre 2026) : on ressaisit
    // le mot de passe de la boutique, comme tests/auth.setup.ts, et la connexion du client est toujours là.
    expect(process.env.PREPROD_PASSWORD, 'PREPROD_PASSWORD est vide : renseignez-le dans le fichier .env').toBeTruthy();
    await page.locator('input[name="password"]').fill(process.env.PREPROD_PASSWORD!);
    await page.locator('input[name="password"]').press('Enter');
    await page.waitForURL(url => !url.pathname.endsWith('/password'));
    reponse = await page.goto(chemin, { waitUntil: 'domcontentloaded' });
  }
  expect(page.url(), 'Session du compte client expirée (renvoi vers la connexion) : relancer « npm run connexion:compte »')
    .not.toMatch(/account\/login|customer_authentication|shopify\.com\/authentication/);
  expect(reponse?.status(), `La page ${chemin} doit répondre (code 200)`).toBe(200);
}

/** Contrôles communs : section principale affichée, menu complet, ni erreur Shopify, ni erreur JS, ni débordement. */
async function verifierPage(page: Page, testInfo: TestInfo, erreursJs: string[]) {
  const section = page.locator('[id^="shopify-section-template--"][id$="__main"]');
  await expect(section, 'La section principale de l\'espace client doit s\'afficher').toBeVisible();
  const menu = page.locator('main a[href*="/account"]');
  for (const entree of MENU) await expect.soft(menu.filter({ hasText: entree }).first(), `Entrée du menu ${entree}`).toBeAttached();
  const texte = await page.locator('main').innerText();
  expect.soft(texte.match(/Liquid error[^\n]*|translation missing[^\n]*/gi) ?? [], 'Texte d\'erreur Shopify visible dans la page').toEqual([]);
  expect.soft(erreursJs, 'Erreur(s) JavaScript sur la page').toEqual([]);
  await verifierLargeur(page, testInfo);
}

function suivreErreursJs(page: Page): string[] {
  const erreurs: string[] = [];
  page.on('pageerror', e => { if (!erreurIgnoree(e)) erreurs.push(decrireErreur(e)); });
  return erreurs;
}

/**
 * Ouvre « Orders » et renvoie les lignes de l'historique des commandes. L'historique n'est pas dans la page : il est
 * chargé ensuite par l'application Polène (`apps/polene-theme-features/order-history`), on attend sa réponse.
 */
async function ouvrirCommandes(page: Page): Promise<string[]> {
  const chargement = page.waitForResponse(r => r.url().includes('/order-history'), { timeout: 30_000 });
  await ouvrir(page, 'account?view=orders');
  const reponse = await chargement;
  expect(reponse.ok(), `L'historique des commandes n'a pas pu être chargé (statut ${reponse.status()})`).toBe(true);
  await page.waitForTimeout(500);
  return page.locator('main table tr:has(td)').evaluateAll(lignes => lignes.map(l => (l.textContent ?? '').replace(/\s+/g, ' ').trim()));
}

const titre = (page: Page, nom: RegExp) => page.locator('main').getByRole('heading', { name: nom }).first();

/** Pages simples de l'espace client : chemin et titre attendu. */
const VUES = [
  { nom: 'Accueil du compte', chemin: 'account', titre: /^Welcome|^Bienvenue/i },
  { nom: 'Profil', chemin: 'account?view=profile', titre: /Your Profile|Votre profil/i },
  { nom: 'Favoris', chemin: 'account?view=wishlist', titre: /Your favorites|Vos favoris/i },
  // Fiche TNR ACCOUNT-18 : le compte de test n'a aucune alerte (l'envoi réel de « Être prévenu(e) » n'est pas testé).
  { nom: 'Alertes de retour en stock', chemin: 'account?view=back-in-stock', titre: /Your Alerts|Vos alertes/i, vide: /You have no back in stock alerts|Vous n.avez (aucune|pas d.)alerte/i },
  { nom: 'Assistance', chemin: 'account?view=assistance', titre: /Need Assistance|Besoin d.aide/i },
] as { nom: string; chemin: string; titre: RegExp; vide?: RegExp }[];

for (const vue of VUES) {
  test(`Espace client · ${vue.nom} @tnr @account`, async ({ page, qaEnv }, testInfo) => {
    conditions(qaEnv, testInfo);
    const erreursJs = suivreErreursJs(page);
    await etape(page, testInfo, `1. Ouvrir ${vue.nom.toLowerCase()} (client connecté)`, async () => {
      await ouvrir(page, vue.chemin);
      await expect(titre(page, vue.titre)).toBeVisible();
      if (vue.vide) {
        await expect(page.locator('main').getByText(vue.vide), 'La page vide doit le dire au client').toBeVisible();
        await expect(page.locator('main').getByRole('link', { name: /new in|nouveautés/i }), 'La page vide doit proposer les nouveautés')
          .toHaveAttribute('href', /collections\/new-in/);
      }
    });
    if (vue.chemin === 'account' || vue.chemin === 'account?view=profile') {
      await etape(page, testInfo, '2. Vérifier que le compte affiché est celui du client de test', async () => {
        await expect(page.locator('main'), 'L\'adresse du compte de test doit être affichée').toContainText(emailCompte(), { ignoreCase: true });
        if (vue.chemin === 'account?view=profile') {
          for (const champ of [/First name|Prénom/i, /Last name|Nom/i]) await expect(page.locator('main').getByRole('textbox', { name: champ }).first()).toBeVisible();
        }
      });
    }
    const numero = vue.chemin === 'account' || vue.chemin === 'account?view=profile' ? 3 : 2;
    await etape(page, testInfo, `${numero}. Vérifier la page : section, menu, ni erreur ni débordement`, async () => {
      await verifierPage(page, testInfo, erreursJs);
    });
  });
}

test('Espace client · Adresses : liste, ajout, modification @tnr @account', async ({ page, qaEnv }, testInfo) => {
  conditions(qaEnv, testInfo);
  const erreursJs = suivreErreursJs(page);
  const main = page.locator('main');
  let lienModifier = '';

  await etape(page, testInfo, '1. Ouvrir la liste des adresses', async () => {
    await ouvrir(page, 'account/addresses');
    await expect(titre(page, /Your addresses|Vos adresses/i)).toBeVisible();
    const modifier = main.locator('a[href*="view=edit"]');
    await expect(modifier.first(), 'Le compte de test doit avoir au moins une adresse, avec un lien « Edit »').toBeVisible();
    lienModifier = (await modifier.first().getAttribute('href'))!;
    // Fiche TNR ACCOUNT-11 : l'adresse par défaut est signalée comme telle.
    await expect(main.getByText(/^(Default|Par défaut|Adresse par défaut)$/i).filter({ visible: true }).first(),'L\'adresse par défaut doit être signalée').toBeVisible();
    await expect(main.locator('a[href*="view=add"]').first(), 'Lien « Add address »').toBeVisible();
    await verifierPage(page, testInfo, erreursJs);
  });

  const champsAdresse = [/First name|Prénom/i, /Last name|Nom/i, /Address 1|Adresse/i, /Postal|Code postal/i, /City|Ville/i];

  await etape(page, testInfo, '2. Ouvrir le formulaire d\'ajout (sans l\'envoyer)', async () => {
    await ouvrir(page, 'account/addresses?view=add');
    await expect(titre(page, /Add address|Ajouter une adresse/i)).toBeVisible();
    for (const champ of champsAdresse) await expect(main.getByRole('textbox', { name: champ }).first(), `Champ ${champ}`).toBeVisible();
    await expect(main.getByRole('button', { name: /^(Save|Enregistrer)$/i })).toBeVisible();
    await verifierPage(page, testInfo, erreursJs);
  });

  await etape(page, testInfo, '3. « Save » sans rien remplir : un message sous chaque champ obligatoire, rien n\'est envoyé', async () => {
    // Fiche TNR ACCOUNT-13. Une adresse enregistrée ne se supprime plus (constat 21) : tout envoi est bloqué par
    // sécurité, et le test vérifie que le formulaire n'a même pas essayé.
    const envois: string[] = [];
    await page.route('**/account/addresses**', route => {
      if (route.request().method() === 'GET') return route.continue();
      envois.push(`${route.request().method()} ${route.request().url()}`);
      return route.abort();
    });
    await main.getByRole('button', { name: /^(Save|Enregistrer)$/i }).click();
    const messages = main.locator('.form-input__error-span').filter({ visible: true });
    for (const [champ, message] of [['prénom', /first name|prénom/i], ['nom', /last name|nom/i], ['adresse', /address 1|adresse/i], ['code postal', /postal|ZIP|code postal/i], ['ville', /city|ville/i]] as [string, RegExp][]) {
      await expect.soft(messages.filter({ hasText: /Please enter your|Veuillez (saisir|entrer)/i }).filter({ hasText: message }).first(), `Message attendu sous le champ ${champ}`).toBeVisible();
    }
    testInfo.annotations.push({ type: 'Messages affichés', description: (await messages.allInnerTexts()).map(m => m.trim()).join(' · ') });
    await page.waitForTimeout(1_000);
    expect(envois, 'Le formulaire vide ne doit rien envoyer').toEqual([]);
    await expect(page, 'On doit rester sur le formulaire d\'ajout').toHaveURL(/view=add/);
    await page.unroute('**/account/addresses**');
  });

  await etape(page, testInfo, '4. Ouvrir le formulaire de modification : l\'adresse est pré-remplie (sans l\'envoyer)', async () => {
    await ouvrir(page, lienModifier.replace(/^\/(fr-fr\/)?/, ''));
    await expect(titre(page, /Update address|Modifier l.adresse/i)).toBeVisible();
    for (const champ of champsAdresse) {
      await expect(main.getByRole('textbox', { name: champ }).first(), `Champ ${champ} pré-rempli`).not.toHaveValue('');
    }
    await expect(main.getByRole('button', { name: /Update address|Mettre à jour/i })).toBeVisible();
    await verifierPage(page, testInfo, erreursJs);
  });
});

test('Espace client · Commandes et détail d\'une commande @tnr @account', async ({ page, qaEnv }, testInfo) => {
  conditions(qaEnv, testInfo);
  const erreursJs = suivreErreursJs(page);
  const main = page.locator('main');
  let lienCommande = '';

  await etape(page, testInfo, '1. Ouvrir la liste des commandes : dernière commande et historique', async () => {
    const historique = await ouvrirCommandes(page);
    const derniere = main.locator('a[href*="/account/orders/"]');
    await expect(derniere.first(), 'Le compte de test doit avoir au moins une commande (sinon : COMMANDE_COMPTE=1, voir le test « Commande d\'un client connecté »)').toBeAttached();
    lienCommande = (await derniere.first().getAttribute('href'))!;
    expect(historique.length, 'L\'historique des commandes (chargé par l\'application Polène) doit lister au moins une commande').toBeGreaterThan(0);
    testInfo.annotations.push({ type: 'Commandes du compte', description: `${historique.length} : ${historique.slice(0, 5).join(' ; ')}` });
    // Fiches TNR ACCOUNT-05 et 06 : colonnes de l'historique, et chaque ligne remplie (numéro, date, montant, détail).
    const colonnes = (await main.locator('table th').allInnerTexts()).map(c => c.trim()).filter(Boolean);
    testInfo.annotations.push({ type: 'Colonnes de l\'historique', description: colonnes.join(' · ') });
    const attendues: [string, RegExp][] = [['numéro', /Order number|N° de commande|Numéro/i], ['date', /^Date$/i], ['statut', /status|statut/i], ['total', /^Total$/i]];
    const absentes = attendues.filter(([, nom]) => !colonnes.some(c => nom.test(c))).map(([c]) => c);
    expect(absentes, `L'historique doit avoir les colonnes numéro, date, statut et total. Manquantes : ${absentes.join(', ')}`).toEqual([]);
    for (const ligne of historique) {
      expect.soft(ligne, `Ligne de l'historique incomplète : « ${ligne} »`).toMatch(/^\S+\s.*\d{4}.*(?:[€$£]\s?\d|\d\s?[€$£])/);
    }
    // « See details » en dernière colonne sur ordinateur ; la mise en page diffère sur téléphone : on compte les liens.
    expect(await main.locator('table tr:has(td) a[href*="/account/orders/"]').count(), 'Chaque commande de l\'historique doit mener à son détail')
      .toBeGreaterThanOrEqual(historique.length);
    await verifierPage(page, testInfo, erreursJs);
  });

  await etape(page, testInfo, '2. Ouvrir le détail de la dernière commande', async () => {
    await ouvrir(page, lienCommande.replace(/^\/(fr-fr\/)?/, ''));
    await expect(main, 'Le détail doit montrer le numéro de la commande').toContainText(/#\s?\w+|Order|Commande/i);
    await expect(main.locator('a[href*="/products/"], img').first(), 'Le détail doit montrer au moins un produit').toBeAttached();
    await expect(main.getByText(/[€$£]\s*\d|\d\s*[€$£]/).filter({ visible: true }).first(), 'Le détail doit montrer un montant').toBeVisible();
    await verifierPage(page, testInfo, erreursJs);
  });
});

/** Entrées du menu de l'espace client : nom, adresse et titre de la page ouverte. « Log out » n'est jamais cliqué. */
const ENTREES_MENU = [
  { nom: /^(Orders|Commandes)$/i, chemin: /account\?view=orders/, titre: /Order history|Historique des commandes/i },
  { nom: /^(Profile|Profil)$/i, chemin: /account\?view=profile/, titre: /Your Profile|Votre profil/i },
  { nom: /^(Addresses|Adresses)$/i, chemin: /account\/addresses/, titre: /Your addresses|Vos adresses/i },
  { nom: /^(Wishlist|Favoris)$/i, chemin: /account\?view=wishlist/, titre: /Your favorites|Vos favoris/i },
  { nom: /back in stock|retour en stock/i, chemin: /account\?view=back-in-stock/, titre: /Your Alerts|Vos alertes/i },
  { nom: /^Assistance$/i, chemin: /account\?view=assistance/, titre: /Need Assistance|Besoin d.aide/i },
  { nom: /^(Overview|Aperçu)$/i, chemin: /account$/, titre: /^Welcome|^Bienvenue/i },
];

test('Espace client · menu : chaque entrée ouvre sa page et devient l\'entrée active @tnr @account', async ({ page, qaEnv }, testInfo) => {
  conditions(qaEnv, testInfo);
  const entreeMenu = (nom: RegExp) => page.locator('main nav').getByRole('menuitem', { name: nom }).first();

  await etape(page, testInfo, '1. Ouvrir l\'accueil du compte : « Overview » est l\'entrée active, « Log out » est proposé', async () => {
    await ouvrir(page, 'account');
    await expect(entreeMenu(/^(Overview|Aperçu)$/i), '« Overview » doit être l\'entrée active').toHaveAttribute('aria-current', 'page');
    // Fiche TNR ACCOUNT-01 : la déconnexion est dans le menu (lue, jamais cliquée : elle fermerait la session de test).
    await expect(page.locator('main a.customer-navigation__link[href*="logout"]').first(), 'Le menu doit proposer « Log out »').toBeAttached();
  });

  for (const [i, entree] of ENTREES_MENU.entries()) {
    await etape(page, testInfo, `${i + 2}. Cliquer « ${entree.nom.source.replace(/[\^$()\\]/g, '').split('|')[0]} » : sa page s'ouvre, l'entrée devient active`, async () => {
      await entreeMenu(entree.nom).click();
      await expect(page, `L'entrée doit ouvrir ${entree.chemin.source}`).toHaveURL(entree.chemin);
      await expect(titre(page, entree.titre), 'La page doit afficher son titre').toBeVisible();
      await expect(entreeMenu(entree.nom), 'L\'entrée cliquée doit être l\'entrée active').toHaveAttribute('aria-current', 'page');
      expect(await page.locator('main nav [aria-current="page"]').count(), 'Une seule entrée active à la fois').toBe(1);
    });
  }
});

test('Espace client · accueil et profil : nom, dernière commande, assistance, profil en lecture seule @tnr @account', async ({ page, qaEnv }, testInfo) => {
  conditions(qaEnv, testInfo);
  const main = page.locator('main');
  let prenom = '';

  await etape(page, testInfo, '1. Profil : civilité, prénom, nom, téléphone, date de naissance et newsletter, sans enregistrer', async () => {
    await ouvrir(page, 'account?view=profile');
    await expect(titre(page, /Your Profile|Votre profil/i)).toBeVisible();
    const civilite = main.getByRole('combobox').first();
    await expect(civilite, 'La civilité du compte de test doit être choisie').not.toHaveValue('');
    prenom = await main.getByRole('textbox', { name: /First name|Prénom/i }).first().inputValue();
    expect(prenom, 'Le prénom du compte doit être rempli').not.toBe('');
    await expect(main.getByRole('textbox', { name: /Last name|Nom/i }).first(), 'Le nom du compte doit être rempli').not.toHaveValue('');
    await expect(main.getByRole('textbox', { name: /Phone|Téléphone/i }).first(), 'Champ téléphone').toBeVisible();
    const naissance = main.getByRole('textbox', { name: /Birth|naissance/i }).first();
    await expect(naissance, 'Champ date de naissance').toBeVisible();
    testInfo.annotations.push({ type: 'Date de naissance', description: `format attendu : « ${await naissance.getAttribute('placeholder')} »` });
    const newsletter = main.getByRole('checkbox', { name: /newsletter/i }).first();
    await expect(newsletter, 'Case d\'inscription à la newsletter').toBeAttached();
    testInfo.annotations.push({ type: 'Newsletter du compte', description: (await newsletter.isChecked()) ? 'inscrit' : 'non inscrit' });
    await expect(main.getByRole('button', { name: /Save your information|Enregistrer/i }), 'Bouton d\'enregistrement (pas cliqué)').toBeVisible();
    // ACCOUNT-10 (suppression du compte) : voir le test « suppression du compte », qui s'arrête à la confirmation.
    await expect(main.getByRole('button', { name: /Delete account|Supprimer (mon|le) compte/i }), 'Bouton de suppression du compte').toBeVisible();
  });

  await etape(page, testInfo, '2. Accueil : « Welcome » avec le prénom, lien vers le profil', async () => {
    await ouvrir(page, 'account');
    await expect(titre(page, /^Welcome|^Bienvenue/i), `L'accueil doit saluer le client par son prénom (« ${prenom} »)`).toHaveText(new RegExp(`^(Welcome|Bienvenue) ${prenom}$`, 'i'));
    await expect(main.getByRole('link', { name: /Edit profile|Modifier (le|mon) profil/i }), 'Lien vers le profil').toHaveAttribute('href', /account\?view=profile/);
  });

  await etape(page, testInfo, '3. Accueil : dernière commande avec son numéro, son produit et le lien vers son détail', async () => {
    const derniere = titre(page, /latest order|dernière commande/i);
    await expect(derniere, 'La dernière commande doit être affichée').toHaveText(/#\s?[A-Z0-9]+/);
    const numero = ((await derniere.textContent()) ?? '').match(/#\s?([A-Z0-9]+)/)![1];
    testInfo.annotations.push({ type: 'Dernière commande', description: numero });
    const detail = main.getByRole('link', { name: /see order details|voir le détail/i });
    await expect(detail, 'Le lien du détail doit porter le numéro de la commande').toHaveAccessibleName(new RegExp(numero));
    await detail.click();
    await expect(page, 'Le lien doit ouvrir le détail de la commande').toHaveURL(/\/account\/orders\/[0-9a-f]+/);
    await expect(main, `Le détail doit être celui de la commande ${numero}`).toContainText(numero);
  });

  await etape(page, testInfo, '4. Accueil : bloc « Need Assistance? » avec l\'email et le chat', async () => {
    await ouvrir(page, 'account');
    await expect(titre(page, /Need Assistance|Besoin d.aide/i)).toBeVisible();
    await expect(main.getByRole('link', { name: /by email|par e-?mail/i }).first(), 'Contact par email').toHaveAttribute('href', /^mailto:\S+@polene-paris\.com$/);
    await expect(main.getByRole('button', { name: /Chat with us|Discuter/i }).first(), 'Bouton du chat').toBeVisible();
  });
});

/**
 * ACCOUNT-10, suppression du compte : jouée jusqu'à la fenêtre de confirmation, puis « Cancel ». Jamais « Yes, delete
 * account » : le compte de test serait perdu (décision QA du 15 octobre 2026, un compte supprimé à chaque passage ne
 * tiendrait pas). Garde-fous : le bouton n'est cliqué que si la fenêtre de confirmation existe dans la page, et toute
 * requête d'envoi pendant le test est bloquée.
 */
test('Espace client · suppression du compte : confirmation demandée, « Cancel » ne supprime rien @tnr @account', async ({ page, qaEnv }, testInfo) => {
  conditions(qaEnv, testInfo);
  const main = page.locator('main');
  const envois: string[] = [];
  // Pendant le clic et la fenêtre : toute requête autre qu'une lecture (GET) est bloquée et notée.
  const bloquerEnvois = (route: import('@playwright/test').Route) => route.request().method() !== 'GET'
    ? (envois.push(route.request().url()), route.abort())
    : route.fallback();
  const fenetre = page.locator('component-modal[data-ref="account-delete-modal"]');

  await etape(page, testInfo, '1. Profil : bouton « Delete account », fenêtre de confirmation prête dans la page', async () => {
    await ouvrir(page, 'account?view=profile');
    await expect(main.getByRole('button', { name: /Delete account|Supprimer (mon|le) compte/i })).toBeVisible();
    // Garde-fou : sans fenêtre de confirmation, on ne clique pas (le clic supprimerait peut-être le compte tout de suite).
    await expect(fenetre, 'La fenêtre de confirmation doit exister avant qu\'on touche au bouton').toBeAttached();
    // Fenêtre encore fermée : ses boutons sont masqués, cherchés par leur texte.
    await expect(fenetre.locator('button', { hasText: /^\s*(Cancel|Annuler)\s*$/i }), 'La fenêtre doit proposer « Cancel »').toBeAttached();
  });

  await etape(page, testInfo, '2. Cliquer « Delete account » : la fenêtre demande confirmation', async () => {
    await page.route('**/*', bloquerEnvois);
    await main.getByRole('button', { name: /Delete account|Supprimer (mon|le) compte/i }).click();
    const dialogue = page.locator('component-modal.active[data-ref="account-delete-modal"]');
    await expect(dialogue, 'La fenêtre de confirmation doit s\'ouvrir').toBeVisible();
    await expect(dialogue, 'Elle doit demander confirmation').toContainText(/Are you certain|Êtes-vous sûr/i);
    await expect(dialogue.getByRole('button', { name: /Confirm deletion|Yes, delete account|Oui, supprimer/i }), 'Bouton de confirmation (pas cliqué)').toBeVisible();
  });

  await etape(page, testInfo, '3. « Cancel » : la fenêtre se ferme, le compte est toujours là', async () => {
    await page.locator('component-modal.active[data-ref="account-delete-modal"]').getByRole('button', { name: /^(Cancel( deletion)?|Annuler)$/i }).click();
    await expect(page.locator('component-modal.active[data-ref="account-delete-modal"]'), 'La fenêtre doit se fermer').toHaveCount(0);
    await page.unroute('**/*', bloquerEnvois);
    // Seuls comptent les envois vers la boutique, hors mesures d'audience de Shopify (monorail…) ; les outils tiers
    // (Forter, mesures) envoient aussi en POST.
    const boutique = new URL(page.url()).hostname;
    expect(envois.filter(u => new URL(u).hostname === boutique && !/monorail|\/api\/collect|web-pixels|\/fec\//.test(u)), 'Aucune demande ne doit partir vers la boutique').toEqual([]);
    await ouvrir(page, 'account?view=profile');
    await expect(main, 'Le compte de test doit toujours exister').toContainText(emailCompte(), { ignoreCase: true });
  });
});

test('Espace client · assistance : formulaire, email, FAQ, chat et réseaux sociaux @tnr @account', async ({ page, qaEnv }, testInfo) => {
  conditions(qaEnv, testInfo);
  const main = page.locator('main');

  await etape(page, testInfo, '1. Ouvrir l\'assistance : formulaire de contact et email', async () => {
    await ouvrir(page, 'account?view=assistance');
    await expect(titre(page, /Need Assistance|Besoin d.aide/i)).toBeVisible();
    await expect(main.getByRole('link', { name: /Contact us form|formulaire/i }), 'Formulaire de contact du support').toHaveAttribute('href', /^https:\/\/support\.polene-paris\.com\/hc\/fr\/requests\/new$/);
    await expect(main.getByRole('link', { name: /by email|par e-?mail/i }), 'Contact par email').toHaveAttribute('href', /^mailto:\S+@polene-paris\.com$/);
  });

  await etape(page, testInfo, '2. FAQ : 3 liens vers l\'aide en français, « See more » vers l\'accueil de l\'aide', async () => {
    const faq = main.getByRole('list').filter({ has: page.locator('a[href*="support.polene-paris.com"]') }).getByRole('link');
    expect(await faq.count(), 'La FAQ doit proposer 3 liens').toBe(3);
    for (const lien of await faq.all()) {
      // Fiche TNR (bug n° 2) : les liens de la FAQ doivent mener à l'aide en français, comme « See more ».
      expect.soft(await lien.getAttribute('href'), `« ${await lien.textContent()} » doit mener à l'aide en français (/hc/fr/), constat 47`).toMatch(/^https:\/\/support\.polene-paris\.com\/hc\/fr\//);
    }
    await expect(main.getByRole('link', { name: /^(See more|Voir plus)$/i }), '« See more » doit mener à l\'aide en français').toHaveAttribute('href', /^https:\/\/support\.polene-paris\.com\/hc\/fr\/?$/);
  });

  await etape(page, testInfo, '3. Chat en direct et réseaux sociaux', async () => {
    await expect(titre(page, /Live Chat|Chat en direct/i)).toBeVisible();
    await expect(main.getByRole('button', { name: /Chat with us|Discuter/i }).filter({ visible: true }).first(), 'Bouton du chat').toBeVisible();
    await expect(main.getByRole('link', { name: 'Instagram' }), 'Lien Instagram').toHaveAttribute('href', /^https:\/\/www\.instagram\.com\/polene_paris\/?$/);
    await expect(main.getByRole('link', { name: 'Facebook' }), 'Lien Facebook').toHaveAttribute('href', /^https:\/\/www\.facebook\.com\/poleneparis\/?$/);
  });
});

/**
 * Commande d'un client connecté : crée une vraie commande de test (préprod), à lancer à part, une fois, avec
 * l'accord de la QA : `COMMANDE_COMPTE=1 npx playwright test compte-client --project "preprod · desktop-chrome" --grep "Commande d"`.
 * Elle donne au compte une commande pour les tests de l'espace client, et vérifie au passage le checkout connecté
 * (adresse email et adresse de livraison reprises du compte).
 */
test('Espace client · Commande d\'un client connecté @journey @account', async ({ page, qaEnv, isMobile }, testInfo) => {
  test.skip(!process.env.COMMANDE_COMPTE, 'Crée une commande : seulement avec COMMANDE_COMPTE=1 (accord QA)');
  test.skip(qaEnv.name !== 'preprod' || !qaEnv.completePurchase, 'Préprod uniquement');
  test.skip(!sessionPresente, `Pas de session client : lancer « npm run connexion:compte » (${SESSION})`);
  test.skip(testInfo.project.name.split(' · ')[1] !== 'desktop-chrome', 'Une seule commande : Chrome ordinateur');
  const header = new Header(page, isMobile);
  const product = new ProductPage(page);
  const cart = new CartPage(page);
  const checkout = new CheckoutPage(page);
  const produit = produitFixe(qaEnv.produitAchat ?? 'QA01');
  let productData: ProductData;
  let commandesAvant = 0;

  await etape(page, testInfo, '1. Ouvrir l\'espace client et compter les commandes', async () => {
    commandesAvant = (await ouvrirCommandes(page)).length;
    // Le panier d'un client connecté est gardé d'une session à l'autre : on le vide.
    await page.request.post('cart/clear.js');
  });

  await etape(page, testInfo, `2. Ajouter le produit ${produit.id} au panier`, async () => {
    await page.goto(`products/${produit.handle}`, { waitUntil: 'domcontentloaded' });
    productData = await product.fetchProductData(produit.handle);
    testInfo.annotations.push({ type: 'Produit testé', description: `${productData.title} (${produit.handle})` });
    await product.expectPurchasable();
    await product.addToCart();
    await expect.poll(() => header.cartCount(), { message: 'Le compteur du panier doit passer à 1' }).toBe(1);
  });

  await etape(page, testInfo, '3. Passer au checkout : email et adresse repris du compte', async () => {
    await page.goto('cart', { waitUntil: 'domcontentloaded' });
    await cart.expectLoaded();
    await cart.goToCheckout();
    await expect(page).toHaveTitle(/Paiement|Checkout/i);
    await checkout.expectProductInSummary(productData.title);
    const main = page.locator('main');
    await expect(main, 'L\'adresse email du compte doit être reprise').toContainText(emailCompte(), { ignoreCase: true, timeout: 20_000 });
    await expect(page.getByRole('textbox', { name: /Adresse e-mail|Email/i }), 'Pas de champ email à remplir pour un client connecté').toHaveCount(0);
    // Client connecté : Shopify montre un résumé (« Expédier à », « Expédition ») au lieu des champs d'adresse.
    const resume = page.getByRole('region', { name: /Contact/i });
    await expect(resume.getByRole('heading', { name: /Expédier à|Ship to/i }), 'L\'adresse de livraison du compte doit être reprise').toBeVisible();
    await expect(resume.getByRole('heading', { name: /^(Expédition|Shipping)$/i })).toBeVisible();
    await expect(resume.getByText(/\d.*[€$£]|[€$£].*\d|Gratuit|Free/i).first(), 'Un mode d\'expédition avec son prix doit être choisi').toBeVisible();
  });

  await etape(page, testInfo, '4. Payer avec la carte de test', async () => {
    await checkout.payWithCard({
      number: process.env.PREPROD_CARD_NUMBER ?? '4242424242424242',
      expiry: process.env.PREPROD_CARD_EXPIRY ?? '12/30',
      cvv: process.env.PREPROD_CARD_CVV ?? '123',
      name: process.env.PREPROD_CARD_NAME ?? 'QA Polene',
    });
    const confirmation = await checkout.expectOrderConfirmed();
    testInfo.annotations.push({ type: 'Commande de test', description: `Confirmation n° ${confirmation}` });
  });

  await etape(page, testInfo, '5. Retrouver la commande dans l\'espace client', async () => {
    await expect.poll(async () => (await ouvrirCommandes(page)).length,
      { message: 'La nouvelle commande doit apparaître dans l\'historique de « Orders »', timeout: 90_000, intervals: [5_000] }).toBe(commandesAvant + 1);
  });
});
