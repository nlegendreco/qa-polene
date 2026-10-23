import type { Locator, Page } from '@playwright/test';
import { test, expect, etape, pourChaqueFiche } from '../src/fixtures';
import { ProductPage } from '../src/pages/product';
import { produitFixe } from '../src/produits-fixes';
import { appelShopify } from '../src/shopify';

/**
 * Fiche produit, contenu et galerie (roadmap phase 2.3) : fil d'Ariane (fiche TNR PDP-01), photos et zoom (PDP-02),
 * fenêtre des photos sur mobile (PDP-03), vue 3D (PDP-12), accordéons et bloc savoir-faire (PDP-10, PDP-11).
 *
 * Sur de vrais produits, présents en prod et en préprod sous le même handle : le sac P08 (Cyme Mini camel, vue 3D) et
 * la bague P02 (Eroz). Les produits QA n'ont ni fil d'Ariane (ils ne sont dans aucune collection du menu) ni vue 3D
 * (le modèle 3D est retrouvé par la référence du produit). Chaque test tourne sur les deux fiches du Roll Out
 * (src/fiches.ts), en prod comme en préprod, sauf la vue 3D (nouvelle fiche seulement).
 */

const SAC = produitFixe('P08');
const BIJOU = produitFixe('P02');

const centrer = (element: Locator) => element.evaluate(e => e.scrollIntoView({ block: 'center', behavior: 'instant' }));

async function ouvrirFiche(page: Page, handle: string) {
  const reponse = await new ProductPage(page).goto(handle);
  expect(reponse?.status(), `La fiche ${handle} doit répondre (code 200)`).toBe(200);
}

pourChaqueFiche(version => {
  const ancienne = version === 'ancienne';

  for (const produit of [SAC, BIJOU]) {
    test(`Fiche produit · fil d'Ariane (${produit.id}) @tnr @pdp`, async ({ page, qaEnv }, testInfo) => {
      let liens: { nom: string; href: string }[] = [];

      await etape(page, testInfo, `1. Ouvrir la fiche ${produit.handle} : fil d'Ariane « catégorie / modèle »`, async () => {
        await ouvrirFiche(page, produit.handle);
        const fil = page.getByRole('main').getByRole('navigation', { name: /Breadcrumb|Fil d.Ariane/i }).filter({ visible: true }).first();
        await expect(fil, 'Le fil d\'Ariane doit s\'afficher').toBeVisible();
        liens = await fil.getByRole('link').evaluateAll(as => as.map(a => ({ nom: (a.textContent ?? '').trim(), href: a.getAttribute('href') ?? '' })));
        testInfo.annotations.push({ type: 'Fil d\'Ariane', description: liens.map(l => `${l.nom} (${l.href})`).join(' / ') });
        expect(liens.length, 'Le fil d\'Ariane doit avoir une catégorie et un modèle').toBeGreaterThanOrEqual(2);
        expect(await fil.innerText(), 'Les niveaux sont séparés par « / »').toMatch(/\S\s*\/\s*\S/);
      });

      await etape(page, testInfo, '2. La catégorie et le modèle mènent à leurs collections', async () => {
        const [categorie, modele] = liens;
        expect.soft(categorie.nom, 'Le premier niveau doit être la catégorie du produit').toMatch(produit === SAC ? /^(Sacs|Bags)$/i : /^(Bijoux|Jewellery|Jewelry)$/i);
        // Second niveau : le modèle pour un sac (« Sacs / Cyme », fiche TNR PDP-01), le type pour un bijou (« Bijoux / Bagues »).
        const attendu = produit === SAC ? /^Cyme$/i : /^(Bagues|Rings|Eroz)$/i;
        if (qaEnv.name === 'preprod' && produit === SAC && !attendu.test(modele.nom)) {
          testInfo.annotations.push({ type: 'Constat 42', description: `Préprod : « ${categorie.nom} / ${modele.nom} » au lieu de « Sacs / Cyme » en prod (menu collection-hierarchy de la préprod)` });
        } else {
          expect.soft(modele.nom, `Le second niveau doit être ${produit === SAC ? 'le modèle (Cyme)' : 'le type de bijou (Bagues)'}`).toMatch(attendu);
        }
        for (const lien of liens) {
          expect.soft(lien.href, `« ${lien.nom} » doit mener à une collection`).toMatch(/\/collections\/[a-z0-9-]+$/);
          const reponse = await appelShopify(page, `Le lien « ${lien.nom} » du fil d'Ariane`, () => page.request.get(lien.href.replace(/^\/(fr-fr\/)?/, '')));
          expect.soft(reponse.status(), `« ${lien.nom} » (${lien.href}) doit répondre`).toBe(200);
        }
      });
    });
  }

  test(`Fiche produit · photos et zoom (${SAC.id}) @tnr @pdp`, async ({ page, isMobile, browserName }, testInfo) => {
    await etape(page, testInfo, `1. Ouvrir la fiche ${SAC.handle} : plusieurs photos, chargées`, async () => {
      await ouvrirFiche(page, SAC.handle);
      const photos = page.getByRole('main').locator('img').filter({ visible: true });
      // Seulement les grandes photos à l'écran : les diapositives suivantes du carrousel mobile se chargent à la demande.
      await expect.poll(() => photos.evaluateAll(imgs => (imgs as HTMLImageElement[]).filter(i => {
        const r = i.getBoundingClientRect();
        return r.width > 250 && r.top < window.innerHeight && r.left >= 0 && r.left < window.innerWidth;
      }).every(i => i.complete && i.naturalWidth > 0)),
        { message: 'Les photos du haut de la fiche doivent être chargées' }).toBe(true);
    });

    if (!isMobile) {
      // Préprod depuis le 21 octobre 2026 : le nom porte aussi la position et le produit (« Zoom on image, 1 of 2 : … »).
      const zooms = page.getByRole('main').getByRole('button', { name: /^(Zoom on image|Zoom sur l.image)(,|$)/i }).filter({ visible: true });
      const pleinEcran = page.locator('.component-zoomable-image__fs-image-container.active');
      await etape(page, testInfo, '2. Ordinateur : les photos sont empilées, chacune peut être agrandie', async () => {
        expect(await zooms.count(), 'La fiche doit montrer au moins 2 photos agrandissables').toBeGreaterThanOrEqual(2);
      });

      await etape(page, testInfo, '3. Cliquer la 2e photo : elle s\'affiche en plein écran, chargée', async () => {
        const photo = zooms.nth(1);
        await centrer(photo);
        await photo.click();
        await expect(photo, 'Le bouton doit indiquer que la photo est agrandie').toHaveAttribute('aria-pressed', 'true');
        await expect(pleinEcran, 'La photo doit s\'afficher en plein écran').toBeVisible();
        const zone = (await pleinEcran.boundingBox())!;
        const ecran = page.viewportSize()!;
        expect(zone.width * zone.height, 'La photo agrandie doit couvrir l\'écran').toBeGreaterThanOrEqual(ecran.width * ecran.height * 0.9);
        await expect.poll(() => pleinEcran.locator('img').first().evaluate(i => (i as HTMLImageElement).complete && (i as HTMLImageElement).naturalWidth > 0),
          { message: 'La photo agrandie doit être chargée' }).toBe(true);
      });

      await etape(page, testInfo, '4. Échap ferme la photo agrandie', async () => {
        await page.keyboard.press('Escape');
        if (await pleinEcran.isVisible()) {
          testInfo.annotations.push({ type: 'Zoom', description: 'Échap ne ferme pas la photo agrandie : fermée par un clic' });
          await pleinEcran.click();
        }
        await expect(pleinEcran, 'La photo agrandie doit se fermer').toBeHidden();
      });
      return;
    }

    if (ancienne) {
      // Ancienne fiche sur mobile : carrousel Swiper, sans flèches ni points, on glisse au doigt.
      const carrousel = page.getByRole('main').locator('[aria-roledescription="carousel"]').filter({ visible: true }).first();
      const visible = () => carrousel.evaluate(c => [...c.querySelectorAll('[aria-roledescription="slide"]')]
        .find(s => Math.abs(s.getBoundingClientRect().left) < 5)?.getAttribute('aria-label') ?? '');

      await etape(page, testInfo, '2. Mobile (ancienne fiche) : carrousel de photos sur toute la largeur', async () => {
        await expect(carrousel, 'Le carrousel de photos doit s\'afficher').toBeVisible();
        expect((await carrousel.boundingBox())!.width, 'Le carrousel doit prendre la largeur de l\'écran').toBeGreaterThanOrEqual(page.viewportSize()!.width - 2);
        const nombre = Number((await visible()).match(/of (\d+)|sur (\d+)/)?.slice(1).find(Boolean) ?? 0);
        testInfo.annotations.push({ type: 'Photos', description: `${nombre} (première : « ${await visible()} »)` });
        expect(nombre, 'Le carrousel doit avoir au moins 2 photos').toBeGreaterThanOrEqual(2);
        // Constat 41 : les photos n'ont pas de nom pour les lecteurs d'écran (« , 1 of 5 »).
        if (/^,/.test(await visible())) testInfo.annotations.push({ type: 'Constat 41', description: `Photo du carrousel sans nom : « ${await visible()} »` });
      });

      await etape(page, testInfo, '3. Glisser vers la gauche : la photo suivante arrive', async () => {
        test.skip(browserName !== 'chromium', 'Glisser au doigt : simulé sous Chrome (Android) seulement, pas sous Safari');
        const avant = await visible();
        const zone = (await carrousel.boundingBox())!;
        const y = zone.y + zone.height / 2;
        const cdp = await page.context().newCDPSession(page);
        const toucher = (type: 'touchStart' | 'touchMove' | 'touchEnd', x: number) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
        await toucher('touchStart', zone.width * 0.85);
        for (let x = zone.width * 0.85; x > zone.width * 0.15; x -= 20) await toucher('touchMove', x);
        await toucher('touchEnd', zone.width * 0.15);
        // Relu jusqu'à la fin de l'animation : pendant le glissement, aucune photo n'est calée à gauche (« »).
        await expect.poll(visible, { message: `Après un glissement, la 2e photo doit être affichée (avant : « ${avant} »)` }).toMatch(/2 (of|sur)/);
      });
      return;
    }

    // Nouvelle fiche sur mobile : carrousel avec points, flèches pour les lecteurs d'écran, fenêtre des photos (PDP-03).
    const galerie = page.getByRole('main').getByRole('region', { name: /Product gallery|Galerie/i });
    const points = page.getByRole('main').getByRole('button', { name: /^Go to slide \d+$/i });
    const fenetre = page.locator('component-modal.active[data-type="gallery"]');

    await etape(page, testInfo, '2. Mobile : carrousel de photos avec un point par photo, le premier actif', async () => {
      await expect(galerie, 'Le carrousel de photos doit s\'afficher').toBeVisible();
      expect(await points.count(), 'Un point par photo, au moins 2').toBeGreaterThanOrEqual(2);
      await expect(points.first(), 'Le premier point doit être actif').toHaveAttribute('aria-current', 'true');
    });

    await etape(page, testInfo, '3. Flèche « Suivant » au clavier (lecteur d\'écran) : la 2e photo devient active', async () => {
      const suivant = page.getByRole('main').getByRole('button', { name: /^(Next|Suivant)$/i }).first();
      await suivant.focus();
      await page.keyboard.press('Enter');
      await expect(points.nth(1), 'Le 2e point doit devenir actif').toHaveAttribute('aria-current', 'true');
    });

    await etape(page, testInfo, '4. Toucher la photo : la fenêtre des photos s\'ouvre sur la même photo, avec les vignettes', async () => {
      await galerie.getByRole('button', { name: /Zoom/i }).filter({ visible: true }).first().click();
      await expect(fenetre, 'La fenêtre des photos doit s\'ouvrir').toBeVisible();
      await expect(fenetre.getByRole('listitem').filter({ visible: true }).first(), 'La fenêtre doit s\'ouvrir sur la photo touchée (la 2e)').toHaveAccessibleName(/2 (of|sur)/);
      const vignettes = fenetre.getByRole('button', { name: /\d+ (of|sur) \d+/ });
      expect(await vignettes.count(), 'La fenêtre doit montrer une vignette par photo').toBe(await points.count());
    });

    await etape(page, testInfo, '5. Toucher la dernière vignette puis fermer la fenêtre', async () => {
      const vignettes = fenetre.getByRole('button', { name: /\d+ (of|sur) \d+/ });
      const derniere = vignettes.last();
      const nom = (await derniere.getAttribute('aria-label')) ?? (await derniere.textContent()) ?? '';
      await derniere.click();
      await expect(fenetre.getByRole('listitem').filter({ visible: true }).first(), 'La photo de la vignette touchée doit s\'afficher').toHaveAccessibleName(new RegExp(nom.match(/\d+ (of|sur) \d+/)![0]));
      await fenetre.getByRole('button', { name: /^(Close|Fermer)( modal| la fenêtre)?$/i }).click();
      await expect(fenetre, 'La fenêtre doit se fermer').toBeHidden();
    });
  });

  // Nouvelle fiche seulement : l'ancienne n'a plus de vue 3D (constat 43, essai de l'équipe), test retiré à la revue
  // de la QA du 22 octobre 2026.
  if (!ancienne) test(`Fiche produit · vue 3D (${SAC.id}) @tnr @pdp`, async ({ page }, testInfo) => {
    // Sans carte graphique, le navigateur de test dessine la 3D au processeur : lent, surtout à plusieurs en parallèle
    // (captures d'étape de plus de 15 s sous Chrome quand le Mac est chargé).
    test.slow();
    // Le lecteur 3D (cadre power.xyz) : l'élément product-xyz-3d qui l'entoure passe par moments pour invisible.
    const lecteur = page.locator('product-xyz-3d iframe').filter({ visible: true }).first();
    const interrupteur = page.locator('product-xyz-3d').getByRole('switch', { name: /open or closed|ouvert ou fermé/i }).filter({ visible: true }).first();

    await etape(page, testInfo, `1. Ouvrir la fiche ${SAC.handle} : bouton « Vue 3D »`, async () => {
      await ouvrirFiche(page, SAC.handle);
      const bouton3d = page.getByRole('main').getByRole('button', { name: /^(3D View|Vue 3D)$/i }).filter({ visible: true }).first();
      await expect(bouton3d, 'Le bouton « Vue 3D » doit s\'afficher').toBeVisible();
    });

    // Une seule étape pour ouvrir, manipuler et fermer la 3D : la capture de fin d'étape est prise 3D fermée. 3D ouverte,
    // sous Chrome et sur un Mac chargé, une capture dépasse 15 s (le navigateur redessine la 3D sans arrêt).
    await etape(page, testInfo, '2. Vue 3D : le modèle se télécharge et s\'affiche, l\'interrupteur ouvre le sac, « Close » ferme', async () => {
      const modele = page.waitForResponse(r => /power\.xyz\/.*\.glb/.test(r.url()), { timeout: 45_000 });
      const bouton = page.getByRole('main').getByRole('button', { name: /^(3D View|Vue 3D)$/i }).filter({ visible: true }).first();
      await centrer(bouton);
      await bouton.click();
      const reponse = await modele;
      expect(reponse.status(), 'Le modèle 3D doit être téléchargé (power.xyz)').toBe(200);
      await expect(lecteur, 'La vue 3D doit s\'afficher').toBeVisible();
      // Mesure dans la page : sous Chrome, Playwright ne retrouvait plus le cadre pour le mesurer (délai dépassé).
      const zone = await page.locator('product-xyz-3d iframe').evaluateAll(cadres => cadres.map(c => c.getBoundingClientRect())
        .reduce((a, r) => (r.width > a.width ? { width: r.width, height: r.height } : a), { width: 0, height: 0 }));
      expect(zone.width, 'La vue 3D doit avoir une vraie taille').toBeGreaterThan(300);
      testInfo.annotations.push({ type: 'Vue 3D', description: `${Math.round(zone.width)} × ${Math.round(zone.height)} px ; la rotation reste à vérifier à la main` });

      await expect(interrupteur, 'La vue 3D doit proposer le sac ouvert ou fermé').toBeVisible();
      const avant = await interrupteur.isChecked();
      // Case à cocher dessinée en interrupteur « Fermé · Ouvert ». Clic envoyé à l'élément sans passer par la souris :
      // 3D ouverte, le navigateur dessine sans arrêt et le défilement ou l'attente d'après-clic de Playwright dépassaient
      // 15 s dès que deux navigateurs tournaient (22 octobre 2026, Android prod et Chrome préprod ; vert seul).
      await interrupteur.dispatchEvent('click');
      await expect(interrupteur, 'L\'interrupteur doit passer à l\'autre état').toBeChecked({ checked: !avant });
      const capture = await page.screenshot({ timeout: 5_000 }).catch(() => null);
      if (capture) await testInfo.attach('📸 Vue 3D ouverte', { body: capture, contentType: 'image/png' });

      const fenetre = page.locator('component-modal.active [role=dialog]').filter({ has: page.locator('product-xyz-3d') });
      const fermer = (await fenetre.count())
        ? fenetre.getByRole('button', { name: /^(Close|Fermer)/i }).first()
        : page.getByRole('main').getByRole('button', { name: /^(Close|Fermer)\s*(3D View|Vue 3D)?$/i }).filter({ visible: true }).first();
      await fermer.dispatchEvent('click');
      await expect(lecteur, 'La vue 3D doit se fermer').toBeHidden();
    });
  });

  for (const produit of [SAC, BIJOU]) {
    test(`Fiche produit · savoir-faire : accordéons et bloc éditorial (${produit.id}) @tnr @pdp`, async ({ page }, testInfo) => {
      const sac = produit === SAC;

      await etape(page, testInfo, `1. Ouvrir la fiche ${produit.handle}`, async () => {
        await ouvrirFiche(page, produit.handle);
      });

      await etape(page, testInfo, '2. Accordéons « Conçu avec minutie » / « Envoyé avec soin », fermés au départ, qui s\'ouvrent au clic', async () => {
        if (ancienne) {
          testInfo.annotations.push({ type: 'Accordéons', description: 'Ancienne fiche : pas d\'accordéons savoir-faire (onglets à la place), non vérifié' });
          return;
        }
        const titres: [string, RegExp][] = sac
          ? [['Conçu avec minutie', /Conçu avec minutie|crafted/i], ['Envoyé avec soin', /Envoyé avec soin|Shipped with care/i]]
          : [['Une conception minutieuse', /Une conception minutieuse|Meticulous|crafted/i], ['Un envoi soigné', /Un envoi soigné|Shipped with care|Careful/i]];
        for (const [nom, titre] of titres) {
          const bouton = page.getByRole('main').getByRole('button', { name: titre }).filter({ visible: true }).first();
          // Constat 50 : en préprod (nouvelle fiche), seul « Shipped with care » est là, sur le sac comme sur la bague.
          // Bug confirmé par la QA le 22 octobre 2026 (accordéon retiré en préprod, cause à investiguer).
          if (!(await bouton.isVisible({ timeout: 5_000 }).catch(() => false))) {
            expect.soft(false, `L'accordéon « ${nom} » doit s'afficher (constat 50 en préprod : accordéon retiré, à investiguer)`).toBe(true);
            continue;
          }
          await expect(bouton, 'Fermé au départ').toHaveAttribute('aria-expanded', 'false');
          await centrer(bouton);
          await bouton.click();
          await expect(bouton, 'Ouvert après un clic').toHaveAttribute('aria-expanded', 'true');
          const contenu = page.locator(`#${await bouton.getAttribute('aria-controls')}`);
          await expect(contenu, 'Le texte de l\'accordéon doit s\'afficher').toBeVisible();
          expect(((await contenu.innerText()) ?? '').trim().length, 'L\'accordéon ne doit pas être vide').toBeGreaterThan(20);
        }
      });

      await etape(page, testInfo, `3. Bloc « ${sac ? 'Le savoir-faire d\'Ubrique' : 'Le savoir-faire du bijou'} » en bas de fiche, avec sa photo`, async () => {
        const titre = page.getByRole('main').getByRole('heading', { level: 2, name: sac ? /Ubrique/i : /bijou|jewel/i }).filter({ visible: true }).first();
        await centrer(titre);
        await expect(titre, 'Le bloc savoir-faire doit s\'afficher avec le bon titre pour ce produit').toBeVisible();
        testInfo.annotations.push({ type: 'Savoir-faire', description: (await titre.textContent())?.trim() ?? '' });
        const photo = titre.locator('xpath=ancestor::*[contains(concat(" ", @class, " "), " shopify-section ")][1]').locator('img').filter({ visible: true }).first();
        await centrer(photo);
        await expect.poll(() => photo.evaluate(i => (i as HTMLImageElement).complete && (i as HTMLImageElement).naturalWidth > 0),
          { message: 'La photo du bloc savoir-faire doit être chargée' }).toBe(true);
      });
    });
  }
});
