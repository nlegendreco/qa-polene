import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import type { Page, TestInfo } from '@playwright/test';
import { expect } from './fixtures';

/**
 * Accessibilité relevée par axe (outil de Deque, celui des extensions de navigateur), en « cran » : l'équipe corrige
 * l'accessibilité du site au fil de l'eau (octobre 2026), sans liste à jour de ce qui doit déjà marcher. On ne juge
 * donc pas la page sur une liste écrite à la main :
 * - chaque page a son relevé de référence (references/accessibilite/<page>/<projet>.json, versionné) : les types de
 *   problème (règles axe) encore présents à ce moment-là, avec leur nombre ;
 * - un problème du relevé encore là : noté dans le rapport (« en cours de correction »), jamais en échec ;
 * - un problème du relevé qui a disparu : noté « corrigé », à enregistrer avec `npm run test:accessibilite:maj` ;
 *   une fois enregistré, s'il revient, le test échoue ;
 * - un type de problème absent du relevé : échec (régression, ou problème nouveau sur la page).
 *
 * Règles WCAG 2.1 niveaux A et AA (la base du RGAA), textes d'axe en français. axe lit la page sans s'en servir :
 * il ne voit qu'une partie des problèmes (pas l'utilisation au clavier, l'ordre de lecture, les textes mal choisis).
 */

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

/**
 * Zones exclues : contenu de tiers qui change d'un passage à l'autre et que l'équipe ne maîtrise pas. Bulle du chat
 * Zendesk ; photos Instagram de l'accueil (Instafeed, changent à chaque post, parfois absentes en préprod).
 */
const EXCLUS = ['iframe#launcher', '.instagram'];

/** axe en français : sa traduction (axe-core/locales/fr.json) est appliquée avant chaque analyse. */
const SOURCE_AXE = `${readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8')};axe.configure({ locale: ${readFileSync(require.resolve('axe-core/locales/fr.json'), 'utf8')} });`;

const IMPACT: Record<string, string> = { critical: 'critique', serious: 'grave', moderate: 'moyen', minor: 'mineur' };

interface Probleme {
  /** Règle axe (button-name, color-contrast…). */
  regle: string;
  impact: string;
  /** Ce que demande la règle, en français. */
  aide: string;
  /** Éléments de la page concernés. */
  nombre: number;
}

interface Releve {
  page: string;
  projet: string;
  /** Jour du relevé, ou de son dernier resserrage. */
  date: string;
  problemes: Probleme[];
}

/** Mise à jour du relevé : `1` enregistre les corrections (le relevé ne fait que rétrécir), `tout` accepte aussi les nouveaux problèmes. */
const MAJ = process.env.ACCESSIBILITE_MAJ;

function cheminReleve(page: string, projet: string): string {
  return join(__dirname, '..', 'references', 'accessibilite', page, `${projet.replace(/ /g, '-')}.json`);
}

function ligne(p: Probleme, avant?: number): string {
  const evolution = avant === undefined || avant === p.nombre ? '' : ` (${avant} au relevé)`;
  return `${p.aide} [${p.regle}, ${p.impact}] : ${p.nombre} élément${p.nombre > 1 ? 's' : ''}${evolution}`;
}

/**
 * Analyse la page telle qu'elle est affichée et la compare à son relevé. `cle` : dossier du relevé
 * (references/accessibilite/<cle>/), un par page testée. `zone` : sélecteur de la partie analysée (une section),
 * la page entière sinon.
 */
export async function verifierAccessibilite(page: Page, testInfo: TestInfo, cle: string, zone?: string) {
  const axe = new AxeBuilder({ page, axeSource: SOURCE_AXE }).withTags(TAGS).exclude(EXCLUS);
  if (zone) axe.include(zone);
  const resultats = await axe.analyze();
  const problemes: Probleme[] = resultats.violations.map(v => ({
    regle: v.id,
    impact: IMPACT[v.impact ?? ''] ?? 'inconnu',
    aide: v.help,
    nombre: v.nodes.length,
  })).sort((a, b) => a.regle.localeCompare(b.regle));

  // Détail lisible : chaque problème, avec les premiers éléments concernés et ce qu'axe leur reproche.
  const detail = resultats.violations.map(v => [
    `■ ${v.help} [${v.id}, ${IMPACT[v.impact ?? ''] ?? 'inconnu'}], ${v.nodes.length} élément(s)`,
    `  ${v.helpUrl}`,
    ...v.nodes.slice(0, 5).flatMap(n => [
      `  - ${n.target.join(' ')}`,
      `    ${n.html.replace(/\s+/g, ' ').slice(0, 200)}`,
      ...(n.failureSummary ?? '').split('\n').filter(Boolean).map(l => `      ${l.trim()}`),
    ]),
    ...(v.nodes.length > 5 ? [`  … et ${v.nodes.length - 5} autre(s)`] : []),
  ].join('\n'));
  // Points qu'axe n'a pas pu trancher seul (contraste d'un texte posé sur une photo…) : à regarder à la main, sans échec.
  const aVerifier = resultats.incomplete.filter(v => TAGS.some(t => v.tags.includes(t)))
    .map(v => `- ${v.help} [${v.id}] : ${v.nodes.length} élément(s)`);
  await testInfo.attach('♿ accessibilité, détail axe', {
    contentType: 'text/plain',
    body: [
      detail.length ? detail.join('\n\n') : 'Aucun problème relevé par axe sur cette page.',
      ...(aVerifier.length ? ['', 'À vérifier à la main (axe ne peut pas trancher, pas compté dans le relevé) :', ...aVerifier] : []),
    ].join('\n'),
  });

  const fichier = cheminReleve(cle, testInfo.project.name);
  const releve: Releve | null = existsSync(fichier) ? JSON.parse(readFileSync(fichier, 'utf8')) : null;
  const connus = new Map((releve?.problemes ?? []).map(p => [p.regle, p]));
  const nouveaux = problemes.filter(p => !connus.has(p.regle));
  const enCours = problemes.filter(p => connus.has(p.regle));
  const corriges = [...connus.values()].filter(p => !problemes.some(q => q.regle === p.regle));

  if (MAJ && (!releve || corriges.length || nouveaux.length && MAJ === 'tout' || enCours.some(p => p.nombre !== connus.get(p.regle)!.nombre))) {
    // Premier relevé : la page telle qu'elle est. Ensuite, le relevé ne fait que rétrécir, sauf accord explicite (tout).
    const garde = !releve || MAJ === 'tout' ? problemes : enCours;
    mkdirSync(dirname(fichier), { recursive: true });
    writeFileSync(fichier, `${JSON.stringify({ page: cle, projet: testInfo.project.name, date: new Date().toISOString().slice(0, 10), problemes: garde } satisfies Releve, null, 2)}\n`);
    testInfo.annotations.push({ type: 'Relevé d\'accessibilité', description: releve ? `mis à jour : ${corriges.length} correction(s) enregistrée(s)${MAJ === 'tout' ? `, ${nouveaux.length} nouveau(x) problème(s) accepté(s)` : ''}` : `premier relevé, ${problemes.length} type(s) de problème` });
    if (!releve || MAJ === 'tout') return;
  }

  if (!releve) {
    expect(releve, `Pas de relevé d'accessibilité pour cette page (${fichier.split('references/')[1]}) : lancer « npm run test:accessibilite:maj »`).not.toBeNull();
    return;
  }
  testInfo.annotations.push({ type: 'Relevé d\'accessibilité', description: `du ${releve.date}, ${releve.problemes.length} type(s) de problème connu(s)` });
  if (enCours.length) {
    testInfo.annotations.push({ type: 'Accessibilité, en cours de correction', description: enCours.map(p => ligne(p, connus.get(p.regle)!.nombre)).join(' ; ') });
  }
  if (corriges.length) {
    testInfo.annotations.push({ type: 'Accessibilité, corrigé depuis le relevé', description: `${corriges.map(p => `${p.aide} [${p.regle}]`).join(' ; ')}. Pour que ça reste corrigé : « npm run test:accessibilite:maj »` });
  }
  expect.soft(nouveaux.map(p => ligne(p)), `Problème(s) d'accessibilité absent(s) du relevé du ${releve.date} : régression d'un point corrigé, ou nouveau problème sur la page (détail dans « ♿ accessibilité, détail axe »)`).toEqual([]);
}
