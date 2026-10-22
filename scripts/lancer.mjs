// Lance une entrée des catalogues de data/catalogue.json : par type de test ou par page.
// Usage : npm run type -- accessibilite        → un type de test (série resultats/accessibilite/)
//         npm run page -- pdp                  → tout ce qui touche une page (série resultats/page-pdp/)
//         npm run page -- pdp --project "prod · iphone"   → options Playwright ajoutées après le nom
//         npm run catalogue                    → les deux catalogues
// Un type qui crée des commandes de test en préprod (tnr, parcours) demande « oui » d'abord (ou --oui).
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createInterface } from 'node:readline/promises';

const PROJET = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const catalogue = JSON.parse(readFileSync(path.join(PROJET, 'data', 'catalogue.json'), 'utf8'));
const [genre, cle, ...options] = process.argv.slice(2);

function afficher(genres = ['type', 'page']) {
  const largeur = Math.max(...[...catalogue.types, ...catalogue.pages].map(e => e.cle.length)) + 2;
  if (genres.includes('type')) {
    console.log('\nPar type de test : npm run type -- <nom>\n');
    for (const t of catalogue.types) {
      console.log(`  ${t.cle.padEnd(largeur)}${t.nom} : ${t.description}${t.commandesPreprod ? '  ⚠ crée 4 commandes de test en préprod' : ''}`);
    }
  }
  if (genres.includes('page')) {
    console.log('\nPar page (tous les types de test de la page, sans visuel ni démo, aucune commande) : npm run page -- <nom>\n');
    for (const p of catalogue.pages) console.log(`  ${p.cle.padEnd(largeur)}${p.nom} (@${p.cle})`);
  }
  console.log('\nOptions Playwright possibles après le nom, par exemple : npm run page -- pdp --project "prod · iphone"\n');
}

if (!['type', 'page'].includes(genre)) {
  afficher();
  process.exit(0);
}
const liste = genre === 'type' ? catalogue.types : catalogue.pages;
const entree = liste.find(e => e.cle === cle);
if (!entree) {
  if (cle) console.error(`« ${cle} » n'est pas dans le catalogue par ${genre === 'type' ? 'type de test' : 'page'}.`);
  afficher([genre]);
  process.exit(cle ? 1 : 0);
}

const serie = genre === 'type' ? entree.cle : `page-${entree.cle}`;
const variables = { ...entree.variables, ...process.env, SERIE: serie };
const confirme = options.includes('--oui');
// Projets du catalogue limités aux environnements lancés (QA_ENVS=prod) : Playwright refuse un projet qui n'existe pas.
const envs = (variables.QA_ENVS ?? 'prod,preprod').split(',').map(e => e.trim());
const args = [
  'test',
  ...(genre === 'page' ? ['--grep', `@${entree.cle}\\b`] : []),
  ...(entree.grep ? ['--grep', entree.grep] : []),
  ...(entree.grepInvert ? ['--grep-invert', entree.grepInvert] : []),
  ...(entree.projets ?? []).filter(p => envs.includes(p.split(' · ')[0])).flatMap(p => ['--project', p]),
  ...(entree.options ?? []),
  ...options.filter(o => o !== '--oui'),
];

// Commandes de test : seulement si la préprod est dans le lancement (QA_ENVS, ou --project choisis à la main).
const projetsChoisis = options.filter((o, i) => options[i - 1] === '--project');
const avecPreprod = (variables.QA_ENVS ?? 'prod,preprod').includes('preprod')
  && (!projetsChoisis.length || projetsChoisis.some(p => p.startsWith('preprod')));
if (entree.commandesPreprod && avecPreprod && !confirme) {
  const lecteur = createInterface({ input: process.stdin, output: process.stdout });
  const reponse = (await lecteur.question(`« ${entree.nom} » passe des commandes de test en préprod (une par appareil). Taper « oui » pour continuer : `)).trim().toLowerCase();
  lecteur.close();
  if (reponse !== 'oui') {
    console.log('Rien lancé. Pour la prod seule : QA_ENVS=prod devant la commande.');
    process.exit(0);
  }
}

// Commande affichée dans le rapport : celle qu'on a tapée (npm run test:accessibilite reste npm run test:accessibilite).
const tape = process.env.npm_lifecycle_event;
const enClair = liste => liste.map(o => (/\s/.test(o) ? `"${o}"` : o)).join(' ');
const commande = tape && !['type', 'page', 'catalogue'].includes(tape)
  ? `npm run ${tape}${options.length ? ` -- ${enClair(options)}` : ''}`
  : `npm run ${genre} -- ${enClair([cle, ...options])}`;
console.log(`\n${entree.nom} · série « ${serie} » · ${commande}\n`);
const enfant = spawn(path.join(PROJET, 'node_modules', '.bin', 'playwright'), args, {
  cwd: PROJET,
  stdio: 'inherit',
  env: { ...variables, QA_COMMANDE: commande },
});
enfant.on('exit', code => process.exit(code ?? 1));
