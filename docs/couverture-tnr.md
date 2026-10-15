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
| PDP-04 Info panel | Bloquant | Partiel | `etats-produit.spec.ts` (titre, prix = JSON) ; 14 octobre 2026 : ordre nom, prix, coloris, bouton, onglets (QA13), titre long QA21 sans débordement sur la fiche, la carte, le panier et le checkout, prix sous 100 € (QA17) et au-dessus de 1 000 € (QA18, milliers séparés) sur la fiche et la carte | Prix selon la taille, nouvelle fiche |
| PDP-05 Coloris | Bloquant | Partiel | `sante-donnees.spec.ts` (nombre de coloris de P08) ; `etats-produit.spec.ts` (14 octobre 2026, ancienne fiche) : famille QA13 à QA15, les 3 vignettes et elles seules, vignette active, passage au noir en rupture (QA14) puis à l'ébène d'une autre matière (QA15, à son prix) | Groupes de matières et « Découvrir tout » (nouvelle fiche), clavier (constat 38) |
| PDP-06 Tailles | Bloquant | Partiel | `etats-produit.spec.ts` (13 octobre 2026, ancienne fiche : QA10 tailles partielles, QA12 taille en précommande, QA11 tout épuisé) ; `fiche-produit.spec.ts` (14 octobre 2026, QA09 : diamètre de chaque taille dans l'onglet « Size & fit », qui tient lieu de guide sur l'ancienne fiche) | Nouvelle fiche (fenêtre « Choose your size », avec le tableau « Guide des tailles & Conseils » en mm et en pouces, vu en prod), clavier (constat 34) |
| PDP-07 Ajout au panier | Bloquant | Partiel | `parcours-achat.spec.ts` (en stock), `etats-produit.spec.ts` (rupture ; précommande QA05 avec la date dans la notification, 13 octobre 2026 ; 14 octobre 2026 : coming soon QA04 avec sa fenêtre, précommande expirée QA07 redevenue normale, précommande retardée QA06), `fiche-produit.spec.ts` (14 octobre 2026 : double clic = un seul article, barre d'achat fixe en bas de l'écran sur mobile) | Nouvelle fiche, produit épuisé depuis le cache |
| PDP-08 BIS | Majeur | Partiel | `etats-produit.spec.ts` (ouverture, fermeture ; 14 octobre 2026 : envoi vide et « test@ » refusés avec « Please type a valid e-mail », rien n'est envoyé, depuis la carte car le bouton de la fiche n'ouvre plus la fenêtre, constat 33) | Envoi réel et message de réussite (exclu volontairement) |
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
| PLP-04 Carte & Quick Add | Bloquant | Partiel | `etats-produit.spec.ts` (cartes en rupture, précommande, coming soon, étiquette « New in » de QA08) ; `cartes-collection.spec.ts` (14 octobre 2026, C5) : ajout rapide de QA01 sans quitter la collection, ajout rapide d'une taille de QA09 (tailles au survol sur ordinateur, fenêtre « Select size » sur mobile) | Tailles épuisées sur la carte, nouvelle carte |
| PLP-05 Wishlist | Majeur | Non couvert | | Cœur de la carte |
| PLP-06 Load More | Majeur | Non couvert | `sante-donnees.spec.ts` compte seulement 48 / 60 | Clic sur « Voir plus » (C3) |
| PLP-07 Modale BIS | Majeur | Partiel | `etats-produit.spec.ts` (ouverture depuis la carte QA02, envoi vide et « test@ » refusés, fermeture, 14 octobre 2026) | Envoi réel (exclu volontairement) |

### Panier

| Fiche | Priorité | Couverture | Où | Manque |
|---|---|---|---|---|
| CART-01 Panier vide | Bloquant | Partiel | `pages-sections.spec.ts` (R05), `panier.spec.ts` (titre, « Discover Polène selection » vers `collections/all`, 13 octobre 2026) | Bouton « Login », client connecté |
| CART-02 Liste | Bloquant | Partiel | `parcours-achat.spec.ts` (1 ligne) ; `panier.spec.ts` (14 octobre 2026, QA01 + QA05) : deux lignes, compteur « 1 product » / « 2 products » (singulier et pluriel), précommande et date sur la seule ligne concernée, sous-total = somme des lignes, propriétés de précommande sur le seul article en précommande, arrivée au checkout avec les deux produits et le même total, retrait par la croix (fenêtre « Remove item ? ») | Panier de 10 articles et plus (défilement) |
| CART-03 Ligne produit | Bloquant | Partiel | `etats-produit.spec.ts` (ligne d'une précommande), `panier.spec.ts` (+/−, fenêtre « Remove item ? » fermée puis confirmée, dernière pièce QA03 bloquée à 1 avec message, 13 octobre 2026) | Favoris depuis le panier, croix de la ligne |
| CART-04 Résumé & checkout | Bloquant | Partiel | `parcours-achat.spec.ts` (sous-total, passage au checkout), `panier.spec.ts` (sous-total recalculé après +/− ; 14 octobre 2026 : récapitulatif avec sous-total et livraison « calculated at checkout », « Continue » visible sans défiler, collé au bas de l'écran sur mobile) | Boutons Shop Pay et PayPal (absents de la préprod) |
| CART-05 Réassurance | Mineur | Partiel | `visuel.spec.ts` (prod, pixel) | Libellés |
| CART-06 Accordéon assistance | Mineur | Non couvert | | Ouverture, clavier |
| CART-07 Carrousels | Majeur | Partiel | `pages-sections.spec.ts` (R05) | Quick Add, flèches |
| CART-08 Bannière | Mineur | Non couvert | | Dépend d'une campagne |

### Checkout

| Fiche | Priorité | Couverture | Où | Manque |
|---|---|---|---|---|
| CHECKOUT-01 Résumé fixe mobile | Majeur | Partiel | `checkout.ts` l'ouvre | Visible sur mobile seulement, prix |
| CHECKOUT-02 Paiement express | Bloquant | **Non couvert** | | Présence des boutons en prod (la préprod n'a que la carte) |
| CHECKOUT-03 Contact | Bloquant | Partiel | `checkout.ts` remplit le bloc ; `checkout-erreurs.spec.ts` (14 octobre 2026, préprod, 4 appareils) : message sous chaque champ vide (email, civilité, prénom, nom), « test@ » refusé | Cases pré-cochées (constat 1, noté seulement), clavier numérique du téléphone |
| CHECKOUT-04 Livraison | Bloquant | Partiel | `parcours-achat.spec.ts`, `compte-client.spec.ts` ; `checkout-erreurs.spec.ts` (14 octobre 2026) : messages sous adresse, code postal, ville, téléphone vides, code postal « ABCDE » refusé pour la France | Changement de pays |
| CHECKOUT-05 Paiement | Bloquant | Partiel | Carte en préprod, présence de PayPal et Klarna en prod ; `checkout-erreurs.spec.ts` (14 octobre 2026, Chrome ordinateur, accord QA) : carte refusée, expirée et au code de sécurité faux, chacune avec son message, sans commande ; messages sous les champs de carte vides | PayPal et Klarna (prod seulement, sans payer) |
| CHECKOUT-06 Payer + CGV | Bloquant | Partiel | `parcours-achat.spec.ts` (confirmation) ; `checkout-erreurs.spec.ts` (14 octobre 2026) : formulaire vide ou faux sans commande, mention « En cliquant sur Payer, j'accepte les Conditions Générales de Vente », lien et page des CGV non vide, en prod (sans rien saisir) et en préprod (constat 39) | Double clic sur « Payer » (créerait une commande) |
| CHECKOUT-07 Récap + code promo | Majeur | Partiel | Produit et total ; titre long QA21 sans débordement (14 octobre 2026) | Code promo (pas testé pour l'instant, décision QA du 14 octobre 2026), taille |
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

- ~~Quick Add et « Variant Picker » depuis une carte : où les voit-on aujourd'hui ?~~ Trouvés le 14 octobre 2026 sur les cartes de la préprod (ancienne carte) : « Add to cart » au survol sur ordinateur, icône sur mobile ; pour un bijou à tailles, les tailles remplacent le bouton au survol sur ordinateur et une fenêtre « Select size » s'ouvre sur mobile. Testés dans `tests/cartes-collection.spec.ts`.
- ~~Favoris d'un visiteur non connecté : fenêtre de connexion ou sauvegarde dans le navigateur (question ouverte dans CART-03 et PDP-08) ?~~ Vu le 15 octobre 2026 : sauvegarde dans le navigateur, page `pages/wishlist` avec un lien « Sign in ». Testé dans `tests/favoris.spec.ts`.
- Peut-on remplir les favoris et poser une alerte BIS sur le compte de test `+qacompte` ? Favoris : oui, le test les remplit puis les vide (15 octobre 2026). Alerte BIS : toujours ouvert (l'envoi réel de « Être prévenu(e) » n'est pas testé).
- ~~Compte de prod pour les favoris du compte~~ : `+qacompte` en prod, fourni par la QA le 15 octobre 2026 (identifiants dans `.env`), à créer par elle.
- ~~Compte dédié pour ACCOUNT-10~~ : un compte supprimé à chaque passage ne tiendrait pas (QA, 15 octobre 2026). Le test va jusqu'à la confirmation et annule.
- ~~Résumé du checkout mobile fixé ?~~ Non : il défile avec la page, la fiche CHECKOUT-01 se trompait (QA, 15 octobre 2026).

## Phase 2.3 (15 octobre 2026)

Fiches jouées en plus de 2.2, sans commande. Le site fait foi ; un écart avec la prod est noté comme constat (CLAUDE.md, constats 40 à 51).

| Fiche | Où | Ce qui est vérifié |
|---|---|---|
| PDP-01 Breadcrumb | `fiche-galerie.spec.ts` | Catégorie puis modèle (sac) ou type (bijou), liens vers des collections qui répondent (constat 42 en préprod) |
| PDP-02 Galerie, PDP-03 Modale packshot | `fiche-galerie.spec.ts` | Ordinateur : zoom plein écran, photo chargée, Échap. Mobile : carrousel (glissé sous Android), points, flèche au clavier, fenêtre des photos et vignettes (nouvelle fiche) |
| PDP-08/09, PLP-05 Favoris | `favoris.spec.ts` | Cœur de la fiche et de la carte, compteur, page des favoris (rubriques, nombres, produits côte à côte), retrait ; compte connecté en préprod et en prod (compte de prod créé le 15 octobre 2026). Deux bugs de la prod détectés : rubriques (constat 48) et produits les uns sous les autres (constat 51), corrigés en prod le 15 octobre 2026 vers 15 h 50 |
| PDP-10, PDP-11 Savoir-faire | `fiche-galerie.spec.ts` | Accordéons (nouvelle fiche ; constat 50 : un des deux manque en préprod), bloc « Le savoir-faire d'Ubrique » avec sa photo |
| PDP-12 Vue 3D | `fiche-galerie.spec.ts` | Bouton, modèle téléchargé, lecteur affiché, interrupteur ouvert / fermé, fermeture ; ignoré sur l'ancienne fiche de la préprod, où la 3D a été remplacée par une « 360 View » ou retirée (essai de l'équipe, constat 43) |
| PLP-01 Menu de collection | `collections.spec.ts` | Titre, entrées, flèches (ordinateur), clic : URL, titre, entrée active |
| PLP-02 Filtres et tri | `collections.spec.ts` | Fenêtre, tris par prix, en stock, facette Rings, « Clear », « Close » |
| PLP-03 Grille préprod | `structure-collections.spec.ts` | C1, C5, C7 : produits exacts, cartes complètes, colonnes, clic vers la fiche |
| PLP-06 « Voir plus » | `collections.spec.ts` | C3 (bouton) et C2 (défilement infini) : 48 puis 60 produits, sans doublon ; collection vide et filtre vide (constat 40) |
| Recherche (grille Mandatory) | `recherche.spec.ts` | Champ de l'en-tête, titre et nombre, cartes, bons produits en tête (QA22 seul produit QA), clic vers la fiche |
| CART-01, 05, 06, 07 Panier vide | `panier.spec.ts` | Connexion, sélection, réassurance, logos, accordéon Assistance (clic et clavier), suggestions (flèches au clavier, ajout rapide) ; constats 44 et 45 |
| CHECKOUT-01, 02, 08 | `checkout.spec.ts` | Résumé mobile replié avec le total (ouvrir, refermer), paiement express, blocs d'information une fois chacun (constat 46) |
| ACCOUNT-01 à 04, 07 à 11, 19 à 23 | `compte-client.spec.ts` | Chaque entrée du menu et l'entrée active, « Log out » présent (jamais cliqué), accueil (prénom, dernière commande, détail, assistance), profil en lecture seule (civilité, nom, téléphone, naissance, newsletter), suppression du compte jusqu'à la confirmation puis « Cancel » (jamais confirmée), adresse par défaut, assistance (formulaire, email, FAQ, chat, réseaux) ; constat 47 |
| Header et accueil (grille Mandatory) | `en-tete.spec.ts` | Logo, panneau du menu au survol, menu mobile, tous les liens internes de l'en-tête et du pied de page, newsletter (saisies invalides), vidéo de l'accueil, défilement jusqu'au pied de page |

Pas joués : la suppression réelle du compte (ACCOUNT-10 s'arrête à la confirmation), envoi réel des formulaires (profil, newsletter, « Être prévenu(e) »), CART-08 (bannière : aucune aujourd'hui), code promo (décision QA du 14 octobre 2026).

### Les deux fiches produit (15 octobre 2026)

Le Roll Out sert l'ancienne ou la nouvelle fiche au hasard, en prod (50/50) comme en préprod. Les tests choisissent maintenant leur fiche (`src/fiches.ts`) : chaque fiche TNR « PDP » est jouée sur les deux à chaque lancement.

| Fiche | Ancienne fiche | Nouvelle fiche |
|---|---|---|
| PDP-04 Coloris | Vignettes, vignette active, ordre nom / prix / coloris / bouton / onglets | Carrousel de vignettes, fiche affichée marquée (`aria-current`), « Explore all (3) » et sa fenêtre, même ordre |
| PDP-05, PDP-06 Tailles et guide | Menu « Select size » (taille épuisée grisée, ouvre « Être prévenu(e) »), guide dans « Size & fit » | Fenêtre « Choose your size » : « Please select a size », taille épuisée → « Notify me », précommande d'une taille avec sa date, ajout de la bonne taille ; diamètres de « Details » = colonne mm du guide (constat 53 : autres colonnes fausses en préprod) |
| PDP-07 Ajout au panier | Double clic = 1 article, barre d'achat fixe sur mobile | Double clic = 1 article, barre d'achat fixe sur mobile (bouton seul, sans nom ni prix) |
| PDP-09 Onglets | 4 onglets, aucun ouvert, un seul contenu à la fois, Entrée | Description ouvert au chargement, Details, Composition, Shipping & Return, un seul contenu à la fois, Entrée (« Golden data test » noté, constat 50) |
| États produit | Rupture, précommande, coming soon, précommande expirée et retardée, titre long, prix : mêmes vérifications sur les deux fiches | |
| PDP-01 à 03, 10 à 12 | Fil d'Ariane, zoom, carrousel mobile (glissé), 3D absente (constat 43) | Fil d'Ariane, zoom, fenêtre des photos, 3D, accordéons (constat 50 en préprod) |

Parcours d'achat, panier mixte et favoris du visiteur : une fiche par appareil (ancienne sur Chrome ordinateur et iPhone, nouvelle sur Safari et Android). Tests visuels de la fiche : une référence par fiche (ancienne prise le 15 octobre 2026).
