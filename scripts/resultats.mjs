// Derniers résultats connus de chaque test, toutes séries confondues : resultats/ (lancements rangés compris) et les
// essais archivés (archives/essais-*/, 23 octobre 2026 : sortis du sommaire, gardés comme source de résultats).
// Utilisé par le sommaire du Rapport Polène (cartes assemblées, scripts/ouvrir-rapport.mjs) et par la revue des tests.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

export const PROJET = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const RESULTATS = path.join(PROJET, 'resultats');
const ARCHIVES = path.join(PROJET, 'archives');

/**
 * Dossiers lus, avec l'adresse sous laquelle le serveur les sert : la racine servie, et pour resultats/ seulement,
 * les essais archivés (servis sous /archives/<nom>/).
 */
export function sourcesDeResultats(racine) {
  const sources = [{ dossier: racine, url: '/' }];
  if (path.resolve(racine) === RESULTATS && existsSync(ARCHIVES)) {
    for (const nom of readdirSync(ARCHIVES).filter(n => /^essais-/.test(n)).sort()) {
      sources.push({ dossier: path.join(ARCHIVES, nom), url: `/archives/${nom}/` });
    }
  }
  return sources;
}

/** Dossier d'archive d'essais servi sous /archives/<nom>/, ou null si le chemin demandé n'en est pas un. */
export function archiveServie(racine, chemin) {
  const m = chemin.match(/^\/archives\/(essais-[^/]+)(\/.*)?$/);
  if (!m) return null;
  const source = sourcesDeResultats(racine).find(s => s.url === `/archives/${m[1]}/`);
  return source ? { dossier: source.dossier, reste: m[2] ?? '/' } : null;
}

// Lecture des donnees.js gardée en mémoire tant que le fichier ne change pas (le sommaire relit tout à chaque visite).
const cache = new Map();
export function lireRapport(fichier) {
  const date = statSync(fichier).mtimeMs;
  const deja = cache.get(fichier);
  if (deja?.date === date) return deja.R;
  const texte = readFileSync(fichier, 'utf8');
  const R = JSON.parse(texte.slice(texte.indexOf('{'), texte.lastIndexOf('}') + 1));
  cache.set(fichier, { date, R });
  return R;
}

/** Tous les rapports d'une source : dernier lancement et lancements rangés de chaque série. */
function rapports(source) {
  if (!existsSync(source.dossier)) return [];
  return readdirSync(source.dossier).flatMap(serie => {
    const lancements = path.join(source.dossier, serie, 'lancements');
    return [
      `${serie}/rapport-polene`,
      ...(existsSync(lancements) ? readdirSync(lancements).map(nom => `${serie}/lancements/${nom}`) : []),
    ].filter(dossier => existsSync(path.join(source.dossier, dossier, 'donnees.js')))
      .map(dossier => ({ serie, fichier: path.join(source.dossier, dossier, 'donnees.js'), url: `${source.url}${dossier.split('/').map(encodeURIComponent).join('/')}/` }));
  });
}

/**
 * Dernier résultat de chaque test sur chaque projet (clé « projet › titre ») : le plus récent l'emporte, même ignoré
 * (un test ignoré ne tourne pas sur cet appareil, ou plus sur cette fiche). `url` : adresse du rapport du lancement.
 */
export function derniersResultats(racine) {
  const resultats = new Map();
  for (const source of sourcesDeResultats(racine)) {
    for (const { serie, fichier, url } of rapports(source)) {
      const R = lireRapport(fichier);
      for (const test of R.tests) {
        if (test.projet.endsWith('connexion')) continue;
        const cle = `${test.projet} › ${test.titre}`;
        const deja = resultats.get(cle);
        if (deja && deja.date > R.lancement.date) continue;
        resultats.set(cle, { test, date: R.lancement.date, serie, url, playwright: R.playwright });
      }
    }
  }
  return resultats;
}

/** Liste des tests telle que Playwright la voit (visuels compris, démos exclues), par le rapporteur src/rapport/liste.ts. */
export function listerTests() {
  const dossier = mkdtempSync(path.join(tmpdir(), 'liste-'));
  const sortie = path.join(dossier, 'liste.json');
  try {
    execFileSync('npx', ['playwright', 'test', '--list', '--reporter=./src/rapport/liste.ts'], {
      cwd: PROJET, stdio: 'ignore', env: { ...process.env, VISUEL: '1', LISTE_TESTS: sortie },
    });
    return JSON.parse(readFileSync(sortie, 'utf8')).filter(t => !t.projet.endsWith('connexion'));
  } finally {
    rmSync(dossier, { recursive: true, force: true });
  }
}
