import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { TestBuyer } from './pages/checkout';

interface ClientTestFile {
  civilite: TestBuyer['civility'];
  prenom: string;
  nom: string;
  adresse: string;
  codePostal: string;
  ville: string;
  telephone: string;
  sourceAcquisition: string;
}

/** Client de test : identité fictive dans data/client-test.json, email dans PREPROD_EMAIL (.env). */
export function loadClientTest(): TestBuyer {
  const email = process.env.PREPROD_EMAIL;
  if (!email) throw new Error('PREPROD_EMAIL est vide : renseignez l\'email du client de test dans le fichier .env');
  const client = JSON.parse(readFileSync(join(__dirname, '..', 'data', 'client-test.json'), 'utf8')) as ClientTestFile;
  return {
    email,
    civility: client.civilite,
    firstName: client.prenom,
    lastName: client.nom,
    address: client.adresse,
    postalCode: client.codePostal,
    city: client.ville,
    phone: client.telephone,
    acquisitionSource: client.sourceAcquisition,
  };
}
