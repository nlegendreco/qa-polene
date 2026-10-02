# Profils clients de test

Ce fichier liste les clients fictifs utilisés par les tests automatisés. Il sert à retrouver les commandes de test dans l'admin Shopify pour comprendre un échec.

## Profils actifs

### P1 · Client standard

| Champ | Valeur |
| --- | --- |
| **Utilisé par** | `tests/parcours-achat.spec.ts`, étapes 7 à 10 (préprod uniquement) |
| **Ce qu'il teste** | Parcours d'achat nominal : un produit en stock, livraison en France, paiement par carte |
| **Environnement** | Préprod `asia-polene`, marché France (`/fr-fr/`), euros |
| **Civilité / prénom / nom** | Mme · QA · Automatisée |
| **Email** | Valeur de `PREPROD_EMAIL` dans le fichier `.env` (non versionné) |
| **Adresse de livraison** | 60 rue du Louvre, 75002 Paris, France |
| **Téléphone** | 01 99 00 00 00 (plage fixe 01 99 00 xx xx réservée à la fiction par l'ARCEP ; la plage mobile 06 39 98 xx xx est refusée par le checkout Shopify) |
| **Paiement** | Carte de test Shopify Payments 4242 4242 4242 4242 (aucun débit réel). Date, CVV et nom sur la carte dans le `.env` |
| **Consentements** | Cases newsletter et SMS décochées par le test |
| **Source d'acquisition** | « Bouche à oreille », réponse au questionnaire « Comment avez-vous connu Polène Paris ? » de la page de confirmation |
| **Données techniques** | Identité dans `data/client-test.json`, chargée par `src/client-test.ts` |

## Retrouver une commande de test

1. Dans le rapport Playwright, ouvrir le test en préprod : l'annotation **Commande de test** donne le numéro de confirmation (ex. `0QCUHHXVT`).
2. Dans l'admin Shopify de la préprod, menu **Commandes**, rechercher l'email du profil (`PREPROD_EMAIL`) ou le nom « Automatisée ».
3. Chaque lancement complet crée une commande par appareil (4 au total).

## Historique

| Période | Profil | Données utilisées | Commandes |
| --- | --- | --- | --- |
| 1er octobre 2026, mise au point du POC 1 | Ancien profil (avant P1) | Mme · QA · Automatisée, `qa+preprod@polene-paris.com`, 69 rue de Richelieu 75002 Paris, 06 12 34 56 78 | 10 commandes préprod |
| 2 octobre 2026, validation du profil P1 | P1 | Voir ci-dessus | 3 commandes préprod, questionnaire non enregistré sur les trois (mise au point du test) : T19558 (confirmation TV4RI880L), J8GYD9V36, P5QIGDN1X |
| 2 octobre 2026, validation du questionnaire | P1 | Voir ci-dessus | 1 commande préprod : VVGWK0PJK, « Bouche à oreille » enregistré (« Merci pour votre réponse ! » affiché) |
