# CLAUDE.md · QA automatisée Polène

Tests automatisés (Playwright, TypeScript) du site Shopify [polene-paris.com](https://www.polene-paris.com/) et de sa préprod. Objectif : remplacer progressivement la recette manuelle (TNR) par une QA automatisée desktop + mobile, fonctionnelle et visuelle.

- Feuille de route détaillée et avancement : [roadmap-qa-polene.md](roadmap-qa-polene.md)
- Installation et commandes : [README.md](README.md)
- Clients fictifs utilisés par les tests : [docs/profils-clients.md](docs/profils-clients.md)

## Règles de travail

- **Langue** : tout en français (échanges, noms d'étapes, messages d'erreur, docs). La personne avec qui on travaille est la QA du projet, pas un profil développeur : expliquer simplement, sans jargon inutile.
- **Commandes préprod** : chaque achat préprod crée une vraie commande de test (un lancement complet = 4 commandes). Ne jamais lancer de test préprod qui va jusqu'au paiement sans accord explicite. Pas de commande le soir.
- **Prod** : jamais de paiement. Les tests prod s'arrêtent à l'arrivée sur le checkout. On peut lancer `npm run test:prod` à tout moment.
- **Données personnelles** : aucune donnée réelle dans le dépôt. Le mot de passe préprod, l'email du client de test et les infos de carte restent dans `.env` (non versionné). Ne jamais écrire l'email personnel de la QA dans un fichier versionné. Les dossiers `emails/`, `.auth/`, rapports et résultats sont exclus de Git.
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
npm run rapport                         # dernier rapport HTML
npm run test:demo-echec                 # échec volontaire (POC 1.6)
npm run typecheck
```

## Organisation du code

```
playwright.config.ts   Projets = environnement × appareil ("prod · iphone"…), rapport HTML
src/environments.ts    URL et réglages par environnement
src/fixtures.ts        Neutralisations (cookies, blocage AB Tasty / Klaviyo / pixels), étapes avec capture, diagnostic réseau
src/pages/             Un objet par type de page : header, collection, product, cart, checkout
src/price.ts           Lecture des prix quel que soit le format (640 €, €495,95, $880…)
src/client-test.ts     Charge le client fictif (data/client-test.json + PREPROD_EMAIL)
tests/                 auth.setup.ts, parcours-achat.spec.ts, demo-echec.spec.ts
```

Conventions :
- Chaque étape d'un test passe par `etape(page, testInfo, 'N. Libellé', …)` : nom en français, capture jointe au rapport.
- Localiser par rôle et nom accessible (`getByRole`), avec des expressions qui acceptent FR et EN (la préprod mélange les deux).
- Chemins relatifs à l'URL de base (`'cart'`, `'products/<handle>'`), jamais `'/cart'`, sinon le préfixe `/fr-fr/` saute.
- Comparer les prix en centimes via `parsePriceToCents`. Le prix de référence vient du JSON Shopify `products/<handle>.js`.
- Étiquettes : `@smoke` (parcours MEP), `@tnr` (non-régression), `@demo-echec` (exclu par défaut).
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
- **Bot protection** : en local, aucun blocage. Depuis une CI (IP de datacenter), il faudra les signatures Web Bot Auth de Shopify (une par domaine, valables 3 mois).

## Suivi

> Dernière mise à jour : 2 octobre 2026.

### Avancement

- **POC 1 (parcours + rapport)** : ✅ validé par la QA le 2 octobre 2026. Parcours 8/8 (prod + préprod × 4 appareils, ~2 min), 10 étapes en préprod dont le questionnaire d'acquisition. Profil P1 validé.
- **POC 2 (tests visuels)** : prochaine étape.

### Prochaines actions

- [x] QA : rapport et démo d'échec jugés clairs (critère Go/No-Go 1.6), 2 octobre 2026.
- [x] Profil P1 validé jusqu'à la confirmation (commandes T19558 et J8GYD9V36, 2 octobre 2026).
- [x] Questionnaire d'acquisition validé (commande VVGWK0PJK, 2 octobre 2026) : le test attend la réponse du serveur `/api/checkout/order-source`.
- [ ] QA : confirmer dans l'admin préprod que le client de la commande VVGWK0PJK a bien « Acquisition Source » = Bouche à oreille.
- [ ] Décider s'il faut réécrire l'historique Git pour retirer l'email du premier commit (force push, irréversible : seulement avec confirmation).
- [ ] POC 2 : trancher d'abord la référence visuelle (la préprod n'a ni les mêmes textes ni les mêmes prix que la prod).
- [ ] Discuter de l'organisation des profils clients (un profil par cas de test, convention de nommage, adresse email par profil).

### Constats à remonter à l'équipe

1. Cases newsletter et SMS **pré-cochées** au checkout, en prod et en préprod (consentement RGPD non valable). Cause trouvée en préprod : réglages `defaultEmailConsent: true` et `defaultPhoneConsent: true` de l'extension checkout `enhanced-customer` (app Polène `polene-opc-pp`).
2. Bandeau cookies mobile : texte du bouton « REJETER » quasi invisible (blanc sur fond clair). La CNIL attend un refus aussi visible que l'acceptation.
3. Préprod non iso : textes du thème en anglais en `/fr-fr/`, prix différents de la prod (Cyme Mini 495,95 € contre 390 €), un seul moyen de paiement.
4. 56 produits portent le tag `LABEL:OOS` alors qu'ils sont achetables (ex. `boky-textured-camel`) : signification du tag à confirmer.
5. Un passage en prod a échoué sur un chargement de home de plus de 45 s alors que la page était visible : cause non identifiée (diagnostic réseau ajouté au rapport depuis).
6. Questionnaire « Comment avez-vous connu Polène Paris ? » : il est présent **deux fois** dans la page (version desktop et version mobile, l'une masquée) avec les **mêmes identifiants** (`source-survey-word_of_mouth`…) et le même nom de groupe. Cliquer sur un libellé peut cocher la réponse dans la version masquée. Impact réel sur les clients à vérifier avec les devs.
7. Extension `source-survey` : si le réglage `APP_URL` est absent, la réponse part vers une adresse de tunnel de développement codée en dur (`*.trycloudflare.com`). En préprod le réglage est bien rempli (`one-page-checkout-pp.vercel.app`), mais ce repli est à retirer par les devs.

### Décisions actées

- La référence est la prod polene-paris.com (pas de spécifications). Les références sont mises à jour après chaque MEP, avec l'accord de tout le monde.
- Préprod : catalogue non iso volontairement, une dizaine de produits fixes à statut forcé pour des tests déterministes.
- Le périmètre de chaque release (Jira) doit être connu avant le TNR, pour ne pas compter les changements voulus comme des échecs. On commence par un simple fichier de périmètre.
- Playwright reste le langage des tests. TestMu AI ou BrowserStack éventuellement plus tard, pour de vrais iPhone. Appium et Maestro écartés (pas d'app native).
- Email du client de test : adresse `+qautomatic` de la QA, dans `.env` uniquement.

### Pistes gardées pour plus tard

- **Tests d'emails** : collecter les `.eml` au fil des tests dans `emails/` (exclu de Git), notifications test Shopify, puis boîte de test par API (testmail.app ou Mailosaur) avec une adresse par profil. Détail dans la roadmap.
- **Vrais iPhone** (TestMu AI ou BrowserStack), revue IA des captures, Lighthouse, autres boutiques (UK, JP…).
