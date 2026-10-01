/**
 * Environnements testés. Chaque environnement correspond à une boutique Shopify.
 * Les libellés sont configurables car la préprod peut ne pas être en français.
 */
export type EnvName = 'prod' | 'preprod';

export interface QaEnvironment {
  name: EnvName;
  label: string;
  /** URL racine, terminée par "/". Les chemins des tests sont relatifs à cette racine. */
  baseURL: string;
  /** Domaine sur lequel poser le cookie de consentement. */
  cookieDomain: string;
  /** Boutique protégée par le mot de passe Shopify. */
  passwordProtected: boolean;
  /** Va-t-on jusqu'au paiement ? Jamais en prod. */
  completePurchase: boolean;
  /** Collection utilisée pour trouver un produit en stock. */
  collection: { menuLabel: RegExp; path: string };
  /** Moyens de paiement qui doivent apparaître au checkout. */
  paymentMethods: RegExp[];
}

export const environments: Record<EnvName, QaEnvironment> = {
  prod: {
    name: 'prod',
    label: 'Prod FR',
    baseURL: 'https://www.polene-paris.com/',
    cookieDomain: 'www.polene-paris.com',
    passwordProtected: false,
    completePurchase: false,
    collection: { menuLabel: /^(Sacs|Bags)$/i, path: '/collections/handbags' },
    paymentMethods: [/Carte de crédit|Credit card/i, /PayPal/i, /Klarna/i],
  },
  preprod: {
    name: 'preprod',
    label: 'Préprod',
    // La préprod est en anglais / USD par défaut : /fr-fr la met en français, euros, marché France, comme la prod FR.
    baseURL: 'https://asia-polene.myshopify.com/fr-fr/',
    cookieDomain: 'asia-polene.myshopify.com',
    passwordProtected: true,
    completePurchase: true,
    collection: { menuLabel: /^(Sacs|Bags)$/i, path: '/collections/handbags' },
    paymentMethods: [/Carte de crédit|Credit card/i],
  },
};

export function getEnvironment(name: string): QaEnvironment {
  const env = environments[name as EnvName];
  if (!env) throw new Error(`Environnement inconnu : "${name}". Valeurs possibles : ${Object.keys(environments).join(', ')}`);
  return env;
}
