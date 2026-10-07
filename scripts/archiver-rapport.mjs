// Conserve les derniers rapports (Rapport Polène et rapport Playwright de chaque série, s'ils existent)
// dans archives/<date>-<nom>/. Les dossiers gardent leur nom pour que les liens entre les deux rapports marchent.
// Usage : npm run archiver -- poc1
import { cpSync, existsSync, readdirSync, rmSync } from 'node:fs';

const nom = process.argv[2] ?? 'rapport';
const date = new Date().toISOString().slice(0, 10);
const dossier = `archives/${date}-${nom}`;

const rapports = readdirSync('.')
  .filter((d) => /^(rapport-polene|playwright-report)[\w-]*$/.test(d) && existsSync(`${d}/index.html`))
  .sort();

if (rapports.length === 0) {
  console.error('Aucun rapport à archiver : lancer les tests d\'abord.');
  process.exit(1);
}

rmSync(dossier, { recursive: true, force: true });
for (const source of rapports) {
  cpSync(source, `${dossier}/${source}`, { recursive: true });
  console.log(`✔ ${source} → ${dossier}/${source}`);
}
console.log(`\nPour ouvrir un Rapport Polène archivé : npm run rapport:polene -- ${dossier}/rapport-polene`);
console.log(`Rapport Playwright archivé : npx playwright show-report ${dossier}/playwright-report`);
