import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Produits fixes de la préprod (roadmap phase 1) : de vrais produits de la prod, au même handle,
 * dont le statut est forcé en préprod pour que les tests trouvent toujours le même cas.
 * Liste dans data/produits-fixes.json, raisons du choix dans docs/produits-fixes.md.
 */
export type EtatProduit = 'en-stock' | 'tailles' | 'rupture' | 'coming-soon' | 'precommande';

export interface ProduitFixe {
  id: string;
  /** Cas couvert, en clair : « Tailles partielles ». */
  role: string;
  handle: string;
  /** État affiché par la fiche : bouton principal et ce qu'il propose. */
  etat: EtatProduit;
  /** Produit à tailles : tailles qu'on doit pouvoir acheter, et celles qui doivent être épuisées. */
  tailles?: { disponibles: string[]; indisponibles: string[] };
  /** Étiquette « Nouveauté » (tag LABEL:NEW). */
  nouveaute?: boolean;
  /** Nombre minimum de coloris proposés par « Découvrir tout ». */
  colorisMinimum?: number;
  /** Prix maximum, en euros, pour le cas « petit prix ». */
  prixMaximumEuros?: number;
}

export const PRODUITS_FIXES = (JSON.parse(readFileSync(join(__dirname, '..', 'data', 'produits-fixes.json'), 'utf8')) as { produits: ProduitFixe[] }).produits;

export function produitFixe(id: string): ProduitFixe {
  const produit = PRODUITS_FIXES.find(p => p.id === id);
  if (!produit) throw new Error(`Produit fixe inconnu : ${id}. Voir data/produits-fixes.json`);
  return produit;
}
