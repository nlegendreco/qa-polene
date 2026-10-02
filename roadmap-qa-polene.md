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
| Phase 3 | Scope de release (Jira) | ~1 semaine |
| Phase 4 | Cycle MEP et références | ~1 semaine |
| Phase 5 | CI et surveillance prod | ~1 semaine |
| Phase 6 | IA, tous les sites | en continu |

Légende des intervenants : **QA**, **Claude Code**, **Devs**, **Équipe** (QA + devs + PO).

## Avancement

> Mis à jour le 2 octobre 2026. **POC 1 validé par la QA.**

| Étape | Statut | Détail |
| --- | --- | --- |
| 1.1 Préparer le dossier | ✅ Fait | Projet dans `~/Developer/qa`, dépôt GitHub `nlegendreco/qa-polene` |
| 1.2 Configurer les 4 appareils | ✅ Fait | Desktop Chrome, desktop Safari, iPhone 15, Pixel 7 |
| 1.3 Neutraliser ce qui perturbe | ✅ Fait | Bandeau cookies, AB Tasty, Klaviyo, pixels publicitaires. Popup de géolocalisation pas encore rencontrée depuis la France |
| 1.4 Parcours d'achat nominal | ✅ Fait | 8/8 : prod jusqu'au checkout, préprod jusqu'à la confirmation de commande et au questionnaire « Comment avez-vous connu Polène Paris ? » (10 étapes) |
| 1.5 Rapport | ✅ Fait | Étapes en français, capture par étape, vidéo, trace et requêtes lentes en cas d'échec |
| 1.6 Échec volontaire | ✅ Fait | Démo `npm run test:demo-echec`, rapport jugé clair par la QA |
| Profil client P1 | ✅ Fait | 60 rue du Louvre, 01 99 00 00 00, questionnaire « Bouche à oreille » enregistré (commande VVGWK0PJK) |
| POC 2 | ⚪ Prochaine étape | Premier point à trancher : la référence visuelle (préprod et prod n'ont ni les mêmes textes ni les mêmes prix) |

## Ce qui est déjà acté

- La référence, c'est la prod [polene-paris.com](https://www.polene-paris.com/) (pas de spécifications écrites).
- Les références sont mises à jour après chaque MEP, avec l'accord de tout le monde.
- Préprod = boutique séparée `asia-polene`, protégée par mot de passe, checkout et achats complets possibles.
- Catalogue préprod non iso : une dizaine de produits fixes à statut forcé, pour des tests déterministes.
- D'autres personnes modifient la préprod : il faudra une convention sur les produits de test.
- Coming soon et précommande sont des métachamps basculés à la main ; la précommande expire seule après sa date.
- Accès API d'administration sur la préprod : d'accord sur le principe, à mettre en place.
- Le périmètre de chaque release (Jira) doit être connu avant de lancer le TNR.

---

## POC : prouver que ça marche, sur un périmètre minuscule

> **Étape en cours.**

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
- [ ] 10 passages visuels sans changement donnent 0 fausse alerte.
- [ ] Les 4 régressions injectées sont toutes détectées.
- [ ] Accepter un changement visuel attendu prend moins de 10 minutes.
- [ ] Le format de rapport visuel est choisi (natif ou Argos).

---

## Phase 1 : une préprod déterministe (~1 semaine)

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

Les fichiers issus de `site-mapper` → `site-mapper-to-tnr` servent de spécification. Claude Code les transforme en tests, page par page, avec les agents Playwright (planner, generator).

#### 2.2 Couvrir les états produit et les paniers combinés
*Claude Code*

Chacun des 7 états sur la fiche et dans les listes. Paniers en stock + précommande, codes promo, checkout complet.

#### 2.3 Couvrir le reste du site
*Claude Code*

Recherche, filtres, compte client, wishlist, newsletter, « Être prévenu(e) », pages boutiques et Savoir-Faire.

#### 2.4 Ajouter les contrôles automatiques
*Claude Code*

Images toutes chargées, pas de débordement horizontal en mobile, pas de clé de traduction visible, aucune erreur console, accessibilité (axe).

#### 2.5 Ajouter les références de structure
*Claude Code*

Pour chaque page, Playwright enregistre la liste des liens du menu, des titres et des boutons. Il détecte un lien disparu ou un bouton renommé, même quand le visuel change peu.

#### 2.6 Faire tourner en parallèle de votre recette manuelle
*QA*

Pendant 1 ou 2 releases, vous faites les deux et vous comparez : ce que la suite rate, ce qu'elle trouve en plus.

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

## À décider plus tard

> Rien de tout cela ne bloque le POC.

- Où vit le repo de tests : GitHub de Polène, repo séparé ou dans celui du thème ?
- Plateforme de CI utilisée aujourd'hui pour les tests Playwright existants.
- Canal Slack pour les alertes de la prod.
- Budget mensuel pour Argos payant, vrais appareils et surveillance, si le volume le demande.
- Quelle configuration de site la préprod `asia-polene` reproduit (langue, devise, livraison).

---

*Durées estimées pour une personne QA accompagnée de Claude Code, à réajuster après le POC.*
