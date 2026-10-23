# Revue des tests par la QA

> 22 octobre 2026, demande QA : passer les tests un par un pour dire s'ils sont utiles, et pourquoi ceux en échec échouent. Page : `npm run revue`. Avis : [`data/revue-tests.json`](../data/revue-tests.json).

## Lancer la revue

```bash
npm run revue
```

La page s'ouvre dans le navigateur (serveur local, comme le Rapport Polène ; Ctrl+C dans le terminal pour l'arrêter). Elle liste tous les tests du TNR et les tests visuels (sans les démos), un test par fiche, toutes ses exécutions réunies : un test joué en prod et en préprod sur 4 appareils est une seule fiche.

Chaque fiche montre :
- **Ce que vérifie le test** : ses étapes (celles du dernier lancement, sinon celles écrites dans le code), le commentaire du code quand il y en a un, le contexte du fichier (dépliable), les constats notés par le test.
- **Derniers résultats** : un résultat par appareil et environnement concernés, le plus récent toutes séries confondues (lancements rangés compris). Un clic ouvre le détail dans le Rapport Polène (étapes, captures, vidéo). Les appareils où le test ne tourne pas sont comptés à part (« non concerné »).
- **Première analyse** : pour un test en échec, ce que l'analyse a trouvé avant la revue (bug connu, changement du site, test à corriger).
- **Ton avis** :
  - *Ce test est-il utile ?* Utile, à garder · À modifier · Inutile, à retirer.
  - *Pourquoi échoue-t-il ?* (tests en échec ou instables) Bug du site · Changement voulu du site · Le test se trompe · Instable · Je ne sais pas.
  - *Commentaire* libre : ce qu'il faudrait vérifier en plus, le bug connu, la personne à qui demander.

Chaque choix est enregistré tout de suite dans `data/revue-tests.json` (« Enregistré le … » sous la fiche) ; « Effacer mon avis » le retire. Les tests en échec sont en tête. Filtres : état, page, type de test, recherche, et « Montrer les tests déjà revus » à décocher pour ne voir que ce qui reste. Les filtres sont gardés d'une visite à l'autre dans le navigateur.

La revue peut se faire en plusieurs fois : la page reprend les avis déjà donnés. Après un nouveau lancement, recharger la page pour voir les derniers résultats.

## Ce qui se passe ensuite

Les avis forment la liste de travail :

| Avis | Suite |
|---|---|
| Inutile, à retirer | Test supprimé (et sa référence s'il en a une) |
| À modifier | Test réécrit d'après le commentaire, puis rejoué |
| Bug du site | Constat ajouté (ou complété) et remonté à l'équipe ; le test reste en échec, ou est marqué « bug connu » une fois la V2 en place |
| Changement voulu du site | Test adapté ou référence reprise (visuel, structure, accessibilité) |
| Le test se trompe | Test corrigé, puis rejoué |
| Instable | Cause cherchée (Mac chargé, limite Shopify, animation…), test stabilisé |
| Je ne sais pas | Point à regarder ensemble |

Une fois traité, l'avis reste dans le fichier (historique de la décision dans Git).

## Suite donnée à la revue du 22 octobre 2026

214 tests revus. Ce qui a changé :

- **Tests visuels** : la prod est la référence, la préprod lui est comparée (ses échecs sont attendus tant qu'elle n'est pas à jour) ; en prod, comparaison seulement pendant une MEP et sur les pages à contenu fixe (`npm run test:visuel:mep`). Pages ajoutées : panier vide, checkout, page introuvable, connexion, mot de passe oublié, création de compte, favoris, savoir-faire, boutiques, et chaque onglet du menu (ordinateur et téléphone). Ancienne fiche retirée (la prod ne la sert plus).
- **Accessibilité (axe)** : 4 appareils ; premiers relevés de Safari et Android pris comme point de départ ([écarts](accessibilite.md#relevés-de-safari-et-android-22-octobre-2026)) ; page d'une commande ajoutée.
- **Pages de sections** : chaque section est un test, nommé d'après l'intitulé posé au-dessus (contrôles, axe limité à la section, capture) ; 4 appareils. Interactions par section proposées dans [sections-theme.md](sections-theme.md#interactions-par-section-proposition-à-valider-par-la-qa-avant-dêtre-codée), à valider avant d'être codées.
- **Constats** : 1, 13, 37 et 52 (cases newsletter cochées) sont la politique de Polène, plus notés ; 55 (favoris du panier) devient une vérification qui échoue ; 56 nouveau (« Besoin d'aide ? » absent du checkout de la prod sous Android) ; 45 et 47 : contributions de la préprod à corriger ; 27 : bug.
- **Fiche produit** : vue 3D testée sur la nouvelle fiche seule ; onglet « GOLDEN DATA TEST » (ajout de la QA) ignoré et masqué des captures.
- **Collection Sacs** : titre « Sacs » attendu (changement voulu de la prod, la préprod doit suivre).
- **Structure** : gardée sur les pages de sections, le design system et l'UAT (test bonus), Chrome ordinateur et iPhone.

## Fichier des avis

`data/revue-tests.json`, versionné :
- `avis` : un avis par test, sous son nom dans le Rapport Polène (« Nouvelle fiche › … » compris) : `pertinence` (utile, modifier, retirer), `cause` (bug-site, changement-voulu, test-faux, instable, ne-sait-pas), `commentaire`, `etat` du test au moment de l'avis (echec, reussi…), `date`.
- `analyses` : première analyse d'un test en échec, écrite avant la revue et affichée sur sa fiche.

Un test renommé perd son avis (le nom sert de clé) : le reporter de l'historique a la même règle.

## Fonctionnement

- `scripts/revue.mjs` : liste des tests (Playwright `--list` avec le rapporteur `src/rapport/liste.ts`, mêmes noms que le Rapport Polène), derniers résultats lus dans `resultats/*/rapport-polene/` et `resultats/*/lancements/*/`, commentaires et étapes lus dans le code, enregistrement des avis.
- `scripts/ouvrir-rapport.mjs --revue` : sert la page (`src/rapport/revue/`) et les rapports, sur `127.0.0.1` seulement.
