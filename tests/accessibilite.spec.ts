import { test, expect, etape } from '../src/fixtures';

/**
 * Accessibilité au clavier. Bouton pause / lecture des vidéos (SCRUM-1241) : il est fait pour les personnes qui
 * naviguent au clavier, donc on le teste uniquement au clavier (Tab, Entrée, Espace), jamais à la souris.
 * Page UAT de la préprod qui pose une vidéo dans chaque type de section. Ordinateur seulement (pas de clavier sur
 * téléphone). Lecture seule.
 */

const PAGE_UAT = 'pages/uat-video-toggle';
const BOUTON = '.component-video-toggle__button';

test('Accessibilité · Bouton pause / lecture des vidéos au clavier (UAT) @tnr @accessibilite @sections', async ({ page, qaEnv, isMobile, browserName }, testInfo) => {
  test.skip(qaEnv.name !== 'preprod', 'Page UAT : préprod uniquement');
  test.skip(isMobile, 'Navigation au clavier : ordinateur seulement');
  // Safari ne passe sur les boutons et les liens avec Tab que si l'option du Mac est activée ; Option + Tab le fait toujours.
  const tab = browserName === 'webkit' ? 'Alt+Tab' : 'Tab';
  const boutonsVisibles = page.locator(`${BOUTON}:visible`);
  let attendus = 0;
  /** Position de la page une fois le défilement terminé (deux mesures identiques à 250 ms d'écart). */
  const immobile = async () => {
    let avant = -1;
    for (let i = 0; i < 20; i++) {
      const maintenant = await page.evaluate(() => Math.round(window.scrollY));
      if (maintenant === avant) return maintenant;
      avant = maintenant;
      await page.waitForTimeout(250);
    }
    return avant;
  };

  await etape(page, testInfo, '1. Ouvrir la page UAT des vidéos', async () => {
    await page.goto(PAGE_UAT, { waitUntil: 'load' });
    // La fenêtre de géolocalisation garde le focus clavier tant qu'elle est ouverte : la faire apparaître et fermer
    // (handler de src/fixtures.ts) avant de commencer, par une action qui n'en dépend pas.
    await page.locator('main').hover();    attendus = await boutonsVisibles.count();
    expect(attendus, 'La page doit contenir des boutons pause / lecture').toBeGreaterThan(0);
    testInfo.annotations.push({ type: 'Boutons pause / lecture', description: `${attendus} visibles sur la page` });
  });

  const testes: string[] = [];
  await etape(page, testInfo, '2. Parcourir la page avec Tab : chaque bouton reçoit le focus, visible, et répond à Entrée puis Espace', async () => {
    await page.evaluate(() => { window.scrollTo({ top: 0, behavior: 'instant' }); (document.activeElement as HTMLElement | null)?.blur(); });
    // Un tour complet de la page : après le pied de page, Tab repart du haut ; retomber sur un bouton déjà testé
    // veut dire que le tour est fini. 400 appuis au plus, au cas où le focus resterait bloqué quelque part.
    for (let i = 0; i < 400 && testes.length < attendus; i++) {
      await page.keyboard.press(tab);
      const focus = page.locator(':focus');
      const etat = await focus.evaluate((e, sel) => {
        if (!e.matches(sel)) return 'autre';
        if (e.hasAttribute('data-qa-teste')) return 'deja-teste';
        e.setAttribute('data-qa-teste', '');
        return 'nouveau';
      }, BOUTON).catch(() => 'autre');
      if (etat === 'deja-teste') break;
      if (etat === 'autre') continue;
      const nom = await focus.evaluate((e, n) => `${e.closest('[id^="shopify-section-template--"]')?.id.replace(/^shopify-section-template--\d+__/, '') ?? '?'} n° ${n}`, testes.length + 1);
      testes.push(nom);

      // Vidéo pilotée par ce bouton : la vidéo visible la plus proche.
      const videoEnPause = () => focus.evaluate(e => {
        let c = e.parentElement; let v: HTMLVideoElement | undefined;
        while (c && !(v = [...c.querySelectorAll('video')].find(x => x.checkVisibility()))) c = c.parentElement;
        return v ? v.paused : null;
      });
      expect.soft(await videoEnPause(), `${nom} : aucune vidéo trouvée à côté du bouton`).not.toBeNull();

      const indicateur = await focus.evaluate(e => {
        const st = getComputedStyle(e);
        return e.matches(':focus-visible') && (st.outlineStyle !== 'none' || st.boxShadow !== 'none');
      });
      expect.soft(indicateur, `${nom} : le bouton doit montrer qu'il a le focus (contour ou halo)`).toBe(true);

      // La vidéo démarre seule quand elle arrive à l'écran.
      await expect.poll(videoEnPause, { message: `${nom} : la vidéo doit être en lecture avant de tester le bouton`, timeout: 8_000 }).toBe(false);
      await expect.soft(focus, `${nom} : le bouton doit proposer la pause`).toHaveAttribute('aria-label', /Pause video|Mettre en pause|Pause/i);

      await page.keyboard.press('Enter');
      await expect.poll(videoEnPause, { message: `${nom} : Entrée doit mettre la vidéo en pause` }).toBe(true);
      await expect.soft(focus, `${nom} : après la pause, le bouton doit proposer la lecture`).toHaveAttribute('aria-label', /Play video|Lire|Lecture/i);

      // Le thème défile en douceur jusqu'au bouton qui reçoit le focus : attendre que la page soit immobile avant de mesurer.
      const hauteur = await immobile();
      await page.keyboard.press('Space');
      await expect.poll(videoEnPause, { message: `${nom} : Espace doit relancer la vidéo` }).toBe(false);
      await expect.soft(focus, `${nom} : après la relance, le bouton doit de nouveau proposer la pause`).toHaveAttribute('aria-label', /Pause video|Mettre en pause|Pause/i);
      expect.soft(await immobile(), `${nom} : Espace sur le bouton ne doit pas faire défiler la page`).toBe(hauteur);
    }
    testInfo.annotations.push({ type: 'Boutons testés au clavier', description: testes.join(' · ') });
    const oublies = await page.locator(`${BOUTON}:visible:not([data-qa-teste])`).evaluateAll(bs => bs.map(b =>
      b.closest('[id^="shopify-section-template--"]')?.id.replace(/^shopify-section-template--\d+__/, '') ?? '?'));
    if (oublies.length) testInfo.annotations.push({ type: 'Boutons jamais atteints au clavier', description: oublies.join(', ') });
    expect(testes.length, `Tous les boutons visibles doivent être atteignables avec ${tab} (${testes.length} sur ${attendus})`).toBe(attendus);
  });
});
