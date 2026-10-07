// Copie les références visuelles dans archives/references/<date>-<heure>/ avant leur mise à jour,
// pour garder les anciennes captures (demande de la QA, 6 octobre 2026). Lancé par npm run test:visuel:maj.
import { cpSync, existsSync, readdirSync } from 'node:fs';

if (!existsSync('references')) {
  console.log('Pas encore de références : rien à sauvegarder.');
  process.exit(0);
}

const maintenant = new Date();
const deux = n => String(n).padStart(2, '0');
const horodatage = `${maintenant.getFullYear()}-${deux(maintenant.getMonth() + 1)}-${deux(maintenant.getDate())}-${deux(maintenant.getHours())}h${deux(maintenant.getMinutes())}`;
const dossier = `archives/references/${horodatage}`;

cpSync('references', dossier, { recursive: true });
const pages = readdirSync(dossier).filter(nom => !nom.startsWith('.'));
console.log(`✔ Anciennes références sauvegardées dans ${dossier} (${pages.join(', ')})`);
