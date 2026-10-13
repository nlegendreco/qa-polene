# Reprise · Phase 1 « préprod déterministe »

> Notes de la séance du 7 octobre 2026, pour reprendre là où on s'est arrêté. Le détail est dans les documents cités ; ce fichier dit où on en est, ce qui a été décidé et quoi faire ensuite.

## Où on en est, en bref

Les POC sont validés. On a démarré la phase 1 de la roadmap : avoir en préprod des données de test qui ne bougent pas.

1. Un **test de santé des données** existe et fonctionne (`npm run test:donnees`). Il vérifie aujourd'hui 9 **vrais** produits de la préprod.
2. On a décidé de remplacer ces vrais produits par des **copies QA** (produits et collections à nous), parce que les réimports de la prod vers la préprod écraseraient nos réglages.
3. Le **plan complet** des données QA est écrit : [plan-donnees-qa.md](plan-donnees-qa.md). **Il attend ta validation.**
4. La **CLI Shopify** est installée et connectée à la préprod en **lecture seule**. Rien n'a encore été modifié dans la préprod.

**Prochaine action : valider le plan, puis lancer le pilote** (section « Prochaines étapes »).

## Ce qui est fait

| Quoi | Où | État |
|---|---|---|
| Relevé du catalogue préprod (474 produits visibles, leurs états) | [produits-fixes.md](produits-fixes.md) | Fait |
| 9 produits fixes choisis et validés (P01 à P09), sans P10 « moyens de paiement » (carte seule en préprod) | `data/produits-fixes.json` | Fait, commité |
| Test de santé des données : un contrôle par produit, Chrome seul, sans commande, appareil « Données préprod » dans le Rapport Polène | `tests/sante-donnees.spec.ts`, `npm run test:donnees` | Fait, commité. 4 passages verts ; deux erreurs provoquées exprès (P03, P04) bien signalées |
| CLI Shopify installée dans le projet (version 4.8.5) | `package.json` | Fait, **pas encore commité** |
| Connexion de la CLI à la préprod avec ton compte, droits en lecture (produits, stocks, emplacements, publications) | Jeton gardé sur le Mac, hors du dépôt | Fait le 7 octobre. **Le jeton expire : à refaire** à la reprise |
| Lecture de l'admin : où chaque état est rangé, les 250 collections, les 105 réglages personnalisés (32 de collection, 60 de produit, 13 de variante) | [produits-fixes.md](produits-fixes.md), [plan-donnees-qa.md](plan-donnees-qa.md) | Fait |
| Plan des données QA (22 produits, 38 de remplissage, 8 collections, entrée de menu) | [plan-donnees-qa.md](plan-donnees-qa.md) | Écrit, **à valider** |

## Ce qu'on a décidé

| Sujet | Décision |
|---|---|
| Produits de test | Des **copies** des vrais produits, pas les vrais produits marqués. Raison : les réimports prod → préprod les écraseraient, et nos achats de test vidaient le stock des vrais |
| Nom des produits | `QA <Modèle> - <Cas>`, en anglais. Le thème coupe au tiret : le site affiche « QA Numéro Un » puis « Edition Out of Stock » |
| Handle | `qa-<modèle>-<cas>` (n'existe pas en prod) |
| Tag | `qa-fixture` (et `qa-filler` pour le remplissage) |
| Étiquette « QA » visible sur le site | Non : elle pourrait cacher l'étiquette « New » qu'on veut tester |
| Menu | Une entrée **« QA »** dans le menu de la préprod, qui mène aux collections QA |
| En-têtes de collection | Surtout le **carrousel** (comme « Sacs par collection »), quelques collections en **titre seul** (comme « Nouveautés »). Les onglets plus tard |
| Grandes collections | 38 produits de remplissage pour dépasser 48 et tester le défilement infini et le bouton « Voir plus ». Repli : la vraie collection Sacs |
| Carte cadeau | Non |
| Petit prix | Fusionné avec l'accessoire (miroir Atla), qui a une vraie mise en page différente. Ajout d'un prix au-dessus de 1 000 € |
| Matrixify | Jamais utilisé par la QA. Aucun nouveau métaobjet créé (l'équipe exporte parfois les métaobjets vers la prod) |
| Modifications de la préprod | Par la CLI, toujours montrées avant d'être envoyées, avec ton accord |
| Ordre de travail | Tout valider, puis un pilote, puis un test de base, puis l'extension |

## Ce qu'on a appris sur la préprod

- **Deux fiches produit** depuis le 7 octobre : l'ancienne (menu « Select size », coloris en carrousel de vignettes, onglet « Size & fit ») est revenue ce jour-là pour une partie des navigateurs, à côté de la nouvelle (« Explore all », fenêtre « Choose your size »). Nommage corrigé par la QA le 13 octobre : on appelait « nouvelle » la fiche à vignettes. L'équipe utilise la fonction **Roll Out** pour comparer l'ancienne et la nouvelle : chaque navigateur de test tombe sur l'une ou l'autre. Il faudra que les tests choisissent la version.
- **Où sont rangés les états** : le stock qui compte est celui de l'entrepôt **« Online »** (les boutiques ne comptent pas pour le site) ; coming soon = `coming_soon.enabled` sur le produit ; précommande = `preorder.date` sur la **variante**, plus une **précommande retardée** (`preorder.delayed_date`) ; nouveauté = tag `LABEL:NEW`.
- **Collections** : 175 collections se remplissent seules, presque toutes par tag. Le **défilement infini** est un réglage de chaque collection ; sans lui, un bouton « Voir plus » apparaît. Les **coloris** d'une fiche viennent de la collection de famille (`family_…`), à confirmer au pilote. Les **PLP breaks** et le **carrousel d'en-tête** sont des métaobjets reliés à la collection.
- **La boutique** : « Polène PREPROD », formule Enterprise, en **dollars** (convertis en euros pour la France). Ce n'est pas une boutique de développement : on ne sait pas encore si la CLI acceptera d'y faire des modifications.
- **La préprod bouge** : des centaines de produits modifiés en même temps le 7 octobre à 10 h 26.
- **Constat 24** : deux Cyme Mini (noire et taupe) ont une option « Color » à 3 valeurs pour une seule variante et affichent « Choose your size » sur un sac. Probablement un essai d'un collègue.

## En attente

| Question | Qui |
|---|---|
| Valider le plan complet [plan-donnees-qa.md](plan-donnees-qa.md) | Toi |
| Les réimports prod → préprod : quel outil, suppriment-ils les produits absents de la prod, remplacent-ils le menu ? | Toi, auprès de l'équipe |
| Relancer le parcours d'achat préprod sur la fiche à vignettes, l'ancienne (4 commandes de test) | Ton accord |
| L'artefact « Cartographie QA Polène » n'est plus accessible : supprimé exprès ou à repartager ? CLAUDE.md y renvoie encore | Toi |
| Commiter les changements en cours (CLI, docs, plan) | Ton accord |

## Prochaines étapes, dans l'ordre

1. **Valider le plan** (ou dire ce qu'il faut changer).
2. **Reconnecter la CLI avec les droits d'écriture**, dans Claude Code :
   ```
   ! npx shopify store auth --store asia-polene.myshopify.com --scopes read_products,write_products,read_inventory,write_inventory,read_locations,read_publications,write_publications,read_online_store_navigation,write_online_store_navigation,read_metaobjects
   ```
   Laisser la commande au premier plan (ne pas la mettre en arrière-plan) et aller au bout dans le navigateur, jusqu'au message « Authenticated ».
3. **Pilote** : créer QA02 « QA Numéro Un Nano - Out of Stock », la « QA Collection » avec ce seul produit (en-tête carrousel) et l'entrée « QA » du menu. Liste exacte des modifications montrée avant envoi.
4. **Vérifier le pilote** : fiche, carte, carrousel, menu, absent de la recherche et des autres collections.
5. **Test de base** : le test de santé passe sur le produit et la collection pilotes.
6. **Extension** : les autres produits et collections, le script de création et de remise en état, puis les tests qui s'en servent.

## Commandes utiles

```bash
npm run test:donnees     # état des produits fixes (préprod, Chrome seul, sans commande)
npx shopify store auth list    # la CLI est-elle connectée ?
npx shopify store execute --store asia-polene.myshopify.com --query-file <fichier.graphql>   # lecture de l'admin
```

## Fichiers à relire

- [plan-donnees-qa.md](plan-donnees-qa.md) : le plan à valider
- [produits-fixes.md](produits-fixes.md) : les 9 produits actuels, le test de santé, où sont rangés les états
- `CLAUDE.md`, section « Suivi » : avancement et prochaines actions du projet
- `roadmap-qa-polene.md`, tableau « Avancement » : phase 1
