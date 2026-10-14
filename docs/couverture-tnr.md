# Couverture des fiches TNR de la QA

> Relevé du 13 octobre 2026 (phase 2.1). Source : les fiches Word de la QA (dossier OneDrive `02_polene/tnr`, hors dépôt), non exhaustives de l'aveu de la QA : 59 fiches (PDP, PLP, CART, CHECKOUT, ACCOUNT), 5 index CSV et la grille « TNR Mandatory ». Comparées aux tests du dépôt sans rien lancer.
>
> **Comment s'en servir** (décision QA du 13 octobre 2026) : les fiches sont sur un ancien modèle et pas forcément à jour. On garde leur **liste d'éléments** et leur **criticité** ; pour le comportement attendu, c'est le site qui fait foi, et les fiches peuvent être réécrites librement. Les éléments sont répartis dans les étapes 2.2 et 2.3 de la [roadmap](../roadmap-qa-polene.md), Bloquants d'abord.

## En chiffres

| Page | Fiches | Couvert | Partiel | Non couvert |
|---|---|---|---|---|
| PDP (fiche produit) | 13 | 0 | 7 | 6 |
| PLP (collection) | 7 | 1 | 3 | 3 |
| CART (panier) | 8 | 0 | 5 | 3 |
| CHECKOUT | 8 | 0 | 6 | 2 |
| ACCOUNT (espace client) | 23 | 0 | 16 | 7 |
| **Total** | **59** | **1** | **37** | **21** |

« Partiel » veut souvent dire que la page est vue (sections affichées, images chargées, pas d'erreur JS) ou que le parcours d'achat passe dessus, sans que les interactions de la fiche soient jouées. Header et accueil n'ont pas de fiche, seulement des lignes dans la grille Mandatory.

## Par fiche

### PDP

| Fiche | Priorité | Couverture | Où | Manque |
|---|---|---|---|---|
| PDP-01 Breadcrumb | Mineur | Non couvert | | Format, liens |
| PDP-02 Galerie | Majeur | Partiel | `visuel.spec.ts`, `regressions-injectees.spec.ts` (prod, pixel) | Zoom, vidéo, carrousel mobile, flèches |
| PDP-03 Modale packshot | Majeur | Non couvert | | Ouverture, navigation, fermeture, clavier |
| PDP-04 Info panel | Bloquant | Partiel | `etats-produit.spec.ts` (titre, prix = JSON, QA02) | Ordre, débordement, prix selon la taille |
| PDP-05 Coloris | Bloquant | Partiel | `sante-donnees.spec.ts` (nombre de coloris de P08) | Clic, coloris actif, coloris en rupture |
| PDP-06 Tailles | Bloquant | Partiel | `etats-produit.spec.ts` (13 octobre 2026, ancienne fiche : QA10 tailles partielles, QA12 taille en précommande, QA11 tout épuisé) ; `fiche-produit.spec.ts` (14 octobre 2026, QA09 : diamètre de chaque taille dans l'onglet « Size & fit », qui tient lieu de guide sur l'ancienne fiche) | Nouvelle fiche (fenêtre « Choose your size », avec le tableau « Guide des tailles & Conseils » en mm et en pouces, vu en prod), clavier (constat 34) |
| PDP-07 Ajout au panier | Bloquant | Partiel | `parcours-achat.spec.ts` (en stock), `etats-produit.spec.ts` (rupture ; précommande QA05 avec la date dans la notification, 13 octobre 2026) | Double clic, bouton fixe mobile, coming soon |
| PDP-08 BIS | Majeur | Partiel | `etats-produit.spec.ts` (ouverture, fermeture, sans envoi) | Email invalide, envoi vide |
| PDP-08/09 Wishlist | Majeur | Non couvert | | Cœur, snackbars, non connecté |
| PDP-09 Onglets | Majeur | Partiel | `fiche-produit.spec.ts` (14 octobre 2026, QA09, ancienne fiche) : Description, Size & fit, Materials, Shipping and returns dans l'ordre, aucun ouvert au chargement (fonctionnement normal de l'ancienne fiche d'après la QA, 14 octobre 2026 : sur ordinateur la photo est affichée ; la fiche TNR, qui attend Description ouverte, décrit la nouvelle), un seul contenu affiché à la fois et non vide, Entrée au clavier | Onglet « Details » absent sur ordinateur (constat 36), sac (QA01), nouvelle fiche (Description ouverte par défaut) |
| PDP-10 Accordéons | Mineur | Non couvert | | Fermés au départ, ouverture |
| PDP-11 Split screen | Mineur | Partiel | `pages-sections.spec.ts` (R02) | Contenu sac / bijou |
| PDP-12 Vue 3D | Majeur | Non couvert | | Bouton et fenêtre (la rotation WebGL reste manuelle) |

### PLP

| Fiche | Priorité | Couverture | Où | Manque |
|---|---|---|---|---|
| PLP-01 Collection Menu | Majeur | Non couvert | | Items, flèches, « Voir tout » |
| PLP-02 Filtres & tri | Majeur | Partiel | `structure-collections.spec.ts` (bouton visible) | Panneau, facettes, tri, 0 résultat |
| PLP-03 Grille | Bloquant | Couvert (prod) | `structure-collections.spec.ts` (4 appareils) | Préprod (test en `skip` alors que les collections QA existent), clic vers la fiche |
| PLP-04 Carte & Quick Add | Bloquant | Partiel | `etats-produit.spec.ts` (carte QA02 sur C7) | Quick Add en stock, tailles, badges |
| PLP-05 Wishlist | Majeur | Non couvert | | Cœur de la carte |
| PLP-06 Load More | Majeur | Non couvert | `sante-donnees.spec.ts` compte seulement 48 / 60 | Clic sur « Voir plus » (C3) |
| PLP-07 Modale BIS | Majeur | Partiel | `etats-produit.spec.ts` | Saisie, envoi (exclu volontairement) |

### Panier

| Fiche | Priorité | Couverture | Où | Manque |
|---|---|---|---|---|
| CART-01 Panier vide | Bloquant | Partiel | `pages-sections.spec.ts` (R05), `panier.spec.ts` (titre, « Discover Polène selection » vers `collections/all`, 13 octobre 2026) | Bouton « Login », client connecté |
| CART-02 Liste | Bloquant | Partiel | `parcours-achat.spec.ts` (1 ligne) | Plusieurs articles, compteur, pluriel |
| CART-03 Ligne produit | Bloquant | Partiel | `etats-produit.spec.ts` (ligne d'une précommande), `panier.spec.ts` (+/−, fenêtre « Remove item ? » fermée puis confirmée, dernière pièce QA03 bloquée à 1 avec message, 13 octobre 2026) | Favoris depuis le panier, croix de la ligne |
| CART-04 Résumé & checkout | Bloquant | Partiel | `parcours-achat.spec.ts` (sous-total, passage au checkout), `panier.spec.ts` (sous-total recalculé après +/−) | Bouton fixe mobile |
| CART-05 Réassurance | Mineur | Partiel | `visuel.spec.ts` (prod, pixel) | Libellés |
| CART-06 Accordéon assistance | Mineur | Non couvert | | Ouverture, clavier |
| CART-07 Carrousels | Majeur | Partiel | `pages-sections.spec.ts` (R05) | Quick Add, flèches |
| CART-08 Bannière | Mineur | Non couvert | | Dépend d'une campagne |

### Checkout

| Fiche | Priorité | Couverture | Où | Manque |
|---|---|---|---|---|
| CHECKOUT-01 Résumé fixe mobile | Majeur | Partiel | `checkout.ts` l'ouvre | Visible sur mobile seulement, prix |
| CHECKOUT-02 Paiement express | Bloquant | **Non couvert** | | Présence des boutons en prod (la préprod n'a que la carte) |
| CHECKOUT-03 Contact | Bloquant | Partiel | `checkout.ts` remplit le bloc | Messages d'erreur, cases pré-cochées (constat 1) |
| CHECKOUT-04 Livraison | Bloquant | Partiel | `parcours-achat.spec.ts`, `compte-client.spec.ts` | Adresse incomplète, code postal invalide |
| CHECKOUT-05 Paiement | Bloquant | Partiel | Carte en préprod, présence de PayPal et Klarna en prod | Carte refusée, expirée, CVV faux |
| CHECKOUT-06 Payer + CGV | Bloquant | Partiel | `parcours-achat.spec.ts` (confirmation) | Formulaire incomplet, lien CGV |
| CHECKOUT-07 Récap + code promo | Majeur | Partiel | Produit et total | Code promo, taille, plusieurs articles |
| CHECKOUT-08 Blocs d'infos | Mineur | Non couvert | | Blocs, lien email |

Grille Mandatory sans fiche : emails de confirmation et d'expédition (piste « tests d'emails »), reçu POS (hors web), logo du checkout. Le questionnaire d'acquisition est testé mais absent de la grille.

### Espace client

Tous les tests sont dans `compte-client.spec.ts`, en préprod, Chrome ordinateur et iPhone, sans envoi de formulaire.

| Fiches | Priorité | Couverture | Manque |
|---|---|---|---|
| 01 Navigation | Majeur | Partiel | Clic sur chaque onglet, onglet actif |
| 02 Welcome, 03 et 05 Dernière commande, 06 Historique | Majeur | Partiel | Prénom, « Edit profile », statut, colonnes |
| 04 Bloc assistance | Majeur | Non couvert | Liens email et chat |
| 07 Email, 08 Profil | Bloquant | Partiel | Champs pré-remplis, email non modifiable |
| 09 Préférences marketing | Bloquant | Non couvert | Lire la case sans enregistrer |
| 10 Suppression du compte | Bloquant | Non couvert | Irréversible : au mieux ouvrir puis annuler, sur un compte dédié |
| 11 Adresse par défaut, 13 Ajout | Majeur | Partiel | Libellé « Default », validation sans envoi |
| 12 Adresse secondaire | Majeur | Non couvert | Le compte n'en a pas, et une adresse ajoutée ne se supprime pas (constat 21) |
| 14 Favoris vides, 18 Alertes | Majeur | Partiel | Message et bouton de l'état vide |
| 15 à 17 Favoris remplis | Majeur | Non couvert | Favoris à ajouter au compte de test |
| 19 à 23 Assistance | Majeur | Partiel | Liens FAQ, email, Instagram (sans cliquer dehors) |

## Ce qui ne s'automatise pas ou pas en préprod

- Apple Pay, Google Pay, Shop Pay, PayPal, Klarna : la préprod n'a que la carte. En prod, on peut seulement vérifier que les boutons sont là.
- Inscriptions Klaviyo réelles (BIS, newsletter), désinscription côté Klaviyo : outils bloqués par les tests, vrais contacts dans un outil tiers.
- Connexion par code email : faite à la main par la QA (`npm run connexion:compte`).
- Rotation de la vue 3D, swipe tactile : manuel.
- Colonnes des marchés de la grille Mandatory (AU, NL, UK, JP…) : une boutique par marché, pas encore testées.

## Remarques sur les fiches

À garder en tête si on réécrit les fiches ; rien à corriger tant qu'elles servent seulement de liste.

1. **Identifiants des jeux de données** : P-01, U-01, CB-01… changent de sens d'une fiche à l'autre (P-02 = « bijou en stock » en PDP-01, « sac en rupture » en PDP-04, « 2-3 produits » en CART-02, « précommande » en CART-03). Aucune liste commune ne les définit, et ils ne renvoient pas aux produits QA01 à QA22. Proposition : un seul tableau qui relie chaque besoin à un produit ou une collection QA (`data/donnees-qa.json`).
2. **Doublons** : `PDP-08-BISForm` et `PDP-08-BISFormWishlist`, `PDP-09-Wishlist` et `PDP-09-ProductInfoTabs`. 13 fichiers pour 12 lignes dans l'index ; la wishlist de la fiche produit n'a pas de priorité.
3. **Index ACCOUNT** : numéroté par onglet (01 à 08) alors que les fiches vont de 01 à 23 ; « ACCOUNT-02 » ne désigne pas la même chose dans l'index et dans les fiches.
4. **CSV** : colonnes décalées (ligne PLP-01 : les jeux de données tombent dans « Dernière MEP » ; index CART à largeur variable), formats d'en-tête différents d'un index à l'autre. Colonne « Composant Shopify » vide partout.
5. **Une seule fiche produit décrite** : l'ancienne et la nouvelle alternent (Roll Out), avec « Découvrir tout » ou un carrousel de vignettes, une fenêtre « Choose your size » ou un menu « Select size », 4 ou 5 onglets. PDP-07 parle de 3 états ; il en existe au moins 5 (coming soon, précommande retardée).
6. **Contradictions avec le site** :
   - cases newsletter et SMS du checkout « non cochées (à vérifier) » : elles sont pré-cochées (constat 1) ;
   - case newsletter de la fenêtre BIS « optionnelle » : cochée par défaut (constat 13) ;
   - PayPal et Klarna décrits en préprod : carte seule ;
   - suppression et « Set as default » d'une adresse : introuvables en préprod (constat 21) ;
   - connexion email et mot de passe, création de compte : la préprod n'a plus que la connexion par code ;
   - « Voir plus » : la plupart des collections défilent à l'infini, le bouton n'existe que sur certaines ; « 50+ produits » : le thème en charge 48 ;
   - « Polène suggère » selon le panier : en préprod, le bloc ignore le panier (constat 26) ;
   - exemples de prix de la prod (« 390 € », « 540 € ») alors que les prix de la préprod diffèrent (constat 3) ;
   - textes uniquement en français alors que la préprod mélange français et anglais.
7. **Grille Mandatory** : lignes sans fiche (bouton fixe mobile de la fiche produit et du panier, bannières précommande et rupture du panier, « Continue shopping »).
8. Une fiche checkout contient une adresse email personnelle : elle n'est pas reprise dans le dépôt.

## Premiers tests proposés

Aucun ne va jusqu'au paiement.

1. **Panier, ligne produit** (CART-03 et 04, bloquant, rien aujourd'hui) : QA01, +/−, sous-total recalculé, suppression avec fenêtre (annuler puis confirmer), retour au panier vide (CART-01). Puis QA03 (dernière pièce : « + » bloqué).
2. **Précommande et panier mixte** (PDP-07, CART-02, bloquant) : QA05 ajouté, date dans la notification, puis QA01 + QA05 dans le panier. Suite logique des états produit.
3. **Tailles et coloris** (PDP-06 et 05, bloquant) : QA10 puis QA09, famille QA13 à QA15, en acceptant les deux versions de la fiche.
4. **Collections en préprod et Quick Add** (PLP-03 et 04, bloquant) : structure de C1, C5, C7, ajout depuis la carte QA01, « Voir plus » sur C3.
5. **Checkout sans commande** (CHECKOUT-01 à 03) : résumé fixe mobile, boutons express en prod, messages d'erreur du formulaire.
6. **Espace client en lecture** : clic sur les 7 onglets, bloc dernière commande (T19581), liens d'assistance.

## Questions pour la QA

- Quick Add et « Variant Picker » depuis une carte : où les voit-on aujourd'hui (ils n'ont pas été rencontrés pendant nos tests) ?
- Favoris d'un visiteur non connecté : fenêtre de connexion ou sauvegarde dans le navigateur (question ouverte dans CART-03 et PDP-08) ?
- Peut-on remplir les favoris et poser une alerte BIS sur le compte de test `+qacompte` ?
