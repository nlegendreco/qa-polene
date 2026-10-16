# Accessibilité : relevé axe et cran

> 16 octobre 2026, phase 2.4 de la roadmap. Tests : `tests/accessibilite-axe.spec.ts` (axe) et `tests/accessibilite.spec.ts` (bouton pause / lecture au clavier). Mécanisme : `src/accessibilite.ts`.

## Le principe

L'équipe corrige l'accessibilité du site au fil de l'eau, et il n'existe pas de liste à jour (Jira compris) de ce qui doit déjà marcher. Les tests ne jugent donc pas les pages d'après une liste écrite à la main : ils suivent les corrections, en « cran ».

- **Relevé** : chaque page testée a son relevé de référence, `references/accessibilite/<page>/<projet>.json`, versionné avec les tests. Il liste les types de problème (règles axe) présents sur la page au moment du relevé, avec le nombre d'éléments concernés.
- **Problème du relevé encore là** : noté dans le rapport (« Accessibilité, en cours de correction », avec l'évolution du nombre), jamais en échec.
- **Problème du relevé qui a disparu** : noté « Accessibilité, corrigé depuis le relevé ». Pour qu'il reste corrigé, on l'enregistre avec `npm run test:accessibilite:maj` (avec l'accord de la QA, comme une référence visuelle). Une fois enregistré, s'il revient, le test échoue.
- **Problème absent du relevé** : échec. C'est soit la régression d'un point corrigé, soit un problème nouveau sur la page.

`npm run test:accessibilite:maj` ne fait que **rétrécir** les relevés : il retire ce qui a été corrigé et met les nombres à jour, mais n'accepte jamais un nouveau problème (le test reste en échec). Pour accepter quand même un nouveau problème, en connaissance de cause : `ACCESSIBILITE_MAJ=tout` à la place de `ACCESSIBILITE_MAJ=1` (jamais sans l'accord de la QA). Une page sans relevé (page ajoutée aux tests) échoue avec la commande à lancer ; `test:accessibilite:maj` lui fait son premier relevé.

Chaque test joint « ♿ accessibilité, détail axe » : pour chaque problème, le lien vers l'explication de Deque (en français), les 5 premiers éléments concernés et ce qu'axe leur reproche, puis ce qu'axe n'a pas pu trancher seul (contraste d'un texte sur une photo…), à regarder à la main, jamais compté.

## Ce qui est vérifié

- **Règles** : WCAG 2.1 niveaux A et AA (`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`), la base du RGAA. Textes d'axe en français (traduction fournie avec axe).
- **Zones exclues** : bulle du chat Zendesk et photos Instagram de l'accueil (contenu de tiers, qui change d'un passage à l'autre).
- **Pages** : toutes celles de `data/pages-sections.json` en préprod (pages de sections, UAT, design system, pages réelles), celles qui existent aussi en prod (`cheminProd`), la fiche produit sur chacune des deux fiches du Roll Out (QA01 en préprod, Cyme Mini camel en prod), le checkout sans rien saisir (prod et préprod), les 7 pages de l'espace client de la préprod (session `npm run connexion:compte`).
- **Appareils** : Chrome ordinateur et iPhone (limite d'appels Shopify, comme les pages de sections).
- **Granularité** : le cran porte sur le type de problème par page, pas sur chaque élément. Un bouton sans nom de plus sur une page qui en a déjà n'est pas un échec (le nombre en hausse est noté). Suivre chaque élément aurait fait échouer les tests à chaque changement de produits dans une grille.

Stabilité (16 octobre 2026) : 3 passages pour les pages de la préprod et 6 pages de la prod, 2 pour les autres pages de la prod, mêmes problèmes et mêmes nombres partout. Détection vérifiée : un problème retiré du relevé fait échouer le test (« Problème(s) d'accessibilité absent(s) du relevé… »), un faux problème ajouté au relevé est noté « corrigé », et `test:accessibilite:maj` le retire (le relevé revient à l'identique).

## Premier relevé (16 octobre 2026)

51 pages (33 en préprod, 18 en prod, chaque fiche comptée à part) × 2 appareils, 102 relevés. **Aucun problème sur l'accueil, les deux fiches produit, le panier vide, la liste des collections, la page introuvable, les favoris, les boutiques, le savoir-faire**, en prod comme en préprod : ces pages sont verrouillées à zéro dès maintenant. 8 types de problème ailleurs :

| Problème (règle axe, gravité selon axe) | Où | Exemple |
| --- | --- | --- |
| Contraste de couleurs insuffisant (`color-contrast`, grave) | 18 pages : blogs (Actualités 17 éléments en préprod, 6 en prod), création de compte, connexion, checkout, collections et recherche sur mobile, espace client, pages de sections | lien « Mot de passe oublié » de la connexion (gris clair) |
| Rôle ARIA sans le parent attendu (`aria-required-parent`, critique) | les 7 pages de l'espace client (7 à 8 éléments) | entrées du menu du compte en `role="menuitem"` sans `role="menu"` autour |
| Libellé lu différent du texte affiché (`label-content-name-mismatch`, grave) | collections et recherche sur mobile, checkout | bouton d'ajout rapide en précommande : `aria-label` « Boky - Ébène Grainé - Précommander maintenant » |
| Image sans texte de remplacement (`image-alt`, critique) | page UAT (12), Sections 1 et 2 | image de secours dans les balises `video` |
| Lien sans texte (`link-name`, grave) | Sections 1 | lien Google Maps vide de la carte des boutiques (Séoul) |
| Menu déroulant sans nom (`select-name`, critique) | profil du compte | civilité (`#civility`) |
| Auto-remplissage mal déclaré (`autocomplete-valid`, grave) | profil du compte | date de naissance (`autocomplete="birthdate"`, valeur qui n'existe pas) |
| Zoom désactivé (`meta-viewport`, moyen) | checkout sur iPhone (prod et préprod) | page de Shopify, pas du thème |

Le détail page par page est dans les relevés (`references/accessibilite/`) et dans le Rapport Polène (`npm run rapport:polene -- accessibilite`).

À noter : le constat 12 (boutons sans nom accessible sur la fiche produit, le panier, les favoris, la connexion et la création de compte, relevé le 6 octobre 2026) n'est plus vu par axe sur ces pages. Corrigé depuis, ou relevé par un autre moyen que les règles WCAG d'axe : je ne sais pas.

## Ce qu'axe ne voit pas

axe lit la page sans s'en servir. Il ne voit qu'une partie des problèmes d'accessibilité :

- l'utilisation au clavier (menu « Sacs » qui n'ouvre pas son sous-menu, constat 15 ; tailles de l'ancienne fiche, constat 34 ; vignettes de coloris en `tabindex="-1"`, constat 38) ;
- l'ordre de lecture, le focus qui se perd ou reste bloqué (fenêtre de géolocalisation de la préprod) ;
- la qualité des textes : un nom présent mais faux ou incomplet (« QA Cyme Mini - Merino Ebony, of », constat 38) passe ;
- ce qu'un lecteur d'écran annonce après une action (`aria-live` du panier, constat 29) ;
- les fenêtres et menus fermés au moment de l'analyse.

Pour ça, il faut des tests écrits exprès, comme celui du bouton pause / lecture (`tests/accessibilite.spec.ts`).

## Reste à faire

1. **Fenêtres et menus ouverts** : analyser aussi les états qu'axe ne voit pas page fermée : menu de l'en-tête et menu mobile, notification d'ajout au panier, « Remove item ? », « Choose your size », « Être prévenu(e) », fenêtre des photos, filtres des collections. Même mécanisme de relevé.
2. **Tests au clavier**, sur le modèle du bouton pause / lecture : menu de l'en-tête (constat 15), tailles et coloris des deux fiches (constats 34 et 38), fenêtres (focus gardé dedans, Échap, retour du focus au bouton qui l'a ouverte), parcours d'achat au clavier.
3. **Annonces aux lecteurs d'écran** : compteur du panier après un ajout (constat 29), messages des formulaires.
4. **Safari et Android** : pas couverts (limite d'appels Shopify). À ajouter si la QA veut les 4 appareils.
5. **QA** : relire le premier relevé et dire si un de ces problèmes doit être remonté à l'équipe tout de suite, ou si l'équipe les a déjà dans ses corrections. Valider le principe du cran (qui donne l'accord pour `test:accessibilite:maj`).
