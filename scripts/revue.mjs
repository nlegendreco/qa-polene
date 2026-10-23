// Revue des tests par la QA (npm run revue, demande du 22 octobre 2026) : une fiche par test, avec ce qu'il vérifie,
// son dernier résultat sur chaque appareil, et l'avis de la QA (utile ou non, pourquoi il échoue, commentaire).
// Les avis sont enregistrés dans data/revue-tests.json (versionné) : c'est la liste de travail des corrections.
// Servi par scripts/ouvrir-rapport.mjs, qui sert aussi les rapports (liens vers le détail de chaque résultat).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { PROJET, derniersResultats as tousLesDerniers, listerTests } from './resultats.mjs';

const FICHIER_AVIS = path.join(PROJET, 'data', 'revue-tests.json');

export const PERTINENCES = {
  utile: 'Utile, à garder',
  modifier: 'À modifier',
  retirer: 'Inutile, à retirer',
};
export const CAUSES = {
  'bug-site': 'Bug du site',
  'changement-voulu': 'Changement voulu du site',
  'test-faux': 'Le test se trompe',
  instable: 'Instable',
  'ne-sait-pas': 'Je ne sais pas',
};

// Type de test (comme le catalogue « par type ») d'après les étiquettes.
const TYPES = [
  ['@journey', 'Parcours'], ['@controles', 'Contrôles des pages'], ['@accessibilite', 'Accessibilité'],
  ['@structure', 'Structure des pages'], ['@donnees', 'Données préprod'], ['@visuel', 'Tests visuels'],
];
const typeDe = etiquettes => TYPES.find(([e]) => etiquettes.includes(e))?.[1] ?? 'Fonctionnel';
const PAGES = ['@home', '@plp', '@pdp', '@cart', '@checkout', '@search', '@account', '@content', '@sections', '@journey'];

/**
 * Dernier résultat de chaque test sur chaque projet, toutes séries confondues (lancements rangés et essais archivés
 * compris : un lancement de la prod seule range le précédent, qui garde les résultats de la préprod).
 */
function derniersResultats(racine) {
  const resultats = new Map();
  for (const [cle, { test: t, date, serie, url }] of tousLesDerniers(racine)) {
    const essai = t.essais.at(-1);
    resultats.set(cle, {
      statut: t.statut,
      date,
      serie,
      lien: `${url}#/test/${encodeURIComponent(t.id)}`,
      erreur: essai?.erreurs[0]?.resume ?? '',
      raison: t.statut === 'ignore' ? t.annotations.find(a => a.type === 'skip')?.description ?? '' : '',
      constats: t.annotations.filter(a => /^Constat/.test(a.type)).map(a => `${a.type} : ${a.description}`),
      etapes: (essai?.etapes ?? []).filter(e => e.categorie === 'test.step').map(e => e.titre),
    });
  }
  return resultats;
}

/** Commentaire écrit au-dessus du test (ou au-dessus de la boucle qui le déclare) : ce que le test vérifie et pourquoi. */
function commentaireAuDessus(lignes, index) {
  let i = index - 1;
  // Test déclaré dans une boucle ou un groupe : le commentaire est au-dessus de la boucle.
  while (i >= 0 && /^\s*(for \(|pourChaqueFiche\(|test\.describe\()/.test(lignes[i])) i--;
  const bloc = [];
  for (; i >= 0 && /^\s*(\/\/|\/\*\*?|\*)/.test(lignes[i]); i--) bloc.unshift(lignes[i]);
  return bloc.map(l => l.replace(/^\s*(\/\*\*?|\*\/|\*|\/\/)\s?/, '').replace(/\*\/\s*$/, '').trim())
    .filter(Boolean).join(' ');
}

/** Commentaire d'en-tête du fichier (premier bloc `/** … *\/` avant le premier test) : le contexte commun à ses tests. */
function contexteDuFichier(lignes) {
  const premierTest = lignes.findIndex(l => /^\s*(test|pourChaqueFiche)\(|^\s*for \(/.test(l));
  const debut = lignes.findIndex(l => /^\s*\/\*\*/.test(l));
  if (debut < 0 || (premierTest >= 0 && debut > premierTest)) return '';
  const fin = lignes.findIndex((l, i) => i >= debut && /\*\//.test(l));
  return commentaireAuDessus(lignes, fin + 1);
}

/** Libellés des étapes écrits dans le code du test (`etape(page, testInfo, '…'`), quand il n'a jamais été joué. */
function etapesDuCode(lignes, index) {
  const retrait = lignes[index].match(/^\s*/)[0].length;
  const etapes = [];
  for (let i = index + 1; i < lignes.length; i++) {
    const ligne = lignes[i];
    if (ligne.trim() && ligne.match(/^\s*/)[0].length <= retrait && /^\s*\}/.test(ligne)) break;
    const etape = ligne.match(/etape\(\s*\w+\s*,\s*\w+\s*,\s*(['"`])((?:\\.|(?!\1).)*)\1/);
    if (etape) etapes.push(etape[2].replace(/\\'/g, '\'').replace(/\$\{[^}]*\}/g, '…'));
  }
  return etapes;
}

/** Avis de la QA et analyses écrites avant la revue (champ `analyses` : cause probable d'un échec, constat connu…). */
function lireFichier() {
  const contenu = existsSync(FICHIER_AVIS) ? JSON.parse(readFileSync(FICHIER_AVIS, 'utf8')) : {};
  return { avis: contenu.avis ?? {}, analyses: contenu.analyses ?? {} };
}

/** Tests regroupés par nom (un test = toutes ses exécutions, par environnement et appareil), avec résultats et avis. */
export function donneesRevue(racineResultats) {
  const liste = listerTests();
  const resultats = derniersResultats(racineResultats);
  const sources = new Map();
  const source = fichier => {
    if (!sources.has(fichier)) sources.set(fichier, readFileSync(path.join(PROJET, fichier), 'utf8').split('\n'));
    return sources.get(fichier);
  };
  const tests = new Map();
  for (const t of liste) {
    if (!tests.has(t.titre)) {
      const lignes = source(t.fichier);
      tests.set(t.titre, {
        titre: t.titre,
        type: typeDe(t.etiquettes),
        pages: t.etiquettes.filter(e => PAGES.includes(e)),
        etiquettes: t.etiquettes,
        fichier: t.fichier,
        ligne: t.ligne,
        description: commentaireAuDessus(lignes, t.ligne - 1),
        contexte: contexteDuFichier(lignes),
        etapesCode: etapesDuCode(lignes, t.ligne - 1),
        executions: [],
      });
    }
    const r = resultats.get(`${t.projet} › ${t.titre}`);
    tests.get(t.titre).executions.push({ projet: t.projet, ...(r ?? { statut: 'jamais' }) });
  }
  const { avis, analyses } = lireFichier();
  return [...tests.values()].map(t => {
    const joues = t.executions.filter(e => e.statut !== 'jamais' && e.statut !== 'ignore');
    const etapes = joues.find(e => e.etapes?.length)?.etapes ?? t.etapesCode;
    const etat = !joues.length ? 'jamais'
      : joues.some(e => e.statut === 'echec' || e.statut === 'interrompu') ? 'echec'
        : joues.some(e => e.statut === 'instable') ? 'instable' : 'reussi';
    return { ...t, etapes, etat, analyse: analyses[t.titre] ?? '', avis: avis[t.titre] ?? null };
  });
}

/** Enregistre l'avis de la QA sur un test (appelé par la page, POST /revue/avis). */
export function enregistrerAvis(corps, titresConnus) {
  const { titre, pertinence = '', cause = '', commentaire = '', etat = '' } = corps;
  if (!titresConnus.has(titre)) throw new Error('Test inconnu');
  if (pertinence && !(pertinence in PERTINENCES)) throw new Error('Avis inconnu');
  if (cause && !(cause in CAUSES)) throw new Error('Cause inconnue');
  const contenu = existsSync(FICHIER_AVIS) ? JSON.parse(readFileSync(FICHIER_AVIS, 'utf8')) : {
    _note: 'Revue des tests par la QA (npm run revue). Une entrée par test (nom du Rapport Polène) : pertinence '
      + `(${Object.keys(PERTINENCES).join(', ')}), cause d'un échec (${Object.keys(CAUSES).join(', ')}), commentaire, `
      + 'état du test au moment de l\'avis. `analyses` : première analyse d\'un échec, écrite avant la revue et affichée '
      + 'sur la fiche du test.',
    avis: {},
  };
  if (!pertinence && !cause && !commentaire.trim()) {
    delete contenu.avis[titre];
  } else {
    contenu.avis[titre] = {
      pertinence, cause, commentaire: String(commentaire).slice(0, 4000), etat, date: new Date().toISOString(),
    };
  }
  contenu.avis = Object.fromEntries(Object.entries(contenu.avis).sort(([a], [b]) => a.localeCompare(b, 'fr')));
  writeFileSync(FICHIER_AVIS, `${JSON.stringify(contenu, null, 2)}\n`);
  return contenu.avis[titre] ?? null;
}
