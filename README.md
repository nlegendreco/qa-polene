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
| `npm run test:donnees` | Préprod : vérifie que les produits fixes sont dans leur état prévu (rupture, précommande…), sans commande. Voir [docs/produits-fixes.md](docs/produits-fixes.md) |
| `npm run rapport:polene` | Ouvre le **sommaire** des derniers lancements : une carte par série avec son verdict, qui mène à son Rapport Polène |
| `npm run rapport:polene -- visuel` | Ouvre directement le Rapport Polène d'une série (`tnr`, `visuel`, `regressions`, `demo-echec`) |
| `npm run rapport` | Ouvre le rapport Playwright d'origine du parcours (détail technique) |
| `npm run test:demo-echec` | Démo d'un échec volontaire (bouton « Ajouter au panier » masqué) |
| `npm run test:visuel` | Tests visuels (prod) : compare 4 pages (accueil, fiche produit nouvelle et ancienne, panier) × 4 appareils à la référence |
| `npm run test:visuel:maj` | Sauvegarde la référence actuelle dans `archives/references/<date>/`, puis la reprend (après une MEP validée, avec l'accord de tout le monde) |
| `npm run test:regressions` | Démo : 4 régressions injectées (desktop Chrome + iPhone), chacune **doit** échouer |
| `npm run test:accessibilite` | Accessibilité (prod et préprod, Chrome ordinateur et iPhone) : axe sur 51 pages, comparé au relevé de chaque page (seul un problème absent du relevé échoue), et bouton pause / lecture au clavier. Voir [docs/accessibilite.md](docs/accessibilite.md) |
| `npm run test:accessibilite:maj` | Enregistre les corrections d'accessibilité dans `references/accessibilite/` (le relevé ne fait que rétrécir), avec l'accord de la QA |
| `npm run test:structure` | Structure (prod et préprod, Chrome ordinateur et iPhone) : titres, boutons et liens de chaque page, en-tête et pied de page, comparés à la référence. Voir [docs/structure.md](docs/structure.md) |
| `npm run test:structure:maj` | Reprend les références de structure qui ont changé (après une MEP ou un changement voulu), avec l'accord de la QA |
| `npm run archiver -- <nom>` | Conserve les rapports de toutes les séries dans `archives/<date>-<nom>/` (hors Git), voir [docs/demo-poc.md](docs/demo-poc.md) |

Pour lancer un seul appareil : `npx playwright test --project "prod · iphone"`.
Pour regarder le navigateur pendant le test : ajouter `--headed`.

### Où sont les résultats

Chaque série range tout dans un seul dossier, `resultats/<série>/` (hors Git), remplacé à chaque lancement de la série :

```
resultats/
  tnr/            npm test, test:prod, test:preprod (parcours d'achat, structure des collections, données préprod)
  donnees/        npm run test:donnees
  visuel/         npm run test:visuel
  accessibilite/  npm run test:accessibilite
  structure/      npm run test:structure
  regressions/    npm run test:regressions
  demo-echec/     npm run test:demo-echec
    rapport-polene/      le Rapport Polène
    playwright-report/   le rapport Playwright d'origine
    test-results/        fichiers bruts (captures, vidéos, traces)
    historique.json      les 40 derniers lancements, pour les graphiques
```

Pour un essai qui ne doit pas remplacer le dernier lancement d'une série : `SERIE=essai npx playwright test …` écrit dans `resultats/essai/`.

## Ce que fait le parcours d'achat (`tests/parcours-achat.spec.ts`)

1. Ouvrir la page d'accueil (logo visible, panier vide).
2. Aller dans la collection Sacs depuis le menu (burger + « Voir tout » sur mobile).
3. Ouvrir la première fiche produit en stock de la collection (préprod : toujours la fiche du produit QA « QA Numéro Un - In Stock », QA01).
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

Chaque lancement produit deux rapports :

**Le Rapport Polène** (`npm run rapport:polene`), en français, aux couleurs de Polène :
- **tableau de bord** : verdict du lancement, réussis / échecs / instables / ignorés, durée, commandes de test créées, tableau test × appareil, graphiques des derniers lancements (résultats et durée), raisons des échecs (« Écart visuel », « Délai dépassé », « Limite d'appels Shopify (429) »…), tests à surveiller (échecs ou instabilités sur les 10 derniers lancements), tests les plus longs comparés à leur durée habituelle ;
- **liste des tests** filtrable par statut, appareil et texte, avec les derniers résultats de chaque test ;
- **fiche d'un test** : erreur résumée en français (détail technique replié), étapes avec leur durée et leur capture, onglets par essai, vidéo, trace Playwright (frise chronologique cliquable avec le DOM, le réseau et la console), requêtes lentes ou bloquées (🐢) ;
- **comparateur visuel** en cas d'écart : côte à côte (défilement synchronisé), curseur, différence en rouge, attendu, obtenu, taille réelle.

Le rapport reprend la charte de polene-paris.com : logo, polices du site (Canela, Sackers, chargées depuis le site, il faut donc une connexion internet ; sinon des polices proches s'affichent), beiges et formes du thème. Les textes sont un peu plus grands et plus marqués que sur le site pour la lecture, et les graphiques ont leurs propres couleurs (bleu pour les durées, cognac et rose prune pour les raisons d'échec).

Le rapport est servi en local (la trace en a besoin) : laisser la fenêtre du terminal ouverte, Ctrl+C pour arrêter. L'historique des lancements est gardé dans `resultats/<série>/historique.json` (hors Git).

**Le rapport Playwright d'origine** (`npm run rapport`) reste disponible pour le détail technique, avec un lien depuis chaque fiche du Rapport Polène.

## Les tests visuels (`tests/visuel.spec.ts`, POC 2)

3 pages capturées en entier sur les 4 appareils, soit 12 captures, comparées pixel par pixel à la référence :

| Page | Adresse |
|---|---|
| Accueil | `/` |
| Fiche produit | `/products/numero-un-textured-black` (Numéro Un noir grainé, en ligne depuis 2017) |
| Panier | `/cart` avec ce produit, ajouté directement par l'API Shopify |

Les collections ne sont plus comparées en pixels : les mentions de stock (« Être prévenu(e) », « Précommande le … ») changent plusieurs fois par jour en prod. Elles sont vérifiées par leur structure (voir plus bas).

- **Prod uniquement** pour l'instant : la préprod n'a ni les mêmes textes ni les mêmes prix.
- **Référence** : dossier `references/<page>/<appareil>.png`. C'est l'« état validé » de la QA.
- **2 navigateurs à la fois** (au lieu de 4) pour ne pas saturer le Mac : environ 2 minutes par passage.
- **Densité 1 pixel par point** sur tous les appareils : même mise en page que sur le vrai appareil, mais en densité 3 l'iPhone émulé réduit les photos différemment d'un passage à l'autre.
- **Un second essai automatique** si une capture diffère : un vrai défaut échoue deux fois. Un test qui passe au second essai est marqué « flaky » (instable) dans le rapport, à surveiller. La démo des régressions n'a pas de second essai.
- **Pas lancés par défaut** avec `npm test` ou `npm run test:prod`, pour ne pas mélanger les deux rapports.
- **En cas d'écart**, le rapport montre l'attendu, l'obtenu et la différence (en rouge), avec un curseur pour comparer.
- **Accepter un changement voulu** : `npm run test:visuel:maj` remplace les captures qui ont changé, après avoir sauvegardé les anciennes dans `archives/references/<date-heure>/`.

Avant chaque capture, le test stabilise la page :
- images et polices chargées jusqu'en bas de page, fin des téléchargements, images entièrement décodées ;
- tout le contenu dessiné, même loin de l'écran (sinon les cartes produit des collections desktop sortent en cases blanches) ;
- vidéos de la home arrêtées et cachées : on vérifie l'image fixe placée dessous et ce qui est posé dessus (une image de vidéo n'est jamais dessinée deux fois pareil) ;
- bandeaux de sacs qui défilent tout seuls sur la home figés sur leur première position ;
- défilement instantané (le thème défile en douceur, la capture partirait en plein mouvement) ;
- bulle de chat Zendesk et curseur personnalisé masqués ;
- pas de vidéo du test (l'attendu, l'obtenu et la différence suffisent ; l'enregistrement surchargeait la machine) ;
- barres fixées en bas d'écran sur mobile (ajout au panier, filtres, récapitulatif du panier) remises à leur place dans la page.

Une zone qui change sans que ce soit un bug est recouverte d'un aplat rose (zone ignorée). C'est le cas des photos Instagram de l'accueil, qui changent à chaque post de Polène (le titre du bloc reste vérifié), et du bloc de recommandations du panier, titre compris (il s'appelle tantôt « Polène suggère », tantôt « Complétez votre panier »). Ce bloc a une hauteur fixe pendant la capture : sinon, selon les produits suggérés, tout le bas du panier se décale de quelques pixels. Les réglages sont dans `src/visuel.ts` et `src/visuel.css`.

**Sensibilité** : aucun pixel différent n'est toléré, et une nuance de couleur compte à partir du seuil 0,2 (réglage par défaut de Playwright). Le seuil était à 0,3 tant que les collections étaient comparées (Safari y lissait les vignettes différemment à chaque passage). Avec 0,3, un header blanc décalé de 10 px sur le ciel clair de l'accueil iPhone passait inaperçu ; avec 0,2 il est détecté, sans fausse alerte sur les 3 pages restantes.

**Démo des régressions** (`tests/regressions-injectees.spec.ts`) : le test casse lui-même la page juste avant la capture, sans toucher au site. Il décale le header de 10 px sur l'accueil, masque la photo de la fiche produit, masque son prix et fait déborder le titre du produit dans le panier. Chaque test doit échouer et montrer la différence en rouge. Un test vert voudrait dire qu'une régression est passée inaperçue. Dans le Rapport Polène, ces échecs s'affichent « Détecté » ; un échec dû à autre chose (limite d'appels Shopify, délai) s'affiche « Non vérifié ».

## Les collections (`tests/structure-collections.spec.ts`)

Collections Sacs (sans PLP break) et Crossbody (avec une grande photo dans la grille), en prod sur les 4 appareils. Pour chaque collection :
1. la page s'ouvre (titre, bouton Filtres) ;
2. chaque carte produit a un nom, un prix, un lien et une photo chargée (48 cartes au plus sur la première page) ;
3. la grille a 4 colonnes sur ordinateur et 2 sur mobile, des cartes de même largeur, rien ne dépasse de l'écran ;
4. chaque PLP break a sa photo chargée, est plus large qu'une carte et son lien répond.

Ce test fait partie de `npm run test:prod`.

## Ce que les tests neutralisent

- **Bandeau cookies** : le consentement est posé d'avance (`cookieconsent_status`).
- **AB Tasty** : bloqué, pour que chaque passage voie la même version du site.
- **Pixels publicitaires et analytics** (Google, Meta, TikTok, Criteo…) : bloqués, pour ne pas polluer les données marketing avec le trafic de test.
- **Klaviyo** : bloqué, pour éviter les popups newsletter.

## Structure

```
playwright.config.ts      Appareils, environnements, rapports
src/environments.ts       URL et réglages de la prod et de la préprod
src/fixtures.ts           Neutralisations, captures par étape, diagnostic réseau
src/pages/                Un fichier par type de page (en-tête, collection, produit, panier, checkout)
src/shopify.ts            Appels directs à la boutique, avec nouvel essai si Shopify limite (code 429)
src/rapport/              Rapport Polène : collecte des résultats (reporter.ts) et page du rapport (page/)
scripts/                  Ouverture du rapport, archivage, sauvegarde des références
tests/auth.setup.ts       Saisie du mot de passe préprod (une fois par lancement)
tests/parcours-achat.spec.ts
tests/structure-collections.spec.ts  Structure des collections (cartes, grille, PLP breaks)
tests/sante-donnees.spec.ts  État des produits fixes de la préprod (phase 1.5)
data/produits-fixes.json  Produits fixes de la préprod et leur état prévu (lus par src/produits-fixes.ts)
tests/demo-echec.spec.ts
tests/visuel.spec.ts      Tests visuels (POC 2)
tests/regressions-injectees.spec.ts  Démo des régressions détectées (POC 2.5)
src/visuel.ts, visuel.css Stabilisation des pages avant capture
references/               Captures de référence des tests visuels
```
