# Présenter les POC

> POC 1 validé par la QA le 2 octobre 2026, POC 2 le 7 octobre 2026. Exécution de référence : 7 octobre 2026,
> archivée dans `archives/2026-10-07-poc/`. Version du code : repère Git `poc-valides`.

## Ce que les POC prouvent

**POC 1, parcours d'achat** : un parcours d'achat complet est testé automatiquement sur 4 appareils (desktop Chrome, desktop Safari, iPhone 15, Pixel 7), et le rapport permet de comprendre un échec sans l'aide d'un dev.

| | Prod polene-paris.com | Préprod asia-polene |
|---|---|---|
| Jusqu'où va le test | Arrivée au checkout (6 étapes) | Confirmation de commande + questionnaire (10 étapes) |
| Commande créée | Aucune | Une par appareil |

**POC 2, non-régression visuelle** : 3 pages (accueil, fiche produit, panier) sont capturées en entier sur les 4 appareils et comparées à une référence validée par la QA. Des défauts injectés volontairement (header décalé de 10 px, prix masqué, image absente, titre qui déborde) sont tous détectés. Les collections, dont les stocks bougent plusieurs fois par jour, sont vérifiées par leur structure (photo, nom, prix, lien, colonnes, PLP breaks).

Critères Go / No-Go atteints :
- le parcours passe sur les 4 appareils, en prod et en préprod ; 5 relances d'affilée donnent le même résultat ;
- un échec se comprend dans le rapport en moins de 5 minutes ;
- 10 passages visuels de suite sans fausse alerte (160 captures, 2 octobre 2026) ;
- 8 régressions injectées sur 8 détectées.

## L'exécution archivée (7 octobre 2026)

| Série | Résultat | Contenu |
|---|---|---|
| Parcours et non-régression (`tnr`) | 17 / 17 réussis, 2 min 48 | Parcours prod × 4 et préprod × 4, structure de 2 collections × 4 appareils, connexion préprod. Commandes préprod : 553GLKT54 (desktop Chrome), FJ25K80G3 (desktop Safari), IM8IXTTU8 (iPhone), DXFTKEXQR (Pixel 7). Produit préprod : Numéro Un - Textured Pink, 524,95 € ; prod : Cyme - Camel Grainé, 440 € |
| Tests visuels (`visuel`) | 12 / 12 réussis, 1 min 18 (un premier passage, Mac surchargé, avait eu une page trop lente au premier essai : il reste visible dans l'historique) | Accueil, fiche Numéro Un noir grainé, panier × 4 appareils, en prod |
| Régressions injectées (`regressions`) | 8 / 8 détectées | 4 défauts × desktop Chrome et iPhone, chacun repéré par un écart visuel |
| Échec volontaire (`demo-echec`) | 2 / 2 échecs détectés | Bouton « Ajouter au panier » masqué, desktop Chrome et iPhone |

Dans les rapports de la série `tnr`, la ligne « 48 cartes affichées sur NaN produits » des collections vient d'un défaut du test, corrigé juste après ce lancement : le nombre de produits n'était pas lu, la vérification « 48 produits sur la première page » ne tournait donc pas.

## Ouvrir l'archive

```bash
npm run rapport:polene -- archives/2026-10-07-poc
```

Un sommaire s'ouvre dans le navigateur : une carte par série avec son verdict, qui mène au Rapport Polène de la série (tableau de bord, détail des tests, vidéo, trace), et de là au rapport Playwright d'origine. Laisser le terminal ouvert pendant la démo, Ctrl+C pour arrêter.

Passer par cette commande plutôt que double-cliquer sur un `index.html` : sinon la trace ne s'ouvre pas.

### Si le Mac n'est plus là

L'archive n'est pas dans Git : les captures du checkout préprod montrent l'email du client de test, et l'ensemble pèse plusieurs centaines de Mo. Une copie zippée, `2026-10-07-poc.zip`, est déposée sur le drive interne de l'équipe. Pour la rouvrir sur un autre poste :

1. récupérer le dépôt à la version des POC : `git clone …` puis `git checkout poc-valides`, et `npm install` ;
2. dézipper l'archive dans `archives/` ;
3. `npm run rapport:polene -- archives/2026-10-07-poc`.

Ne pas publier le zip ni l'envoyer hors de l'équipe.

### Archiver un nouveau lancement

`npm run archiver -- <nom>` copie les rapports de toutes les séries de `resultats/` dans `archives/<date>-<nom>/`, avec la même organisation (un dossier par série). Le même nom le même jour remplace l'archive précédente.

## Déroulé de démo proposé (15 minutes)

1. **Le sommaire** : les 4 séries et leur verdict d'un coup d'œil.
2. **Parcours et non-régression** (`tnr`) : le tableau de bord (verdict, test × appareil, commandes créées), puis un parcours préprod sur iPhone. Faire défiler les étapes en français, chacune avec sa capture. Montrer :
   - le menu mobile (burger, puis « Voir tout ») ;
   - le contrôle du prix entre le panier et le checkout ;
   - le numéro de commande noté à la confirmation ;
   - la réponse au questionnaire « Comment avez-vous connu Polène Paris ? ».
3. **Un échec** (`demo-echec`) : le message d'erreur en français, la capture au moment de l'échec, la vidéo, puis la trace (frise cliquable qui montre la page à chaque instant).
4. **Les régressions détectées** (`regressions`) : ouvrir « Prix masqué » sur iPhone et montrer le comparateur (côte à côte, curseur, différence en rouge). Le prix ne change que quelques dizaines de pixels sur une page entière.
5. **Les tests visuels** (`visuel`) : 12 pages conformes à la référence validée par la QA.
6. **Ce que les tests ont déjà trouvé** : les constats remontés à l'équipe (section « Constats » de [CLAUDE.md](../CLAUDE.md)), notamment les cases newsletter et SMS pré-cochées au checkout et le questionnaire présent en double dans la page.
7. **En direct, si on veut** : `npx playwright test parcours-achat --project "prod · iphone" --headed` ouvre le navigateur et déroule le parcours sous les yeux de l'équipe (sans `parcours-achat`, ce sont les centaines de tests de la suite actuelle qui partent). Aucune commande n'est passée (prod). Ce lancement devient le dernier rapport de `resultats/tnr/` (le précédent est rangé dans `resultats/tnr/lancements/`) ; l'archive n'est pas touchée.

## Limites à annoncer

- Appareils **émulés** (Chrome et Safari de bureau avec une taille et un comportement de mobile), pas de vrais téléphones.
- Lancement **en local** sur un Mac, pas encore en CI.
- Préprod non iso avec la prod : textes en partie en anglais, prix différents, un seul moyen de paiement.
- Tests visuels en prod uniquement, sur 3 pages.
- Un seul parcours (le parcours nominal) : les états produit (rupture, précommande, coming soon…) viendront ensuite.
