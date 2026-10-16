import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { Page, TestInfo } from '@playwright/test';
import { expect } from './fixtures';

/**
 * Références de structure (phase 2.5) : pour chaque page, la liste de ses titres, boutons et liens, et pour le site
 * les liens et boutons de l'en-tête et du pied de page. Comparée à la référence de la page
 * (references/structure/<cle>/<projet>.json, versionnée) : un lien disparu, un bouton renommé ou un titre en plus
 * font échouer le test, même quand le visuel change peu. Un changement voulu se reprend avec
 * `npm run test:structure:maj` (accord QA, comme les références visuelles ; l'ancienne version reste dans Git).
 *
 * Ce qui change sans que personne ne touche au site n'est pas relevé : cartes produit (stocks, nouveautés), cartes
 * d'articles (chargées au défilement, nouveaux articles),
 * diapositives des carrousels (créées à l'approche de l'écran), recommandations, photos Instagram ; prix (taux de
 * change de la préprod), nombres entre parenthèses et nombres de produits, compteurs du panier et des favoris ;
 * fenêtre de géolocalisation de la préprod.
 */

/** Zones dont le contenu change seul : rien n'y est relevé. */
const ZONES_VARIABLES = [
  '.component-product-card', '.component-carousel__slide', 'product-recommendations', '[id*="product_recommendations"]',
  '.instagram', 'iframe', '.bis-product-card', 'bis-product-card',
  // Cartes d'articles des blogs et de La Maison : chargées page par page au défilement (blog-articles?cursor=…).
  '.all-articles__card',
  // Fenêtre de géolocalisation de la préprod : là ou non selon le moment où elle s'ouvre (fermée par src/fixtures.ts).
  'theme-geo-suggestion', '[data-ref="theme-store-redirect-modal"]',
];

export interface Lien {
  texte: string;
  lien: string;
}

export interface Structure {
  titres?: string[];
  boutons: string[];
  liens: Lien[];
}

interface Reference extends Structure {
  page: string;
  projet: string;
  date: string;
}

/**
 * Relève la structure de la page affichée. `zone` : `contenu` (dans `main`), `en-tete` ou `pied-de-page`.
 * Éléments masqués (`display: none`, version mobile ou ordinateur cachée) ignorés ; menus et fenêtres fermés comptés
 * (ils sont dans la page, cachés autrement).
 */
export async function releverStructure(page: Page, zone: 'contenu' | 'en-tete' | 'pied-de-page'): Promise<Structure> {
  const racine = { 'contenu': 'main', 'en-tete': 'header', 'pied-de-page': 'footer' }[zone];
  return page.evaluate(({ racine, variables, avecTitres }) => {
    const base = document.querySelector(racine);
    if (!base) return { titres: [], boutons: [], liens: [] };
    const masquer = (t: string) => t
      .replace(/(€\s?\d[\d\s.,]*\d|\d[\d\s.,]*\s?€|\$\s?\d[\d.,]*\d|\d[\d.,]*\s?\$)/g, '<prix>')
      .replace(/\(\s*\d+\s*\)/g, '(N)')
      .replace(/•\s*\d+/g, '• N')
      .replace(/\b\d+\s+(produits?|products?|articles?|items?|résultats?|results?)\b/gi, 'N $1');
    const texte = (e: Element, nom = true) => masquer(((nom && e.getAttribute('aria-label')) || e.textContent || '').replace(/\s+/g, ' ').trim()).slice(0, 120);
    const retenu = (e: Element) => e.checkVisibility() && !e.closest(variables);
    const adresse = (a: HTMLAnchorElement) => {
      const brut = a.getAttribute('href') ?? '';
      if (brut.startsWith('#') || /^(mailto|tel|javascript):/.test(brut)) return brut;
      try {
        const u = new URL(brut, location.href);
        return u.host === location.host ? u.pathname : `${u.host}${u.pathname}`;
      } catch { return brut; }
    };
    const uniques = <T>(liste: T[], cle: (x: T) => string) => liste.filter((x, i) => liste.findIndex(y => cle(y) === cle(x)) === i);

    const titres = [...base.querySelectorAll('h1, h2, h3, h4')].filter(retenu).map(h => `${h.tagName.toLowerCase()} ${texte(h, false)}`).filter(t => t.length > 3);
    const boutons = uniques([...base.querySelectorAll('button, [role="button"], input[type="submit"]')].filter(retenu)
      .map(b => texte(b) || (b as HTMLInputElement).value || '(sans nom)'), b => b);
    const liens = uniques([...base.querySelectorAll<HTMLAnchorElement>('a[href]')].filter(retenu).map(a => {
      const lien = adresse(a);
      // Panier et favoris de l'en-tête : leur texte contient le nombre d'articles.
      const t = /\/(cart|pages\/wishlist)$/.test(lien) ? texte(a).replace(/\d+/g, 'N') : texte(a);
      return { texte: t || '(sans texte)', lien };
    }), l => `${l.texte} → ${l.lien}`);
    return avecTitres ? { titres, boutons, liens } : { boutons, liens };
  }, { racine, variables: ZONES_VARIABLES.join(', '), avecTitres: zone === 'contenu' });
}

/** Mise à jour des références : `STRUCTURE_MAJ=1` (avec l'accord de la QA). */
const MAJ = !!process.env.STRUCTURE_MAJ;

function cheminReference(cle: string, projet: string): string {
  return join(__dirname, '..', 'references', 'structure', cle, `${projet.replace(/ /g, '-')}.json`);
}

const lienTexte = (l: Lien) => `« ${l.texte} » → ${l.lien}`;

/** Écarts entre deux listes : éléments disparus, nouveaux, et ordre changé si les deux listes ont les mêmes éléments. */
function ecarts(avant: string[], apres: string[], ordre: boolean): string[] {
  const disparus = avant.filter(x => !apres.includes(x)).map(x => `disparu : ${x}`);
  const nouveaux = apres.filter(x => !avant.includes(x)).map(x => `nouveau : ${x}`);
  if (ordre && !disparus.length && !nouveaux.length && avant.join('\n') !== apres.join('\n')) return ['ordre changé'];
  return [...disparus, ...nouveaux];
}

/** Compare la structure relevée à la référence de la page `cle`, ou la reprend (STRUCTURE_MAJ). */
export async function verifierStructure(testInfo: TestInfo, cle: string, structure: Structure) {
  const fichier = cheminReference(cle, testInfo.project.name);
  const reference: Reference | null = existsSync(fichier) ? JSON.parse(readFileSync(fichier, 'utf8')) : null;
  const resume = `${structure.titres ? `${structure.titres.length} titre(s), ` : ''}${structure.boutons.length} bouton(s), ${structure.liens.length} lien(s)`;
  await testInfo.attach('🧱 structure relevée', {
    contentType: 'text/plain',
    body: [
      ...(structure.titres ? ['TITRES', ...structure.titres, ''] : []),
      'BOUTONS', ...structure.boutons, '',
      'LIENS', ...structure.liens.map(lienTexte),
    ].join('\n'),
  });

  if (MAJ || !reference) {
    if (!MAJ) {
      expect(reference, `Pas de référence de structure pour cette page (${fichier.split('references/')[1]}) : lancer « npm run test:structure:maj »`).not.toBeNull();
      return;
    }
    // Référence identique : on ne la réécrit pas (sa date reste celle du dernier vrai changement).
    if (reference && JSON.stringify({ titres: reference.titres, boutons: reference.boutons, liens: reference.liens })
      === JSON.stringify({ titres: structure.titres, boutons: structure.boutons, liens: structure.liens })) {
      testInfo.annotations.push({ type: 'Référence de structure', description: `inchangée depuis le ${reference.date}` });
      return;
    }
    mkdirSync(dirname(fichier), { recursive: true });
    writeFileSync(fichier, `${JSON.stringify({ page: cle, projet: testInfo.project.name, date: new Date().toISOString().slice(0, 10), ...structure } satisfies Reference, null, 2)}\n`);
    testInfo.annotations.push({ type: 'Référence de structure', description: `${reference ? 'reprise' : 'créée'} : ${resume}` });
    return;
  }

  testInfo.annotations.push({ type: 'Référence de structure', description: `du ${reference.date} ; relevé : ${resume}` });
  const message = (quoi: string) => `${quoi} différents de la référence du ${reference.date}. Changement voulu (MEP, nouveau contenu) : « npm run test:structure:maj » avec l'accord de la QA`;
  if (structure.titres) expect.soft(ecarts(reference.titres ?? [], structure.titres, true), message('Titres')).toEqual([]);
  expect.soft(ecarts(reference.boutons, structure.boutons, false), message('Boutons')).toEqual([]);
  expect.soft(ecarts(reference.liens.map(lienTexte), structure.liens.map(lienTexte), false), message('Liens')).toEqual([]);
}
