/** Données écrites par le rapporteur dans donnees.js et lues par la page (src/rapport/page/app.js). */

export type Statut = 'reussi' | 'echec' | 'instable' | 'ignore' | 'interrompu';

export interface Annotation {
  type: string;
  description: string;
}

export interface PieceJointe {
  nom: string;
  type: string;
  /** Chemin relatif au rapport (donnees/…), absent si le fichier n'existait plus. */
  chemin?: string;
  taille: number;
  /** Contenu des pièces jointes texte courtes, pour les afficher sans les ouvrir. */
  texte?: string;
}

export interface Erreur {
  /** Phrase principale, en français quand le test fournit son message. */
  resume: string;
  /** Traduction des détails de Playwright (pixels différents, attendu / obtenu…). */
  precisions: string[];
  message: string;
  extrait?: string;
  pile?: string;
  emplacement?: string;
}

export interface Etape {
  titre: string;
  categorie: string;
  /** Début, en millisecondes depuis le début de l'essai. */
  debut: number;
  duree: number;
  erreur?: string;
  /** Index des pièces jointes de l'essai. */
  pieces: number[];
  enfants: Etape[];
}

/** Captures attendue / obtenue / différence d'une comparaison visuelle (index des pièces jointes). */
export interface Comparaison {
  nom: string;
  attendu?: number;
  obtenu?: number;
  difference?: number;
}

export interface Essai {
  numero: number;
  statut: 'passed' | 'failed' | 'timedOut' | 'skipped' | 'interrupted';
  duree: number;
  debut: string;
  erreurs: Erreur[];
  etapes: Etape[];
  pieces: PieceJointe[];
  comparaisons: Comparaison[];
  /** Index de la vidéo, -1 s'il n'y en a pas. */
  video: number;
  trace: boolean;
  sortie: string;
  erreursConsole: string;
}

export interface Test {
  id: string;
  /** Identifiant stable d'un lancement à l'autre : projet › titre. */
  cle: string;
  titre: string;
  etiquettes: string[];
  fichier: string;
  ligne: number;
  projet: string;
  env: string;
  appareil: string;
  statut: Statut;
  duree: number;
  annotations: Annotation[];
  categorie?: string;
  essais: Essai[];
}

export interface Lancement {
  id: string;
  date: string;
  duree: number;
  statut: string;
  totaux: Record<Statut, number>;
  /** Statut et durée de chaque test, par clé. */
  tests: Record<string, { s: Statut; d: number }>;
}

export interface DonneesRapport {
  titre: string;
  genereLe: string;
  lancement: Lancement;
  environnements: string[];
  appareils: string[];
  playwright: string;
  workers: number;
  reessais: number;
  commande: string;
  /** Chemin du rapport Playwright, relatif au Rapport Polène ; vide pour un lancement rangé (il n'est plus là). */
  rapportPlaywright: string;
  tests: Test[];
  historique: Lancement[];
  /** Date à laquelle les pièces jointes des tests réussis ont été retirées (lancement rangé de plus de 30 jours). */
  allege?: string;
}
