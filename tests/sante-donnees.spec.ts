import type { Page } from '@playwright/test';
import { test, expect, etape } from '../src/fixtures';
import { formatCents } from '../src/price';
import { DONNEES_QA, HANDLES_CHERCHABLES, HANDLES_QA, PRODUITS_FIXES, contenuCollectionQa, type EtatProduit } from '../src/produits-fixes';
import { appelShopify } from '../src/shopify';

/**
 * Santé des données préprod (roadmap phase 1.5) : avant le TNR, on vérifie que chaque produit fixe
 * est toujours dans l'état prévu. Si quelqu'un a remis en stock le produit en rupture, ce test le dit
 * (« P04 Rupture totale n'est plus en rupture ») au lieu de laisser échouer un test du panier sans explication.
 *
 * Préprod uniquement, sur un seul navigateur (projet « preprod · donnees ») : ce sont les données qui sont
 * vérifiées, pas l'affichage sur chaque appareil. Aucun ajout au panier, aucune commande.
 */

/**
 * Ce que le bouton principal de la fiche doit montrer pour chaque état : valeurs de data-state posées par le thème
 * et libellé (FR ou EN). Deux versions de la fiche coexistent depuis le 7 octobre 2026 : l'ancienne (submit, modal
 * « Choose your size ») et la nouvelle déployée ce jour-là en préprod (active, inactive avec menu « Select size »,
 * preorder). Retirer les anciennes valeurs quand la nouvelle fiche sera en prod.
 */
const BOUTON_ATTENDU: Record<EtatProduit, { states: string[]; libelle: RegExp; enClair: string }> = {
  'en-stock': { states: ['active', 'submit'], libelle: /Add to (cart|bag)|Ajouter au panier/i, enClair: 'en stock (« Ajouter au panier »)' },
  'tailles': { states: ['inactive', 'modal'], libelle: /Add to (cart|bag)|Ajouter au panier|Choose your size|Choisi\w* (votre|une) taille/i, enClair: 'choix de taille (bouton inactif tant qu\'aucune taille n\'est choisie)' },
  'rupture': { states: ['disabled'], libelle: /Notify me|Être prévenu/i, enClair: 'rupture (« Être prévenu(e) »)' },
  'coming-soon': { states: ['coming-soon'], libelle: /Coming soon|Bientôt/i, enClair: 'coming soon (« Coming soon — Sign up »)' },
  'precommande': { states: ['preorder', 'submit'], libelle: /Pre-?order|Précommand/i, enClair: 'précommande (« Précommander »)' },
};

/** Délai sous lequel une précommande doit être repoussée : elle expire seule à sa date. */
const PRECOMMANDE_JOURS_MINIMUM = 30;

const MOIS: Record<string, number> = {
  janvier: 0, fevrier: 1, mars: 2, avril: 3, mai: 4, juin: 5, juillet: 6, aout: 7, septembre: 8, octobre: 9, novembre: 10, decembre: 11,
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5, july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
};

/** « Shipping on novembre, 15 » ou « Expédition le 15 novembre » → date (sans année affichée : la prochaine à venir). */
function lireDateExpedition(texte: string): Date | null {
  const sansAccents = texte.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const mois = Object.keys(MOIS).find(m => sansAccents.includes(m));
  const jour = sansAccents.match(/\b(\d{1,2})\b/)?.[1];
  if (mois === undefined || !jour) return null;
  const aujourdhui = new Date();
  const date = new Date(aujourdhui.getFullYear(), MOIS[mois], Number(jour));
  if (date < aujourdhui) date.setFullYear(date.getFullYear() + 1);
  return date;
}

interface ProduitJson {
  title: string;
  tags: string[];
  options: { name: string }[];
  variants: { option1: string; available: boolean; price: number }[];
}

/** État montré par le bouton principal de la fiche (le premier visible : le thème en a un second, collant). */
async function lireBouton(page: Page) {
  const bouton = page.getByRole('main').locator('.cta-primary-add-to-cart:visible').first();
  await expect(bouton, 'La fiche doit afficher son bouton principal (ajout au panier, précommande, alerte…)').toBeVisible();
  return {
    state: await bouton.getAttribute('data-state') ?? '',
    // Texte affiché seulement : le bouton contient aussi « Added to cart », caché tant qu'on n'a rien ajouté.
    libelle: (await bouton.innerText()).replace(/\s+/g, ' ').trim(),
  };
}

function etatAffiche(bouton: { state: string; libelle: string }): string {
  const etat = (Object.entries(BOUTON_ATTENDU) as [EtatProduit, typeof BOUTON_ATTENDU[EtatProduit]][])
    .find(([, b]) => b.states.includes(bouton.state) && b.libelle.test(bouton.libelle));
  return etat ? etat[1].enClair : `« ${bouton.libelle} » (état ${bouton.state || 'inconnu'})`;
}

for (const produit of PRODUITS_FIXES) {
  const nom = `${produit.id} ${produit.role}`;

  test(`Données · ${nom} @donnees`, async ({ page }, testInfo) => {
    testInfo.annotations.push({ type: 'Produit fixe', description: `${nom} : ${produit.handle}` });
    let json!: ProduitJson;

    await etape(page, testInfo, '1. Ouvrir la fiche produit', async () => {
      const reponse = await page.goto(`products/${produit.handle}`, { waitUntil: 'load' });
      expect(reponse?.status(), `${nom} : la fiche ${produit.handle} n'existe plus ou n'est plus publiée en préprod (code ${reponse?.status()})`).toBe(200);
    });

    await etape(page, testInfo, '2. Vérifier le produit dans le catalogue', async () => {
      const reponse = await appelShopify(page, `La lecture du produit ${produit.handle}`, () => page.request.get(`products/${produit.handle}.js`));
      json = await reponse.json() as ProduitJson;
      const prixMinimum = Math.min(...json.variants.map(v => v.price));
      testInfo.annotations.push({ type: 'Catalogue', description: `${json.title} · ${formatCents(prixMinimum)} · ${json.variants.filter(v => v.available).length}/${json.variants.length} variante(s) disponible(s)` });

      if (produit.tailles) {
        const tailles = new Map(json.variants.map(v => [v.option1, v.available]));
        const manquantes = [...produit.tailles.disponibles, ...produit.tailles.indisponibles].filter(t => !tailles.has(t));
        const plusDisponibles = produit.tailles.disponibles.filter(t => tailles.get(t) === false);
        const redevenuesDisponibles = produit.tailles.indisponibles.filter(t => tailles.get(t) === true);
        expect.soft(manquantes, `${nom} : tailles qui n'existent plus sur le produit : ${manquantes.join(', ')}`).toEqual([]);
        expect.soft(plusDisponibles, `${nom} : tailles qui devraient être disponibles mais sont épuisées : ${plusDisponibles.join(', ')}`).toEqual([]);
        expect.soft(redevenuesDisponibles, `${nom} : tailles qui devraient être épuisées mais sont de nouveau en stock : ${redevenuesDisponibles.join(', ')}`).toEqual([]);
      } else if (produit.etat === 'rupture') {
        expect.soft(json.variants.some(v => v.available), `${nom} n'est plus en rupture : il est de nouveau achetable`).toBe(false);
      } else {
        expect.soft(json.variants.some(v => v.available), `${nom} n'a plus de stock : aucune variante n'est achetable`).toBe(true);
      }
      if (produit.nouveaute !== undefined) {
        expect.soft(json.tags.includes('LABEL:NEW'), `${nom} : le tag LABEL:NEW (étiquette « Nouveauté ») ${produit.nouveaute ? 'a été retiré' : 'a été ajouté'}`).toBe(produit.nouveaute);
      }
      if (produit.tags) {
        const enTrop = json.tags.filter(t => !produit.tags!.includes(t));
        const manquants = produit.tags.filter(t => !json.tags.includes(t));
        expect.soft(enTrop, `${nom} : tag(s) en trop, ajouté(s) par quelqu'un ou par une automatisation : ${enTrop.join(', ')}. Il peut entrer dans de vraies collections. Remise en état : npm run donnees:qa`).toEqual([]);
        expect.soft(manquants, `${nom} : tag(s) retiré(s) : ${manquants.join(', ')}. Remise en état : npm run donnees:qa`).toEqual([]);
      }
      if (produit.prixMaximumEuros !== undefined) {
        expect.soft(prixMinimum, `${nom} : le prix (${formatCents(prixMinimum)}) dépasse ${produit.prixMaximumEuros} €`).toBeLessThanOrEqual(produit.prixMaximumEuros * 100);
      }
    });

    await etape(page, testInfo, '3. Vérifier l\'état affiché sur la fiche', async () => {
      const attendu = BOUTON_ATTENDU[produit.etat];
      const bouton = await lireBouton(page);
      const conforme = attendu.states.includes(bouton.state) && attendu.libelle.test(bouton.libelle);
      expect.soft(conforme, `${nom} : la fiche devrait afficher l'état ${attendu.enClair}, elle affiche ${etatAffiche(bouton)}`).toBe(true);

      if (produit.etat === 'precommande') {
        const mention = page.getByRole('main').getByText(/Shipping on|Expédition (le|à partir du)/i).first();
        await expect.soft(mention, `${nom} : la date d'expédition de la précommande n'est pas affichée`).toBeVisible();
        const texte = (await mention.textContent().catch(() => null))?.trim() ?? '';
        const date = lireDateExpedition(texte);
        if (date) {
          const jours = Math.round((date.getTime() - Date.now()) / 86_400_000);
          testInfo.annotations.push({ type: 'Précommande', description: `${texte} : expédition dans ${jours} jours` });
          expect.soft(jours, `${nom} : la précommande expire dans ${jours} jours (${texte}). Elle s'arrête seule à cette date : repousser la date dans l'admin préprod`).toBeGreaterThanOrEqual(PRECOMMANDE_JOURS_MINIMUM);
        } else if (texte) {
          testInfo.annotations.push({ type: 'Précommande', description: `Date illisible : « ${texte} »` });
        }
      }

      if (produit.colorisMinimum !== undefined) {
        // Nouvelle fiche : carrousel de vignettes « Cyme Mini - Textured Camel, 1 of 24 ». Ancienne : bouton « Explore all (24) ».
        // Seules les vignettes à l'écran sont accessibles : on lit le total annoncé par la première.
        const vignette = page.getByRole('main').getByRole('link', { name: /,\s*\d+\s+(of|sur)\s+\d+$/i }).first();
        const nomVignette = await vignette.getAttribute('aria-label', { timeout: 5_000 }).catch(() => null) ?? '';
        let coloris = Number(nomVignette.match(/(\d+)$/)?.[1] ?? 0);
        if (!coloris) {
          const decouvrir = page.getByRole('main').getByRole('button', { name: /^(Explore all|Découvrir tout)\s*\(\d+\)/i }).first();
          const libelle = await decouvrir.textContent({ timeout: 5_000 }).catch(() => '') ?? '';
          coloris = Number(libelle.match(/\((\d+)\)/)?.[1] ?? 0);
        }
        testInfo.annotations.push({ type: 'Coloris', description: `${coloris} coloris proposés` });
        expect.soft(coloris, `${nom} : la fiche doit proposer au moins ${produit.colorisMinimum} coloris (${coloris} trouvés)`).toBeGreaterThanOrEqual(produit.colorisMinimum);
      }
    });
  });
}

/** Produits par page de collection (thème Polène). */
const PRODUITS_PAR_PAGE = 48;

/** Handles des produits liés depuis la page (cartes de collection, résultats de recherche). */
async function handlesAffiches(page: Page): Promise<string[]> {
  const liens = await page.getByRole('main').locator('a[href*="/products/"]').evaluateAll(as => as.map(a => a.getAttribute('href') ?? ''));
  return [...new Set(liens.map(l => l.split('/products/')[1]?.split(/[?#/]/)[0] ?? '').filter(Boolean))];
}

for (const collection of DONNEES_QA.collections) {
  const nom = `${collection.id} ${collection.titre}`;

  test(`Données · ${nom} @donnees`, async ({ page }, testInfo) => {
    testInfo.annotations.push({ type: 'Collection QA', description: `${nom} : collections/${collection.handle}` });
    // Par tag (automatique) ou liste fixe (manuelle) : la collection doit montrer ces produits QA, et eux seuls.
    const attendus = contenuCollectionQa(collection);

    await etape(page, testInfo, '1. Ouvrir la collection', async () => {
      const reponse = await page.goto(`collections/${collection.handle}`, { waitUntil: 'load' });
      expect(reponse?.status(), `${nom} : la collection ${collection.handle} n'existe plus ou n'est plus publiée en préprod (code ${reponse?.status()}). Remise en état : npm run donnees:qa`).toBe(200);
    });

    await etape(page, testInfo, '2. Vérifier les produits affichés', async () => {
      const affiches = await handlesAffiches(page);
      testInfo.annotations.push({ type: 'Produits', description: `${affiches.length} produit(s) : ${affiches.join(', ')}` });
      // Au-delà d'une page (48 produits), seule la première page est affichée : on vérifie qu'elle est pleine.
      const surPlusieursPages = attendus.length > PRODUITS_PAR_PAGE;
      const manquants = surPlusieursPages ? [] : attendus.filter(h => !affiches.includes(h));
      const enTrop = affiches.filter(h => !attendus.includes(h));
      if (surPlusieursPages) {
        expect.soft(affiches.length, `${nom} : la première page devrait montrer ${PRODUITS_PAR_PAGE} des ${attendus.length} produits, elle en montre ${affiches.length}`).toBe(PRODUITS_PAR_PAGE);
      }
      expect.soft(manquants, `${nom} : produit(s) QA absent(s) de la collection : ${manquants.join(', ')}. Tag qa-fixture retiré ou produit dépublié ? Remise en état : npm run donnees:qa`).toEqual([]);
      expect.soft(enTrop, `${nom} : produit(s) qui n'ont rien à faire dans la collection QA : ${enTrop.join(', ')}. Quelqu'un leur a mis le tag qa-fixture ?`).toEqual([]);
    });
  });
}

test('Données · Produits QA cachés de la recherche @donnees', async ({ page }, testInfo) => {
  // Les produits QA sont cachés de la recherche (seo.hidden) : un client ou un collègue de la préprod ne doit pas tomber dessus.
  // Sauf le produit dédié à la recherche (QA22 « Searchable »).
  for (const recherche of ['QA', 'QA Numéro', 'QA Filler']) {
    await etape(page, testInfo, `Chercher « ${recherche} »`, async () => {
      await page.goto(`search?q=${encodeURIComponent(recherche)}&type=product`, { waitUntil: 'load' });
      const trouves = (await handlesAffiches(page)).filter(h => HANDLES_QA.includes(h) && !HANDLES_CHERCHABLES.includes(h));
      expect.soft(trouves, `Produit(s) QA visible(s) en cherchant « ${recherche} » : ${trouves.join(', ')}. Le réglage « caché de la recherche » a sauté. Remise en état : npm run donnees:qa`).toEqual([]);
    });
  }
  for (const handle of HANDLES_CHERCHABLES) {
    await etape(page, testInfo, `Chercher « Searchable »`, async () => {
      await page.goto(`search?q=Searchable&type=product`, { waitUntil: 'load' });
      expect.soft(await handlesAffiches(page), `La recherche « Searchable » doit trouver ${handle}, le produit QA visible dans la recherche`).toContain(handle);
    });
  }
});
