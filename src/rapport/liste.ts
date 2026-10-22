import type { Reporter, Suite } from '@playwright/test/reporter';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { titreDuTest } from './reporter';

/**
 * Liste des tests pour la revue (npm run revue) : lancé avec `--list`, il écrit dans LISTE_TESTS un fichier JSON avec,
 * pour chaque test, son nom (le même que dans le Rapport Polène), ses étiquettes, son fichier et ses projets.
 */
export default class ListeTests implements Reporter {
  onBegin(_config: unknown, suite: Suite) {
    const sortie = process.env.LISTE_TESTS;
    if (!sortie) throw new Error('LISTE_TESTS : chemin du fichier à écrire manquant');
    const tests = suite.allTests().map(test => ({
      titre: titreDuTest(test),
      etiquettes: test.tags,
      fichier: path.relative(process.cwd(), test.location.file),
      ligne: test.location.line,
      projet: test.parent.project()?.name ?? '',
    }));
    writeFileSync(sortie, JSON.stringify(tests));
  }

  printsToStdio() {
    return false;
  }
}
