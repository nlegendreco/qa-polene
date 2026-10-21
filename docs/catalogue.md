# Catalogues de lancement et conservation des rapports

> 20 octobre 2026, demande QA : deux catalogues lançables séparément, un par type de test et un par page, et des rapports gardés pour retrouver un bug ancien. Liste : `data/catalogue.json`. Lancement : `scripts/lancer.mjs`.

## Lancer

```bash
npm run catalogue                 # affiche les deux catalogues
npm run type -- accessibilite     # un type de test
npm run page -- pdp               # tout ce qui touche une page
npm run page -- pdp --project "prod · iphone"   # options Playwright après le nom
QA_ENVS=prod npm run type -- tnr  # prod seule
```

Chaque entrée a sa série (`resultats/<nom>/`, `resultats/page-<nom>/` pour une page) : lancer la fiche produit ne remplace pas le rapport de l'accessibilité. Le sommaire (`npm run rapport:polene`) range les cartes de la même façon : « Par type de test », « Par page », puis « Autres séries » (essais `SERIE=…`).

Les anciennes commandes (`npm run test:accessibilite`, `test:structure`, `test:visuel`, `test:regressions`, `test:demo-echec`, `test:donnees`) passent par le catalogue et donnent le même lancement.

## Par type de test

Les types parcours, fonctionnel, contrôles, accessibilité et structure se partagent les tests `@tnr` : chaque test est dans un seul de ces types. Nombres de tests au 21 octobre 2026 (un test de l'ancienne et de la nouvelle fiche compte pour deux) ; un test tourne ensuite sur plusieurs appareils et environnements. Le 20 octobre, une page testée en prod et en préprod comptait pour deux (un test par environnement, fusionnés le 21) et l'espace client avait 5 tests en double : 251 au lieu de 209.

| Nom | Contenu | Tests |
|---|---|---|
| `tnr` | Tout, sauf visuel et démos (comme `npm test`). ⚠ 4 commandes de test en préprod : demande « oui » | 209 |
| `parcours` | Tests qui traversent plusieurs pages (`@journey`) : parcours d'achat, précommande jusqu'au checkout, titre long, alerte de retour en stock. ⚠ 4 commandes de test en préprod : demande « oui » | 6 |
| `fonctionnel` | Ce que fait chaque page : états produit, fiche, galerie, collections et cartes, recherche, favoris, panier, checkout, en-tête, espace client | 80 |
| `controles` | Pages de sections et pages réelles : sections, images, erreurs JS, largeur (`@controles`) | 24 |
| `accessibilite` | axe en cran et bouton pause / lecture au clavier | 34 |
| `structure` | Titres, boutons et liens comparés à la référence | 32 |
| `donnees` | Produits fixes P02 et P08, produits et collections QA de la préprod | 32 |
| `visuel` | Comparaison en pixels, prod : accueil, deux fiches, panier, menu ouvert (ordinateur et mobile) | 6 |
| `regressions` | Démo : défauts injectés, doivent échouer | 4 |
| `demo-echec` | Démo : échec volontaire | 1 |

« Oui » se saute avec `--oui` après le nom, ou n'est pas demandé quand la préprod n'est pas dans le lancement (`QA_ENVS=prod`, ou `--project` de prod seulement).

## Par page

Tous les types de test d'une page (fonctionnel, contrôles, accessibilité, structure), sans visuel ni démo. Aucun ne passe de commande : le parcours d'achat est dans `parcours`, pas dans une page.

| Nom | Page | Tests |
|---|---|---|
| `home` | Accueil, en-tête et pied de page | 7 |
| `plp` | Collections et cartes produit | 24 |
| `pdp` | Fiche produit | 44 |
| `cart` | Panier | 10 |
| `checkout` | Checkout | 6 |
| `search` | Recherche | 4 |
| `account` | Espace client, connexion et favoris | 33 |
| `content` | Pages éditoriales (blogs, articles, Savoir-faire, 404) | 27 |
| `sections` | Pages de sections du thème (sections, UAT, design system) | 16 |

Un test qui porte deux étiquettes de page est dans les deux (favoris du visiteur : `@pdp` et `@plp`).

## Conservation des rapports

| | Gardé |
|---|---|
| Dernier lancement d'une série | Rapport Polène, rapport Playwright, fichiers bruts (`resultats/<série>/`) |
| Lancements précédents | Rapport Polène seul, dans `resultats/<série>/lancements/<date-heure>/` ; lien « N lancements précédents » sur la carte du sommaire |
| Après 30 jours | Tests en échec, instables ou interrompus : complets (captures, vidéo, trace). Tests réussis ou ignorés : statut et durée seulement |
| Graphiques | 200 derniers lancements par série (`historique.json`) |
| Lancement de MEP | `npm run archiver -- <nom>` : copie complète dans `archives/`, jamais allégée, zip sur le drive |

Poids : environ 1,5 Mo par test joué dans le Rapport Polène (surtout les captures d'étape), divisé par 100 environ après 30 jours pour un lancement vert. Une série complète de 300 à 400 tests joués pèse donc 400 à 600 Mo le premier mois. Le Mac a 190 Go libres (20 octobre 2026).

Un lancement sans aucun test joué (`--list`, filtre qui ne retient rien) n'écrit plus rien : ni rapport, ni ligne d'historique. Les faux lancements « tout ignoré » laissés par des `--list` ont été retirés des historiques le 20 octobre 2026 ; le dernier rapport de `tnr` reste ce faux lancement (0 / 0) jusqu'au prochain `npm run type -- tnr`.
