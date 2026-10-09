# Plan des données QA de la préprod

> Phase 1 de la roadmap. **Proposition du 7 octobre 2026, mise à jour avec les réponses de la QA le jour même (section 9).** Reste à la valider, puis essai sur un produit pilote, puis extension.

Objectif : des produits et des collections **à nous**, dans la préprod, qui couvrent chaque cas à tester, qui ne bougent pas, et qui gênent le moins possible le reste de la préprod.

Tout ce qui suit a été relevé dans l'admin préprod par la CLI Shopify (lecture seule) : 1 085 produits dont 670 publiés, 250 collections, 32 réglages de collection et 60 réglages de produit.

## 1. Les règles

| Règle | Pourquoi |
|---|---|
| **Des copies, jamais les vrais produits.** Chaque produit QA est la copie d'un vrai produit (photos, description, détails), puis réglé dans l'état voulu | Les réimports de la prod vers la préprod ne touchent pas un produit qui n'existe pas en prod. Nos achats de test ne vident pas le stock des vrais produits |
| **Titre `QA <Modèle> - <Cas>`**, en anglais comme le catalogue. Le thème coupe au tiret : le site affiche « **QA Numéro Un** », puis « Edition Out of Stock » | « QA » se voit partout : admin, site, panier, commandes. Le vrai modèle garde une fiche réaliste |
| **Handle `qa-<modèle>-<cas>`** | N'existe pas en prod : aucun conflit à l'import |
| **Tags** : `qa-fixture` seulement, plus les tags d'un cas (`LABEL:NEW` pour la nouveauté, la famille QA pour les coloris). Tous les autres tags de la copie sont retirés | 175 collections de la préprod se remplissent par tag (`family_…`, `numero1`, `all`…). Sans leurs tags, les copies n'y entrent pas |
| **Cachés de la recherche** (`seo.hidden = 1`), sauf le produit dédié à la recherche | Un client de la préprod (ou un collègue) ne les voit pas en cherchant « Numéro Un » |
| **Une entrée « QA » dans le menu de la préprod** (demande QA du 7 octobre 2026), qui mène aux collections QA | Accès facile pour la QA et pour les tests, qui peuvent passer par le menu comme un client |
| **Aucun nouveau métaobjet.** Les bandeaux PLP des collections QA réutilisent ceux qui existent | L'équipe exporte parfois des métaobjets de la préprod vers la prod avec Matrixify : un métaobjet QA pourrait partir en prod |
| **Aucun export Matrixify** depuis la QA | Même raison |
| **Un script crée et répare tout** à partir d'un fichier du dépôt (`data/donnees-qa.json`) : il crée ce qui manque, remet stocks et dates. Il montre d'abord ce qu'il va changer, et ne modifie qu'avec l'accord de la QA | Après un réimport ou des achats de test, tout revient en une minute |

## 2. Les produits

### États de vente (fiche et carte)

| N° | Titre | Copie de | Ce qu'il permet de tester | Réglage |
|---|---|---|---|---|
| QA01 | QA Numéro Un - In Stock | Numéro Un Textured Black | Sac en stock : fiche complète (vue 3D, photo au survol), ajout au panier, **achat préprod** | Stock « Online » élevé |
| QA02 | QA Numéro Un Nano - Out of Stock | Numéro Un Nano Textured Black | Rupture : « Être prévenu(e) », fenêtre d'alerte (sans envoi) | Stock 0 |
| QA03 | QA Numéro Un - Last Unit | Numéro Un Textured Black | Dernière pièce : en ajouter 2 → message, quantité bloquée au panier | Stock 1 |
| QA04 | QA Numéro Neuf Mini - Coming Soon | Numéro Neuf Mini Textured Taupe | Coming soon : bouton, fenêtre d'inscription (sans envoi), carte | `coming_soon.enabled` |
| QA05 | QA Solé - Preorder | Solé Tan | Précommande : date affichée, ajout au panier, panier et checkout en précommande | `preorder.date` = 31/12/2030 |
| QA06 | QA Cyme Tote Nano - Delayed Preorder | Cyme Tote Nano Textured Taupe | Précommande **retardée** (`preorder.delayed_date`, déjà utilisé sur 3 produits) : ce qu'affiche la fiche | Dates 2030 et 2031 |
| QA07 | QA Numéro Un - Expired Preorder | Numéro Un Textured Black | Précommande **expirée** : le produit doit redevenir normal tout seul | `preorder.date` = 01/01/2020 |
| QA08 | QA Tsubi - New | Tsubi Raffia | Étiquette « New » sur la carte | Tag `LABEL:NEW` |

### Tailles

| N° | Titre | Copie de | Ce qu'il permet de tester | Réglage |
|---|---|---|---|---|
| QA09 | QA Eroz Ring - All Sizes | Bague Eroz dorée | Toutes les tailles disponibles, **guide des tailles** | 4 tailles en stock |
| QA10 | QA Éole Draped Ring - Partial Sizes | Bague Éole Draped dorée | Seules les tailles en stock sont proposées | 50 et 54 en stock, 52 et 56 à 0 |
| QA11 | QA Eroz Cuff - Sizes Out of Stock | Manchette Eroz dorée | Produit à tailles entièrement épuisé | Toutes à 0 |
| QA12 | QA Éole Bangle - Size Preorder | Jonc Éole doré | Une taille en précommande, les autres en stock (cas réel : la bague Eroz avait une date par taille) | Une taille avec `preorder.date` |

### Coloris

| N° | Titre | Copie de | Ce qu'il permet de tester |
|---|---|---|---|
| QA13 | QA Cyme Mini - Textured Camel | Cyme Mini Textured Camel | Coloris en stock |
| QA14 | QA Cyme Mini - Textured Black | Cyme Mini Textured Black | Coloris en rupture, dans la même famille |
| QA15 | QA Cyme Mini - Merino Ebony | Cyme Mini Merino Ebony | Coloris d'une **autre matière** (le sélecteur regroupe par matière) |

Les trois forment une famille QA à part (tag et collection `family_qa-cyme-mini`). Sur la fiche, les coloris viennent de la collection de famille : à vérifier sur le pilote, car le code du thème n'a pas été lu. Ils n'apparaissent pas dans le carrousel de la vraie Cyme Mini.

### Types de fiche, médias, prix, recommandations, recherche

| N° | Titre | Copie de | Ce qu'il permet de tester |
|---|---|---|---|
| QA16 | QA Numéro Dix - Video | Numéro Dix Textured Camel | Vidéo dans la galerie (16 produits en ont) |
| QA17 | QA Atla Mirror - Accessory | Miroir Atla Duo Black | Fiche d'**accessoire** (mise en page différente d'un sac), **petit prix** (< 100 €) |
| QA18 | QA Numéro Un - High Price | Numéro Un Textured Black | Prix **au-dessus de 1 000 €** : espace des milliers (« 1 290,00 € »), plafonds de paiement |
| QA19 | QA AirPods Case - Recommendations | Étui AirPods noir | **Recommandations fixées à la main** (produits complémentaires = produits QA) : le bloc « Complétez votre panier » devient prévisible |
| QA20 | QA Numéro Neuf East West - Minimal | Numéro Neuf East West | Fiche **minimale** : sans photo au survol, sans vue 3D, peu de détails. La page ne doit pas casser |
| QA21 | QA Numéro Un - Very Long Edition Name To Check Line Wrapping | Numéro Un Textured Black | **Titre long** : retour à la ligne sur carte, fiche, panier, checkout |
| QA22 | QA Numéro Un - Searchable | Numéro Un Textured Black | Le **seul produit QA visible dans la recherche** : chercher « Searchable » doit le trouver, lui seul |

Pas de carte cadeau (décision QA du 7 octobre 2026).

### Produits de remplissage (pour les grandes collections)

Le site affiche 48 produits par page. Pour tester le défilement infini et le bouton « Voir plus », il faut **plus de 48 produits** dans une collection QA : **38 produits de remplissage** (`QA Filler 01` à `QA Filler 38`, copies simples de QA01 en stock, tag `qa-filler`). Avec les 22 produits ci-dessus, on arrive à 60 : une page pleine plus une suite. Validé par la QA ; si c'est trop lourd à mettre en place, on teste le défilement infini sur la vraie collection Sacs.

### Sur « petit prix »

La roadmap le prévoyait pour les seuils : livraison offerte au-dessus d'un montant, minimum d'un moyen de paiement. En préprod, il n'y a qu'un mode de livraison et la carte, donc ce cas seul n'apporte rien. Il est **fusionné avec l'accessoire** (QA17), qui a une vraie différence : sa fiche n'a pas la même mise en page qu'un sac. Le **prix élevé** (QA18) est ajouté, parce que l'affichage « 1 290,00 € » est un piège classique. Attention : la préprod est en dollars et convertit en euros pour la France ; le prix en dollars est réglé pour dépasser 1 000 € après conversion.

## 3. Les collections

Toutes sont publiées et cachées de la recherche. Elles sont dans le menu, sous l'entrée « QA » (section 3 bis).

**En-tête de collection.** Le thème en a trois, réglés par collection (`custom.plp_header_variant`) :

| En-tête | Ce qu'on voit | Collections de la préprod qui l'utilisent |
|---|---|---|
| Carrousel d'images (`carousel_images`) | Titre (« Sacs par collection »), carrousel de photos des modèles, « Voir tout ». **Le plus souvent à tester** (demande QA) | 26, dont Sacs, Cyme, Numéro Un |
| Titre seul (`title`) | Grand titre (« Nouveautés ») | 2 : Bestsellers, À offrir |
| Liste de liens (`list_text`), probablement les onglets | Liste de liens au-dessus de la grille | 23, dont Crossbody, Wallets, Belts. Mis de côté pour l'instant (décision QA) |

Le contenu du carrousel est un métaobjet (`plp.carousel`). Pour ne pas en créer (Matrixify), les collections QA **réutilisent le carrousel de Sacs**. Conséquence : si l'équipe modifie le carrousel de Sacs (nouvelle collection, nouvelle photo), il change aussi sur les collections QA. Les comparaisons au pixel masqueront donc la zone du carrousel, et ses liens seront vérifiés par le code. Le contenu du métaobjet n'a pas pu être lu (la CLI n'a pas le droit `read_metaobjects`).

| N° | Titre | En-tête | Contenu | Réglages | Ce qu'elle permet de tester |
|---|---|---|---|---|---|
| C1 | QA Collection | Carrousel | Produits QA01 à QA22 (tag `qa-fixture`), ordre fixe | Sans défilement infini, moins de 48 produits | **Grille de référence comparée au pixel**, carrousel d'en-tête, tous les états de carte, tri par prix, filtres (couleur, matière, taille), ajout rapide, vue grande / compacte |
| C2 | QA Collection Infinite Scroll | Carrousel | QA + remplissage (60) | Défilement infini | Chargement de la suite au défilement, nombre total |
| C3 | QA Collection Load More | Carrousel | Les mêmes 60 | Sans défilement infini | Bouton « Voir plus » (comportement relevé sur Crossbody) |
| C4 | QA Collection Breaks | Carrousel | Une dizaine de produits QA | **PLP breaks** : grande carte produit, bandeau, collection visuelle, titre et description de la collection, bloc média. Petites cartes par défaut. Étiquette « New » désactivée | Chaque type de break, la grille compacte par défaut, l'absence d'étiquette « New » (alors qu'elle s'affiche dans C1) |
| C5 | QA Collection Title | Titre seul | Une dizaine de produits QA | | En-tête titre seul (comme « Nouveautés ») |
| C6 | QA Collection Empty | Titre seul | Aucun produit | | Message de collection vide (11 vraies collections sont vides, constat 8) |
| C7 | QA Collection Out of Stock | Titre seul | Ruptures seulement (QA02, QA11, QA14) | | Collection sans aucun produit achetable |
| – | family_qa-cyme-mini | – | QA13 à QA15 | Collection de famille, hors menu | Coloris de QA13 à QA15 (si le thème passe bien par là) |

## 3 bis. L'entrée « QA » du menu

Demande QA du 7 octobre 2026 : les collections QA doivent être accessibles depuis le menu de la préprod.

- Une entrée **« QA »** à la fin du menu principal, avec C1 à C7 en sous-liens. C1 en premier.
- Les tests pourront y passer comme un client (desktop et mobile : « QA » puis « Voir tout »), en plus du parcours par « Sacs ».
- Le panneau du menu d'une collection se règle aussi par la collection (`menu.type_of_menu` : packshot avec titre, liste de liens avec images, images). Les réglages existants sont réutilisés, sans nouveau métaobjet.
- Visible par toute personne qui navigue sur la préprod : c'est voulu.
- Il faut un droit de plus pour la CLI : la navigation de la boutique (`read_online_store_navigation`, `write_online_store_navigation`).
- À vérifier avec l'équipe : les réimports de la prod remplacent-ils aussi le menu ? Si oui, le script remettra l'entrée « QA ».

## 4. Ce qu'on ne duplique pas

| Quoi | Pourquoi | Comment on le teste |
|---|---|---|
| Menu, header, accueil, pages éditoriales, boutiques | Ce sont des contenus, pas des cas de produit. Les copier ferait un second site | Par les contrôles de santé (lot A) et l'IA (lot D), sur les vraies pages |
| Les vraies collections (Sacs, Crossbody…) | Le parcours d'un client passe par le vrai menu | Parcours nominal par le menu (gardé), test de structure en prod |
| Le compte client de test (`+qacompte`) et le profil P1 | Ils existent déjà | Tels quels |
| Les réglages du checkout (livraison, paiement) | Communs à toute la boutique | Tels quels |
| Les vrais produits fixes de ce matin (P01 à P09) | Remplacés par les copies QA | Le test de santé passera sur les copies |

## 5. Ce qui viendra plus tard (autres droits ou autres phases)

- **Codes promo QA** : pourcentage, montant fixe, livraison offerte, expiré, montant minimum. Il faut le droit `write_discounts`.
- **Commandes et clients en lecture** (`read_orders`, `read_customers`) : vérifier les commandes de test, retrouver le client.
- **Page témoin** avec toutes les sections du thème : c'est une page de contenu, elle crée des métaobjets, donc à voir avec les devs à cause de Matrixify.
- **Autres marchés** (UK, JP…).

## 6. L'effet sur la préprod

- **60 produits** (22 cas + 38 de remplissage), **8 collections** et **une entrée de menu**, tous préfixés « QA ».
- Ils entreront quand même dans les collections techniques qui prennent tous les produits ayant un prix (`api`, `easygift-all-products`, `globofilter-best-selling-products-index`) ou un poids (`facebook-feed`), et dans `cart-recommendations-failover` (tout produit en stock). Celle-ci pourrait proposer un produit QA dans le panier quand Shopify n'a pas d'autre suggestion. Pour sortir de `facebook-feed`, les copies auront un poids de 0.
- Les recommandations automatiques de Shopify peuvent proposer un produit QA, car la mention « caché de la recherche » ne joue pas sur elles.
- Droits nécessaires pour la CLI : produits, stocks, publications et navigation (menu), en lecture et en écriture, plus la lecture des métaobjets (pour vérifier le carrousel réutilisé). Rien sur les commandes, les clients ou le thème, et pas d'écriture des métaobjets.

## 7. Le Roll Out de la fiche produit

L'équipe compare l'ancienne et la nouvelle fiche avec la fonction Roll Out : chaque navigateur de test tombe sur l'une ou l'autre. Les tests devront **choisir la version** à chaque lancement, et idéalement passer sur les deux. Sans ça, les références visuelles des fiches QA ne seront pas stables.

## 8. Comment on avance

1. **Valider ce plan** (liste, noms, collections, questions ci-dessous).
2. **Pilote** : créer QA02 seul, C1 avec ce seul produit (en-tête carrousel) et l'entrée « QA » du menu. Vérifier la fiche, la carte, le carrousel, le menu, l'absence dans la recherche et dans les autres collections, puis le comportement après un réimport si possible.
3. **Test de base** : le test de santé passe sur QA02 et C1.
4. **Extension** : les autres produits et collections, puis les tests qui s'en servent.

## 9. Questions

| Question | Réponse (7 octobre 2026) |
|---|---|
| Réimports prod → préprod : quel outil, suppriment-ils les produits absents de la prod, remplacent-ils le menu ? | **En attente** : la QA pose la question à l'équipe. Le script recrée tout de toute façon |
| Produits de remplissage (38) | Oui. Repli possible sur la collection Sacs |
| Carte cadeau | Non |
| `cart-recommendations-failover`, flux Facebook / Google | Inconnu, sans importance pour l'instant |
| Titres en anglais | Oui |
| Entrée « QA » dans le menu | Oui, demandée par la QA |
| En-têtes | Surtout le carrousel ; quelques collections en titre seul ; les onglets plus tard |
