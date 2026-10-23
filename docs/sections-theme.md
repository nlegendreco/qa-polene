# Sections du thème et pages de sections

> Relevé du 12 octobre 2026 sur le thème publié de la préprod (`polene/store/pp-polene`, mis à jour le 12 octobre à 16 h), en lecture seule par la CLI Shopify (droit `read_themes`). Pages de sections : modèles `article.sections-1`, `-2`, `-3` (`blogs/editorials/sections`, `sections-2`, `sections-3`).

Le thème compte **83 sections**. Les trois pages de sections en posent **31 types**. Il en reste **52**, classées ci-dessous.

Deux réglages de chaque section décident où on peut la poser :
- **Limite de modèle** (`enabled_on` dans son schéma) : une section limitée à l'accueil ne peut pas être ajoutée à un article.
- **Préréglage** (`presets`) : sans préréglage, la section n'apparaît pas dans « Ajouter une section » de l'éditeur ; seul un dev peut la poser, dans le fichier JSON du modèle.

## 1. Peuvent être ajoutées aux pages sections-1 à 3

| Section | Nom dans l'éditeur | Utilisée aujourd'hui | Remarque |
|---|---|---|---|
| `blog-space` | Blog Space | 10 modèles d'articles | Espacement vertical |
| `eyes-cursor` | Friendly faces | `page.friendly-faces` (pages/eye-cursor) | |
| `plain-article` | Main content | `article.plain`, `article.craftsmanship`, `article.sustainable-projects` | Contenu principal d'un article simple |
| `instafeed` | Instafeed App | nulle part | Vérifier qu'elle sert encore (l'accueil utilise `instagram`) |
| `video-gallery` | Video gallery | `page.video-gallery`, `page.video-gallery-2` | Sans préréglage : à poser par un dev |
| `craftsmanship-intro` | (sans nom) | blogs bags, craftsmanship, shoes | Sans préréglage : à poser par un dev |
| `store-article` | (sans nom) | `article.store` | Sans préréglage : contenu principal des articles boutique |

## 2. Limitées à un autre type de page

Impossibles à poser sur un article. Pour les tester comme les autres, il faudrait une page de sections du bon type.

| Type de page | Sections | Utilisées nulle part |
|---|---|---|
| Accueil (`index`) | `hero`, `promoted-collections`, `instagram` | `article-teaser`, `page-teaser`, `triple-teaser` |
| Page (`page`) | `customizable` (page UAT), `page-hero` (craftsmanship, sustainable-projects, tests-streaming), `blog-viewer-article` (la-maison) | |
| Blog (`blog`) | `numbered-info-grid` (blogs bags, shoes), `discover-more` (blogs craftsmanship, shoes) | |
| Fiche produit (`product`) | `splitscreen-teaser` (20 modèles de fiche) | `complete-the-look` |

Shopify ne permet pas de second modèle pour l'accueil : les sections réservées à l'accueil ne se testent que sur l'accueil. Pour les autres, une page, un blog et une fiche produit QA de sections suffiraient (la fiche QA01 par exemple).

## 3. Propres à un écran (normal qu'elles ne soient pas sur les pages de sections)

En-tête et pied de page (`header`, `header-announcements`, `footer`), contenus principaux (`main-404`, `main-account`, `main-activate-account`, `main-addresses`, `main-blog`, `main-cart`, `main-collection`, `main-list-collections`, `main-login`, `main-order`, `main-password`, `main-recover-password`, `main-register`, `main-reset-password`, `main-search`, `product-main`, `page`, `stores-blog`, `sustainable-blog`), écrans à part (`design-system`, `wishlist`, `wishlist-slider`, `gift-card`, `redirection-sap-documents`), notification d'ajout au panier (`cart-notification-content`, `-preview`, `-product`), redirection de boutique (`store-redirect-i18n`).

## 4. Code peut-être mort (à voir avec les devs)

- Posées dans aucun modèle et appelées nulle part dans le code du thème : `article-teaser`, `complete-the-look`, `instafeed`, `page-teaser`, `triple-teaser`, `main-product` (les fiches utilisent `product-main`), `store-redirect-i18n`, `cart-notification-preview`. Une section peut être appelée par du JavaScript avec un nom construit : à confirmer avant de supprimer quoi que ce soit.
- `cart-notification-preview` et `cart-notification-product` portent un commentaire « TODO: DELETE THIS FILE AFTER VERIFYING cart-notification-content.liquid IS WORKING ».

## Couverture des 83 sections (12 octobre 2026)

Limite Shopify : 25 sections par modèle de page (et 50 blocs par section), intitulés « text » compris. D'où trois pages de sections ; sections-1 et -2 sont pleines, sections-3 a 6 places libres.

Choix validé par la QA : pas de nouvelle page de sections, on teste les pages réelles qui portent déjà les sections manquantes (`data/pages-sections.json`, pages R01 à R18). Leur contenu change avec l'équipe : pas de liste figée, seulement l'état des sections (affichées, images chargées, ni erreur JS ni texte d'erreur Shopify, pas de débordement). Une section vide y est notée sans échec (panier vide, pas de favoris, bloc d'application caché).

| | Sections | Où |
|---|---|---|
| Pages de sections, UAT, design system, en-tête et pied de page | 37 | sections-1 à 3, `pages/uat-video-toggle`, `pages/design-system` |
| Pages réelles ajoutées au test | 27 | accueil (`hero`, `promoted-collections`, `instagram`, `blog-space`), fiche QA01 (`product-main`, `splitscreen-teaser`), collection QA, liste des collections, panier (`main-cart`, `wishlist-slider`), recherche, 404, connexion (`main-login`, `main-recover-password`), création de compte, `blogs/bags` (`craftsmanship-intro`, `numbered-info-grid`), `blogs/news` (`main-blog`), `blogs/stores` (`stores-blog`), `blogs/jewellery/confection` (`plain-article`), `pages/craftsmanship` (`page-hero`), `pages/la-maison` (`blog-viewer-article`), `pages/eye-cursor` (`eyes-cursor`), `pages/wishlist`, `pages/sap-invoices-email-redirection` |
| Vues par un autre test | 2 | notification d'ajout au panier (`cart-notification-content`, parcours d'achat), page mot de passe de la préprod (`main-password`, connexion des tests) |
| Espace client (connecté) | 3 | `main-account` (6 vues), `main-addresses` (liste, ajout, modification), `main-order` : `tests/compte-client.spec.ts`, compte de test `+qacompte` (commande T19581 du 13 octobre 2026). Le thème affiche toujours ces pages avec la nouvelle connexion Shopify par code |
| Lien reçu par email | 3 | `main-activate-account`, `main-reset-password` : ancienne connexion par mot de passe, plus utilisée en préprod (connexion par code), et pas de test de connexion en prod pour l'instant ; `gift-card` : pas testée |
| Aucune page publiée trouvée | 4 | `video-gallery`, `discover-more`, `sustainable-blog`, `store-article` : pas testées (décision QA du 13 octobre 2026) |
| Peut-être du code mort | 9 | `article-teaser`, `complete-the-look`, `instafeed`, `page-teaser`, `triple-teaser`, `main-product`, `store-redirect-i18n`, `cart-notification-preview`, `cart-notification-product` (constat 30) : pas testées |

Total testé automatiquement : 69 sections sur 83 (37 + 27 + 2 + 3). Les pages de l'ancienne connexion (`account/login`, `?view=recover`, `account/register`) restent testées tant que la prod les utilise, même si la préprod n'y mène plus (décision QA du 13 octobre 2026).

Limites connues : sur le panier vide, `wishlist-slider` et le bloc de recommandations n'ont rien à montrer (vides) ; `article-link-list` est vide sur l'article Confection ; le bloc d'application de la connexion (pré-remplissage de l'email) est invisible par nature.

## Sections testées une à une (22 octobre 2026)

Demande QA : sur les pages Sections 1 à 3, chaque section est un test à part, nommé d'après l'intitulé posé au-dessus d'elle (« Carousel », « Mosaic »…), quelle que soit la page. 30 sections, sur les 4 appareils :

- `Section · <intitulé>` (`tests/sections.spec.ts`, type « contrôles ») : la section est sur la page, sous son intitulé, s'affiche, ses images chargent, sans texte d'erreur Shopify ;
- `Accessibilité (axe) · Section <intitulé>` (même fichier, type « accessibilité ») : axe limité à la section, relevé `references/accessibilite/sections/<intitulé>/` ;
- `Visuel · Section <intitulé>` (`tests/visuel-sections.spec.ts`, type « visuel ») : capture de la section, référence prise en préprod (`references/sections/<intitulé>/`), à valider par la QA.

Restent vérifiés par page (`Sections · Sections 1 (blog)`…) : présence et ordre des sections, erreurs JavaScript, largeur de la page, et les sections sans intitulé (en-tête et fin d'article). La correspondance intitulé → section est dans `intitules` de `data/pages-sections.json`. Sur Sections 3, la section Text est posée sous l'intitulé « Split Screen Media », et l'intitulé « Text » n'a rien en dessous : le test le signale (« Intitulé ») ; à remettre dans l'ordre sur la page.

### Interactions par section (proposition, à valider par la QA avant d'être codée)

Relevé du HTML de la préprod le 22 octobre 2026 : composants du thème, boutons, formulaires, vidéos.

| Section | Ce qui réagit | Interactions proposées |
| --- | --- | --- |
| Article List | carrousel d'articles, points | flèches au clavier et points : la diapositive change ; chaque carte mène à son article |
| Blog Double Media, Blog Layer Sections, Blog Media, Blog Split Screen, Blog Text | rien (texte et photos) | aucune : contrôles, accessibilité et capture suffisent |
| Blog Promoted Item | produit mis en avant : ajout au panier, favori, bouton pause / lecture de la vidéo | ajout au panier (notification, compteur), cœur des favoris (`aria-pressed`, compteur), pause / lecture au clavier |
| Blog Split Screen Map | carrousel (boutiques), points, 3 liens | changer de diapositive ; les liens mènent à une page qui répond |
| Blog Triple Media | carrousel de photos, points | changer de diapositive (mobile : au doigt, comme la galerie de la fiche) |
| CTA, Product Banner, Hero Flowers, Split Promo Block, Split Screen Media, Text | un ou deux liens | le lien mène à une page qui répond (200) |
| Collection Teaser | 4 cartes produit avec ajout rapide et favori | ajout rapide d'une carte (comme `tests/cartes-collection.spec.ts`), cœur d'une carte |
| Carousel | carrousel de produits qui défile seul, points | défilement automatique (la position change), arrêt au survol ou au focus si prévu, cartes cliquables |
| Countdown Teaser | compte à rebours, champ email, bouton « CONFIRM » | le compte à rebours affiche une date valable (aujourd'hui « 00000000 ») ; email vide ou « test@ » refusé, sans envoi |
| Explore More Articles | 3 liens d'articles | les liens mènent à des articles qui répondent |
| Media Collection Teaser | cartes produit | chaque carte mène à sa fiche |
| Mosaic | vidéo et bouton pause / lecture | pause / lecture au clavier (déjà testé sur la page UAT) |
| Order Tracker | suivi de commande (`order-tracker`) | formulaire de suivi : numéro vide ou faux refusé avec un message, sans vraie commande |
| Product Recommandations, Product Recommandations (Cart) | recommandations (vides sur un article) | à décider : vides par nature sur un article (pas de produit de référence) |
| Split Newsletter Block | champ email, bouton « CONFIRM » | email vide ou « test@ » refusé, sans envoi (jamais d'inscription réelle) |
| Text Collection Teaser | carrousel qui défile seul | défilement automatique, liens |
| Sticky Text Gallery | texte fixe pendant que les photos défilent | au défilement, le texte reste à l'écran et la photo affichée change |
| Featured Media Frieze, Text with Frieze | frise (carrousel) | la frise défile ; liens de Text with Frieze |
| Video | lecteur vidéo et ses commandes (`component-video-controls`) | lecture, pause, son au clavier |

## Refaire le relevé

Lecture seule, avec la CLI Shopify connectée avec le droit `read_themes` : lister `sections/*.liquid` et lire `templates/*.json` du thème `MAIN` (requête GraphQL `themes(roles: [MAIN]) { files(filenames: [...]) }`), puis comparer les `type` des sections posées dans `article.sections-1` à `3` avec la liste des fichiers.
