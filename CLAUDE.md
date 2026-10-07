# CLAUDE.md · QA automatisée Polène

Tests automatisés (Playwright, TypeScript) du site Shopify [polene-paris.com](https://www.polene-paris.com/) et de sa préprod. Objectif : remplacer progressivement la recette manuelle (TNR) par une QA automatisée desktop + mobile, fonctionnelle et visuelle.

- Feuille de route détaillée et avancement : [roadmap-qa-polene.md](roadmap-qa-polene.md)
- Installation et commandes : [README.md](README.md)
- Clients fictifs utilisés par les tests : [docs/profils-clients.md](docs/profils-clients.md)
- Présenter le POC 1 (exécution archivée, déroulé de démo) : [docs/demo-poc1.md](docs/demo-poc1.md)
- Ce qui est automatisable par page (codé, pixel, IA, manuel) et résultats de la passe du 6 octobre 2026 : [docs/automatisation-par-page.md](docs/automatisation-par-page.md)

## Règles de travail

- **Langue** : tout en français (échanges, noms d'étapes, messages d'erreur, docs). La personne avec qui on travaille est la QA du projet, pas un profil développeur : expliquer simplement, sans jargon inutile.
- **Commandes préprod** : chaque achat préprod crée une vraie commande de test (un lancement complet = 4 commandes). Ne jamais lancer de test préprod qui va jusqu'au paiement sans accord explicite. Pas de commande le soir.
- **Prod** : jamais de paiement. Les tests prod s'arrêtent à l'arrivée sur le checkout. On peut lancer `npm run test:prod` à tout moment.
- **Données personnelles** : aucune donnée réelle dans le dépôt. Le mot de passe préprod, l'email du client de test et les infos de carte restent dans `.env` (non versionné). Ne jamais écrire l'email personnel de la QA dans un fichier versionné. Les dossiers `emails/`, `.auth/`, `archives/`, rapports et résultats sont exclus de Git.
- **Git** : commit et push uniquement sur demande. Vérifier `git status` et l'absence de secrets avant chaque commit.
- **Vérifier avant d'annoncer** : un changement de test est validé par un lancement réel (prod sans restriction, préprod avec accord). Dire clairement ce qui n'a pas été testé.
- **Suivi** : après chaque étape, mettre à jour la section « Suivi » ci-dessous et le tableau « Avancement » de la roadmap.

## Environnements

| | Prod FR | Préprod |
|---|---|---|
| URL de base des tests | `https://www.polene-paris.com/` | `https://asia-polene.myshopify.com/fr-fr/` |
| Accès | Public | Mot de passe Shopify (`PREPROD_PASSWORD`), saisi par `tests/auth.setup.ts` |
| Jusqu'où va le test | Arrivée au checkout | Confirmation de commande |
| Paiement | Aucun | Carte de test Shopify Payments 4242 4242 4242 4242 |

Préprod : par défaut en anglais / USD / marché US, d'où le préfixe `/fr-fr/` (non mémorisé, il faut le garder sur chaque URL). Même en `/fr-fr/`, une partie des textes du thème reste en anglais et les prix diffèrent de la prod. Un seul moyen de paiement (carte) et un seul mode de livraison.

Autres boutiques de prod (pas encore testées) : `uk-polene`, `jp-polene`… une boutique Shopify et un thème par marché.

## Commandes

```bash
npm run test:prod                       # prod, 4 appareils, sans commande
npm run test:preprod                    # préprod, 4 appareils = 4 commandes de test
npx playwright test --project "prod · iphone" --headed
npx playwright test --ui                # suivi visuel étape par étape
npm run rapport:polene                  # Rapport Polène du dernier lancement (tableau de bord + détail), servi en local
npm run rapport:polene -- visuel        # … des tests visuels (aussi : regressions, demo-echec, ou un chemin d'archive)
npm run rapport                         # rapport Playwright d'origine (détail technique)
npm run test:demo-echec                 # échec volontaire (POC 1.6)
npm run test:visuel                     # POC 2 : 3 pages × 4 appareils comparées à references/ (prod)
npm run test:visuel:maj                 # sauvegarde references/ dans archives/references/<date>/, puis reprend la référence (accord QA)
npm run test:regressions                # POC 2.5 : 4 régressions injectées, les 8 tests doivent échouer
npm run archiver -- <nom>               # conserve les rapports dans archives/<date>-<nom>/ (hors Git)
npm run typecheck
```

## Organisation du code

```
playwright.config.ts   Projets = environnement × appareil ("prod · iphone"…), rapports (liste, Playwright, Polène)
src/environments.ts    URL et réglages par environnement
src/fixtures.ts        Neutralisations (cookies, blocage AB Tasty / Klaviyo / pixels), étapes avec capture, diagnostic réseau
src/pages/             Un objet par type de page : header, collection, product, cart, checkout
src/visuel.ts|css      Stabilisation avant capture visuelle (images, vidéos, défilement, carrousels, widgets, barres fixes)
src/shopify.ts         appelShopify : appel direct à la boutique, réessaie sur la limite 429 puis message clair
src/price.ts           Lecture des prix quel que soit le format (640 €, €495,95, $880…)
src/client-test.ts     Charge le client fictif (data/client-test.json + PREPROD_EMAIL)
src/rapport/           Rapport Polène : reporter.ts (données + historique), types.ts, page/ (index.html, app.css, app.js, logo-polene.svg)
scripts/               ouvrir-rapport (serveur local), archiver-rapport, sauvegarder-references
tests/                 auth.setup.ts, parcours-achat, structure-collections, demo-echec, visuel, regressions-injectees (.spec.ts)
references/            Captures de référence visuelles : references/<page>/<projet>.png
```

Rapport Polène (`src/rapport/`) : écrit à chaque lancement dans `rapport-polene[-<série>]/` (même suffixe que le rapport Playwright de la série), avec les pièces jointes copiées dans `donnees/`. L'historique (40 derniers lancements par série) est dans `historique-rapports/` : il alimente les graphiques. Les deux sont hors Git. Page statique en JS sans dépendance ; la trace s'ouvre seulement si le rapport est servi par `npm run rapport:polene` (le serveur ne laisse lire que les dossiers `rapport-polene*` et `playwright-report*`). Démos (`@regressions`, `@demo-echec`) : un échec y compte comme « Détecté », sauf s'il vient d'autre chose qu'une vérification (429, délai) : « Non vérifié ».

Charte du rapport, relevée sur polene-paris.com le 6 octobre 2026 (le Figma « Design System » ne contenait qu'une couverture et deux couleurs) :
- **Polices** chargées depuis le CDN du thème (`cdn/shop/t/34/assets/`, ouvert à tous les sites) : Canela Light (`canelaweb-light`, titres) et Sackers (menu de l'en-tête et boutons, sur ordinateur seulement : trop large sur téléphone). Ce sont des polices sous licence : ne pas les copier dans le dépôt. Hors ligne ou si le thème change de numéro (`t/34`), les polices de secours prennent le relais.
- **Lisibilité** (demande QA du 6 octobre 2026, le site pur était trop fin et trop petit) : Canela en Light et non en Thin ; texte courant en Cormorant Garamond de Google, graisse 500 (celle du CDN Polène n'a pas les chiffres alignés, « 2026 » sortait en chiffres bas de casse) ; petites capitales en Jost, 11 à 12 px, légèrement espacées (8 à 10 px en Sackers sur le site). Sur téléphone, textes des graphiques agrandis (le dessin rétrécit avec l'écran). En-tête aligné sur la largeur du contenu (1 232 px).
- **Couleurs** du thème : blanc, beige clair `#F9F8F6`, beige `#EDEAE7`, gris `#757575`, traits `rgba(0,0,0,.1)`, rouge `#D92E50`. Le « vert » du thème est un gris olive : le vert « Réussi » `#0F8060` et l'ocre « Instable » `#C98A14` ont été choisis à côté et vérifiés lisibles par les daltoniens. Un statut est toujours accompagné d'une icône et d'un libellé.
- **Couleurs des graphiques** (hors statuts), tons de cuir vérifiés pour les daltoniens : bleu `#2F5DA8` (toujours le temps : courbe des durées, tests les plus longs, tuile « Durée totale »), cognac `#B0662E` et rose prune `#B86AA8` (raisons d'échec, dans cet ordre, tuile « Commandes créées »). Tuiles surmontées d'un filet de la couleur de leur statut. « Les plus longs » montre la durée habituelle par un trait noir sur chaque barre.
- **Logo** : `logo-polene.svg`, repris du header du site et inséré dans la page par `reporter.ts` (il prend la couleur du texte).
- Formes du site : angles droits, boutons noirs de 40 px, pastilles à contour fin, champ de recherche souligné.

Conventions :
- Chaque étape d'un test passe par `etape(page, testInfo, 'N. Libellé', …)` : nom en français, capture jointe au rapport.
- Localiser par rôle et nom accessible (`getByRole`), avec des expressions qui acceptent FR et EN (la préprod mélange les deux).
- Chemins relatifs à l'URL de base (`'cart'`, `'products/<handle>'`), jamais `'/cart'`, sinon le préfixe `/fr-fr/` saute.
- Comparer les prix en centimes via `parsePriceToCents`. Le prix de référence vient du JSON Shopify `products/<handle>.js`.
- Étiquettes : `@smoke` (parcours MEP), `@tnr` (non-régression), `@demo-echec`, `@visuel` et `@regressions` (exclus par défaut, activés par `DEMO_ECHEC=1`, `VISUEL=1` et `REGRESSIONS=1`). Ne pas créer de test temporaire étiqueté `@visuel` pendant une série : il serait ramassé.
- Ne jamais reprendre la référence visuelle (`--update-snapshots`) sans l'accord de la QA : c'est son « état validé ». Toujours lancer `npm run test:visuel` avant `test:visuel:maj` et regarder les écarts : la mise à jour remplace les captures différentes sans les montrer. `test:visuel:maj` sauvegarde d'abord toutes les références dans `archives/references/<date-heure>/` (la QA veut garder les anciennes captures) ; pour une seule page, lancer `node scripts/sauvegarder-references.mjs` avant. Vérifier ensuite qu'aucune page mobile n'est plus large que l'écran (une capture iPhone doit faire 393 px de large).
- Collections : vérifiées par leur structure (`tests/structure-collections.spec.ts` : cartes, nom, prix, lien, photo, colonnes, PLP breaks), pas en pixels (décision QA du 6 octobre 2026).
- Messages d'assertion en français, compréhensibles par la QA.

## Particularités du site à connaître

- **Bandeau cookies (Consentmo)** : neutralisé par le cookie `cookieconsent_status=allow`, avec un filet de sécurité sur `button[data-csm-button-type="accept"]`.
- **Compteur panier** : texte masqué « Shopping cart with N items » dans le lien panier du header.
- **Menu mobile** : toucher une catégorie ouvre un sous-menu, il faut ensuite toucher « Voir tout ».
- **Ajout au panier** : la notification `component-cart-notification.is-active` apparaît. Le bouton de la fiche est `.cta-primary-add-to-cart` (attribut `data-state` : submit, disabled, modal).
- **États produit** : en stock, tailles, tailles partielles, rupture (« Être prévenu(e) »), coming soon (modale, métachamp), précommande (`properties[_is_preorder]`, expire seule après sa date), nouveauté (`LABEL:NEW`). Coming soon et précommande ne sont pas dans le JSON public.
- **A/B tests en préprod** : la préprod peut contenir un A/B test en cours de déploiement (ex. 2 octobre 2026 : bouton « Add to cart - <nom du produit> » sur la fiche produit). Un écart de libellé n'est donc pas forcément un bug : vérifier avec l'équipe avant de corriger le test.
- **Questionnaire d'acquisition** : extension checkout `source-survey` de l'app Polène `polene-opc-pp`. À l'envoi, elle poste `{source, order}` sur `<APP_URL>/api/checkout/order-source` (préprod : `https://one-page-checkout-pp.vercel.app`). Rien ne part si aucune réponse n'est enregistrée. Deux instances (une desktop, une mobile).
- **Checkout** : bloc Contact spécifique à Polène avec civilité (M., Mme, Mx), prénom et nom obligatoires. Cases newsletter et SMS pré-cochées. Le total existe en double (résumé mobile replié + colonne desktop). Confirmation précédée de « En cours de traitement… ». La page de confirmation affiche un questionnaire « Comment avez-vous connu Polène Paris ? » (10 réponses, ordre aléatoire à chaque affichage, bouton « Envoyer »).
- **Rapport** : pas de point dans le nom d'une pièce jointe, sinon Playwright le prend pour une extension et l'image ne s'affiche pas.
- **Captures visuelles** : le thème défile en douceur (`scroll-behavior: smooth`), il faut défiler en `behavior: 'instant'` sinon la capture part en plein mouvement. Sur mobile, `.product-add-to-cart`, `collection-toggles` et `.cart__inner--summary` sont fixés en bas d'écran : remis en `position: static` pour la capture. La barre de filtres garde alors la largeur de l'écran et déborde de 12 px : sans `max-width: 100%`, le mobile dézoome toute la page et toutes les photos diffèrent. Ne pas toucher à la largeur des deux autres barres (le bouton « Ajouter au panier » rétrécirait). Chat Zendesk = `iframe#launcher`. Home : 3 vidéos en lecture automatique, arrêtées et cachées à la capture (`video { visibility: hidden }`), une image fixe est dessous. Figer l'image 0 ne suffisait pas sous Safari. Collection : `collection-infinite-scroll` retiré (sinon 287 produits, 35 000 px).
- **Cartes produit hors écran** : en desktop, les cartes des collections sont en `content-visibility: auto`. Le navigateur ne les dessine pas loin de l'écran, et la capture pleine page les rendait en cases blanches (28 produits sur 48 manquaient dans les références du 2 octobre 2026). `stabiliserPage` force `content-visibility: visible` avant l'attente des images.
- **PLP breaks** : sections posées dans la grille d'une collection (`.collection-break`). Grande carte demi-largeur (`collection-giant-card`) dans crossbody, summer-bags, raffia, orme ; bannière desktop + mobile (`collection-banner`) dans bestsellers (6 octobre 2026). Aucune dans handbags, d'où Crossbody dans le test de structure des collections.
- **Stocks qui bougent en prod** : les mentions « Être prévenu(e) » et « Précommande le … » des cartes de collection changent plusieurs fois par jour (3 changements vus le 6 octobre 2026 en quelques heures). Une capture de collection en prod n'est donc jamais figée longtemps.
- **Bloc de recommandations du panier** : `product-recommendations`, titre tantôt « Polène suggère », tantôt « Complétez votre panier ». Masqué en entier. Un sélecteur `[id*="product_recommendations"]` attrapait aussi des boutons invisibles du carrousel (barres roses sur le récapitulatif). Sa hauteur suit les produits suggérés (370 à 382 px) et décalait tout le bas du panier : hauteur fixée à 420 px pour la capture (`src/visuel.css`). Le titre « Votre panier » se cherche en exact, sinon il trouve aussi « Complétez votre panier ».
- **Carrousels automatiques de l'accueil** (campagne d'octobre 2026) : `component-carousel[data-autoscroll="true"]`, défilent seuls par `transform` sur `.component-carousel__slides`. Figés à la capture (`transform: none`), sinon bandes d'écart à chaque passage.
- **Header animé** : le header a une transition de 0,8 s sur `transform`. La démo des régressions coupe la transition avant de casser un élément, sinon Safari capture l'état de départ.
- **Seuil visuel** : `threshold: 0.2` (valeur par défaut de Playwright) et aucune tolérance en pixels, depuis le 6 octobre 2026. Il était à 0,3 à cause du bruit de Safari sur les vignettes des collections (57 à 75 px au seuil 0,2), qui ne sont plus comparées en pixels. À 0,3, le header blanc décalé de 10 px sur le ciel clair de l'accueil iPhone ne changeait que 42 pixels, que Playwright prenait pour du lissage : test vert. À 0,2 : 443 pixels, détecté. Ne pas ajouter de `maxDiffPixels` ni remonter le seuil sans relancer `npm run test:regressions`.
- **Charge du Mac** : 4 navigateurs en parallèle avec captures pleine page et vidéo saturent un Mac 8 cœurs / 16 Go si Chrome, VS Code et Figma sont ouverts (charge à 57, pages qui ne chargent plus en 45 s). Ce ne sont pas des bugs du site : regarder `uptime` avant de conclure. Les tests visuels n'enregistrent plus de vidéo et tournent sur 2 navigateurs à la fois.
- **Bloc Instagram de l'accueil** : rempli après coup par l'application Instafeed (`api.nfcube.com`), change à chaque post. Seules les images (`.instagram img`) sont en zone ignorée, les conteneurs couvrent toute la section.
- **Limite Shopify sur les appels directs** : après beaucoup de lancements rapprochés, `products/<handle>.js` et `cart/add.js` répondent 429 (`local_rate_limited`), sans en-tête `Retry-After`, et le blocage dure plusieurs minutes. Tous ces appels passent par `appelShopify` (`src/shopify.ts`) : deux nouveaux essais à 15 s d'écart, puis échec avec un message clair (catégorie « Limite d'appels Shopify (429) » dans le Rapport Polène). Espacer les séries d'une dizaine de minutes. À prévoir pour la CI.
- **iPhone émulé (WebKit) en capture pleine page** : en densité 3, les photos sont réduites différemment d'un passage à l'autre (écarts sur toute la collection), d'où `deviceScaleFactor: 1` dans les tests visuels. Même ainsi, Safari oublie parfois de dessiner des photos chargées en bas d'une page de 9 000 px (1 fois sur 8) : `--retries 1` sur `test:visuel`, jamais sur la démo des régressions.
- **Vérifier une capture** : `sips -c` de macOS recadre au centre et ignore le décalage. Recadrer autrement avant de conclure qu'une capture est fausse.
- **Compte client préprod** : créé le 6 octobre 2026, email du client de test suffixé `+qacompte`, identifiants dans `.auth/compte-preprod.json` (hors Git). Contient une adresse fictive impossible à supprimer. Mot de passe oublié : un essai par jour au plus (« Too many attempts »).
- **Fenêtre de géolocalisation préprod** : `theme-geo-suggestion component-modal.active [role=dialog]`, bouton « Close modal ». Elle recouvre la page : la fermer par `addLocatorHandler` sur la fenêtre, pas sur `theme-geo-suggestion` (élément sans taille).
- **Flèches de carrousel** (accueil, bandeau bijoux, galeries boutiques) : boutons de 1 × 1 px réservés aux lecteurs d'écran, impossibles à cliquer. Les tester au clavier (`focus()` puis Entrée).
- **Pièges d'émulation** : WebKit (Safari, iPhone) renvoie un `innerText` vide pour les cartes de collection encore hors écran, utiliser `textContent`. L'iPhone émulé refuse `mouse.wheel`, utiliser `window.scrollBy`. Sur mobile, le header fixe recouvre un bouton amené en haut d'écran : le centrer avant de cliquer. Le blocage d'Elevar provoque « Importing a module script failed » sous WebKit, à filtrer des erreurs JS.
- **Bot protection** : en local, aucun blocage. Depuis une CI (IP de datacenter), il faudra les signatures Web Bot Auth de Shopify (une par domaine, valables 3 mois).

## Suivi

> Dernière mise à jour : 6 octobre 2026 (soir).

### Avancement

- **POC 1 (parcours + rapport)** : ✅ validé par la QA le 2 octobre 2026. Parcours 8/8 (prod + préprod × 4 appareils, ~2 min), 10 étapes en préprod dont le questionnaire d'acquisition. Profil P1 validé.
- **POC 2 (tests visuels)** : presque terminé. 3 pages × 4 appareils en prod (accueil, fiche produit, panier), références reprises le 6 octobre 2026 avec l'accord de la QA (anciennes gardées dans `archives/references/`), seuil 0,2 (1 passage complet 12/12 avant la hauteur fixe du bloc du panier ; depuis : 1 passage complet 12/12, 1 partiel 9/9 sans Chrome, le panier seul 4/4 ; série de 10 à refaire avant la première MEP), 8/8 régressions injectées détectées. Collections vérifiées par leur structure (8/8). Rapport Polène sur mesure V1 (`npm run rapport:polene`), habillé avec la charte du site (polices, logo, couleurs), Allure retiré. Reste : critère « 10 minutes » mesuré à la première MEP (décision QA), relecture du rapport par la QA.
- **Cartographie et passe exploratoire** (6 octobre 2026) : 629 pages inventoriées, interactions jouées sur 4 appareils, compte client préprod. Aucune panne trouvée, 11 nouveaux constats (13 à 23). Classement codé / pixel / IA / manuel dans [docs/automatisation-par-page.md](docs/automatisation-par-page.md).

### Prochaines actions

- [x] QA : rapport et démo d'échec jugés clairs (critère Go/No-Go 1.6), 2 octobre 2026.
- [x] Profil P1 validé jusqu'à la confirmation (commandes T19558 et J8GYD9V36, 2 octobre 2026).
- [x] Questionnaire d'acquisition validé (commande VVGWK0PJK, 2 octobre 2026) : le test attend la réponse du serveur `/api/checkout/order-source`.
- [ ] QA : confirmer dans l'admin préprod que le client de la commande VVGWK0PJK a bien « Acquisition Source » = Bouche à oreille.
- [ ] Décider s'il faut réécrire l'historique Git pour retirer l'email du premier commit (force push, irréversible : seulement avec confirmation).
- [x] POC 2 : référence visuelle = prod uniquement pour l'instant (décision QA, 2 octobre 2026).
- [ ] QA : relire les 12 captures de `references/` reprises le 6 octobre 2026 (« état validé »).
- [ ] Refaire une série de 10 passages visuels au seuil 0,2 (critère 2.2) avant la première MEP, en espaçant à cause de la limite Shopify.
- [x] Références reprises le 6 octobre 2026 (accord QA « relance toi-même ») : accueil (nouvelle campagne validée par la QA) et panier ; fiche produit inchangée. Anciennes captures gardées : `archives/2026-10-06-references-avant-maj/` et `archives/references/<date-heure>/`.
- [x] Collections : vérifiées par leur structure plutôt qu'en pixels (décision QA du 6 octobre 2026), `tests/structure-collections.spec.ts`, 8/8.
- [x] Format de rapport : Rapport Polène sur mesure, gratuit (6 octobre 2026). Argos écarté ; Allure essayé puis retiré (perte de la vidéo et des comparaisons visuelles, moins lisible, seuls les graphiques ont plu).
- [ ] QA : relire le Rapport Polène (`npm run rapport:polene`, `-- visuel`, `-- regressions`, `-- demo-echec`) et dire ce qui manque ou gêne.
- [x] Critère « accepter un changement visuel en moins de 10 minutes » : à mesurer à la première MEP (décision QA, 6 octobre 2026).
- [x] Références stockées dans Git (décision QA du 7 octobre 2026) : 13 captures, 25 Mo, jusqu'à autant à chaque reprise après MEP. Git LFS reste possible plus tard (réécriture de l'historique).
- [ ] QA : mesurer le temps pour accepter un changement visuel attendu (critère < 10 min).
- [ ] Discuter de l'organisation des profils clients (un profil par cas de test, convention de nommage, adresse email par profil).
- [ ] QA : trancher le découpage proposé après la cartographie de la prod du 6 octobre 2026 (artefact « Cartographie QA Polène ») : A santé du site (codé), B invariants par type de page (codé), C pixel sur contenu figé, D revue IA des pages visuelles.
- [ ] Revoir l'exhaustivité de la page témoin préprod (toutes les sections du thème, cas limites).
- [x] Passe exploratoire avec interactions (prod 4 appareils, préprod avec compte client, 17 pages représentatives), 6 octobre 2026 : [docs/automatisation-par-page.md](docs/automatisation-par-page.md). Aucune commande créée.
- [ ] QA : relire `docs/automatisation-par-page.md` et choisir les vérifications à intégrer en premier.
- [ ] Accès admin préprod : la QA n'a pas le droit d'installer le connecteur Shopify Claude (6 octobre 2026). Demander au propriétaire de la boutique `asia-polene` soit l'installation du connecteur, soit une clé d'API d'administration en lecture (produits, champs personnalisés, clients, commandes) à ranger dans `.env` (roadmap, phase 1.3). Débloque : lecture du catalogue sans limite, états coming soon / précommande, vérification des commandes, nettoyage du compte de test.
- [ ] Décider si les scripts de la passe exploratoire (aujourd'hui temporaires, hors dépôt) doivent rejoindre le dépôt.

### Constats à remonter à l'équipe

1. Cases newsletter et SMS **pré-cochées** au checkout, en prod et en préprod (consentement RGPD non valable). Cause trouvée en préprod : réglages `defaultEmailConsent: true` et `defaultPhoneConsent: true` de l'extension checkout `enhanced-customer` (app Polène `polene-opc-pp`).
2. Bandeau cookies mobile : texte du bouton « REJETER » quasi invisible (blanc sur fond clair). La CNIL attend un refus aussi visible que l'acceptation.
3. Préprod non iso : textes du thème en anglais en `/fr-fr/`, prix différents de la prod (Cyme Mini 495,95 € contre 390 €), un seul moyen de paiement.
4. 56 produits portent le tag `LABEL:OOS` alors qu'ils sont achetables (ex. `boky-textured-camel`) : signification du tag à confirmer.
5. Un passage en prod a échoué sur un chargement de home de plus de 45 s alors que la page était visible : cause non identifiée (diagnostic réseau ajouté au rapport depuis).
6. Questionnaire « Comment avez-vous connu Polène Paris ? » : il est présent **deux fois** dans la page (version desktop et version mobile, l'une masquée) avec les **mêmes identifiants** (`source-survey-word_of_mouth`…) et le même nom de groupe. Cliquer sur un libellé peut cocher la réponse dans la version masquée. Impact réel sur les clients à vérifier avec les devs.
7. Extension `source-survey` : si le réglage `APP_URL` est absent, la réponse part vers une adresse de tunnel de développement codée en dur (`*.trycloudflare.com`). En préprod le réglage est bien rempli (`one-page-checkout-pp.vercel.app`), mais ce repli est à retirer par les devs.
8. 11 collections **vides**, publiques et dans le plan du site (bags-by-collection, bags-by-category, jewellery-by-collection, jewellery-by-category, inspiration-bags, inspiration-jewellery, limited-edition, wendy-andreu, wilo-in-upcycled-leather, animation-onda, family_sia-hurtigkarl), plus beri-lif avec uniquement des ruptures (6 octobre 2026). Certaines servent peut-être au menu : à confirmer.
9. Fiche produit desktop en 1440 × 900 : la bulle de chat Zendesk recouvre le bouton favoris (cœur) à côté de « Ajouter au panier ». Libre en 1280, 1536 et 1920. Intermittent : pas reproduit lors de la passe du 6 octobre après-midi.
10. Page 404 en anglais sur le site FR (« We're unable to find the page you're looking for », « Go home »). Autres textes anglais : collection « Bags by collection », « All », article « L'Envol » (« Spring 2024 », « See full collection »).
11. Pages techniques publiques et dans le plan du site : facebook-feed, google-feed, pinterest-feed, images, rewind-menu-backup-page, ccpa-compliance.
12. Accessibilité : boutons sans nom accessible (fiche produit, panier, favoris, connexion, création de compte) ; pas de titre principal (h1) sur les blogs, articles, panier, connexion, favoris, suivi de commande.
13. Fenêtre « Être prévenu(e) » (produit en rupture) : case newsletter **cochée par défaut**, sur les 4 appareils (même problème RGPD que le constat 1).
14. Recherche d'un mot qui n'existe pas (« zzqqxx ») : parfois 3 produits (Numéro Dix Galop, en précommande), parfois aucun.
15. Menu desktop : « Sacs » n'ouvre pas son sous-menu au clavier (Entrée ouvre directement la collection).
16. Textes anglais sur le site FR : « Pause / Play video », « Stop / Start automatic slide rotation », « Large / Compact grid view », « 3D viewer », « Filters updated », sélecteur pays mobile (« Select Country », noms de pays en anglais).
17. Pas de chat sur mobile : Zendesk n'est pas chargé sur iPhone et Android émulés. Choix voulu à confirmer.
18. Pages Shopify publiques mais vides : `/policies/terms-of-service`, `refund-policy`, `shipping-policy` (les CGV sont sur `/policies/terms-of-sale`). Non liées depuis le site.
19. Préprod, espace client : entièrement en anglais (Overview, Orders, Profile, Addresses, Wishlist…).
20. Préprod, ajout d'adresse : l'indicatif affiché par défaut est « France (+33) », mais le numéro est refusé (« Please enter a valid phone number ») tant qu'on ne choisit pas France (+33) à la main.
21. Préprod : aucun moyen de supprimer une adresse enregistrée (ni dans la liste, ni dans la fiche adresse).
22. Préprod, mot de passe oublié : après envoi, retour à la connexion sans message de confirmation.
23. Préprod : la fenêtre de géolocalisation en anglais propose d'aller sur `polene-preprod.myshopify.com`, une autre boutique.

### Décisions actées

- La référence est la prod polene-paris.com (pas de spécifications). Les références sont mises à jour après chaque MEP, avec l'accord de tout le monde.
- Préprod : catalogue non iso volontairement, une dizaine de produits fixes à statut forcé pour des tests déterministes.
- Le périmètre de chaque release (Jira) doit être connu avant le TNR, pour ne pas compter les changements voulus comme des échecs. On commence par un simple fichier de périmètre.
- Playwright reste le langage des tests. TestMu AI ou BrowserStack éventuellement plus tard, pour de vrais iPhone. Appium et Maestro écartés (pas d'app native).
- Email du client de test : adresse `+qautomatic` de la QA, dans `.env` uniquement.

### Pistes gardées pour plus tard

- **Tests d'emails** : collecter les `.eml` au fil des tests dans `emails/` (exclu de Git), notifications test Shopify, puis boîte de test par API (testmail.app ou Mailosaur) avec une adresse par profil. Détail dans la roadmap.
- **Rapport Polène, suites possibles** : statistiques sur plusieurs séries à la fois, envoi du verdict par email ou Slack après un lancement en CI, export PDF pour une MEP.
- **Vrais iPhone** (TestMu AI ou BrowserStack), revue IA des captures, Lighthouse, autres boutiques (UK, JP…).
