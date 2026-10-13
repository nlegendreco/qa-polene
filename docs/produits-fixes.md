# Produits fixes de la préprod

> Phase 1 de la roadmap (« une préprod déterministe »). **Liste validée par la QA le 7 octobre 2026.**

Les tests préprod ont besoin de produits dont l'état ne bouge pas : un produit toujours en rupture, un toujours en précommande, etc. Sans eux, un test « rupture » échoue le jour où quelqu'un remet le produit en stock, et on ne sait pas si c'est un bug ou un changement de données.

- Liste utilisée par les tests : [`data/produits-fixes.json`](../data/produits-fixes.json)
- Contrôle automatique : `npm run test:donnees` (aussi lancé par `npm run test:preprod`). Aucune commande, aucun ajout au panier.

## La proposition

Choisis parmi les 474 produits visibles de la préprod (relevé du 7 octobre 2026), avec trois règles : le produit existe aussi en prod sous le même nom technique (handle), il est déjà dans l'état voulu (rien à modifier pour démarrer), et il ne sert pas à un autre cas.

| N° | Cas couvert | Produit (handle) | État aujourd'hui en préprod | En prod |
|---|---|---|---|---|
| P01 | En stock simple | Numéro Un, Textured Black (`numero-un-textured-black`) | « Ajouter au panier », 526,95 € | Oui. Déjà la fiche de la référence visuelle prod |
| P02 | Tailles toutes disponibles | Bague Eroz dorée (`eroz-ring-24-carat-gold-gilded`) | Tailles 50, 52, 54, 56 disponibles | Oui, 4/4 |
| P03 | Tailles partielles | Bague Éole Draped dorée (`eole-draped-ring-24-carat-gold-gilded`) | 50 et 54 disponibles, 52 et 56 épuisées | Oui, 3/4 |
| P04 | Rupture totale | Numéro Un Nano, Textured Black (`numero-un-nano-textured-black`) | « Être prévenu(e) » | Oui, en stock |
| P05 | Coming soon | Numéro Neuf Mini, Textured Taupe (`numero-neuf-mini-textured-taupe`) | « Coming soon — Sign up » | Oui |
| P06 | Précommande | Solé, Tan (`sole-tan`) | « Preorder now », expédition le 15 novembre | Oui, en rupture |
| P07 | Nouveauté | Tsubi Raffia (`tsubi-raffia`) | Étiquette « New » (tag `LABEL:NEW`), en stock | Oui |
| P08 | Multi-coloris | Cyme Mini, Textured Camel (`cyme-mini-textured-camel`) | 24 coloris proposés, en stock, plusieurs coloris en rupture | Oui |
| P09 | Petit prix | Miroir Atla, Duo Black (`atla-mirror-black`) | 81,95 € | Oui |

Pourquoi ces choix :
- **P06 Solé Tan** est le **seul** produit en précommande de la préprod. Sa date (15 novembre) le fera sortir de la précommande tout seul dans 39 jours : il faut la repousser très loin (par exemple 2030). Le test prévient 30 jours avant.
- **P08** : la Cyme Mini noire (`cyme-mini-textured-black`) a été écartée. Elle a été modifiée en préprod (option « Color » avec 3 valeurs mais une seule variante) et affiche « Choose your size » sur un sac. Probablement un essai d'un collègue, à confirmer.
- **Pas de produit « moyens de paiement »** (prévu dans la roadmap) : la préprod ne paie que par carte (décision QA du 7 octobre 2026).

## Ce que vérifie `npm run test:donnees`

Un test par produit, sur Chrome ordinateur seulement (ce sont les données qu'on vérifie, pas l'affichage sur chaque appareil). Il apparaît dans le Rapport Polène sous l'appareil « Données préprod ».

1. La fiche existe toujours (code 200).
2. Le catalogue : le produit est achetable ou non, comme prévu ; les bonnes tailles sont disponibles ; le tag `LABEL:NEW` est là ; le prix reste sous le plafond.
3. L'état affiché : le bouton principal de la fiche (« Ajouter au panier », choix de la taille, « Être prévenu(e) », « Coming soon », « Précommander »), la date d'expédition de la précommande, le nombre de coloris.

Quand un produit a bougé, le message le dit en clair, par exemple :
- « P04 Rupture totale n'est plus en rupture : il est de nouveau achetable »
- « P03 Tailles partielles : tailles qui devraient être épuisées mais sont de nouveau en stock : 54 »
- « P06 Précommande : la précommande expire dans 12 jours (…). Repousser la date dans l'admin préprod »

Vérifié le 7 octobre 2026 : 4 passages verts de suite, et deux attentes faussées exprès (P03, P04) ont bien été signalées avec ces messages.

## Ce qu'il reste à faire

| Étape roadmap | Qui | Statut |
|---|---|---|
| 1.1 Valider la liste | QA | ✅ Validée le 7 octobre 2026 (9 produits, pas de P10) |
| 1.2 Convention d'équipe : tag `qa-fixture` sur ces produits (choisi par la QA le 7 octobre 2026), personne d'autre ne les modifie ; date de précommande lointaine ; collection automatique « QA · Produits de test » (tag = `qa-fixture`, tri manuel, hors menu) ; jamais d'export Matrixify depuis la QA | Équipe | En cours. Le relevé du 7 octobre montre que la préprod bouge : des centaines de produits mis à jour à 10 h 26, et une seconde version de la fiche produit apparue dans la matinée (Roll Out : l'ancienne fiche, revenue à côté de la nouvelle, d'après la QA le 13 octobre) |
| 1.3 Accès API d'administration à `asia-polene` (produits, stock, champs personnalisés) | QA · Claude Code | 🟡 Lecture ✅ le 7 octobre 2026 par la CLI Shopify (`shopify store auth` avec le compte de la QA, sans app à créer). Écriture à demander au moment de modifier |
| 1.4 Script de remise en état avant chaque TNR (stock, champs coming soon et précommande, dates) | Claude Code | Attend l'accès 1.3 |
| 1.5 Test de santé des données | Claude Code | ✅ Fait (`npm run test:donnees`) |

Depuis le 12 octobre 2026, le parcours d'achat préprod achète toujours le produit QA01 « QA Numéro Un - In Stock » (`produitAchat` dans `src/environments.ts`), au lieu du « premier produit en stock de la collection Sacs », qui changeait selon les jours. Il passe toujours par le menu Sacs pour vérifier la navigation.

## Où chaque état est rangé dans l'admin

Relevé le 7 octobre 2026 par la CLI Shopify, en lecture seule. C'est ce que le script de remise en état (1.4) devra remettre en place.

| État | Où il est rangé | Exemple |
|---|---|---|
| Stock, rupture, tailles | Stock de l'entrepôt **« Online »**, le seul qui alimente le site. Les boutiques (Conciergerie V2, Champs Élysées…) n'y comptent pas | Éole Draped : les tailles 52 et 56 ont 0 en « Online » mais 1 pièce en boutique. Le site les affiche épuisées, l'admin les dit « disponibles » |
| Coming soon | Champ personnalisé du produit `coming_soon.enabled` = vrai | Numéro Neuf Mini Taupe |
| Précommande | Champ personnalisé de la **variante** `preorder.date` (pas un plan de vente) | Solé Tan : `2026-11-15` |
| Nouveauté | Tag `LABEL:NEW` | Tsubi Raffia |

Boutique : « Polène PREPROD », formule Enterprise. Ce n'est pas une boutique de développement.

## Comment l'état a été relevé

Pour choisir les produits, sans accès admin, on a lu ce que voit un visiteur : le catalogue public (`products.json`), et l'état posé par le thème sur chaque carte de la collection « All » (`data-tracking-state` : active, disabled, coming-soon, preorder). Les états coming soon et précommande ne figurent pas dans le catalogue public. Depuis, la CLI Shopify lit l'admin directement (section précédente). Au 7 octobre 2026 : 245 produits en stock, 220 en rupture, 8 coming soon, 1 précommande.
