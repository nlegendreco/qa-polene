import type { FullConfig, FullResult, Reporter, Suite, TestCase, TestError, TestResult, TestStep } from '@playwright/test/reporter';
import { createHash } from 'node:crypto';
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
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
 * Tout est rangé dans le dossier de la série (resultats/<série>/) : rapport-polene/, à côté de playwright-report/
 * et test-results/. L'historique (historique.json) est à côté du rapport, pour survivre à son remplacement.
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

const NOMS_RAPPORTS: Record<string, string> = {
  'tnr': 'Parcours et non-régression',
  'visuel': 'Tests visuels',
  'regressions': 'Démo · régressions injectées',
  'demo-echec': 'Démo · échec volontaire',
};

const EXTENSIONS: Record<string, string> = {
  'image/png': 'png', 'image/jpeg': 'jpg', 'video/webm': 'webm', 'application/zip': 'zip',
  'text/plain': 'txt', 'text/markdown': 'md', 'application/json': 'json', 'text/html': 'html',
};

/** Au-delà, une pièce jointe texte n'est pas recopiée dans la page (elle reste téléchargeable). */
const TEXTE_MAX = 200_000;
const HISTORIQUE_MAX = 40;

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
    // Sécurité : on ne remplace qu'un ancien Rapport Polène, jamais un autre dossier.
    if (existsSync(sortie) && !existsSync(path.join(sortie, 'donnees.js'))) {
      console.error(`Rapport Polène non écrit : le dossier ${path.relative(racine, sortie)} existe et ne contient pas de rapport Polène.`);
      return;
    }
    rmSync(sortie, { recursive: true, force: true });
    mkdirSync(path.join(sortie, 'donnees'), { recursive: true });

    const tests = this.suite.allTests().map(test => this.convertirTest(test, sortie, racine));
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
      titre: NOMS_RAPPORTS[this.serie] ?? this.serie,
      genereLe: new Date().toISOString(),
      lancement,
      environnements: envs.map(e => environments[e as keyof typeof environments]?.label ?? e),
      appareils: [...new Set(tests.map(t => t.appareil))],
      playwright: this.config.version,
      workers: this.config.workers,
      reessais: Math.max(...this.config.projects.map(p => p.retries), 0),
      commande: process.env.npm_lifecycle_event ? `npm run ${process.env.npm_lifecycle_event}` : 'npx playwright test',
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

    console.log(`\n  Rapport Polène : npm run rapport:polene -- ${this.serie}\n`);
  }

  private convertirTest(test: TestCase, sortie: string, racine: string): Test {
    const projet = test.parent.project();
    const nomProjet = projet?.name ?? '';
    const [envNom, appareilCle] = nomProjet.split(' · ');
    const titre = test.title.replace(/\s*@[\w-]+/g, '').trim();
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

function empreinte(valeur: string | Buffer): string {
  return createHash('sha1').update(valeur).digest('hex').slice(0, 10);
}
