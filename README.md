# QA automatisée Polène

Tests automatisés du site [polene-paris.com](https://www.polene-paris.com/) et de la préprod `asia-polene`, sur 4 appareils : desktop Chrome, desktop Safari, iPhone 15 et Pixel 7 (émulés).

Feuille de route : [roadmap-qa-polene.md](roadmap-qa-polene.md).

## Installation (une seule fois)

```bash
npm install
npx playwright install chromium webkit
cp .env.example .env   # puis renseigner PREPROD_PASSWORD
```

Sans `PREPROD_PASSWORD`, seuls les tests de prod sont lancés (un avertissement s'affiche).

## Commandes

| Commande | Ce qu'elle fait |
|---|---|
| `npm test` | Lance tous les tests (prod + préprod) sur les 4 appareils |
| `npm run test:prod` | Prod uniquement |
| `npm run test:preprod` | Préprod uniquement |
| `npm run rapport` | Ouvre le dernier rapport HTML |
| `npm run test:demo-echec` | Démo d'un échec volontaire (bouton « Ajouter au panier » masqué) |
| `npm run rapport:demo-echec` | Ouvre le rapport de la démo d'échec |

Pour lancer un seul appareil : `npx playwright test --project "prod · iphone"`.
Pour regarder le navigateur pendant le test : ajouter `--headed`.

## Ce que fait le parcours d'achat (`tests/parcours-achat.spec.ts`)

1. Ouvrir la page d'accueil (logo visible, panier vide).
2. Aller dans la collection Sacs depuis le menu (burger + « Voir tout » sur mobile).
3. Ouvrir la première fiche produit en stock de la collection.
4. Ajouter au panier (notification affichée, compteur à 1).
5. Vérifier le panier (1 ligne, sous-total = prix Shopify du produit).
6. Passer au checkout (produit dans le résumé, total correct, moyens de paiement présents).
7. *Préprod uniquement* : contact (civilité, prénom, nom, email) et adresse, modes d'expédition proposés. Les cases newsletter et SMS, pré-cochées, sont décochées.
8. *Préprod uniquement* : paiement avec la carte de test Shopify Payments (4242 4242 4242 4242).
9. *Préprod uniquement* : page de confirmation de commande. Le numéro de confirmation est noté dans le rapport.
10. *Préprod uniquement* : réponse au questionnaire « Comment avez-vous connu Polène Paris ? » (réponse définie dans le profil client).

En prod, le test s'arrête à l'étape 6 : aucune commande n'est passée.
Chaque lancement complet crée **4 commandes de test en préprod** (une par appareil).
Le client fictif utilisé est décrit dans [docs/profils-clients.md](docs/profils-clients.md).

## Préprod : à savoir

- Par défaut, `asia-polene` s'affiche en anglais, en dollars, marché US. Les tests passent par `/fr-fr/` (français, euros, marché France) pour se rapprocher de la prod FR.
- Même en `/fr-fr/`, une partie des textes du thème reste en anglais et les prix diffèrent de la prod. Les tests acceptent donc les libellés FR et EN, et lisent les prix quel que soit leur format.

## Le rapport

Chaque étape apparaît en français, avec une capture d'écran prise à la fin de l'étape. En cas d'échec, on a aussi :
- la vidéo du test ;
- la trace Playwright (« View Trace ») : frise chronologique cliquable avec le DOM, le réseau et la console à chaque instant ;
- la liste des requêtes lentes ou bloquées (🐢), utile quand une page ne finit pas de charger.

## Ce que les tests neutralisent

- **Bandeau cookies** : le consentement est posé d'avance (`cookieconsent_status`).
- **AB Tasty** : bloqué, pour que chaque passage voie la même version du site.
- **Pixels publicitaires et analytics** (Google, Meta, TikTok, Criteo…) : bloqués, pour ne pas polluer les données marketing avec le trafic de test.
- **Klaviyo** : bloqué, pour éviter les popups newsletter.

## Structure

```
playwright.config.ts      Appareils, environnements, rapport
src/environments.ts       URL et réglages de la prod et de la préprod
src/fixtures.ts           Neutralisations, captures par étape, diagnostic réseau
src/pages/                Un fichier par type de page (en-tête, collection, produit, panier, checkout)
tests/auth.setup.ts       Saisie du mot de passe préprod (une fois par lancement)
tests/parcours-achat.spec.ts
tests/demo-echec.spec.ts
```
