// Ouvre les Rapports Polène dans le navigateur, servis en local (nécessaire pour la trace Playwright).
// Usage : npm run rapport:polene              → sommaire de toutes les séries de resultats/, rangé comme les
//                                               catalogues (par type de test, par page), avec les lancements précédents
//         npm run rapport:polene -- visuel    → resultats/visuel/ (aussi : tnr, page-pdp…, une clé du catalogue)
//         npm run rapport:polene -- archives/2026-10-07-poc               → sommaire d'une archive
//         npm run rapport:polene -- archives/2026-10-07-poc/regressions   → une série de l'archive
//         npm run revue                       → revue des tests par la QA (scripts/revue.mjs), avec les rapports
import { createReadStream, existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { exec } from 'node:child_process';
import path from 'node:path';
import { CAUSES, PERTINENCES, donneesRevue, enregistrerAvis } from './revue.mjs';

const PROJET = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
// Sommaire rangé comme les catalogues de data/catalogue.json : par type de test, par page, puis les autres séries.
const catalogue = JSON.parse(readFileSync(path.join(PROJET, 'data', 'catalogue.json'), 'utf8'));
const ORDRE = [...catalogue.types.map(t => t.cle), ...catalogue.pages.map(p => `page-${p.cle}`)];
const estSerie = dossier => existsSync(path.join(dossier, 'rapport-polene', 'index.html'));
const lancementsRanges = serie => {
  const dossier = path.join(racine, serie, 'lancements');
  return existsSync(dossier)
    ? readdirSync(dossier).filter(nom => existsSync(path.join(dossier, nom, 'donnees.js'))).sort().reverse()
    : [];
};

// Racine servie (resultats/ ou une archive) et page à ouvrir : le sommaire, le rapport d'une série ou la revue.
const revue = process.argv[2] === '--revue';
const argument = revue ? '' : process.argv[2] ?? '';
let racine, serie = '';
if (!argument) {
  racine = path.join(PROJET, 'resultats');
} else if (!existsSync(argument) && estSerie(path.join(PROJET, 'resultats', argument))) {
  racine = path.join(PROJET, 'resultats');
  serie = argument;
} else {
  let dossier = path.resolve(argument);
  if (path.basename(dossier) === 'rapport-polene') dossier = path.dirname(dossier);
  if (estSerie(dossier)) {
    racine = path.dirname(dossier);
    serie = path.basename(dossier);
  } else {
    racine = dossier;
  }
}

const series = existsSync(racine)
  ? readdirSync(racine).filter(nom => estSerie(path.join(racine, nom)))
    .sort((a, b) => (ORDRE.indexOf(a) + 1 || 99) - (ORDRE.indexOf(b) + 1 || 99))
  : [];
if (!series.length) {
  console.error(`Pas de rapport dans ${path.relative(process.cwd(), racine) || racine} : lancer les tests d'abord.`);
  process.exit(1);
}
// Sécurité : on ne sert jamais le projet lui-même (.env, .auth…), seulement un dossier de résultats.
if (existsSync(path.join(racine, '.env')) || existsSync(path.join(racine, 'package.json'))) {
  console.error(`${racine} n'est pas un dossier de résultats.`);
  process.exit(1);
}

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.webm': 'video/webm', '.zip': 'application/zip', '.txt': 'text/plain; charset=utf-8', '.md': 'text/markdown; charset=utf-8',
  '.ttf': 'font/ttf', '.webmanifest': 'application/manifest+json',
};

const serveur = createServer((requete, reponse) => {
  const chemin = decodeURIComponent(new URL(requete.url, 'http://localhost').pathname);
  if (chemin === '/') {
    reponse.writeHead(200, { 'Content-Type': TYPES['.html'] }).end(sommaire());
    return;
  }
  if (revue && chemin.startsWith('/revue/')) {
    servirRevue(chemin, requete, reponse);
    return;
  }
  // Lancements précédents d'une série : page générée, une carte par lancement rangé.
  const precedents = chemin.match(/^\/([^/]+)\/lancements\/?$/);
  if (precedents && series.includes(precedents[1])) {
    reponse.writeHead(200, { 'Content-Type': TYPES['.html'] }).end(pageLancements(precedents[1]));
    return;
  }
  let fichier = path.join(racine, chemin);
  const relatif = path.relative(racine, fichier);
  if (relatif.startsWith('..') || path.isAbsolute(relatif)) {
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
  const adresse = `http://127.0.0.1:${serveur.address().port}/${revue ? 'revue/' : serie ? `${encodeURIComponent(serie)}/rapport-polene/` : ''}`;
  console.log(`${revue ? 'Revue des tests' : 'Rapport Polène'} : ${adresse}  (Ctrl+C pour arrêter)`);
  if (process.env.OUVRIR !== '0') exec(`open "${adresse}"`);
});

// ---------- Revue des tests (npm run revue) ----------

// Noms des tests de la dernière liste envoyée à la page : un avis n'est enregistré que pour un test connu.
let titresConnus = new Set();

function servirRevue(chemin, requete, reponse) {
  if (chemin === '/revue/' && requete.method === 'GET') {
    const choix = JSON.stringify({ pertinences: PERTINENCES, causes: CAUSES }).replace(/</g, '\\u003c');
    const fichier = nom => readFileSync(path.join(PROJET, 'src', 'rapport', 'revue', nom), 'utf8');
    const contenu = `
      <p class="aide">Pour chaque test : est-il utile, et s'il échoue, pourquoi. Les liens des résultats ouvrent le détail dans le Rapport Polène. Les avis servent ensuite de liste de travail : tests à retirer, à corriger, bugs à remonter.</p>
      <style>${fichier('revue.css')}</style>
      <div id="revue"></div>
      <script type="application/json" id="choix">${choix}</script>
      <script>${fichier('revue.js')}</script>`;
    reponse.writeHead(200, { 'Content-Type': TYPES['.html'] }).end(gabarit('Revue des tests', contenu, 'Revue des tests · Polène'));
    return;
  }
  if (chemin === '/revue/donnees.json' && requete.method === 'GET') {
    const tests = donneesRevue(racine);
    titresConnus = new Set(tests.map(t => t.titre));
    reponse.writeHead(200, { 'Content-Type': TYPES['.json'] }).end(JSON.stringify(tests));
    return;
  }
  if (chemin === '/revue/avis' && requete.method === 'POST') {
    let corps = '';
    requete.on('data', morceau => {
      corps += morceau;
      if (corps.length > 20_000) requete.destroy();
    });
    requete.on('end', () => {
      try {
        const avis = enregistrerAvis(JSON.parse(corps), titresConnus);
        reponse.writeHead(200, { 'Content-Type': TYPES['.json'] }).end(JSON.stringify(avis));
      } catch (erreur) {
        reponse.writeHead(400, { 'Content-Type': TYPES['.txt'] }).end(erreur.message);
      }
    });
    return;
  }
  reponse.writeHead(404).end('Introuvable');
}

// ---------- Sommaire : une carte par série, avec son verdict ----------

const esc = texte => String(texte ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const pluriel = (n, un, plusieurs) => `${n} ${n > 1 ? plusieurs : un}`;
const dateLongue = iso => new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const duree = ms => (ms < 60_000 ? `${Math.round(ms / 1000)} s` : `${Math.floor(ms / 60_000)} min ${String(Math.round((ms % 60_000) / 1000)).padStart(2, '0')}`);

/** Même verdict que le tableau de bord du rapport (src/rapport/page/app.js). */
function verdict(R) {
  const t = { reussi: 0, echec: 0, instable: 0, interrompu: 0, ignore: 0 };
  const demo = R.tests.length > 0 && R.tests.every(x => x.etiquettes.some(e => e === '@regressions' || e === '@demo-echec'));
  for (const x of R.tests) {
    const nonVerifie = demo && x.statut === 'echec' && !['Écart visuel', 'Vérification en échec'].includes(x.categorie);
    t[nonVerifie ? 'interrompu' : x.statut]++;
  }
  const executes = R.tests.length - t.ignore;
  if (!R.tests.length) return { statut: 'ignore', titre: 'Aucun test lancé' };
  if (demo) {
    const manques = t.reussi + t.instable;
    if (manques) return { statut: 'echec', titre: pluriel(manques, 'régression non détectée', 'régressions non détectées') };
    if (t.interrompu) return { statut: 'instable', titre: `${t.echec} / ${executes} détectées, ${pluriel(t.interrompu, 'non vérifiée', 'non vérifiées')}` };
    return { statut: 'reussi', titre: `${t.echec} / ${executes} ${R.tests[0].etiquettes.includes('@demo-echec') ? 'échecs détectés' : 'régressions détectées'}` };
  }
  if (t.echec + t.interrompu) return { statut: 'echec', titre: `${pluriel(t.echec + t.interrompu, 'test en échec', 'tests en échec')} sur ${executes}` };
  if (t.instable) return { statut: 'instable', titre: `${t.reussi + t.instable} / ${executes} réussis, ${pluriel(t.instable, 'au second essai', 'au second essai')}` };
  return { statut: 'reussi', titre: `${t.reussi} / ${executes} réussis` };
}

/** Carte d'un rapport : `dossier` est <série>/rapport-polene (dernier lancement) ou <série>/lancements/<date-heure>. */
function carte(dossier, { serie } = {}) {
  const texte = readFileSync(path.join(racine, dossier, 'donnees.js'), 'utf8');
  const R = JSON.parse(texte.slice(texte.indexOf('{'), texte.lastIndexOf('}') + 1));
  const { statut, titre } = verdict(R);
  const anciens = serie ? lancementsRanges(serie).length : 0;
  // Nom actuel du catalogue plutôt que celui gardé dans un rapport plus ancien que le catalogue.
  const type = catalogue.types.find(t => t.cle === serie);
  const page = catalogue.pages.find(p => `page-${p.cle}` === serie);
  R.titre = type?.nom ?? (page ? `Page · ${page.nom}` : R.titre);
  const commandes = R.tests.flatMap(t => t.annotations.filter(a => a.type === 'Commande de test')).length;
  const details = [
    R.environnements.join(', '),
    pluriel(R.appareils.filter(a => a !== 'Connexion préprod').length, 'appareil', 'appareils'),
    duree(R.lancement.duree),
    commandes ? pluriel(commandes, 'commande de test', 'commandes de test') : '',
  ].filter(Boolean).map(detail => `<span>${esc(detail)}</span>`).join(' · ');
  const lien = `/${dossier.split('/').map(encodeURIComponent).join('/')}/`;
  return `
    <div class="carte carte--${statut}">
      <a class="carte__lien" href="${lien}">
        <span class="capitales">${esc(R.titre)}</span>
        <strong class="verdict"><span class="puce" aria-hidden="true"></span>${esc(titre)}</strong>
        <span class="details">${details}</span>
        <span class="date">${esc(dateLongue(R.lancement.date))}${R.allege ? ' · captures des tests réussis retirées' : ''}</span>
      </a>
      ${anciens ? `<a class="carte__anciens" href="/${encodeURIComponent(serie)}/lancements/">${pluriel(anciens, 'lancement précédent', 'lancements précédents')} ›</a>` : ''}
    </div>`;
}

function sommaire() {
  const groupes = [
    { titre: 'Par type de test', aide: 'npm run type -- <nom>', series: series.filter(s => catalogue.types.some(t => t.cle === s)) },
    { titre: 'Par page', aide: 'npm run page -- <nom>', series: series.filter(s => catalogue.pages.some(p => `page-${p.cle}` === s)) },
    { titre: 'Autres séries', aide: 'essais (SERIE=…) et anciennes séries', series: series.filter(s => !ORDRE.includes(s)) },
  ].filter(g => g.series.length);
  const contenu = groupes.map(g => `
    <section>
      <h2>${esc(g.titre)} <span class="capitales">${esc(g.aide)}</span></h2>
      <div class="grille">${g.series.map(s => carte(`${s}/rapport-polene`, { serie: s })).join('')}</div>
    </section>`).join('');
  return gabarit(titreRacine(), contenu);
}

function pageLancements(serie) {
  const derniers = [`${serie}/rapport-polene`, ...lancementsRanges(serie).map(nom => `${serie}/lancements/${nom}`)];
  const texte = readFileSync(path.join(racine, serie, 'rapport-polene', 'donnees.js'), 'utf8');
  const nom = JSON.parse(texte.slice(texte.indexOf('{'), texte.lastIndexOf('}') + 1)).titre;
  const contenu = `
    <p><a href="/">‹ Sommaire</a></p>
    <p class="aide">Le plus récent en premier. Après 30 jours, un lancement garde ses tests en échec complets (captures, vidéo, trace) et seulement le statut de ses tests réussis.</p>
    <div class="grille">${derniers.map(d => carte(d)).join('')}</div>`;
  return gabarit(`${nom} · tous les lancements`, contenu);
}

function titreRacine() {
  // Archive nommée <date>-<nom> par npm run archiver : « Archive poc · 7 octobre 2026 ».
  const archive = path.basename(racine).match(/^(\d{4}-\d{2}-\d{2})-(.+)$/);
  return path.basename(racine) === 'resultats' ? 'Derniers lancements'
    : archive ? `Archive ${archive[2]} · ${new Date(`${archive[1]}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`
    : path.basename(racine);
}

function gabarit(titre, contenu, onglet = 'Sommaire QA · Polène') {
  const logo = readFileSync(path.join(PROJET, 'src', 'rapport', 'page', 'logo-polene.svg'), 'utf8');
  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(onglet)}</title>
  <link rel="icon" href="https://www.polene-paris.com/cdn/shop/files/polene-favicon.png?crop=center&height=32&width=32">
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600&family=Jost:wght@400;500&display=swap">
  <style>
    @font-face { font-family: 'Polène Primary'; src: url('https://www.polene-paris.com/cdn/shop/t/34/assets/canelaweb-light.woff2') format('woff2'); font-weight: 300; }
    :root { --ok: #0f8060; --instable: #c98a14; --echec: #d92e50; --ignore: #b3b3b3; --gris: #757575; --trait: rgba(0,0,0,.1); }
    * { box-sizing: border-box; }
    body { margin: 0; background: #fff; color: #000; font: 500 18px/1.35 'Cormorant Garamond', Georgia, serif; font-variant-numeric: lining-nums; -webkit-font-smoothing: antialiased; }
    header { border-bottom: 1px solid var(--trait); padding: 20px 16px; text-align: center; }
    header .logo { display: block; width: 143px; height: 29px; margin: 0 auto; }
    main { max-width: 1232px; margin: 0 auto; padding: 40px 16px 64px; }
    h1 { font: 300 clamp(30px, 4vw, 46px)/1.05 'Polène Primary', 'Cormorant Garamond', serif; margin: 0 0 8px; }
    .capitales { font: 500 11.5px/1.3 Jost, system-ui, sans-serif; letter-spacing: .08em; text-transform: uppercase; color: var(--gris); }
    h2 { display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px 16px; font: 300 28px/1.1 'Polène Primary', 'Cormorant Garamond', serif; margin: 48px 0 0; padding-bottom: 10px; border-bottom: 1px solid var(--trait); }
    a { color: inherit; }
    .aide { color: #4d4d4d; max-width: 720px; }
    .grille { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 16px; margin-top: 24px; }
    .carte { display: flex; flex-direction: column; background: #f9f8f6; border-top: 3px solid var(--couleur); }
    .carte:hover { background: #edeae7; }
    .carte__lien { flex: 1; display: flex; flex-direction: column; gap: 10px; padding: 20px; color: inherit; text-decoration: none; }
    .carte__anciens { padding: 10px 20px 14px; border-top: 1px solid var(--trait); font: 500 11.5px/1.3 Jost, system-ui, sans-serif; letter-spacing: .08em; text-transform: uppercase; text-decoration: none; }
    .carte__anciens:hover { text-decoration: underline; }
    .carte--reussi { --couleur: var(--ok); } .carte--instable { --couleur: var(--instable); } .carte--echec { --couleur: var(--echec); } .carte--ignore { --couleur: var(--ignore); }
    .verdict { display: flex; align-items: baseline; gap: 8px; font: 300 24px/1.15 'Polène Primary', 'Cormorant Garamond', serif; }
    .puce { flex: none; width: 10px; height: 10px; border-radius: 50%; background: var(--couleur); }
    .details { color: #4d4d4d; }
    .details span { white-space: nowrap; } /* « 2 min 48 » ne se coupe pas en fin de ligne */
    .date { color: var(--gris); font-size: 16px; margin-top: auto; }
  </style>
</head>
<body>
  <header>${logo}<svg class="logo" role="img" aria-label="Polène"><use href="#logo-polene"/></svg></header>
  <main>
    <p class="capitales">QA automatisée</p>
    <h1>${esc(titre)}</h1>
    ${contenu}
  </main>
</body>
</html>`;
}
