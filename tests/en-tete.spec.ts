import { test, expect, etape } from '../src/fixtures';
import { Header } from '../src/pages/header';
import { produitFixe } from '../src/produits-fixes';
import { appelShopify } from '../src/shopify';
import { verifierLargeur } from '../src/controles';

/**
 * En-tête, pied de page et accueil (roadmap phase 2.3, grille « Mandatory » des fiches TNR) : logo, menu déroulant
 * (ordinateur) et menu mobile, liens de l'en-tête et du pied de page, newsletter du pied de page (saisies invalides
 * seulement : rien n'est envoyé), vidéos et défilement de l'accueil. En prod et en préprod.
 */

const PRODUIT = produitFixe('P08').handle;

test('En-tête · logo vers l\'accueil, menu des catégories @tnr @home', async ({ page, qaEnv, isMobile }, testInfo) => {
  const header = new Header(page, isMobile);
  const accueil = new URL(qaEnv.baseURL).pathname.replace(/\/$/, '');

  await etape(page, testInfo, `1. Depuis la fiche ${PRODUIT}, le logo ramène à l'accueil`, async () => {
    await page.goto(`products/${PRODUIT}`, { waitUntil: 'domcontentloaded' });
    await header.logo.filter({ visible: true }).first().click();
    await expect.poll(() => new URL(page.url()).pathname.replace(/\/$/, ''), { message: 'Le logo doit mener à l\'accueil' }).toBe(accueil);
  });

  if (isMobile) {
    await etape(page, testInfo, '2. Mobile : menu, « Sacs », puis « Voir tout » ouvre la collection', async () => {
      await header.openCategory(/^(Bags|Sacs)$/i);
      await expect(page, 'La collection des sacs doit s\'ouvrir').toHaveURL(/\/collections\/[a-z-]+/);
      await expect(page.getByRole('main').getByRole('heading', { level: 1 }).first(), 'La collection doit afficher son titre').toBeVisible();
    });
    return;
  }

  const nav = header.banner.getByRole('navigation', { name: /Menu principal|Main menu/i });
  const panneau = page.locator('.header__menu-panel__wrapper').filter({ visible: true });

  await etape(page, testInfo, '2. Ordinateur : survoler « Sacs » ouvre son panneau de liens', async () => {    await nav.getByRole('link', { name: /^(Bags|Sacs)$/i }).first().hover();
    await expect(panneau.first(), 'Le panneau du menu « Sacs » doit s\'ouvrir au survol').toBeVisible();
    const liens = await panneau.first().getByRole('link').filter({ visible: true }).count();
    testInfo.annotations.push({ type: 'Panneau « Sacs »', description: `${liens} liens` });
    expect(liens, 'Le panneau doit proposer des sous-catégories').toBeGreaterThanOrEqual(10);
  });

  await etape(page, testInfo, '3. Sortir de l\'en-tête : le panneau se referme', async () => {
    await page.mouse.move(10, page.viewportSize()!.height - 10);
    await expect(panneau, 'Le panneau doit se refermer quand la souris quitte le menu').toHaveCount(0);
  });

  await etape(page, testInfo, '4. Cliquer « Sacs » : la collection s\'ouvre', async () => {
    await header.openCategory(/^(Bags|Sacs)$/i);
    await expect(page, 'La collection des sacs doit s\'ouvrir').toHaveURL(/\/collections\/[a-z-]+/);
    await expect(page.getByRole('main').getByRole('heading', { level: 1 }).first()).toBeVisible();
  });
});

test('En-tête et pied de page · chaque lien du site répond @tnr @home', async ({ page, qaEnv }, testInfo) => {
  // Une centaine d'adresses : un seul appareil, pour ménager la limite d'appels de Shopify (les liens sont les mêmes partout).
  test.skip(testInfo.project.name.split(' · ')[1] !== 'desktop-chrome', 'Liens : Chrome ordinateur seulement (mêmes liens sur tous les appareils)');
  test.slow();
  const site = new URL(qaEnv.baseURL);
  let liens: string[] = [];

  await etape(page, testInfo, '1. Relever les liens de l\'en-tête (menus compris) et du pied de page', async () => {
    await page.goto('', { waitUntil: 'domcontentloaded' });
    liens = await page.locator('header a[href], footer a[href]').evaluateAll(as => as.map(a => (a as HTMLAnchorElement).href));
    liens = [...new Set(liens.map(l => l.split('#')[0]))].filter(l => {
      const u = new URL(l);
      // Liens du site seulement (les sites externes, Instagram, aide Zendesk…, bloquent souvent les robots), sans
      // déconnexion ni connexion par code (customer_authentication refuse un appel qui ne vient pas d'un navigateur : 406).
      return u.hostname === site.hostname && !/logout|customer_authentication/.test(u.pathname);
    });
    testInfo.annotations.push({ type: 'Liens vérifiés', description: String(liens.length) });
    expect(liens.length, 'L\'en-tête et le pied de page doivent contenir des liens').toBeGreaterThan(30);
  });

  await etape(page, testInfo, '2. Chaque lien répond sans erreur (pas de page 404 ni d\'erreur serveur)', async () => {
    const casses: string[] = [];
    for (const lien of liens) {
      const lire = () => page.request.get(lien, { maxRedirects: 5 });
      let reponse = await lire();
      // Limite d'appels Shopify : on attend et on réessaie (échec clair si elle dure).
      if (reponse.status() === 429) reponse = await appelShopify(page, `Le lien ${lien}`, lire);
      if (reponse.status() >= 400) casses.push(`${reponse.status()} ${lien.replace(site.origin, '')}`);
    }
    expect(casses, 'Liens en erreur dans l\'en-tête ou le pied de page').toEqual([]);
  });
});

test('Pied de page · la newsletter refuse un email vide ou incomplet, sans rien envoyer @tnr @home', async ({ page }, testInfo) => {
  const pied = page.getByRole('contentinfo');
  const champ = pied.getByRole('textbox', { name: /newsletter/i }).first();
  const envois: string[] = [];
  page.on('request', r => { if (r.method() === 'POST' && /klaviyo|subscribe|\/contact|newsletter/i.test(r.url())) envois.push(r.url()); });

  await etape(page, testInfo, '1. Ouvrir l\'accueil : champ « Votre email » et bouton de confirmation dans le pied de page', async () => {
    await page.goto('', { waitUntil: 'domcontentloaded' });
    await champ.scrollIntoViewIfNeeded();
    await expect(champ, 'Le champ de la newsletter doit s\'afficher').toBeVisible();
  });

  for (const [i, saisie] of ['', 'test@'].entries()) {
    await etape(page, testInfo, `${i + 2}. Envoyer ${saisie ? `« ${saisie} »` : 'le champ vide'} : message d'erreur, rien n'est envoyé`, async () => {
      await champ.fill(saisie);
      await pied.getByRole('button', { name: /^(Confirm|Confirmer|Valider|S.inscrire)$/i }).first().click();
      await expect(champ, 'Le champ doit être signalé en erreur').toHaveAttribute('aria-invalid', 'true');
      await expect(pied.getByText(/email valide|valid e-?mail/i).filter({ visible: true }).first(), 'Un message doit demander un email valide').toBeVisible();
      expect(envois, 'Aucune inscription ne doit partir').toEqual([]);
    });
  }
});

test('Accueil · vidéos en lecture, page qui défile jusqu\'au pied de page @tnr @home', async ({ page }, testInfo) => {
  await etape(page, testInfo, '1. Ouvrir l\'accueil : les vidéos visibles se lisent seules, avec un bouton pause', async () => {
    await page.goto('', { waitUntil: 'domcontentloaded' });
    const video = page.getByRole('main').locator('video').filter({ visible: true }).first();
    await expect(video, 'L\'accueil doit afficher une vidéo').toBeVisible();
    await expect.poll(() => video.evaluate(v => !(v as HTMLVideoElement).paused && (v as HTMLVideoElement).currentTime > 0),
      { message: 'La vidéo doit se lancer seule', timeout: 20_000 }).toBe(true);
    await expect(page.getByRole('main').getByRole('button', { name: /Pause/i }).filter({ visible: true }).first(),
      'Un bouton doit permettre de mettre la vidéo en pause').toBeAttached();
  });

  await etape(page, testInfo, '2. Faire défiler jusqu\'en bas : le pied de page s\'affiche, rien ne dépasse de l\'écran', async () => {
    for (let essai = 0; essai < 30; essai++) {
      const fin = await page.evaluate(() => { window.scrollBy(0, window.innerHeight); return window.scrollY + window.innerHeight >= document.body.scrollHeight - 5; });
      if (fin) break;
      await page.waitForTimeout(200);
    }
    await expect(page.getByRole('contentinfo'), 'Le pied de page doit s\'afficher en bas de l\'accueil').toBeInViewport();
    await verifierLargeur(page, testInfo);
  });
});
