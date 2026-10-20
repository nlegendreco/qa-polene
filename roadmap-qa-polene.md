# Roadmap QA Polène

> Polène · QA automatisée · Version à valider · 1er octobre 2026

On commence petit : un POC qui prouve deux choses (un parcours testé automatiquement avec un rapport lisible, et des tests visuels avec un rapport lisible). Ensuite seulement, on déroule étape par étape jusqu'à l'automatisation complète.

## Vue d'ensemble

| Étape | Contenu | Durée estimée |
|---|---|---|
| **POC 1** | Parcours + rapport | ~3 jours |
| **POC 2** | Visuel + rapport | ~4 jours |
| **Décision** | Go / No-Go | 1 démo |
| Phase 1 | Préprod déterministe | ~1 semaine |
| Phase 2 | TNR préprod complet | ~3 semaines |
| Phase 2 V2 | Fiabiliser la suite, première MEP | à mesurer |
| Phase 3 | Scope de release (Jira) | ~1 semaine |
| Phase 4 | Cycle MEP et références | ~1 semaine |
| Phase 5 | CI et surveillance prod | ~1 semaine |
| Phase 6 | IA, tous les sites | en continu |

Légende des intervenants : **QA**, **Claude Code**, **Devs**, **Équipe** (QA + devs + PO).

## Avancement

> Mis à jour le 16 octobre 2026. **POC 1 et POC 2 validés par la QA (7 octobre). Phase 1 faite (9 octobre) : données QA créées et contrôlées (40/40). Phase 2 en cours depuis le 12 octobre : pages de sections (69 sections du thème sur 83), espace client connecté, fiches TNR de la QA relevées (2.1, 13 octobre), états produit, cartes, panier et erreurs du checkout terminés (2.2, 14 octobre), reste du site codé (2.3, 15 octobre : collections, recherche, favoris, galerie et 3D, panier vide, checkout, espace client, en-tête et accueil), en attente des réponses de la QA ; contrôles automatiques et accessibilité axe en cran (2.4, 16 octobre), références de structure (2.5, 16 octobre) : toute la phase 2 est codée, la QA relit. Prochaine étape : V2, fiabiliser la suite (bugs connus marqués, tests instables, commande MEP), puis première MEP testée (2.6). Reste du POC : critère des 10 minutes à la première MEP.**

| Étape | Statut | Détail |
| --- | --- | --- |
| 1.1 Préparer le dossier | ✅ Fait | Projet dans `~/Developer/qa`, dépôt GitHub `nlegendreco/qa-polene` |
| 1.2 Configurer les 4 appareils | ✅ Fait | Desktop Chrome, desktop Safari, iPhone 15, Pixel 7 |
| 1.3 Neutraliser ce qui perturbe | ✅ Fait | Bandeau cookies, AB Tasty, Klaviyo, pixels publicitaires. Fenêtre de géolocalisation de la préprod (« It looks like you're in France… ») fermée automatiquement depuis le 7 octobre 2026, jour où elle a bloqué les 4 parcours préprod |
| 1.4 Parcours d'achat nominal | ✅ Fait | 8/8 : prod jusqu'au checkout, préprod jusqu'à la confirmation de commande et au questionnaire « Comment avez-vous connu Polène Paris ? » (10 étapes) |
| 1.5 Rapport | ✅ Fait | Étapes en français, capture par étape, vidéo, trace et requêtes lentes en cas d'échec |
| 1.6 Échec volontaire | ✅ Fait | Démo `npm run test:demo-echec`, rapport jugé clair par la QA |
| Profil client P1 | ✅ Fait | 60 rue du Louvre, 01 99 00 00 00, questionnaire « Bouche à oreille » enregistré (commande VVGWK0PJK) |
| Archive des POC | ✅ Fait | 7 octobre 2026 : exécution de référence des deux POC (tnr 17/17 dont 4 commandes préprod, visuel 12/12, régressions 8/8 détectées, démo d'échec) dans `archives/2026-10-07-poc/` (hors Git, zip sur le drive interne), sommaire par `npm run rapport:polene -- archives/2026-10-07-poc`. Déroulé de démo dans [docs/demo-poc.md](docs/demo-poc.md) |
| 2.1 Choisir les pages | ✅ Fait | Accueil, fiche Numéro Un noir grainé, panier avec ce produit. **Prod uniquement** (décision QA du 2 octobre 2026). Collections retirées des pixels le 6 octobre 2026 (stocks qui changent plusieurs fois par jour) : Sacs et Crossbody (avec PLP break) vérifiées par leur structure (`tests/structure-collections.spec.ts`, décision QA) |
| 2.2 Stabiliser les captures | ✅ Fait | 10 passages de suite (160 captures) : 0 fausse alerte. 3 captures ont eu besoin du second essai automatique (2 ratés de dessin Safari, 1 page trop lente), 1 vraie anomalie passagère détectée (logos de paiement non chargés sous Safari) |
| 2.3 Référence prod | ✅ Reprise | 6 octobre 2026, accord QA : accueil (nouvelle campagne, carrousels automatiques figés) et panier (bloc « Polène suggère » à hauteur fixe) repris, fiche produit inchangée. 12 captures. Anciennes références gardées dans `archives/references/<date-heure>/` (sauvegarde automatique avant chaque reprise). Seuil de couleur passé de 0,3 à 0,2 ; aucune fausse alerte sur 2 passages complets, 1 partiel et 1 panier seul (série de 10 à refaire avant la première MEP) |
| 2.4 Format de rapport | ✅ V1 faite | Rapport Polène sur mesure, gratuit, en français (`npm run rapport:polene`) : tableau de bord avec statistiques et historique, liste filtrable, fiche de test avec vidéo, trace et comparateur visuel. Charte de polene-paris.com (polices, logo, couleurs). Argos et Allure écartés. À faire relire par la QA |
| 2.5 Régressions injectées | ✅ Fait | 4 régressions × 2 appareils, 8/8 détectées (`npm run test:regressions`, 6 octobre 2026). Le prix masqué ne change que 44 à 45 pixels : aucune tolérance en nombre de pixels |
| Cartographie du site | ✅ Fait | 6 octobre 2026 : 629 pages de la prod inventoriées, découpage en lots A (santé du site), B (invariants par page), C (pixel sur contenu figé), D (revue IA), à trancher par la QA |
| Phase 1.1 Produits fixes | ✅ Validés | 7 octobre 2026 : 9 produits choisis dans le relevé de la préprod (474 produits visibles), tous déjà dans l'état voulu et présents en prod. Pas de produit « moyens de paiement » (carte seule en préprod). Détail : [docs/produits-fixes.md](docs/produits-fixes.md) |
| Phase 1.2 Convention d'équipe | ✅ Fait | Tag `qa-fixture` sur des copies QA des produits, annoncé à l'équipe. Plan des données QA validé par la QA le 9 octobre 2026 ([docs/plan-donnees-qa.md](docs/plan-donnees-qa.md)). La copie en précommande 2030 (QA05) remplace le report de date de Solé Tan |
| Phase 1.3 Accès API admin | 🟡 Lecture OK | 7 octobre 2026 : CLI Shopify installée dans le projet, `shopify store auth` avec le compte de la QA, sans app ni clé à demander. Lecture des produits, stocks et champs personnalisés vérifiée. Écriture à demander au moment de modifier. Jeton temporaire : pour la CI (phase 5), il faudra une clé permanente |
| Phase 1.4 Remise en état | ✅ Fait | 9 octobre 2026 : `npm run donnees:qa` crée ce qui manque et remet en état ce qui a bougé (tags, stocks, publication, réglages, entrées du menu), à partir de `data/donnees-qa.json`. Montre les changements et attend « oui ». Données créées le 9 octobre 2026 : 22 produits QA, 38 de remplissage, 7 collections (C4 PLP breaks à part), en 25 min ; relance = « Rien à modifier ». Entrée « QA Collection » ajoutée à la main par la QA dans le menu Accessories. Depuis le 12 octobre 2026, le parcours d'achat préprod achète QA01 (44/44, 4 commandes) |
| Phase 1.5 Santé des données | ✅ Fait | `npm run test:donnees` (et dans `test:preprod`) : 40 contrôles depuis le 9 octobre 2026 (9 produits fixes, 22 produits QA avec leurs tags exacts, 7 collections QA, absence de la recherche), 40/40 au premier passage. Depuis le 13 octobre 2026, contrôle aussi le prix en dollars des produits QA (les euros de `/fr-fr/` suivent le taux de change du jour). Avant : 9 contrôles sur Chrome, sans commande. 4 passages verts ; deux attentes faussées exprès bien signalées (« P04 Rupture totale n'est plus en rupture… »). Reconnaît l'ancienne et la nouvelle fiche produit, qui alternent en préprod depuis le 7 octobre 2026 (Roll Out) |
| Passe exploratoire | ✅ Fait | 6 octobre 2026 : 55 interactions × 4 appareils en prod, 17 pages représentatives × 4 appareils, compte client préprod (desktop + iPhone), sans commande. Classement par page dans [docs/automatisation-par-page.md](docs/automatisation-par-page.md) |
| Phase 2.1 Cartographies TNR | ✅ Fait | 13 octobre 2026 : les 59 fiches TNR de la QA (PDP, PLP, panier, checkout, espace client, non exhaustives) comparées aux tests : 1 couverte, 37 en partie, 21 pas du tout ([docs/couverture-tnr.md](docs/couverture-tnr.md)). Décision QA : les fiches sont sur un ancien modèle, on garde leur liste d'éléments et leur criticité, le site fait foi et les fiches peuvent être réécrites. Éléments répartis dans 2.2 et 2.3, Bloquants d'abord. Classement de la prod du 6 octobre 2026 toujours dans [docs/automatisation-par-page.md](docs/automatisation-par-page.md) |
| Phase 2.2 États produit | ✅ Fait (14 octobre 2026) | 14 octobre 2026, fin de l'étape : coming soon QA04 (fiche et carte, fenêtre d'inscription refusant un email vide ou « test@ »), nouveauté QA08 (« New in » sur la carte), précommande expirée QA07 (redevenue normale) et retardée QA06 (date `preorder.date` affichée), coloris QA13 à QA15 (PDP-05), titre long QA21 (fiche, carte, panier, checkout), prix QA17 et QA18 (PDP-04), double clic et barre d'achat fixe mobile (PDP-07), ajout rapide depuis la carte, en stock et à tailles (`tests/cartes-collection.spec.ts`, PLP-04), « Être prévenu(e) » avec email invalide depuis la carte (PLP-07, PDP-08), récapitulatif du panier (CART-04), erreurs du checkout sans commande et lien des CGV en prod et en préprod (`tests/checkout-erreurs.spec.ts`, CHECKOUT-03 à 06), cartes refusées sur Chrome ordinateur (accord QA). Volontairement laissés : code promo (décision QA), nouvelle fiche produit (tests en « ignoré » quand le Roll Out la sert), envois réels des fenêtres d'inscription. Constats 37 à 39. Avant : 12 octobre 2026 : rupture (QA02) sur la fiche et la carte de collection, 4 appareils, sans envoi ni commande (`tests/etats-produit.spec.ts`). 13 octobre 2026 : précommande (QA05, PDP-07) de la fiche jusqu'à l'arrivée au checkout (bouton, date d'expédition, notification, ligne du panier et propriétés `_is_preorder` / `_preorder_date`, total), plus la carte de la collection C5, 4 appareils, 8/8, sans commande. 13 octobre 2026 : tailles (QA10 tailles partielles, QA12 une taille en précommande, QA11 toutes épuisées, PDP-06) sur l'ancienne fiche, 4 appareils, 12/12 ; la nouvelle fiche reste à faire quand le Roll Out la remontre. Rupture de la fiche en échec depuis le 13 octobre : « Notify me » n'ouvre plus la fenêtre sur l'ancienne fiche (constat 33, à confirmer). 13 octobre 2026 : panier (`tests/panier.spec.ts`, CART-01, 03, 04) : +/−, suppression avec confirmation, panier vide, dernière pièce QA03 bloquée à 1 avec message, 4 appareils, 8/8. 14 octobre 2026 : onglets d'information et guide des tailles de la fiche (`tests/fiche-produit.spec.ts`, QA09, PDP-09 et PDP-06, ancienne fiche) : 4 onglets dans l'ordre, aucun ouvert au chargement (normal sur l'ancienne fiche), un seul contenu affiché à la fois, Entrée au clavier, diamètre de chaque taille dans « Size & fit », 4 appareils, 8/8. 14 octobre 2026 : panier mixte QA01 + QA05 (CART-02) jusqu'à l'arrivée au checkout sans payer, 4 appareils. Checkout complet : parcours invité (4 appareils) et client connecté (13 octobre 2026, commande T19581) |
| Phase 2.3 Reste du site | 🟡 Codé, à valider | 15 octobre 2026 : collections (structure de C1, C5, C7 en préprod, menu des sous-collections, filtres et tri, « Voir plus », défilement infini, collection vide), recherche, favoris (visiteur et compte, en préprod et en prod ; les deux bugs des favoris de la prod sont détectés, constats 48 et 51), fiche produit (fil d'Ariane, zoom, fenêtre des photos, vue 3D, savoir-faire), panier vide, checkout (résumé mobile, paiement express, blocs d'information), espace client (menu, accueil, profil en lecture seule, suppression du compte jusqu'à la confirmation, assistance), en-tête, pied de page et accueil (liens, menus, newsletter en saisies invalides, vidéo). Série complète : 163 réussis, 25 en échec dont 19 écarts réels (constats 45 à 50). Le soir, derniers trous des fiches comblés : tailles épuisées sur la carte (PLP-04), favoris depuis le panier (CART-03, constat 55), panier de 10 produits (CART-02), pays de livraison et clavier numérique au checkout (CHECKOUT-03 et 04, prod et préprod), alerte de retour en stock réelle posée puis annulée sur le compte de test (PDP-08, ACCOUNT-18, accord QA), colonnes de l'historique et formulaire d'adresse vide refusé (ACCOUNT-05, 06, 13). Hors de 2.3 par décision : envoi réel des formulaires, code promo, adresse secondaire (constat 21). Reste : validation de la QA. Le même jour, après l'annonce du Roll Out 50/50 en prod : les tests de la fiche tournent sur les deux fiches à chaque lancement (choix par cookie, `src/fiches.ts`), nouvelle fiche écrite pour les tailles, les onglets, le guide des tailles, les coloris et la barre d'achat fixe sur mobile, référence visuelle de l'ancienne fiche prise en prod ; compte de test de la prod créé, favoris de la prod verts (constats 48 et 51 corrigés en prod). Détail : [docs/couverture-tnr.md](docs/couverture-tnr.md#phase-23-15-octobre-2026). Avant : étiquettes de page en anglais sur tous les tests (`@home`, `@plp`, `@pdp`, `@cart`, `@checkout`, `@account`, `@sections`…). Pages de sections (3 articles « Sections », UAT accessibilité, design system) et 19 pages réelles (accueil, fiche, panier, recherche, blogs, boutiques, Savoir-Faire…) : 69 des 83 sections du thème testées, sur Chrome ordinateur et iPhone (les 4 appareils sont gardés pour les parcours critiques, limite d'appels Shopify) ; 47/48, le design system déborde sur iPhone. Espace client connecté (13 octobre 2026) : 7 pages × 2 appareils, 14/14, sans envoi de formulaire. |
| Phase 2.4 Contrôles automatiques | ✅ Codé, à valider (16 octobre 2026) | Sur les pages de sections, les pages réelles et l'espace client : images affichées toutes chargées, pas de débordement sur mobile, pas de « translation missing » ni « Liquid error », aucune erreur JS (hors outils bloqués par les tests). 16 octobre 2026 : les 16 pages réelles qui existent en prod y passent les mêmes contrôles (32/32 ; défilement infini retiré pour le contrôle des images, comme dans les tests visuels). Accessibilité axe (`npm run test:accessibilite`, [docs/accessibilite.md](docs/accessibilite.md)) : relevé par page (51 pages, Chrome ordinateur et iPhone, prod et préprod), en cran : seul un problème absent du relevé échoue, ce qui est en cours de correction est noté, ce qui est corrigé s'enregistre avec `npm run test:accessibilite:maj` (accord QA). Premier relevé : 8 types de problème, aucun sur l'accueil, les fiches et le panier. Bouton pause / lecture des vidéos au clavier (page UAT, 13 boutons, Chrome et Safari). Reste : fenêtres et menus ouverts, autres tests au clavier, annonces des lecteurs d'écran, Safari et Android |
| Phase 2.5 Références de structure | ✅ Codé, à valider (16 octobre 2026) | `npm run test:structure` ([docs/structure.md](docs/structure.md)) : titres, boutons et liens de 49 pages en préprod et en prod (pages de sections et pages réelles, fiche produit sur les deux fiches du Roll Out, espace client), en-tête (menus compris) et pied de page, Chrome ordinateur et iPhone, 102 tests comparés à `references/structure/`. Zones qui changent seules exclues (cartes produit et d'articles, carrousels, recommandations, Instagram), prix et compteurs masqués. Deux passages de suite verts après les réglages (cartes d'articles de La Maison chargées au défilement, fenêtre de géolocalisation, attente que la page ne change plus). Détection vérifiée : bouton renommé et adresse du lien « Sacs » changée dans la référence, les deux signalés (« disparu » / « nouveau »). Avant : structure des collections (cartes, prix, photos, colonnes, PLP breaks) |
| Catalogues et conservation | ✅ Fait (20 octobre 2026) | Demande QA : `npm run type -- <nom>` (parcours, fonctionnel, contrôles, accessibilité, structure, données, visuel, démos) et `npm run page -- <nom>` (home, plp, pdp, cart, checkout, search, account, content, sections), chacun dans sa série et rangé ainsi dans le sommaire. Chaque lancement gardé (`lancements/`), allégé après 30 jours sauf ses tests en échec, historique de 200 lancements, plus rien d'écrit par un `--list`. Vérifié : page Recherche 21/21 puis relances rangées, allègement d'un faux lancement de 30 jours (30 Mo → 0,3 Mo, test en échec gardé complet). Détail : [docs/catalogue.md](docs/catalogue.md) |
| Phase 2 V2 Fiabiliser | ⬜ Prochaine étape | Bugs connus marqués comme attendus, tests instables corrigés un par un, commande « MEP » (prod puis préprod). Détail dans « Phase 2 V2 » |
| Phase 2.6 En parallèle de la recette manuelle | ⬜ Pas commencé | QA, pendant 1 ou 2 releases |

## Ce qui est déjà acté

- La référence, c'est la prod [polene-paris.com](https://www.polene-paris.com/) (pas de spécifications écrites).
- Les références sont mises à jour après chaque MEP, avec l'accord de tout le monde.
- Préprod = boutique séparée `asia-polene`, protégée par mot de passe, checkout et achats complets possibles.
- Catalogue préprod non iso : une dizaine de produits fixes à statut forcé, pour des tests déterministes.
- D'autres personnes modifient la préprod : il faudra une convention sur les produits de test.
- Coming soon et précommande sont des métachamps basculés à la main ; la précommande expire seule après sa date.
- Accès API d'administration sur la préprod : d'accord sur le principe, à mettre en place.
- Le périmètre de chaque release (Jira) doit être connu avant de lancer le TNR.
- Périmètre (QA, 16 octobre 2026) : Polène FR (prod) et la préprod ASIA suffisent pour l'instant ; pas besoin de code promo, de PayPal ni de Klarna ; emails à faire plus tard. Les autres boutiques (UK, JP…) restent en phase 6.

---

## POC : prouver que ça marche, sur un périmètre minuscule

> ✅ POC 1 et POC 2 validés par la QA (7 octobre 2026).

Le POC tourne en local sur un Mac, sans CI et sans outil payant. Il touche la prod FR en lecture seule (aucune commande) et la préprod `asia-polene`, où l'achat va jusqu'à la confirmation. Les rapports présentés à la fin sont les vrais rapports, pas des maquettes.

### POC 1 : un test de parcours, avec son rapport (~3 jours)

#### 1.1 Préparer le dossier
*QA · Claude Code*

Projet Playwright en TypeScript dans le dossier `qa`, versionné avec Git. Le mot de passe préprod va dans un fichier `.env` local, jamais dans le code ni dans le chat.

**Livrable :** une commande `npm test` qui lance un test vide sur les 4 appareils.

#### 1.2 Configurer les 4 appareils
*Claude Code*

Desktop Chrome et Safari en 1440 px, iPhone 15 (Safari) et Pixel 7 (Chrome) émulés.

**Livrable :** chaque test tourne automatiquement 4 fois, une par appareil.

#### 1.3 Neutraliser ce qui perturbe
*Claude Code · QA*

- Saisie du mot de passe préprod une seule fois, puis réutilisation de la session.
- Fermeture automatique de la popup de géolocalisation et des popups Klaviyo.
- AB Tasty bloqué pendant les tests.

**Livrable :** les tests voient la page comme un visiteur qui a déjà tout fermé.

#### 1.4 Écrire le parcours d'achat nominal
*QA · Claude Code*

Vous décrivez le parcours avec vos mots, Claude Code l'écrit. Home → menu → collection → fiche produit en stock → ajout au panier → panier → checkout.

- **Prod FR** : arrêt à l'arrivée sur le checkout (produits et prix présents), sans payer.
- **Préprod** : paiement de test jusqu'à la page de confirmation de commande.

**Livrable :** 1 test × 2 environnements × 4 appareils = 8 exécutions.

#### 1.5 Produire le rapport
*Claude Code*

Rapport HTML Playwright : statut par appareil, étapes nommées en français, capture à chaque étape, vidéo et trace (frise chronologique cliquable : réseau, console, DOM) en cas d'échec.

**Livrable :** un fichier rapport qui s'ouvre dans le navigateur.

#### 1.6 Provoquer un échec exprès
*QA*

On simule une panne, par exemple le bouton « Ajouter au panier » masqué par le test lui-même, pour voir si le rapport permet de comprendre le problème sans aide.

**Livrable :** votre avis : le rapport est-il clair, que manque-t-il ?

### POC 2 : des tests visuels, avec leur rapport (~4 jours)

#### 2.1 Choisir 4 pages
*QA*

Home, une collection, une fiche produit (toujours la même), le panier. Avec 4 appareils, cela fait 16 captures par passage.

#### 2.2 Stabiliser les captures
*Claude Code*

- Animations coupées, carrousels figés sur la première slide, date et heure figées.
- Attente du chargement des images et des polices.
- Zones qui bougent seules masquées (compteur wishlist, blocs de recommandation).

**Livrable :** 10 passages de suite sans aucune différence détectée.

#### 2.3 Capturer la référence sur la prod
*Claude Code · QA*

Première référence prise sur polene-paris.com. Vous la relisez, c'est votre « état validé ».

#### 2.4 Comparer deux formats de rapport
*QA*

| | Playwright natif | Argos (gratuit au POC) |
|---|---|---|
| Affichage | Dans le rapport HTML : attendu, obtenu, diff, curseur | Interface web : diff surligné, côte à côte, historique |
| Accepter un changement | Relancer avec une commande | Bouton « Approuver » |
| Partage avec l'équipe | Envoyer le fichier | Un lien |
| Coût | 0 € | 0 € jusqu'à 5 000 captures/mois |

**Livrable :** votre choix de format pour la suite.

#### 2.5 Injecter des régressions visuelles
*QA · Claude Code*

Le test ajoute lui-même du CSS cassé, sans toucher au site : prix masqué, header décalé de 10 px, image produit absente, texte qui déborde en mobile.

**Livrable :** chaque régression est détectée et visible dans le rapport.

#### 2.6 Bonus : revue IA des 16 captures
*Claude Code*

Claude examine chaque capture avec une grille par type de page et liste ce qui semble cassé. Résultat à titre indicatif, pour voir si cela vaut la peine de continuer.

### Décision Go / No-Go : démo à l'équipe

Le POC est validé si toutes ces cases sont cochées :

- [x] Le parcours passe sur les 4 appareils, en prod (jusqu'au checkout) et en préprod (jusqu'à la confirmation).
- [x] 5 relances d'affilée donnent 5 fois le même résultat. *Mesuré en prod (66/68 sur l'ensemble des passages, 1 lenteur réseau) ; en préprod, pas de série de 5 pour éviter 20 commandes.*
- [x] Un échec se comprend dans le rapport en moins de 5 minutes, sans aide d'un dev.
- [x] 10 passages visuels sans changement donnent 0 fausse alerte. *Mesuré le 2 octobre 2026 en prod, avec un second essai automatique (3 captures sur 160 en ont eu besoin).*
- [x] Les 4 régressions injectées sont toutes détectées. *8/8 (desktop Chrome + iPhone), revérifié le 6 octobre 2026 avec les nouvelles références.*
- [ ] Accepter un changement visuel attendu prend moins de 10 minutes. *À mesurer à la première MEP (décision QA du 6 octobre 2026).*
- [x] Le format de rapport visuel est choisi. *Rapport Polène sur mesure, gratuit (décision QA du 6 octobre 2026, Allure essayé puis écarté). V1 faite le jour même.*

---

## Phase 1 : une préprod déterministe (~1 semaine)

> **Étape en cours** (depuis le 7 octobre 2026). Proposition et état : [docs/produits-fixes.md](docs/produits-fixes.md).

Avoir des données de test qui ne bougent pas, pour que tout écart vienne de la release.

#### 1.1 Choisir les 10 produits fixes
*QA*

De vrais produits de prod (même handle), à statut forcé en préprod : en stock simple, tailles toutes dispo, tailles partielles, rupture totale, coming soon, précommande, nouveauté, multi-couleurs, petit prix, moyens de paiement.

#### 1.2 Fixer la convention d'équipe
*Équipe*

Tag `qa-fixture` sur ces produits, et personne d'autre ne les modifie. Date de précommande très lointaine, puisqu'elle expire seule.

#### 1.3 Créer l'accès API d'administration
*Devs*

App privée sur `asia-polene` uniquement, avec les droits produits, stock et métachamps.

#### 1.4 Script de remise en état
*Claude Code*

Avant chaque TNR, le script remet stock, métachamps et dates des 10 produits dans leur état prévu (les achats complets consomment du stock).

#### 1.5 Test de santé des données
*Claude Code*

Premier test lancé : il vérifie que chaque produit fixe affiche bien son statut. S'il échoue, il dit « produit #4 n'est plus en rupture » plutôt que de faire échouer le panier.

## Phase 2 : le TNR préprod complet (~3 semaines)

Remplacer votre passe manuelle sur la préprod par la suite automatique, page par page.

#### 2.1 Partir de vos cartographies TNR
*QA · Claude Code*

Les fiches TNR de la QA (59 fiches Word, faites sur un ancien modèle et pas forcément à jour) servent de **liste des éléments à couvrir et de criticité** (Bloquant, Majeur, Mineur), pas de spécification au mot près : quand une fiche contredit le site, c'est le site qui fait foi, et les fiches peuvent être réécrites librement. Relevé du 13 octobre 2026 dans [docs/couverture-tnr.md](docs/couverture-tnr.md) : ce qui est couvert, en partie, pas du tout. Dans les étapes suivantes, on traite les éléments Bloquants d'abord.

#### 2.2 Couvrir les états produit et les paniers combinés
*Claude Code*

Chacun des 7 états sur la fiche et dans les listes. Paniers en stock + précommande, codes promo, checkout complet. Éléments TNR concernés, par criticité :
- Bloquant : PDP-07 ajout au panier selon l'état, PDP-06 tailles, PDP-05 coloris, PDP-04 bloc d'infos, PLP-04 carte et ajout rapide, CART-02 et CART-03 lignes du panier (quantité, suppression, précommande, dernière pièce), CART-04 récapitulatif, CHECKOUT-03 à 06 (erreurs du formulaire, cartes refusées, sans commande).
- Majeur : PDP-08 et PLP-07 « Être prévenu(e) », CHECKOUT-07 récapitulatif et code promo.

#### 2.3 Couvrir le reste du site
*Claude Code*

Recherche, filtres, compte client, wishlist, newsletter, « Être prévenu(e) », pages boutiques et Savoir-Faire. Éléments TNR concernés :
- Bloquant : PLP-03 grille des collections en préprod, CART-01 panier vide, CHECKOUT-02 paiement express (présence en prod), ACCOUNT-07 à 10 profil et préférences marketing (lecture seule).
- Majeur : PLP-01 menu de collection, PLP-02 filtres et tri, PLP-05 et PDP-08/09 favoris, PLP-06 « Voir plus », PDP-02, 03, 09 et 12 galerie, onglets, 3D, CART-07 carrousels, CHECKOUT-01 résumé fixe mobile, ACCOUNT-01 à 06 et 11 à 23, header et accueil (grille Mandatory).
- Mineur : PDP-01, 10, 11, CART-05, 06, 08, CHECKOUT-08.

#### 2.4 Ajouter les contrôles automatiques
*Claude Code*

Images toutes chargées, pas de débordement horizontal en mobile, pas de clé de traduction visible, aucune erreur console, accessibilité (axe).

Fait le 16 octobre 2026 : les quatre premiers contrôles sur les pages de sections, les pages réelles (préprod, et prod depuis le 16 octobre) et l'espace client ; axe en « cran » sur 51 pages (l'équipe corrige l'accessibilité au fil de l'eau, sans liste à jour : seul un problème absent du relevé de la page fait échouer). Détail, premier relevé et reste à faire : [docs/accessibilite.md](docs/accessibilite.md).

#### 2.5 Ajouter les références de structure
*Claude Code*

Pour chaque page, Playwright enregistre la liste des liens du menu, des titres et des boutons. Il détecte un lien disparu ou un bouton renommé, même quand le visuel change peu.

Fait le 16 octobre 2026 (`npm run test:structure`, [docs/structure.md](docs/structure.md)) : titres, boutons et liens de 49 pages (préprod et prod, mêmes pages que l'accessibilité sans le checkout), en-tête (menus compris) et pied de page, Chrome ordinateur et iPhone, 102 tests. Ce qui change seul (cartes produit et d'articles, carrousels, recommandations, prix, compteurs) n'est pas relevé. Changement voulu : `npm run test:structure:maj` (accord QA).

#### 2.6 Faire tourner en parallèle de votre recette manuelle
*QA*

Pendant 1 ou 2 releases, vous faites les deux et vous comparez : ce que la suite rate, ce qu'elle trouve en plus.

C'est la première MEP testée avec la suite (objectif de la QA, 16 octobre 2026) : elle vient après la V2 ci-dessous.

### Phase 2 V2 : fiabiliser la suite avant la première MEP

*Claude Code · QA*

Décidé avec la QA le 16 octobre 2026 : on finit d'abord toute la phase 2, même avec des réglages en attente (la QA les relit ensuite), puis on corrige les tests un par un. Le but : tester rapidement la non-régression d'une MEP. Un test en échec à cause d'une nouvelle feature est acceptable : la QA sait dire ce qui est vrai ou faux, tant que c'est remonté proprement et filtrable dans le Rapport Polène.

#### V2.1 Marquer les bugs connus comme attendus
Chaque test laissé volontairement en échec sur un bug déjà connu (constats 45, 46, 47, 50, 27…) est marqué « échec attendu » avec son numéro de constat : visible dans le rapport, mais la série ne rougit plus pour lui. Le jour où l'équipe corrige le bug, le test le signale (« attendu en échec, mais il passe ») et on retire la marque. Une série rouge veut alors dire : problème nouveau.

#### V2.2 Corriger les tests instables, un par un
Lancer la série complète (sans les paiements préprod, sauf accord), relever chaque échec qui ne vient ni d'un bug connu ni du site, et le corriger : 3D sous Chrome sur un Mac chargé, saisie trop rapide sous Safari et Android, menu Android, connexion iPhone (« Blocked a frame … shop.app », vu une fois le 16 octobre 2026), limite d'appels Shopify (429). Critère : deux séries complètes de suite sans échec en dehors des bugs connus et des changements voulus.

Rapport Polène, fait le 20 octobre 2026 ([docs/catalogue.md](docs/catalogue.md)) : un `--list` réécrivait le rapport de la série avec tous les tests « ignorés » (les rapports des grandes séries des 14 et 15 octobre 2026 sont perdus ainsi, et remplacés par les lancements suivants). Désormais, rien n'est écrit sans test joué, les faux lancements ont été retirés des historiques, et chaque lancement est gardé (30 jours complet, puis tests en échec seulement), validé par la QA.

#### V2.3 Une commande « MEP »
Une seule commande pour le jour de MEP, avec un verdict clair et sa durée mesurée. Ordre voulu par la QA : la prod d'abord, puis la préprod. À noter : lancée avant le merge, la préprod peut aussi servir à arrêter une MEP ; à trancher au moment de l'écrire. Base de la phase 4 (smoke après merge).

#### V2.4 Plus tard, quand la suite est fiable
- Appareils (QA, 20 octobre 2026) : les navigateurs les plus utilisés sont Safari iOS, Chrome iOS, Chrome Android, Safari macOS et Chrome macOS. Les 4 appareils des tests les couvrent déjà (émulés) : `iphone` (WebKit, le moteur de Safari et de Chrome sur iOS, Apple impose WebKit à tous les navigateurs iPhone), `android` (Chrome Android), `desktop-safari`, `desktop-chrome`. Règle : les tests critiques sur les 4 ; les autres sur Chrome ordinateur + Safari mobile (`desktop-chrome` + `iphone`, la combinaison déjà utilisée par les tests limités). Proposition à valider par la QA : passer aux 4 appareils l'espace client en lecture et les cartes refusées du checkout (Bloquants, aujourd'hui Chrome ordinateur seul pour les cartes) ; garder sur Chrome ordinateur + iPhone les pages de sections, l'accessibilité axe et la structure (contenu de la page, pareil d'un navigateur à l'autre), les favoris du compte de la prod (une connexion par appareil, le compte se bloque après plusieurs échecs) ; garder sur un seul appareil ce qui crée quelque chose de réel (alerte de retour en stock, commande du compte). À faire en tenant compte de la limite d'appels Shopify (429).
- Accessibilité, suites de la 2.4 : fenêtres et menus ouverts sous axe, autres tests au clavier, annonces des lecteurs d'écran ([docs/accessibilite.md](docs/accessibilite.md)).
- Emails (voir « Pistes gardées pour plus tard ») : à faire, pas encore nécessaire.

## Phase 3 : le périmètre de release avant le TNR (~1 semaine)

Savoir avant de lancer le TNR ce que la release est censée changer, pour qu'un changement voulu ne soit pas compté comme un échec.

#### 3.1 Version simple : un fichier de périmètre
*QA*

Avant chaque TNR, vous listez les pages et composants touchés par la release. Les écarts dans ce périmètre apparaissent « à valider », ceux en dehors « régression probable ».

#### 3.2 Connexion à Jira
*Claude Code · Devs*

Claude lit les tickets de la version Jira et propose le fichier de périmètre. Vous le corrigez et le validez.

#### 3.3 Pré-classement des écarts
*Claude Code*

Chaque écart visuel ou fonctionnel est annoté « correspond au ticket X » ou « aucun ticket ne l'explique ». Vous commencez par les seconds.

## Phase 4 : le cycle MEP et la mise à jour des références (~1 semaine)

Industrialiser votre passe du jour de MEP sur chaque site, et rendre la mise à jour des références formelle.

#### 4.1 Capture avant merge
*Claude Code*

Le jour J, juste avant le merge, capture de chaque site en prod (état N).

#### 4.2 Smoke achat après merge sur chaque site
*Claude Code*

Tous les sites en parallèle sur les 4 appareils, avec arrêt avant le paiement. Résultat en une dizaine de minutes.

#### 4.3 Vérifier que la prod a changé comme la préprod
*QA*

L'écart prod N → N+1 doit être le même que celui validé en préprod. Tout écart en plus sur un site signale un merge ou un réglage à vérifier.

#### 4.4 « MEP validée » par tout le monde
*Équipe*

Validation collective (QA, devs, PO), puis les références préprod et prod passent à N+1. Les cartographies TNR sont mises à jour en même temps.

## Phase 5 : CI et surveillance de la prod (~1 semaine)

Les tests se lancent seuls, et la prod est surveillée entre deux MEP.

#### 5.1 Signatures anti-bot Shopify
*Devs*

Web Bot Auth généré par domaine, rappel de renouvellement tous les 3 mois. Sans elles, les tests lancés depuis la CI se font bloquer.

#### 5.2 Déclencheurs automatiques
*Claude Code · Devs*

TNR à chaque déploiement en préprod, toutes les nuits sur la préprod, et sur un bouton le jour de MEP.

#### 5.3 Surveillance toutes les 30 minutes
*Claude Code*

Parcours d'achat sur chaque site en prod, alerte Slack si un client ne peut plus acheter.

## Phase 6 : IA, tous les sites, vrais appareils (en continu)

#### 6.1 Revue IA des captures
*Claude Code · QA*

D'abord en rapport seulement ; on mesure les fausses alertes, puis on rend bloquantes les catégories fiables.

#### 6.2 Étendre à tous les sites
*Claude Code*

UK, JP puis les autres marchés, avec langue, devise et modes de livraison propres à chacun.

#### 6.3 Vrais iPhone avant MEP
*Équipe*

Si l'émulation laisse passer des bugs Safari iOS : lot court sur TestMu AI ou BrowserStack.

#### 6.4 Performance
*Claude Code*

Lighthouse CI sur home, collection et fiche produit, avec un seuil minimum.

---

## Pistes gardées pour plus tard

### Tester automatiquement les emails

Objectif : vérifier les emails envoyés aux clients (confirmation de commande et d'expédition, « Être prévenu(e) », coming soon, newsletter, compte client) : réception, contenu (numéro de commande, produit, total, langue, liens) et rendu visuel mobile et desktop.

- **Pas d'outil local de capture d'emails** (Mailpit, MailHog) : c'est Shopify qui envoie, depuis ses serveurs, vers de vraies adresses.
- **Constituer une collection d'emails au fil des tests** : enregistrer en `.eml` les emails reçus sur l'adresse `+qautomatic` (notifications test Shopify, vraies commandes préprod), dans un dossier `emails/` exclu de Git. Un test pourra les relire pour vérifier leur contenu et leur rendu, sans boîte de test.
- **Notifications test Shopify** : Paramètres → Notifications → « Envoyer une notification test », pour recevoir chaque template sans passer de commande.
- **Boîte de test lisible par API** quand on automatise la réception : testmail.app (adresse par tag, à partir de 9 $) ou Mailosaur (essai gratuit 14 jours, puis 9 à 79 $/mois). Une adresse par profil client.
- **Lire la boîte pro** : la messagerie est sur Microsoft 365, ce qui demande une autorisation du service informatique. Non retenu pour l'instant.

### Un rapport plus lisible, aux couleurs de Polène

Objectif (demande de la QA, 2 octobre 2026) : un rapport plus user-friendly et moins technique que le rapport HTML de Playwright, avec les informations choisies par la QA.

- **Allure essayé puis écarté** (6 octobre 2026) : la QA y perdait des fonctions du rapport Playwright (vidéo en cas d'échec, comparaison visuelle) et le trouvait moins lisible. Seuls les graphiques ont plu (voir d'un coup d'œil si tout va bien). Retiré du projet.
- **Rapport Polène sur mesure** ✅ V1 le 6 octobre 2026 (`npm run rapport:polene`), gratuit, codé dans le dépôt (`src/rapport/`) : tableau de bord (verdict, statuts, test × appareil, historique des résultats et des durées, raisons des échecs, tests à surveiller, tests les plus longs, commandes créées), liste filtrable, fiche de test (erreur en français, étapes et captures, essais, vidéo, trace, comparateur visuel côte à côte / curseur / différence). Démos : « Détecté » / « Non vérifié ». À faire relire par la QA.
- **Garder le rapport Playwright** pour le détail technique, lié depuis chaque fiche.

## À décider plus tard

> Rien de tout cela ne bloque le POC.

- Où vit le repo de tests : GitHub de Polène, repo séparé ou dans celui du thème ?
- Plateforme de CI utilisée aujourd'hui pour les tests Playwright existants.
- Canal Slack pour les alertes de la prod.
- Budget mensuel pour Argos payant, vrais appareils et surveillance, si le volume le demande.
- Quelle configuration de site la préprod `asia-polene` reproduit (langue, devise, livraison).

---

*Durées estimées pour une personne QA accompagnée de Claude Code, à réajuster après le POC.*
