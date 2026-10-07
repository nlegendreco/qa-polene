# Présenter le POC 1

> POC 1 validé par la QA le 2 octobre 2026. Version du code : commit `59f286c`.

## Ce que le POC 1 prouve

Un parcours d'achat complet est testé automatiquement sur 4 appareils (desktop Chrome, desktop Safari, iPhone 15, Pixel 7), et le rapport permet de comprendre un échec sans l'aide d'un dev.

| | Prod polene-paris.com | Préprod asia-polene |
|---|---|---|
| Jusqu'où va le test | Arrivée au checkout (6 étapes) | Confirmation de commande + questionnaire (10 étapes) |
| Commande créée | Aucune | Une par appareil |
| Résultat | 4/4 | 4/4 |

Durée d'un lancement complet : environ 2 minutes (2,3 min pour le lancement archivé).

Critères Go / No-Go atteints :
- le parcours passe sur les 4 appareils, en prod et en préprod ;
- 5 relances d'affilée donnent le même résultat (mesuré en prod) ;
- un échec se comprend dans le rapport en moins de 5 minutes.

Commandes de test préprod passées pendant la validation : T19558, J8GYD9V36, VVGWK0PJK.

Lancement archivé (2 octobre 2026, 11 h 25) : 8/8 + la connexion préprod. Produit : Numéro Un Nano - Textured Chalk, 424,95 €. Commandes créées : 4AL0PJLNZ (desktop Chrome), TPAH7JNJV (desktop Safari), QIKMMFAUE (iPhone), C0DPF5W9G (Pixel 7).

## Où est conservée l'exécution

Dans `archives/2026-10-02-poc1/`, sur le Mac de la QA :

| Dossier | Contenu | Pour l'ouvrir |
|---|---|---|
| `parcours/` | Rapport du parcours d'achat | `npx playwright show-report archives/2026-10-02-poc1/parcours` |
| `demo-echec/` | Rapport de l'échec volontaire (bouton « Ajouter au panier » masqué) | `npx playwright show-report archives/2026-10-02-poc1/demo-echec` |

Le rapport s'ouvre dans le navigateur. Passer par `show-report` plutôt que double-cliquer sur `index.html`, sinon la trace (« View Trace ») ne s'ouvre pas.

**Ces archives ne sont pas dans Git**, pour deux raisons : les captures du checkout préprod montrent l'email du client de test, et la démo d'échec pèse 15 Mo (vidéo et trace). Pour les partager, envoyer le dossier zippé par un canal interne. Ne pas le publier.

Pour archiver un nouveau lancement : `npm run archiver -- <nom>`, par exemple `npm run archiver -- poc2`. On obtient alors `archives/<date>-poc2/`. Le même nom le même jour remplace l'archive précédente.

## Déroulé de démo proposé (10 minutes)

1. **Le résultat global** (`parcours/`) : la liste des tests, un par environnement et par appareil, tous verts. Les filtres en haut permettent de n'afficher qu'un appareil ou une étiquette (`@smoke`, `@tnr`).
2. **Un parcours préprod sur iPhone** : ouvrir le test pour faire défiler les étapes en français, chacune avec sa capture d'écran. Montrer :
   - le menu mobile (burger, puis « Voir tout ») ;
   - le contrôle du prix entre le panier et le checkout ;
   - le numéro de commande noté à la confirmation ;
   - la réponse au questionnaire « Comment avez-vous connu Polène Paris ? ».
3. **Un échec** (`demo-echec/`) : le message d'erreur en français, la capture au moment de l'échec, la vidéo, puis la trace (frise cliquable qui montre la page à chaque instant).
4. **Ce que les tests ont déjà trouvé** : les constats remontés à l'équipe (section « Constats » de [CLAUDE.md](../CLAUDE.md)), notamment les cases newsletter et SMS pré-cochées au checkout et le questionnaire présent en double dans la page.
5. **En direct, si on veut** : `npx playwright test --project "prod · iphone" --headed` ouvre le navigateur et déroule le parcours sous les yeux de l'équipe. Aucune commande n'est passée (prod).

## Limites à annoncer

- Appareils **émulés** (Chrome et Safari de bureau avec une taille et un comportement de mobile), pas de vrais téléphones.
- Lancement **en local** sur un Mac, pas encore en CI.
- Préprod non iso avec la prod : textes en partie en anglais, prix différents, un seul moyen de paiement.
- Un seul parcours (le parcours nominal) : les états produit (rupture, précommande, coming soon…) viendront en phase 2.
