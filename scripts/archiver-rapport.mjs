// Conserve les derniers rapports de chaque série (Rapport Polène et rapport Playwright) dans archives/<date>-<nom>/,
// avec la même organisation que resultats/ (un dossier par série). Les fichiers bruts (test-results/) ne sont pas
// copiés : les deux rapports contiennent déjà captures, vidéos et traces.
// Usage : npm run archiver -- poc
import { cpSync, existsSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';

const nom = process.argv[2] ?? 'rapport';
const date = new Date().toISOString().slice(0, 10);
const dossier = `archives/${date}-${nom}`;
const A_COPIER = ['rapport-polene', 'playwright-report', 'historique.json'];

const series = existsSync('resultats')
  ? readdirSync('resultats').filter(serie => existsSync(path.join('resultats', serie, 'rapport-polene', 'index.html'))).sort()
  : [];

if (series.length === 0) {
  console.error('Aucun rapport à archiver : lancer les tests d\'abord.');
  process.exit(1);
}

rmSync(dossier, { recursive: true, force: true });
for (const serie of series) {
  for (const element of A_COPIER) {
    const source = path.join('resultats', serie, element);
    if (existsSync(source)) cpSync(source, path.join(dossier, serie, element), { recursive: true });
  }
  console.log(`✔ ${serie} → ${dossier}/${serie}`);
}
console.log(`\nPour ouvrir l'archive : npm run rapport:polene -- ${dossier}`);
