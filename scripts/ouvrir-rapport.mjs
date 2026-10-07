// Ouvre un Rapport Polène dans le navigateur, servi en local (nécessaire pour la trace Playwright).
// Usage : npm run rapport:polene              → rapport-polene/ (parcours et non-régression)
//         npm run rapport:polene -- visuel    → rapport-polene-visuel/
//         npm run rapport:polene -- archives/2026-10-06-poc2/rapport-polene-visuel
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { exec } from 'node:child_process';
import path from 'node:path';

const argument = process.argv[2] ?? '';
const dossier = path.resolve(existsSync(argument) ? argument : argument ? `rapport-polene-${argument}` : 'rapport-polene');

if (!existsSync(path.join(dossier, 'index.html'))) {
  console.error(`Pas de rapport dans ${path.relative(process.cwd(), dossier) || dossier} : lancer les tests d'abord.`);
  process.exit(1);
}

// On sert le dossier parent pour que le lien « Rapport Playwright » (dossier voisin) fonctionne,
// mais seulement les dossiers de rapports : rien d'autre du projet (.env…) n'est accessible.
const parent = path.dirname(dossier);
const DOSSIERS_AUTORISES = /^(rapport-polene|playwright-report)[\w-]*$/;

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.webm': 'video/webm', '.zip': 'application/zip', '.txt': 'text/plain; charset=utf-8', '.md': 'text/markdown; charset=utf-8',
  '.ttf': 'font/ttf', '.webmanifest': 'application/manifest+json',
};

const serveur = createServer((requete, reponse) => {
  const chemin = decodeURIComponent(new URL(requete.url, 'http://localhost').pathname);
  let fichier = path.join(parent, chemin);
  const relatif = path.relative(parent, fichier);
  const premier = relatif.split(path.sep)[0];
  if (relatif.startsWith('..') || path.isAbsolute(relatif) || !DOSSIERS_AUTORISES.test(premier)) {
    reponse.writeHead(403).end('Interdit');
    return;
  }
  if (existsSync(fichier) && statSync(fichier).isDirectory()) fichier = path.join(fichier, 'index.html');
  if (!existsSync(fichier)) { reponse.writeHead(404).end('Introuvable'); return; }

  const taille = statSync(fichier).size;
  const type = TYPES[path.extname(fichier)] ?? 'application/octet-stream';
  // Les vidéos se lisent par morceaux (Safari l'exige pour pouvoir avancer dans la vidéo).
  const plage = requete.headers.range?.match(/bytes=(\d*)-(\d*)/);
  if (plage) {
    const debut = plage[1] ? Number(plage[1]) : 0;
    const fin = plage[2] ? Number(plage[2]) : taille - 1;
    reponse.writeHead(206, { 'Content-Type': type, 'Content-Range': `bytes ${debut}-${fin}/${taille}`, 'Accept-Ranges': 'bytes', 'Content-Length': fin - debut + 1 });
    createReadStream(fichier, { start: debut, end: fin }).pipe(reponse);
    return;
  }
  reponse.writeHead(200, { 'Content-Type': type, 'Content-Length': taille, 'Accept-Ranges': 'bytes' });
  createReadStream(fichier).pipe(reponse);
});

// PORT=9555 pour un port fixe, OUVRIR=0 pour ne pas ouvrir le navigateur (CI, contrôle automatique).
serveur.listen(Number(process.env.PORT ?? 0), '127.0.0.1', () => {
  const adresse = `http://127.0.0.1:${serveur.address().port}/${encodeURIComponent(path.basename(dossier))}/`;
  console.log(`Rapport Polène : ${adresse}  (Ctrl+C pour arrêter)`);
  if (process.env.OUVRIR !== '0') exec(`open "${adresse}"`);
});
