import type { FullConfig, FullResult, Reporter, Suite, TestCase, TestError, TestResult, TestStep } from '@playwright/test/reporter';
import { createHash } from 'node:crypto';
import {
  copyFileSync, cpSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { environments } from '../environments';
import type {
  Annotation, Comparaison, DonneesRapport, Erreur, Essai, Etape, Lancement, PieceJointe, Statut, Test,
} from './types';

/**
 * Rapport Polène : rapport HTML sur mesure, en français, aux couleurs de Polène.
 * Il reprend ce que montre le rapport Playwright (étapes, captures, vidéo, trace, comparaison visuelle,
 * essais successifs) et ajoute un tableau de bord avec l'historique des lancements.
 *
 * Tout est rangé dans le dossier de la série (resultats/<série>/) : rapport-polene/ (dernier lancement), à côté de
 * playwright-report/ et test-results/. L'historique (historique.json) est à côté du rapport. Chaque nouveau lancement
 * range le rapport précédent dans lancements/<date-heure>/ (demande QA du 20 octobre 2026 : garder les rapports pour
 * retrouver un bug ancien). Au-delà de 30 jours, un lancement rangé perd les pièces jointes de ses tests réussis
 * (captures surtout) ; les tests en échec restent complets. Les archives (npm run archiver) ne sont jamais allégées.
 */

const ANSI = /\u001b\[[0-9;]*m/g;
const nettoyer = (texte = '') => texte.replace(ANSI, '');

const APPAREILS: Record<string, string> = {
  'desktop-chrome': 'Chrome ordinateur',
  'desktop-safari': 'Safari ordinateur',
  'iphone': 'iPhone',
  'android': 'Android',
  'connexion': 'Connexion préprod',
  'donnees': 'Données préprod',
};

/** Titre du rapport d'une série : nom de l'entrée du catalogue (data/catalogue.json), sinon le nom de la série. */
function nomSerie(serie: string, racine: string): string {
  try {
    const catalogue = JSON.parse(readFileSync(path.join(racine, 'data', 'catalogue.json'), 'utf8')) as
      { types: { cle: string; nom: string }[]; pages: { cle: string; nom: string }[] };
    const type = catalogue.types.find(t => t.cle === serie);
    const page = catalogue.pages.find(p => `page-${p.cle}` === serie);
    return type?.nom ?? (page ? `Page · ${page.nom}` : serie);
  } catch {
    return serie;
  }
}

/**
 * Nom d'un test dans le rapport et dans l'historique (sans les étiquettes). Les tests déclarés pour chaque fiche du
 * Roll Out (`pourChaqueFiche`, groupes « Ancienne fiche » et « Nouvelle fiche ») portent le même nom : la fiche y est
 * ajoutée, sinon leurs résultats se mélangeaient dans l'historique (avant le 21 octobre 2026). Les autres groupes
 * servent seulement à ranger le code et n'entrent pas dans le nom.
 */
function titreDuTest(test: TestCase): string {
  const sansEtiquettes = (texte: string) => texte.replace(/\s*@[\w-]+/g, '').trim();
  const fiches: string[] = [];
  for (let groupe: Suite | undefined = test.parent; groupe?.type === 'describe'; groupe = groupe.parent) {
    if (/^(Ancienne|Nouvelle) fiche$/.test(groupe.title)) fiches.unshift(groupe.title);
  }
  return [...fiches, sansEtiquettes(test.title)].join(' › ');
}

const EXTENSIONS: Record<string, string> = {
  'image/png': 'png', 'image/jpeg': 'jpg', 'video/webm': 'webm', 'application/zip': 'zip',
  'text/plain': 'txt', 'text/markdown': 'md', 'application/json': 'json', 'text/html': 'html',
};

/** Au-delà, une pièce jointe texte n'est pas recopiée dans la page (elle reste téléchargeable). */
const TEXTE_MAX = 200_000;
const HISTORIQUE_MAX = 200;
/** Âge à partir duquel un lancement rangé perd les pièces jointes de ses tests réussis ou ignorés. */
const JOURS_COMPLETS = 30;

interface Options {
  /** Série lancée (tnr, visuel, regressions, demo-echec), qui donne le titre du rapport. */
  serie?: string;
  /** Dossier de la série, qui contient aussi playwright-report/ (voir playwright.config.ts). */
  dossier?: string;
}

export default class RapportPolene implements Reporter {
  private config!: FullConfig;
  private suite!: Suite;
  private debut = new Date();
  private readonly serie: string;
  private readonly dossierSerie: string;
  private compteur = 0;
  private copies = new Map<string, string>();

  constructor(options: Options = {}) {
    this.serie = options.serie ?? 'tnr';
    this.dossierSerie = options.dossier ?? `resultats/${this.serie}`;
  }

  printsToStdio() {
    return false;
  }

  onBegin(config: FullConfig, suite: Suite) {
    this.config = config;
    this.suite = suite;
    this.debut = new Date();
  }

  async onEnd(resultat: FullResult) {
    const racine = this.config.configFile ? path.dirname(this.config.configFile) : process.cwd();
    const serie = path.resolve(racine, this.dossierSerie);
    const sortie = path.join(serie, 'rapport-polene');
    // Aucun test joué (--list, filtre qui ne retient rien) : le dernier rapport et l'historique restent tels quels.
    if (this.suite.allTests().every(t => !t.results.length)) {
      console.log('\n  Aucun test joué : Rapport Polène inchangé.\n');
      return;
    }
    // Sécurité : on ne remplace qu'un ancien Rapport Polène, jamais un autre dossier.
    if (existsSync(sortie) && !existsSync(path.join(sortie, 'donnees.js'))) {
      console.error(`Rapport Polène non écrit : le dossier ${path.relative(racine, sortie)} existe et ne contient pas de rapport Polène.`);
      return;
    }
    ranger(sortie, path.join(serie, 'lancements'));
    rmSync(sortie, { recursive: true, force: true });
    mkdirSync(path.join(sortie, 'donnees'), { recursive: true });

    const tests = this.suite.allTests().map(test => this.convertirTest(test, sortie, racine));
    // Deux tests du même nom sur le même projet partageraient leur ligne d'historique (le second effacerait le premier).
    const vues = new Set<string>();
    const doublons = [...new Set(tests.filter(t => vues.size === vues.add(t.cle).size).map(t => t.cle))];
    if (doublons.length) console.warn(`\n  Rapport Polène : ${doublons.length} tests portent le même nom qu'un autre, leur historique se mélange :\n${doublons.slice(0, 10).map(c => `    ${c}`).join('\n')}`);
    const fichierHistorique = path.join(serie, 'historique.json');
    const historique = this.lireHistorique(fichierHistorique);

    const lancement: Lancement = {
      id: this.debut.toISOString(),
      date: this.debut.toISOString(),
      duree: resultat.duration,
      statut: resultat.status,
      totaux: compter(tests),
      tests: Object.fromEntries(tests.map(t => [t.cle, { s: t.statut, d: t.duree }])),
    };
    // Un lancement vide (aucun test retenu) n'entre pas dans l'historique.
    const nouvelHistorique = tests.length ? [...historique, lancement].slice(-HISTORIQUE_MAX) : historique;
    mkdirSync(path.dirname(fichierHistorique), { recursive: true });
    writeFileSync(fichierHistorique, JSON.stringify(nouvelHistorique));

    const envs = [...new Set(tests.map(t => t.env).filter(Boolean))];
    const donnees: DonneesRapport = {
      titre: nomSerie(this.serie, racine),
      genereLe: new Date().toISOString(),
      lancement,
      environnements: envs.map(e => environments[e as keyof typeof environments]?.label ?? e),
      appareils: [...new Set(tests.map(t => t.appareil))],
      playwright: this.config.version,
      workers: this.config.workers,
      reessais: Math.max(...this.config.projects.map(p => p.retries), 0),
      commande: process.env.QA_COMMANDE
        // npx se présente aussi comme un script npm (« npx ») : ce n'en est pas un.
        ?? (process.env.npm_lifecycle_event && process.env.npm_lifecycle_event !== 'npx' ? `npm run ${process.env.npm_lifecycle_event}` : 'npx playwright test'),
      rapportPlaywright: '../playwright-report',
      tests,
      historique: nouvelHistorique,
    };

    const page = path.join(__dirname, 'page');
    for (const fichier of ['app.css', 'app.js']) copyFileSync(path.join(page, fichier), path.join(sortie, fichier));
    // Logo Polène inséré dans la page : il prend la couleur du texte, ce qu'une image externe ne permet pas.
    const html = readFileSync(path.join(page, 'index.html'), 'utf8')
      .replace('<!-- logo -->', readFileSync(path.join(page, 'logo-polene.svg'), 'utf8'));
    writeFileSync(path.join(sortie, 'index.html'), html);
    writeFileSync(path.join(sortie, 'donnees.js'), `window.RAPPORT = ${JSON.stringify(donnees)};\n`);

    // Visualiseur de trace de Playwright, recopié comme le fait son propre rapport (il faut l'ouvrir par un serveur).
    if (tests.some(t => t.essais.some(e => e.trace))) {
      const require = createRequire(__filename);
      const visualiseur = path.join(path.dirname(require.resolve('playwright-core/package.json')), 'lib', 'vite', 'traceViewer');
      if (existsSync(visualiseur)) cpSync(visualiseur, path.join(sortie, 'trace'), { recursive: true });
    }

    alleger(path.join(serie, 'lancements'));
    console.log(`\n  Rapport Polène : npm run rapport:polene -- ${this.serie}\n`);
  }

  private convertirTest(test: TestCase, sortie: string, racine: string): Test {
    const projet = test.parent.project();
    const nomProjet = projet?.name ?? '';
    const [envNom, appareilCle] = nomProjet.split(' · ');
    const titre = titreDuTest(test);
    const fichier = path.relative(path.resolve(racine, 'tests'), test.location.file);
    const essais = test.results.map(r => this.convertirEssai(r, sortie));
    const dernier = essais.at(-1);
    const annotations = dedoublonner([
      ...test.annotations,
      ...test.results.flatMap(r => r.annotations ?? []),
    ].filter(a => a.type !== 'skip' || a.description).map(a => ({ type: a.type, description: a.description ?? '' })));

    return {
      id: test.id,
      cle: `${nomProjet} › ${titre}`,
      titre,
      etiquettes: test.tags,
      fichier,
      ligne: test.location.line,
      projet: nomProjet,
      env: envNom ?? '',
      appareil: APPAREILS[appareilCle] ?? appareilCle ?? nomProjet,
      statut: statutDe(test),
      duree: dernier?.duree ?? 0,
      annotations,
      categorie: categorieDe(test, essais),
      essais,
    };
  }

  private convertirEssai(resultat: TestResult, sortie: string): Essai {
    const pieces = resultat.attachments.map(a => this.convertirPiece(a, sortie));
    const index = new Map(resultat.attachments.map((a, i) => [a, i]));
    const parNom = new Map(resultat.attachments.map((a, i) => [a.name, i]));
    const etapes = resultat.steps
      .map(s => convertirEtape(s, resultat.startTime, index, parNom, 0))
      .filter((e): e is Etape => !!e);

    return {
      numero: resultat.retry + 1,
      statut: resultat.status,
      duree: resultat.duration,
      debut: resultat.startTime.toISOString(),
      erreurs: resultat.errors.map(convertirErreur),
      etapes,
      pieces,
      comparaisons: comparaisons(pieces),
      video: pieces.findIndex(p => p.type.startsWith('video/')),
      trace: pieces.some(p => p.nom === 'trace'),
      sortie: nettoyer(resultat.stdout.map(String).join('')).slice(0, TEXTE_MAX),
      erreursConsole: nettoyer(resultat.stderr.map(String).join('')).slice(0, TEXTE_MAX),
    };
  }

  /** Recopie la pièce jointe dans donnees/ (une seule fois par fichier) et garde le texte court pour l'afficher. */
  private convertirPiece(piece: TestResult['attachments'][number], sortie: string): PieceJointe {
    const type = piece.contentType;
    const extension = EXTENSIONS[type.split(';')[0]] ?? (path.extname(piece.path ?? '').slice(1) || 'bin');
    let contenu: Buffer | undefined;
    let chemin: string | undefined;
    let taille = 0;

    if (piece.path && existsSync(piece.path)) {
      taille = statSync(piece.path).size;
      chemin = this.copies.get(piece.path);
      if (!chemin) {
        chemin = `donnees/${++this.compteur}-${empreinte(piece.path)}.${extension}`;
        copyFileSync(piece.path, path.join(sortie, chemin));
        this.copies.set(piece.path, chemin);
      }
      if (type.startsWith('text/') && taille <= TEXTE_MAX) contenu = readFileSync(piece.path);
    } else if (piece.body) {
      taille = piece.body.length;
      chemin = `donnees/${++this.compteur}-${empreinte(piece.body)}.${extension}`;
      writeFileSync(path.join(sortie, chemin), piece.body);
      if (type.startsWith('text/') && taille <= TEXTE_MAX) contenu = piece.body;
    }

    return {
      nom: piece.name,
      type,
      chemin,
      taille,
      texte: contenu ? nettoyer(contenu.toString('utf8')) : undefined,
    };
  }

  private lireHistorique(fichier: string): Lancement[] {
    try {
      return JSON.parse(readFileSync(fichier, 'utf8')) as Lancement[];
    } catch {
      return [];
    }
  }
}

function convertirEtape(step: TestStep, debut: Date, index: Map<object, number>, parNom: Map<string, number>, profondeur: number): Etape | null {
  // Les « attach » sont déjà rattachés à leur étape ; on ne garde que les étapes utiles à la lecture.
  if (step.category === 'test.attach') return null;
  const pieces = [
    ...(step.attachments ?? []).map(a => index.get(a) ?? parNom.get(a.name)),
    // Repli : capture jointe par etape() sous le nom « 📸 <titre sans point> ».
    ...(step.category === 'test.step' ? [parNom.get(`📸 ${step.title.replace(/\./g, '')}`)] : []),
  ].filter((i): i is number => i !== undefined);

  return {
    titre: step.title,
    categorie: step.category,
    debut: step.startTime.getTime() - debut.getTime(),
    duree: step.duration,
    erreur: step.error ? resumer(nettoyer(step.error.message)) : undefined,
    pieces: [...new Set(pieces)],
    enfants: profondeur < 5
      ? step.steps.map(s => convertirEtape(s, debut, index, parNom, profondeur + 1)).filter((e): e is Etape => !!e).slice(0, 200)
      : [],
  };
}

function convertirErreur(erreur: TestError): Erreur {
  const message = nettoyer(erreur.message ?? erreur.value ?? '');
  return {
    resume: resumer(message),
    precisions: preciser(message),
    message,
    extrait: nettoyer(erreur.snippet),
    pile: nettoyer(erreur.stack),
    emplacement: erreur.location ? `${path.basename(erreur.location.file)}:${erreur.location.line}` : undefined,
  };
}

/** Première phrase utile du message : la nôtre (en français) quand il y en a une. */
function resumer(message: string): string {
  const lignes = message.replace(/^Error:\s*/, '').split('\n').map(l => l.trim()).filter(Boolean);
  const premiere = lignes[0] ?? '';
  const timeout = premiere.match(/Test timeout of (\d+)ms exceeded/);
  if (timeout) return `Le test a dépassé sa durée maximale (${Number(timeout[1]) / 1000} s)`;
  if (/^expect\(.+\)\.\w+\(.*\) failed$/.test(premiere)) return 'Une vérification a échoué';
  if (/snapshot doesn't exist/.test(premiere)) return 'Pas encore de référence visuelle pour cette page : la capture du jour a été enregistrée comme référence';
  return premiere;
}

/** Ce que Playwright dit en anglais, traduit en quelques lignes lisibles. */
function preciser(message: string): string[] {
  const precisions: string[] = [];
  const taille = message.match(/Expected an image (\d+)px by (\d+)px, received (\d+)px by (\d+)px/);
  if (taille) precisions.push(`La taille de la page a changé : ${taille[1]} × ${taille[2]} px attendus, ${taille[3]} × ${taille[4]} px obtenus`);
  const pixels = message.match(/(\d+) pixels \(ratio ([\d.]+) of all image pixels\) are different/);
  if (pixels) precisions.push(`${Number(pixels[1]).toLocaleString('fr-FR')} pixels différents (${Math.max(1, Math.round(Number(pixels[2]) * 100))} % de l'image)`);
  const attendu = message.match(/^\s*Expected(?: \(\w+\))?:\s*(.+)$/m);
  const obtenu = message.match(/^\s*Received(?: \(\w+\))?:\s*(.+)$/m);
  if (attendu && !taille) precisions.push(`Attendu : ${attendu[1].trim()}`);
  if (obtenu && !taille) precisions.push(`Obtenu : ${obtenu[1].trim()}`);
  const element = message.match(/^\s*Locator:\s*(.+)$/m);
  if (element) precisions.push(`Élément cherché : ${element[1].trim()}`);
  const attente = message.match(/Timeout:?\s*(\d+)ms/i) ?? message.match(/with timeout (\d+)ms/);
  if (attente && !/Test timeout/.test(message)) precisions.push(`Attente maximale : ${Number(attente[1]) / 1000} s`);
  if (/strict mode violation/.test(message)) {
    const nombre = message.match(/resolved to (\d+) elements/);
    precisions.push(`La recherche trouve ${nombre?.[1] ?? 'plusieurs'} éléments au lieu d'un seul`);
  }
  return precisions;
}

function statutDe(test: TestCase): Statut {
  switch (test.outcome()) {
    case 'expected': return 'reussi';
    case 'flaky': return 'instable';
    case 'skipped': return 'ignore';
    default: return test.results.at(-1)?.status === 'interrupted' ? 'interrompu' : 'echec';
  }
}

/** Raison d'un échec, pour les regrouper dans le tableau de bord. */
function categorieDe(test: TestCase, essais: Essai[]): string | undefined {
  const statut = statutDe(test);
  if (statut !== 'echec' && statut !== 'instable') return undefined;
  const essai = statut === 'instable' ? essais.find(e => e.statut !== 'passed') : essais.at(-1);
  const message = essai?.erreurs.map(e => e.message).join('\n') ?? '';
  if (/code 429|local_rate_limited/.test(message)) return 'Limite d\'appels Shopify (429)';
  if (/toHaveScreenshot|ne correspond plus à la référence|snapshot doesn't exist/.test(message)) return 'Écart visuel';
  if (/Test timeout|Timeout \d+ms exceeded|timed out/i.test(message)) return 'Délai dépassé';
  if (/net::|ERR_|ECONNRESET|socket hang up/.test(message)) return 'Problème réseau';
  if (/expect\(|Expected|toBe|toEqual|toHave|toBeVisible/.test(message)) return 'Vérification en échec';
  return 'Erreur technique';
}

function comparaisons(pieces: PieceJointe[]): Comparaison[] {
  const groupes = new Map<string, Comparaison>();
  pieces.forEach((piece, i) => {
    const m = piece.nom.match(/^(.*)-(expected|actual|diff)\.png$/);
    if (!m) return;
    const groupe = groupes.get(m[1]) ?? { nom: m[1] };
    groupe[({ expected: 'attendu', actual: 'obtenu', diff: 'difference' } as const)[m[2] as 'expected' | 'actual' | 'diff']] = i;
    groupes.set(m[1], groupe);
  });
  return [...groupes.values()];
}

function compter(tests: Test[]) {
  const totaux = { reussi: 0, echec: 0, instable: 0, ignore: 0, interrompu: 0 };
  for (const t of tests) totaux[t.statut]++;
  return totaux;
}

function dedoublonner(annotations: Annotation[]): Annotation[] {
  const vues = new Set<string>();
  return annotations.filter(a => {
    const cle = `${a.type}|${a.description}`;
    if (vues.has(cle)) return false;
    vues.add(cle);
    return true;
  });
}

// ---------- Lancements rangés (resultats/<série>/lancements/<date-heure>/) ----------

function lireDonnees(dossier: string): DonneesRapport | undefined {
  try {
    const texte = readFileSync(path.join(dossier, 'donnees.js'), 'utf8');
    return JSON.parse(texte.slice(texte.indexOf('{'), texte.lastIndexOf('}') + 1)) as DonneesRapport;
  } catch {
    return undefined;
  }
}

function ecrireDonnees(dossier: string, donnees: DonneesRapport) {
  writeFileSync(path.join(dossier, 'donnees.js'), `window.RAPPORT = ${JSON.stringify(donnees)};\n`);
}

/** « 2026-10-20_14h05m32 », heure de Paris : nom du dossier d'un lancement rangé. */
function nomLancement(iso: string): string {
  const p = Object.fromEntries(new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(iso)).map(x => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}_${p.hour}h${p.minute}m${p.second}`;
}

/**
 * Range le rapport du lancement précédent dans lancements/ avant qu'il soit remplacé. Son rapport Playwright, lui,
 * est remplacé par Playwright : le lien disparaît du rapport rangé. Un rapport sans aucun test joué n'est pas gardé.
 */
function ranger(rapport: string, lancements: string) {
  const donnees = existsSync(rapport) ? lireDonnees(rapport) : undefined;
  if (!donnees) return;
  const { reussi, echec, instable, interrompu } = donnees.lancement.totaux;
  if (!(reussi + echec + instable + interrompu)) return;
  const cible = path.join(lancements, nomLancement(donnees.lancement.date));
  if (existsSync(cible)) return;
  mkdirSync(lancements, { recursive: true });
  ecrireDonnees(rapport, { ...donnees, rapportPlaywright: '' });
  renameSync(rapport, cible);
}

/**
 * Lancements rangés de plus de JOURS_COMPLETS jours : les tests réussis ou ignorés perdent leurs pièces jointes
 * (captures d'étape, textes joints) ; les tests en échec, instables ou interrompus gardent tout (captures, vidéo,
 * trace). Le statut et la durée de chaque test restent. Fait une fois par lancement (champ `allege`).
 */
function alleger(lancements: string) {
  if (!existsSync(lancements)) return;
  const limite = Date.now() - JOURS_COMPLETS * 24 * 3600 * 1000;
  for (const nom of readdirSync(lancements)) {
    const dossier = path.join(lancements, nom);
    const date = nom.match(/^(\d{4})-(\d{2})-(\d{2})_(\d{2})h(\d{2})/);
    if (!date || new Date(`${date[1]}-${date[2]}-${date[3]}T${date[4]}:${date[5]}:00`).getTime() > limite) continue;
    const donnees = lireDonnees(dossier);
    if (!donnees || donnees.allege) continue;
    const gardes = new Set<string>();
    const retires = new Set<string>();
    for (const test of donnees.tests) {
      const complet = !['reussi', 'ignore'].includes(test.statut);
      for (const piece of test.essais.flatMap(e => e.pieces)) {
        if (!piece.chemin) continue;
        if (complet) {
          gardes.add(piece.chemin);
        } else {
          retires.add(piece.chemin);
          piece.chemin = undefined;
          piece.texte = undefined;
        }
      }
    }
    for (const chemin of retires) if (!gardes.has(chemin)) rmSync(path.join(dossier, chemin), { force: true });
    donnees.allege = new Date().toISOString();
    ecrireDonnees(dossier, donnees);
  }
}

function empreinte(valeur: string | Buffer): string {
  return createHash('sha1').update(valeur).digest('hex').slice(0, 10);
}
