# Ce qui peut être automatisé, page par page

> Passe exploratoire du 6 octobre 2026, en français uniquement.
> - **Prod** polene-paris.com sur 4 appareils (desktop Chrome, desktop Safari, iPhone 15, Pixel 7) : 55 vérifications jouées en cliquant comme un client, sans paiement ni formulaire réellement envoyé. S'y ajoutent 17 pages représentatives ouvertes et contrôlées sur chaque appareil.
> - **Préprod** `/fr-fr/` avec un compte client de test créé pour l'occasion : 17 vérifications sur desktop Chrome puis iPhone. **Aucune commande créée.**
>
> Bilan brut : 223 vérifications réussies, 16 à vérifier, 64 échecs, 9 non jouées. **Aucun échec ne révèle une panne du site** : tous viennent du scénario de test et ont été recontrôlés un par un (détail en fin de document). Les vrais constats sont les points « à vérifier ».

## Comment lire ce document

Quatre façons de vérifier :

| Méthode | Ce que c'est | Quand l'utiliser |
|---|---|---|
| **Codé** | Le test clique, lit la page et compare à une valeur attendue (prix du catalogue Shopify, nombre de produits, présence d'un bouton). Même résultat à chaque lancement, pas d'IA. | Tout ce qui a une bonne réponse connue à l'avance. C'est la base. |
| **Pixel** | La capture est comparée pixel par pixel à une capture de référence validée par la QA (POC 2). Pas d'IA. | Pages dont le contenu ne change pas entre deux MEP : panier, fiche d'un produit fixe, pages de compte, page témoin préprod. |
| **IA** | Un modèle de vision regarde la capture avec une grille (« un titre, des photos chargées, un bouton d'achat visible, rien qui déborde »). Il juge si la page *a l'air* correcte, même quand son contenu a changé. | Pages qui changent souvent (accueil, éditoriaux, campagnes). Résultat **indicatif**, à confirmer par un humain : jamais seul pour bloquer une MEP. |
| **Manuel** | Ce qui reste à la QA. | Jugement esthétique, emails, vrais téléphones, paiement réel en prod. |

Résultat de la passe, dans l'ordre **Chrome · Safari · iPhone · Android** :
✓ fonctionne · ✗ échec du test (cause expliquée) · ? à vérifier avec l'équipe · – non joué.

Les lots A à D renvoient au découpage proposé après la cartographie (artefact « Cartographie QA Polène ») :
- **A** : santé du site, codé, sur toutes les pages ;
- **B** : vérifications propres à chaque type de page, codé ;
- **C** : comparaison pixel sur un contenu figé ;
- **D** : revue IA des pages visuelles.

---

## 1. Contrôles valables sur toutes les pages (lot A, codé)

Ces contrôles ne demandent aucune connaissance de la page : on peut les lancer sur les 629 adresses du site.

| Contrôle | Méthode | Résultat de la passe |
|---|---|---|
| La page répond (pas d'erreur 404 ou 500) | Codé | 629 pages sur 629 répondent, 0 lien cassé sur 528 vérifiés |
| Aucune image cassée | Codé | 0 sur les 17 pages × 4 appareils |
| Rien ne déborde de l'écran sur mobile | Codé | 0 page plus large que l'écran (iPhone et Android) |
| Aucune erreur JavaScript du site | Codé | 0 erreur du site. Les erreurs vues sous Safari et iPhone viennent de notre blocage des outils de mesure d'audience (Elevar) : sans blocage, aucune erreur. Le test devra les filtrer. |
| Un titre principal (h1) par page | Codé | Absent sur 9 pages sur 17 : panier, connexion, création de compte, favoris, blog et article boutique, article éditorial, CGV (déjà dans le constat 12) |
| Temps de chargement | Codé | 0,7 à 2,2 s par page |
| Pas de texte anglais sur le site FR | Codé (liste de mots) puis IA pour trier | Plusieurs textes anglais trouvés (voir constats) |
| Accessibilité (boutons sans nom, contrastes) | Codé (outil axe) | Boutons sans nom accessible déjà relevés (constat 12) ; contraste du bouton « REJETER » (constat 2) |
| La page « a l'air normale » | IA | Planches regardées à l'œil pendant la passe : rien d'anormal sur les 4 appareils |

---

## 2. Éléments communs : header, menu, recherche, pays, newsletter, cookies, chat

| Vérification | Méthode | Résultat |
|---|---|---|
| Menu : ouvrir « Sacs » puis une ligne (Cyme) | Codé | ✓ ✓ ✓ ✓ (48 produits affichés) |
| Menu : « Savoir-Faire » et « Boutiques » ouvrent leur panneau | Codé | ✓ ✓ ✓ ✓ |
| Menu au clavier | Codé | ✓ ✓ – – ; « Sacs » n'ouvre pas son sous-menu au clavier (Entrée ouvre directement la collection) |
| Recherche « cyme » : suggestions puis résultats | Codé | ✓ ✓ ✓ ✓ (17 suggestions, 307 résultats, tous des Cyme) |
| Recherche sans accent « numero un » | Codé | ✓ ✓ ✓ ✓ |
| Recherche d'un mot qui n'existe pas | Codé | ? ? ? ? : « zzqqxx » renvoie 3 produits (Numéro Dix Galop, en précommande), parfois aucun |
| Sélecteur pays : ouverture, liste, fermeture | Codé | ✓ ✓ ✗ ✗ : sur mobile, c'est un panneau du menu et non une fenêtre. Recontrôlé : il fonctionne (12 pays d'Europe), mais il est entièrement en anglais (« Select Country », « Germany »…) |
| Icônes panier et favoris, logo | Codé | ✓ ✓ ✓ ✓ |
| Newsletter : email invalide refusé | Codé (sans envoi réel) | ✓ ✓ ✓ ✓ (contrôle du navigateur, pas de message du site) |
| Bandeau cookies : affichage à la première visite | Codé + Pixel | ✓ ✓ ✓ ✓ (Préférences, Rejeter, Accepter) |
| « Rejeter » : le consentement est bien enregistré à « non » et le bandeau ne revient pas | Codé | ✓ ✓ ✓ ✓ |
| Lisibilité du bouton « REJETER » sur mobile | IA ou Codé (contraste) | Constat 2 déjà remonté |
| Bulle de chat présente | Codé | ✓ ✓ ✗ ✗ : **aucun chat sur mobile**, le chat Zendesk n'est même pas chargé. À confirmer : choix voulu ? |
| Le chat ne recouvre pas un bouton | Codé | ✓ ✓ ✓ ✓ lors de cette passe. Pendant la cartographie, il recouvrait le cœur en 1440 × 900 (constat 9) : le problème est intermittent |

**IA** : utile seulement pour juger la mise en page du menu ouvert (méga-menu avec photos).
**Manuel** : rien de spécifique.

---

## 3. Accueil

Le contenu change souvent (ordre des sections, images, campagnes) : la comparaison pixel n'est pas adaptée en prod.

| Vérification | Méthode | Résultat |
|---|---|---|
| Vidéo d'ouverture : bouton pause | Codé | ✓ ✓ ✓ ✓ (libellés anglais « Pause video / Play video ») |
| Carrousel produits : avancer / reculer | Codé | ✗ ✗ ✗ ✗ : les flèches font 1 × 1 pixel, elles sont réservées aux lecteurs d'écran. On fait défiler à la souris ou au doigt. Recontrôlé au clavier : ✓. Le test doit utiliser le clavier. |
| Carrousel : arrêt / reprise de la rotation | Codé | Même cause ; au clavier ✓ (libellés anglais « Stop / Start automatic slide rotation ») |
| Ajout au panier depuis une carte produit | Codé | ✓ ✓ ✓ ✓ |
| Les collections mises en avant ne sont pas vides | Codé | – ✓ ✓ ✓ (sur Chrome, la lecture du catalogue a été limitée par Shopify) |
| La page a une vidéo ou image d'ouverture, des sections, des produits avec prix, rien de cassé | **IA** | Pas encore automatisé. C'est le cas d'usage principal de l'IA. |
| Bloc Instagram | – | Contenu d'un service tiers : on vérifie seulement qu'il ne casse pas la page |

**Recommandation** : en prod, codé pour les fonctions et IA pour l'aspect. En préprod, la page témoin (toutes les sections du thème, contenu figé) se teste au pixel (lot C).

---

## 4. Collection (Sacs, Bijoux)

| Vérification | Méthode | Résultat |
|---|---|---|
| Filtre coloris : le nombre annoncé correspond aux produits affichés | Codé | ✗ ✗ ✗ ✗ : le test lisait le nombre avant sa mise à jour. Recontrôlé : « Beige » fait passer le bouton de 315 à 23 produits. La comparaison avec l'affichage reste à refaire. |
| Bouton « Supprimer » des filtres | Codé | Joué dans le même essai, à rejouer |
| Tri « Prix croissants » | Codé | ✓ ✓ ✓ ✓ |
| Vue grande / compacte | Codé | ✓ ✓ – – (pas de bouton sur mobile) |
| Chargement de la suite au défilement | Codé | ✓ ✓ ✗ ✓ : l'iPhone émulé n'accepte pas la molette. Recontrôlé par défilement : 48 → 192 produits ✓ |
| Prix des cartes = prix du catalogue Shopify | Codé | – ✗ ✓ ✓ : Safari ne « lit » pas les prix des cartes encore hors de l'écran (elles apparaissent au défilement). Les prix sont bons ; le test doit lire le texte autrement. |
| Ajout rapide au panier, cœur favoris, clic sur une carte | Codé | ✓ ✓ ✓ ✓ |
| Bandeau « Bijoux par collection » | Codé | – – ✗ ✗ : mêmes flèches invisibles que l'accueil, à faire au clavier |
| Collections vides ou uniquement en rupture | Codé (catalogue) | 11 collections vides + beri-lif (constat 8) |
| Aspect de la grille (photos alignées, pas de carte vide) | Pixel en préprod, IA en prod | Le catalogue prod change à chaque lancement : pixel seulement sur un catalogue figé |

---

## 5. Fiche produit

Produits joués : Numéro Un noir grainé (standard), manchette Téré (tailles), boucles d'oreilles Téré (rupture).

| Vérification | Méthode | Résultat |
|---|---|---|
| Titre, édition et prix = catalogue | Codé | ✓ ✓ ✓ ✓ |
| Zoom sur une image puis fermeture | Codé | ✓ ✓ ✓ ✓ |
| Galerie mobile : faire défiler les photos | Codé | – – ✓ ✓ |
| « Découvrir tout » : fenêtre des coloris | Codé | ✓ ✓ ✓ ✗ |
| Pastille coloris : ouvre l'autre coloris | Codé | ✓ ✓ ✓ ✗ |
| Vue 3D | Codé (ouverture) ; IA ou manuel (qualité du modèle) | ✓ ✓ ✓ ✗ |
| Onglets Description, Détails, Matières, Livraisons | Codé | ✓ ✓ ✓ ✗ |
| Accordéon « Envoyé avec soin » | Codé | ✓ ✓ ✓ ✗ |
| Cœur favoris | Codé | ✓ ✓ ✓ ✗ |
| Ajouter au panier : notification, compteur, lien panier | Codé | ✓ ✓ ✓ ✓ |
| Produit à tailles : seules les tailles disponibles sont proposées | Codé | – ✓ ✓ ✓ |
| Produit en rupture : fenêtre « Être prévenu(e) », email invalide bloqué | Codé (sans envoi) | ? ? ? ? : **case newsletter cochée par défaut** |
| États coming soon, précommande, nouveauté | Codé | Non joués : il faut les produits fixes de la préprod (phase 1 de la roadmap) |
| Mise en page de la fiche | Pixel (préprod, produit fixe) ; IA (prod) | Fiche Numéro Un déjà dans la référence visuelle du POC 2 |

Échecs Android : pendant le défilement automatique du test, le header fixe recouvrait « Découvrir tout ». La fenêtre ouverte ensuite est restée ouverte et a bloqué les essais suivants. Recontrôlé : le bouton est libre pour un client. Le test doit centrer le bouton avant de cliquer.

---

## 6. Panier

| Vérification | Méthode | Résultat |
|---|---|---|
| Panier vide : message et lien de sortie | Codé + Pixel | ✓ ✓ ✓ ✓ |
| Quantité + puis − : sous-total recalculé | Codé | ✓ ✓ ✓ ✓ (420 → 840 → 420 €) |
| « Complétez votre panier » : ajout d'une recommandation | Codé | ✓ ✓ ✓ ✓ |
| Supprimer une ligne (avec fenêtre de confirmation) | Codé | ✓ ✓ ✓ ✓ |
| Accordéon « Assistance » | Codé | ✓ ✓ ✓ ✓ |
| Boutons de paiement express affichés | Codé | ✓ ✓ ✓ ✓ (affichage seulement) |
| Payer avec Apple Pay / Google Pay / PayPal | **Manuel** | Impossible à automatiser sans vrai compte de paiement |
| Mise en page | Pixel | Déjà dans la référence du POC 2 |

---

## 7. Checkout

| Vérification | Méthode | Résultat |
|---|---|---|
| « Continuer » mène au checkout (prod, arrêt avant paiement) | Codé | ✓ ✓ ✓ ✓ |
| Achat complet jusqu'à la confirmation et questionnaire d'acquisition | Codé (préprod, avec accord) | Validé au POC 1 (4 commandes par lancement) |
| Client connecté : email et adresse pré-remplis | Codé (préprod) | ✓ (Chrome) |
| Cases newsletter et SMS pré-cochées | Codé | Constat 1 déjà remonté |
| Paiement réel en prod, 3D Secure réel | **Manuel** | Interdit en automatique |

---

## 8. Compte client (préprod, compte de test)

Le compte a été créé le 6 octobre 2026. Son adresse email est celle du client de test avec le suffixe `+qacompte`. Les identifiants sont dans `.auth/compte-preprod.json`, hors Git.

| Vérification | Méthode | Résultat (Chrome, puis iPhone) |
|---|---|---|
| Créer un compte | Codé | ✓ (une seule fois : le compte existe maintenant) |
| Connexion avec un mauvais mot de passe : message d'erreur | Codé | ✓ (« E-MAIL OU MOT DE PASSE INCORRECT ») |
| Connexion, accueil de l'espace client, chaque rubrique s'ouvre | Codé | ✓ ; **espace client entièrement en anglais** (Overview, Orders, Profile…) |
| Ajouter une adresse | Codé | ✓ ; ? **l'indicatif affiché par défaut est « France (+33) » mais le numéro est refusé** tant qu'on ne choisit pas France (+33) à la main |
| Supprimer une adresse | Codé | ? : aucun bouton de suppression trouvé (ni dans la liste ni dans la fiche adresse). Une adresse fictive reste donc dans le compte. |
| Favoris : ajout sur desktop, retrouvés sur iPhone, retrait | Codé | ✓ puis ✓ ✓ |
| Panier conservé après déconnexion et reconnexion | Codé | ✓ |
| Menu mobile connecté : accès au compte | Codé | ✓ (iPhone) |
| Déconnexion | Codé | ✓ ✓ |
| Mot de passe oublié | Codé, mais **1 essai par jour au plus** | ? : après envoi, retour à la connexion **sans message de confirmation**. Au 2e essai, Shopify bloque (« Too many attempts »). |
| Email de réinitialisation reçu, lien qui fonctionne | **Manuel** pour l'instant | Piste : boîte de test par API (voir roadmap, tests d'emails) |
| Historique de commandes | Codé | Non joué : le compte n'a pas de commande (il faudrait un achat préprod, avec accord) |
| Captcha Shopify à la connexion | – | Pas rencontré. S'il apparaît, le test s'arrête en « non testé ». |

---

## 9. Pages éditoriales et boutiques

| Vérification | Méthode | Résultat |
|---|---|---|
| Liste des boutiques : chaque boutique a une adresse et des horaires | Codé | ✓ ✓ ✓ ✓ |
| Article boutique : adresse, horaires, photos | Codé | ✓ ✓ ✗ ✗ : flèches de galerie invisibles (même cause que l'accueil) |
| La Maison, article éditorial : page complète, photos chargées | Codé (lot A) + IA | ✓ sur les 4 appareils (contrôles du lot A) |
| Qualité de la mise en page éditoriale | **IA** puis manuel | Contenu qui change à chaque campagne : l'IA pré-trie, la QA tranche |

---

## 10. Pages légales, 404, suivi de commande

| Vérification | Méthode | Résultat |
|---|---|---|
| CGV, mentions légales, confidentialité : le lien du pied de page mène à une page remplie | Codé | ✓ (CGV sur `/policies/terms-of-sale`). Les pages Shopify `terms-of-service`, `refund-policy` et `shipping-policy` sont publiques mais vides. Elles ne sont pas liées depuis le site. |
| Page 404 | Codé | Répond bien 404, mais **en anglais** (constat 10) |
| Suivi de commande sans numéro | Codé | ? ? ? ? : pas de formulaire, seulement « Aucune information de suivi disponible ». La page est sans doute prévue pour un lien reçu par email : à confirmer. |

---

## 11. Ce qui n'est pas automatisable (ou pas raisonnablement)

- **Paiement réel en prod**, Apple Pay, Google Pay, PayPal, 3D Secure réel : interdit ou impossible sans vrai compte. On vérifie l'affichage des boutons, pas le paiement.
- **Emails** (confirmation de commande, réinitialisation, « Être prévenu(e) ») : pas encore. Piste : boîte de test par API, une adresse par profil client.
- **Vrais téléphones** : nos iPhone et Android sont émulés. Safari réel, gestes et clavier du téléphone demandent TestMu AI ou BrowserStack.
- **Jugement esthétique** (qualité d'une photo, cohérence d'une nouvelle campagne) : l'IA peut signaler, la QA décide.
- **Contenus de tiers** (Instagram, chat Zendesk, modèle 3D) : on vérifie qu'ils ne cassent pas la page, pas leur contenu.
- **Fonctions limitées par Shopify** : mot de passe oublié (1 essai par jour au plus), lectures répétées du catalogue, ajouts au panier très rapprochés. Ces fonctions se testent avec parcimonie, pas à chaque lancement.

---

## 12. Limites rencontrées pendant la passe (à prévoir dans les vrais tests)

1. **Shopify limite les lectures du catalogue** (`products.json`) : quelques vérifications n'ont pas pu se faire sur Chrome. Il faut des pauses, ou l'accès API d'administration prévu en phase 1. Cet accès admin lèverait aussi d'autres blocages : lire les états coming soon et précommande, vérifier commandes et clients, supprimer l'adresse du compte de test. Il n'est pas disponible pour l'instant : la QA n'a pas le droit d'installer le connecteur Shopify sur la préprod, il faut le demander au propriétaire de la boutique. En revanche, il ne change rien à la limite du panier (429), au « Too many attempts » ni au captcha, qui protègent le site public.
2. **« Too many attempts »** sur le mot de passe oublié dès le 2e essai.
3. **Fenêtre de géolocalisation en préprod** : elle recouvre la page et doit être fermée automatiquement. En anglais, elle propose d'aller sur `polene-preprod.myshopify.com`, une autre boutique de préprod.
4. **Flèches de carrousel invisibles** (1 pixel) : on les teste au clavier, comme un utilisateur de lecteur d'écran.
5. **Safari émulé** ne lit pas le texte des éléments encore hors de l'écran : lire le contenu brut de la page.
6. **Notre blocage des outils de mesure** provoque des erreurs JavaScript sous Safari : il faut les filtrer pour ne pas crier au loup.
7. **Header fixe sur mobile** : centrer chaque bouton avant de cliquer, sinon le header le recouvre.

---

## 13. Ce qui n'a pas été testé

- Les autres marchés (UK, JP…) et les autres langues.
- Les états coming soon, précommande et nouveauté, ainsi que les paniers combinés (il faut les produits fixes de la préprod).
- Les codes promo.
- L'historique de commandes d'un client connecté (aucune commande passée, faute d'accord pour un achat).
- Les emails.
- La réception réelle d'une inscription newsletter ou d'une alerte « Être prévenu(e) » (aucun formulaire envoyé en prod).
- La revue IA elle-même : ce document dit où elle serait utile, elle n'a pas encore été branchée.

## 14. Ce qui reste dans la préprod après la passe

- Le compte client de test (`+qacompte`), réutilisable pour les prochains tests.
- Une adresse fictive (60 rue du Louvre) dans ce compte : aucun moyen de la supprimer trouvé.
- Un article dans le panier de ce compte.
- Aucune commande, aucun favori.
