# Références de structure

> 16 octobre 2026, phase 2.5 de la roadmap. Test : `tests/structure.spec.ts`. Mécanisme : `src/structure.ts`. Pages : `src/pages-testees.ts` (les mêmes que l'accessibilité, sans le checkout).

## Le principe

Pour chaque page, le test relève la liste de ses **titres** (h1 à h4, dans l'ordre), de ses **boutons** et de ses **liens** (texte et adresse), et la compare à la référence de la page, `references/structure/<page>/<projet>.json` (versionnée avec les tests). L'en-tête (menus compris, même fermés) et le pied de page sont relevés une fois, sur l'accueil, puisqu'ils sont les mêmes partout.

Un lien disparu, un bouton renommé, un titre en plus, un lien dont l'adresse change, des titres dans un autre ordre : le test échoue et dit quoi (« disparu : « Sacs » → /collections/bags », « nouveau : … », « ordre changé »), même quand le visuel change peu. Chaque test joint « 🧱 structure relevée », la liste complète.

Un changement voulu (MEP, nouveau contenu) se reprend avec `npm run test:structure:maj`, avec l'accord de la QA, comme les références visuelles. Seules les références qui ont changé sont réécrites ; l'ancienne version reste dans l'historique Git (le diff montre exactement ce qui a changé). Une page ajoutée aux tests a besoin de sa première référence (même commande).

## Ce qui n'est pas relevé

Ce qui change sans que personne ne touche au site, pour qu'un échec veuille dire « quelqu'un a changé la page » :

- **zones** : cartes produit (stocks, nouveautés, ordre des grilles), cartes d'articles des blogs et de La Maison (chargées au défilement), diapositives des carrousels (créées à l'approche de l'écran), recommandations, photos Instagram, alertes de retour en stock du compte, fenêtre de géolocalisation de la préprod ;
- **dans les textes** : prix (`<prix>`, les euros de la préprod suivent le taux de change), nombres entre parenthèses (`Coloris (N)`), nombres de produits (`• N`, `N produits`), compteurs du panier et des favoris de l'en-tête ;
- **éléments masqués** (`display: none`) : la version ordinateur ou mobile cachée d'un bloc. Les menus et fenêtres fermés, eux, sont relevés (ils sont dans la page, cachés autrement).

Conséquence : un produit qui disparaît d'une collection ou un article retiré d'un blog ne sont pas vus ici (les collections sont vérifiées par `tests/structure-collections.spec.ts`). En prod, une page éditoriale modifiée par l'équipe hors MEP (accueil d'une nouvelle campagne, fiche dont le stock change le bouton) fait échouer le test : c'est un vrai changement, à reprendre.

## Pages

Préprod : les pages de `data/pages-sections.json` (pages de sections, UAT, design system, pages réelles), la fiche QA01 sur chacune des deux fiches du Roll Out, les 7 pages de l'espace client, l'en-tête et le pied de page. Prod : les pages réelles qui y existent (`cheminProd`), la fiche Cyme Mini camel (deux fiches), l'en-tête et le pied de page. Chrome ordinateur et iPhone.
