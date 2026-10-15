import type { Page } from '@playwright/test';
import { test, expect, etape } from '../src/fixtures';
import { parsePriceToCents } from '../src/price';
import { collectionQa, produitFixe } from '../src/produits-fixes';

/**
 * Collections (roadmap phase 2.3) : menu des sous-collections (fiche TNR PLP-01), filtres et tri (PLP-02), bouton
 * « Voir plus » (PLP-06), défilement infini, collection vide. La grille elle-même : tests/structure-collections.spec.ts.
 *
 * Le menu des sous-collections se teste sur la vraie collection Sacs, en prod et en préprod : les collections QA
 * réutilisent le carrousel global de Sacs sans entrée QA (décision du 9 octobre 2026). Le reste se teste sur les
 * collections QA de la préprod, dont on connaît le contenu exact (data/donnees-qa.json).
 */

/** Cartes de la grille : handle, état (`data-tracking-state`) et prix, dans l'ordre affiché. */
function lireCartes(page: Page) {
  return page.locator('main .collection__product-grid > component-product-card').evaluateAll(cartes => cartes.map(c => ({
    handle: c.querySelector('a[href*="/products/"]')?.getAttribute('href')?.match(/\/products\/([^/?#]+)/)?.[1] ?? '?',
    etat: (c.querySelector('[data-tracking-state]') as HTMLElement | null)?.dataset.trackingState ?? '',
    prix: c.querySelector('.component-product-card__footer__details__label--price')?.textContent?.trim() ?? '',
  })));
}

const filtresBouton = (page: Page) => page.getByRole('main').getByRole('button', { name: /^(Filtres|Filters)\b/i }).first();
const filtresFenetre = (page: Page) => page.getByRole('dialog', { name: /^(Filtres|Filters)$/i });
const voirProduits = (page: Page) => filtresFenetre(page).getByRole('button', { name: /^(Show products|Voir les produits|Afficher)/i });

/** Attend que la grille ait été rechargée par les filtres (le nombre de produits du bouton de la fenêtre suit). */
async function attendreGrille(page: Page, nombre: number, message: string) {
  await expect.poll(async () => (await lireCartes(page)).length, { message, timeout: 15_000 }).toBe(nombre);
  await expect(voirProduits(page), 'Le bouton de la fenêtre doit annoncer le même nombre de produits').toContainText(new RegExp(`\\b${nombre}\\b`));
}

test('Collection · menu des sous-collections (Sacs) @tnr @plp', async ({ page, isMobile }, testInfo) => {
  const menu = page.locator('main .collection-menu').first();
  const liens = menu.locator('a.collection-menu__list--link');
  let cible = { nom: '', href: '' };

  await etape(page, testInfo, '1. Ouvrir la collection Sacs : menu « Sacs par collection » au-dessus de la grille', async () => {
    await page.goto('collections/handbags', { waitUntil: 'domcontentloaded' });
    await expect(menu, 'Le menu des sous-collections doit s\'afficher').toBeVisible();
    await expect(page.getByRole('main').getByRole('heading', { name: /Sacs\s+par collection|Bags\s+by collections?/i }), 'Le menu doit avoir son titre').toBeVisible();
    const noms = await liens.allTextContents();
    testInfo.annotations.push({ type: 'Sous-collections', description: noms.map(n => n.trim()).join(', ') });
    expect(noms.length, 'Le menu doit proposer plusieurs sous-collections').toBeGreaterThanOrEqual(5);
    for (const href of await liens.evaluateAll(as => as.map(a => a.getAttribute('href') ?? ''))) {
      expect.soft(href, 'Chaque entrée doit mener à une collection').toMatch(/\/collections\/[a-z0-9-]+$/);
    }
    await expect(menu.locator('a[aria-current="page"]'), 'Sur la collection Sacs, aucune sous-collection n\'est active').toHaveCount(0);
  });

  await etape(page, testInfo, isMobile ? '2. Sur mobile : les flèches sont réservées aux lecteurs d\'écran, le menu défile au doigt' : '2. Flèches : « Précédent » inactive au départ, « Suivant » fait défiler le menu', async () => {
    const precedent = menu.getByRole('button', { name: /^(Previous|Précédent)$/i });
    const suivant = menu.getByRole('button', { name: /^(Next|Suivant)$/i });
    await expect(precedent, 'Au départ, la flèche « Précédent » doit être inactive').toBeDisabled();
    const largeur = (await suivant.boundingBox())?.width ?? 0;
    if (isMobile) {
      expect(largeur, 'Sur mobile, les flèches ne doivent pas être affichées (1 px, pour les lecteurs d\'écran)').toBeLessThanOrEqual(2);
      const deborde = await menu.evaluate(m => { const l = m.querySelectorAll('li'); return l[l.length - 1].getBoundingClientRect().right > window.innerWidth; });
      expect(deborde, 'Sur mobile, le menu doit dépasser de l\'écran (il défile au doigt)').toBe(true);
      return;
    }
    expect(largeur, 'Sur ordinateur, les flèches doivent être affichées').toBeGreaterThan(20);
    const premier = liens.first();
    const position = async () => (await premier.boundingBox())?.x ?? 0;
    const avant = await position();
    await suivant.click();
    await expect.poll(position, { message: '« Suivant » doit faire défiler le menu vers la gauche' }).toBeLessThan(avant);
    await expect(precedent, 'Après « Suivant », la flèche « Précédent » doit devenir active').toBeEnabled();
  });

  await etape(page, testInfo, '3. Cliquer une sous-collection : sa page s\'ouvre, l\'entrée est active', async () => {
    const lien = liens.nth(1);
    cible = { nom: ((await lien.textContent()) ?? '').trim(), href: (await lien.getAttribute('href')) ?? '' };
    await lien.evaluate(e => e.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'instant' }));
    await lien.click();
    await expect(page, `Le clic doit ouvrir la collection ${cible.nom}`).toHaveURL(new RegExp(`${cible.href.replace(/^\/(fr-fr\/)?/, '')}$`));
    await expect(page.getByRole('main').getByRole('heading', { level: 1 }), `Titre de la collection ${cible.nom}`).toHaveText(new RegExp(cible.nom, 'i'));
    const actif = menu.locator('a[aria-current="page"]');
    await expect(actif, `L'entrée ${cible.nom} doit être marquée comme active`).toHaveText(new RegExp(`^\\s*${cible.nom}\\s*$`, 'i'));
    await expect(actif, 'L\'entrée active doit être visible à l\'écran').toBeInViewport();
    expect((await lireCartes(page)).length, `La collection ${cible.nom} doit afficher des produits`).toBeGreaterThan(0);
  });
});

test('Collection · filtres et tri (C1) @tnr @plp', async ({ page, qaEnv }, testInfo) => {
  test.skip(qaEnv.name !== 'preprod', 'Collections QA : préprod uniquement');
  const c1 = collectionQa('C1');
  const fenetre = filtresFenetre(page);
  // Produits que « Show only in stock » doit garder : tous ceux qui ne sont pas en rupture (précommande et coming soon compris).
  let tous: Awaited<ReturnType<typeof lireCartes>> = [];

  await etape(page, testInfo, `1. Ouvrir ${c1.id} (${c1.handles.length} produits), puis la fenêtre des filtres`, async () => {
    await page.goto(`collections/${c1.handle}`, { waitUntil: 'domcontentloaded' });
    await expect.poll(async () => (await lireCartes(page)).length, { message: `La collection doit afficher ses ${c1.handles.length} produits` }).toBe(c1.handles.length);
    tous = await lireCartes(page);
    await expect(filtresBouton(page), 'Aucun filtre au départ : « Filters (0) »').toHaveText(/\(\s*0\s*\)/);
    await filtresBouton(page).click();
    await expect(fenetre, 'La fenêtre des filtres doit s\'ouvrir').toBeVisible();
    for (const tri of [/^(Lowest price|Prix croissant)/i, /^(Highest price|Prix décroissant)/i, /^(Newest|Nouveautés)/i]) {
      await expect.soft(fenetre.getByRole('radio', { name: tri }), `Tri proposé : ${tri}`).toBeAttached();
    }
    await expect(fenetre.getByRole('checkbox', { name: /Show only in stock|en stock/i }), 'Filtre de disponibilité').toBeAttached();
    for (const facette of [/^(Category|Catégorie)/i, /^(Materials|Matières?)/i, /^(Colou?r|Couleur)/i, /^(Sizes|Tailles)/i]) {
      await expect.soft(fenetre.getByRole('button', { name: facette }).first(), `Filtre proposé : ${facette}`).toBeVisible();
    }
    const facettes = await fenetre.getByRole('heading', { level: 3 }).allTextContents();
    testInfo.annotations.push({ type: 'Filtres proposés', description: facettes.map(f => f.trim()).join(', ') });
  });

  await etape(page, testInfo, '2. « Show only in stock » : les produits en rupture disparaissent, compteur « Filters (1) »', async () => {
    await fenetre.getByRole('checkbox', { name: /Show only in stock|en stock/i }).check();
    const attendus = tous.filter(c => c.etat !== 'disabled');
    await attendreGrille(page, attendus.length, `Il doit rester ${attendus.length} produits (${tous.length - attendus.length} en rupture retirés)`);
    expect((await lireCartes(page)).filter(c => c.etat === 'disabled').map(c => c.handle), 'Aucun produit en rupture ne doit rester').toEqual([]);
    await expect(page, 'Le filtre doit être dans l\'adresse de la page').toHaveURL(/filter\.v\.availability=1/);
  });

  for (const [n, libelle, nom, sens] of [[3, 'Lowest price', /^(Lowest price|Prix croissant)/i, 1], [4, 'Highest price', /^(Highest price|Prix décroissant)/i, -1]] as const) {
    await etape(page, testInfo, `${n}. Tri « ${libelle} » : les prix sont dans l'ordre ${sens > 0 ? 'croissant' : 'décroissant'}, le filtre reste`, async () => {
      await fenetre.getByRole('radio', { name: nom }).check();
      await expect(page, 'Le tri doit être dans l\'adresse de la page').toHaveURL(new RegExp(`sort_by=price-${sens > 0 ? 'ascending' : 'descending'}`));
      await expect.poll(async () => {
        const prix = (await lireCartes(page)).map(c => parsePriceToCents(c.prix) ?? NaN);
        return prix.every((p, i) => i === 0 || (p - prix[i - 1]) * sens >= 0);
      }, { message: `Les prix doivent être dans l'ordre ${sens > 0 ? 'croissant' : 'décroissant'}` }).toBe(true);
      expect((await lireCartes(page)).filter(c => c.etat === 'disabled').length, 'Le filtre « en stock » doit rester appliqué').toBe(0);
    });
  }

  await etape(page, testInfo, `5. Catégorie « Rings » : seules les bagues QA restent (${produitFixe('QA09').id}, ${produitFixe('QA10').id})`, async () => {
    await fenetre.getByRole('button', { name: /^(Category|Catégorie)/i }).first().click();
    await fenetre.getByRole('checkbox', { name: /^(Rings|Bagues)$/i }).check();
    await attendreGrille(page, 2, 'Il doit rester les 2 bagues QA en stock');
    expect((await lireCartes(page)).map(c => c.handle).sort(), 'Les produits affichés doivent être les bagues QA').toEqual([produitFixe('QA09').handle, produitFixe('QA10').handle].sort());
    // Les autres filtres ne proposent que ce qui donnerait des résultats : on ne peut pas tomber sur 0 produit.
    await fenetre.getByRole('button', { name: /^(Materials|Matières?)/i }).first().click();
    const matieres = fenetre.getByRole('group', { name: /Materials|Matières?/i }).getByRole('checkbox');
    expect(await matieres.count(), 'Le filtre Matières doit proposer des valeurs').toBeGreaterThan(0);
    for (const m of await matieres.all()) await expect.soft(m, 'Les matières sans bague doivent être inactives').toBeDisabled();
  });

  await etape(page, testInfo, '6. « Show products » ferme la fenêtre, « Clear » enlève tous les filtres', async () => {
    await voirProduits(page).click();
    await expect(fenetre, 'La fenêtre doit se fermer').toBeHidden();
    await expect(filtresBouton(page), 'Le bouton doit compter les filtres choisis').not.toHaveText(/\(\s*0\s*\)/);
    await filtresBouton(page).click();
    await fenetre.getByRole('button', { name: /^(Clear|Effacer|Tout effacer)$/i }).click();
    await attendreGrille(page, c1.handles.length, `Sans filtre, les ${c1.handles.length} produits doivent revenir`);
    await expect(page, 'L\'adresse ne doit plus contenir de filtre').not.toHaveURL(/filter\.|sort_by/);
    await fenetre.getByRole('button', { name: /^(Close|Fermer)$/i }).click();
    await expect(fenetre, 'La croix doit fermer la fenêtre').toBeHidden();
    await expect(filtresBouton(page)).toHaveText(/\(\s*0\s*\)/);
  });
});

test('Collection · « Voir plus » charge la suite (C3) @tnr @plp', async ({ page, qaEnv }, testInfo) => {
  test.skip(qaEnv.name !== 'preprod', 'Collections QA : préprod uniquement');
  const c3 = collectionQa('C3');
  const bouton = page.getByRole('main').getByRole('button', { name: /^(See more|Voir plus)$/i });
  let premiers: string[] = [];

  await etape(page, testInfo, `1. Ouvrir ${c3.id} : 48 produits sur ${c3.handles.length}, bouton « See more »`, async () => {
    await page.goto(`collections/${c3.handle}`, { waitUntil: 'domcontentloaded' });
    await expect.poll(async () => (await lireCartes(page)).length, { message: 'La première page doit afficher 48 produits' }).toBe(48);
    premiers = (await lireCartes(page)).map(c => c.handle);
    await expect(bouton, 'Le bouton « See more » doit être affiché sous la grille').toBeVisible();
  });

  await etape(page, testInfo, `2. Cliquer « See more » : les ${c3.handles.length - 48} produits suivants s'ajoutent, le bouton disparaît`, async () => {
    await bouton.evaluate(e => e.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await bouton.click();
    await expect.poll(async () => (await lireCartes(page)).length, { message: `Les ${c3.handles.length} produits doivent être affichés` }).toBe(c3.handles.length);
    const handles = (await lireCartes(page)).map(c => c.handle);
    expect(handles.slice(0, 48), 'Les 48 premiers produits doivent rester à leur place').toEqual(premiers);
    expect(handles.length - new Set(handles).size, 'Aucun produit ne doit apparaître deux fois').toBe(0);
    expect([...handles].sort(), 'La collection doit contenir exactement ses produits QA').toEqual([...c3.handles].sort());
    await expect(bouton, 'Tout est affiché : le bouton doit disparaître').toBeHidden();
  });
});

test('Collection · défilement infini (C2) @tnr @plp', async ({ page, qaEnv }, testInfo) => {
  test.skip(qaEnv.name !== 'preprod', 'Collections QA : préprod uniquement');
  const c2 = collectionQa('C2');

  await etape(page, testInfo, `1. Ouvrir ${c2.id} : 48 produits sur ${c2.handles.length}`, async () => {
    await page.goto(`collections/${c2.handle}`, { waitUntil: 'domcontentloaded' });
    await expect.poll(async () => (await lireCartes(page)).length, { message: 'La première page doit afficher 48 produits' }).toBe(48);
    await expect(page.locator('collection-infinite-scroll'), 'Le nombre total de produits doit être connu de la page').toHaveAttribute('data-total-products', String(c2.handles.length));
  });

  await etape(page, testInfo, `2. Descendre en bas de la grille : les ${c2.handles.length - 48} produits suivants arrivent seuls`, async () => {
    await expect.poll(async () => {
      // Comme un client : on descend jusqu'à la dernière carte (sauter d'un coup au pied de page ne déclenche rien sous Safari).
      await page.evaluate(async () => {
        const cartes = document.querySelectorAll('main .collection__product-grid > component-product-card');
        cartes[cartes.length - 1]?.scrollIntoView({ block: 'end', behavior: 'instant' });
        for (let i = 0; i < 4; i++) { window.scrollBy({ top: window.innerHeight / 3, behavior: 'instant' }); await new Promise(r => setTimeout(r, 150)); }
      });
      return (await lireCartes(page)).length;
    }, { message: `Les ${c2.handles.length} produits doivent être affichés`, timeout: 30_000, intervals: [1_000] }).toBe(c2.handles.length);
    const handles = (await lireCartes(page)).map(c => c.handle);
    expect(handles.length - new Set(handles).size, 'Aucun produit ne doit apparaître deux fois').toBe(0);
    expect([...handles].sort(), 'La collection doit contenir exactement ses produits QA').toEqual([...c2.handles].sort());
  });
});

test('Collection · vide, et filtre sans résultat (C6, C7) @tnr @plp', async ({ page, qaEnv }, testInfo) => {
  test.skip(qaEnv.name !== 'preprod', 'Collections QA : préprod uniquement');
  const c6 = collectionQa('C6');
  const c7 = collectionQa('C7');

  await etape(page, testInfo, `1. Collection vide ${c6.id} : la page s'affiche, sans produit ni erreur`, async () => {
    const reponse = await page.goto(`collections/${c6.handle}`, { waitUntil: 'domcontentloaded' });
    expect(reponse?.status(), 'La collection vide doit répondre (code 200)').toBe(200);
    await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toHaveText(new RegExp(c6.titre, 'i'));
    expect((await lireCartes(page)).length, 'Aucun produit').toBe(0);
    await expect(page.getByRole('main'), 'Pas de texte d\'erreur Shopify').not.toContainText(/Liquid error|translation missing/i);
    const message = page.getByRole('main').getByText(/no products|aucun produit|empty|vide/i);
    if (!(await message.count())) testInfo.annotations.push({ type: 'Constat 40', description: 'Aucun message n\'explique que la collection est vide (même chose en prod, ex. collections/limited-edition)' });
  });

  await etape(page, testInfo, `2. ${c7.id} (aucun produit achetable) filtrée « en stock » : 0 produit, sans erreur`, async () => {
    const reponse = await page.goto(`collections/${c7.handle}?filter.v.availability=1`, { waitUntil: 'domcontentloaded' });
    expect(reponse?.status()).toBe(200);
    await expect(filtresBouton(page), 'Le filtre doit être compté').toHaveText(/\(\s*1\s*\)/);
    expect((await lireCartes(page)).length, 'Aucun produit en stock dans cette collection').toBe(0);
    const message = page.getByRole('main').getByText(/no products|aucun produit|no results?|aucun résultat/i);
    if (!(await message.count())) testInfo.annotations.push({ type: 'Constat 40', description: 'Filtre sans résultat : grille vide, sans message ni proposition d\'enlever le filtre' });
  });
});
