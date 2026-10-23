import { test, expect, etape, ficheDeLAppareil } from '../src/fixtures';
import { Header } from '../src/pages/header';
import { CartPage } from '../src/pages/cart';
import { CheckoutPage } from '../src/pages/checkout';
import { ProductPage } from '../src/pages/product';
import { produitFixe } from '../src/produits-fixes';
import { formatCents, parsePriceToCents } from '../src/price';
import { appelShopify } from '../src/shopify';
import { Wishlist } from '../src/pages/wishlist';
import { verifierLargeur } from '../src/controles';

/**
 * Panier (roadmap phase 2.2, fiches TNR CART-01 à CART-04, toutes « Bloquant »), sur les produits QA de la préprod.
 * Aucune commande : on s'arrête au plus à l'arrivée sur le checkout, sans rien saisir. Le panier est rempli par
 * l'adresse /cart/add?id=…, pas par l'API que Shopify limite vite (429), sauf une précommande : seul le bouton de
 * la fiche pose ses propriétés (_is_preorder, _preorder_date).
 *
 * Fiche de la précommande : une par appareil (FICHE_PAR_APPAREIL, src/fixtures.ts), les deux à chaque lancement.
 */
test.use({ fiche: ficheDeLAppareil, ficheDeRepli: true });

const MENTION_PRECOMMANDE = /Pre-?order|Précommand/i;

/** Sur mobile, le header fixe recouvre un bouton amené en haut d'écran : on le centre avant de toucher. */
const centrer = (element: import('@playwright/test').Locator) => element.evaluate(e => e.scrollIntoView({ block: 'center', behavior: 'instant' }));

test(`Panier · quantité, suppression et panier vide (${produitFixe('QA01').id}) @tnr @cart`, async ({ page, qaEnv, isMobile }, testInfo) => {
  test.skip(qaEnv.name !== 'preprod', 'Produits QA : préprod uniquement');
  const produit = produitFixe('QA01');
  const header = new Header(page, isMobile);
  const panier = new CartPage(page);
  testInfo.annotations.push({ type: 'Produit testé', description: `${produit.id} (${produit.handle})` });
  let prix!: number;

  await etape(page, testInfo, `1. Mettre ${produit.id} au panier : une ligne, quantité 1, sous-total = prix`, async () => {
    await panier.addByUrl(produit.handle);
    await expect(panier.lines, 'Le panier doit contenir une seule ligne').toHaveCount(1);
    await expect(panier.quantity(produit.handle), 'La quantité doit être 1').toHaveValue('1');
    prix = parsePriceToCents(await panier.line(produit.handle).innerText())!;
    expect(prix, 'La ligne doit afficher le prix du produit').toBeGreaterThan(0);
    expect(await panier.subtotalCents(), `Le sous-total doit être égal au prix de la ligne (${formatCents(prix)})`).toBe(prix);
  });

  await etape(page, testInfo, '2. « + » : quantité 2, sous-total doublé', async () => {
    await centrer(panier.increaseButton(produit.handle));
    await panier.increaseButton(produit.handle).click();
    await expect(panier.quantity(produit.handle), 'La quantité doit passer à 2').toHaveValue('2');
    await expect.poll(() => panier.subtotalCents(), { message: `Le sous-total doit passer à ${formatCents(2 * prix)}` }).toBe(2 * prix);
    await expect.poll(() => header.cartCount(), { message: 'Le compteur du panier doit passer à 2' }).toBe(2);
  });

  await etape(page, testInfo, '3. « − » : retour à 1, sous-total = prix', async () => {
    await panier.decreaseButton(produit.handle).click();
    await expect(panier.quantity(produit.handle), 'La quantité doit revenir à 1').toHaveValue('1');
    await expect.poll(() => panier.subtotalCents(), { message: `Le sous-total doit revenir à ${formatCents(prix)}` }).toBe(prix);
  });

  await etape(page, testInfo, '4. « − » à 1 : la fenêtre « Remove item ? » demande confirmation, la fermer ne supprime rien', async () => {
    await expect(panier.decreaseButton(produit.handle), 'À 1, le bouton « − » doit proposer de retirer l\'article').toHaveAccessibleName(/Remove item|Supprimer|Retirer/i);
    await panier.decreaseButton(produit.handle).click();
    await expect(panier.removeDialog, 'Une fenêtre doit demander de confirmer la suppression').toBeVisible();
    await expect(panier.removeDialog, 'La fenêtre doit rappeler le produit et son prix').toContainText(/QA Numéro Un/i);
    await expect(panier.removeDialog.getByRole('button', { name: /Yes, remove|Oui, (supprimer|retirer)/i }), 'La fenêtre doit proposer de confirmer').toBeVisible();
    await panier.removeDialog.getByRole('button', { name: /Close modal|Fermer/i }).click();
    await expect(panier.removeDialog, 'La fenêtre doit se fermer').toBeHidden();
    await expect(panier.lines, 'Fermer la fenêtre ne doit pas retirer l\'article').toHaveCount(1);
    await expect(panier.quantity(produit.handle), 'La quantité doit rester à 1').toHaveValue('1');
  });

  await etape(page, testInfo, '5. Confirmer la suppression : panier vide, compteur à 0', async () => {
    await panier.decreaseButton(produit.handle).click();
    await panier.removeDialog.getByRole('button', { name: /Yes, remove|Oui, (supprimer|retirer)/i }).click();
    await expect(panier.emptyHeading, 'Le panier doit annoncer qu\'il est vide').toBeVisible();
    await expect(panier.lines, 'Plus aucune ligne ne doit rester').toHaveCount(0);
    await expect.poll(() => header.cartCount(), { message: 'Le compteur du panier doit revenir à 0' }).toBe(0);
  });

  await etape(page, testInfo, '6. Panier vide : le bouton « Discover Polène selection » mène au catalogue', async () => {
    const decouvrir = panier.main.getByRole('link', { name: /Discover Polène selection|Découvrir la sélection/i });
    await expect(decouvrir, 'Le panier vide doit proposer de découvrir la sélection').toBeVisible();
    const lien = (await decouvrir.getAttribute('href')) ?? '';
    testInfo.annotations.push({ type: 'Lien du panier vide', description: lien });
    await centrer(decouvrir);
    await decouvrir.click();
    await expect(page, 'Le bouton doit quitter le panier').not.toHaveURL(/\/cart(\?|$)/);
    await expect(page.getByRole('main').getByRole('heading', { level: 1 }), 'La page d\'arrivée doit avoir un titre').toBeVisible();
  });
});

test(`Panier · récapitulatif et bouton « Continue » visible sans défiler (${produitFixe('QA01').id}) @tnr @cart`, async ({ page, qaEnv, isMobile }, testInfo) => {
  test.skip(qaEnv.name !== 'preprod', 'Produits QA : préprod uniquement');
  const produit = produitFixe('QA01');
  const panier = new CartPage(page);
  testInfo.annotations.push({ type: 'Produit testé', description: `${produit.id} (${produit.handle})` });

  await etape(page, testInfo, `1. Mettre ${produit.id} au panier : récapitulatif avec sous-total, livraison calculée au checkout, « Continue »`, async () => {
    await panier.addByUrl(produit.handle);
    await expect(panier.summary, 'Le récapitulatif doit s\'afficher').toBeVisible();
    await expect(panier.summary, 'Le récapitulatif doit donner le sous-total').toContainText(/Sous.?total|Subtotal/i);
    await expect(panier.summary, 'Le récapitulatif doit dire que la livraison est calculée au checkout').toContainText(/calcul\w* (at|au) (checkout|paiement)/i);
    const prix = await panier.linePriceCents(produit.handle);
    expect(await panier.subtotalCents(), `Le sous-total doit être égal au prix de la ligne (${formatCents(prix!)})`).toBe(prix);
    await expect(panier.checkoutButton, 'Le bouton « Continue » doit être visible sans faire défiler la page').toBeInViewport();
    if (isMobile) {
      // Sur mobile, le récapitulatif est collé au bas de l'écran (position sticky) tant qu'on est dans le panier.
      const zone = (await panier.summary.boundingBox())!;
      expect(Math.abs(zone.y + zone.height - page.viewportSize()!.height), 'Sur mobile, le récapitulatif doit être collé au bas de l\'écran').toBeLessThanOrEqual(2);
    }
  });
});

test(`Panier · dernière pièce, quantité bloquée à 1 (${produitFixe('QA03').id}) @tnr @cart`, async ({ page, qaEnv, isMobile }, testInfo) => {
  test.skip(qaEnv.name !== 'preprod', 'Produits QA : préprod uniquement');
  const produit = produitFixe('QA03');
  const header = new Header(page, isMobile);
  const panier = new CartPage(page);
  testInfo.annotations.push({ type: 'Produit testé', description: `${produit.id} (${produit.handle}), stock en ligne : 1` });
  let prix!: number;

  await etape(page, testInfo, `1. Mettre la dernière pièce ${produit.id} au panier`, async () => {
    await panier.addByUrl(produit.handle);
    await expect(panier.quantity(produit.handle), 'La quantité doit être 1').toHaveValue('1');
    prix = (await panier.subtotalCents())!;
  });

  await etape(page, testInfo, '2. « + » : la quantité reste à 1, le sous-total ne bouge pas', async () => {
    const refus = page.waitForResponse(r => /\/cart\/change/.test(r.url()), { timeout: 15_000 }).catch(() => null);
    await centrer(panier.increaseButton(produit.handle));
    await panier.increaseButton(produit.handle).click();
    const reponse = await refus;
    if (reponse) testInfo.annotations.push({ type: 'Réponse de Shopify', description: `cart/change : code ${reponse.status()} (422 = stock insuffisant)` });
    await expect(panier.quantity(produit.handle), 'Une seule pièce est en stock : la quantité doit rester à 1').toHaveValue('1');
    expect(await panier.subtotalCents(), `Le sous-total doit rester à ${formatCents(prix)}`).toBe(prix);
    expect(await header.cartCount(), 'Le compteur du panier doit rester à 1').toBe(1);
    // Message de Shopify sous la ligne : « Un article seulement a été ajouté à votre panier en raison de la disponibilité. »
    await expect(panier.line(produit.handle).getByRole('alert'), 'Le client doit être prévenu que le stock est épuisé')
      .toContainText(/disponibilit|availab|stock/i);
  });
});

test(`Panier · mixte, en stock et précommande (${produitFixe('QA01').id} + ${produitFixe('QA05').id}) @tnr @cart`, async ({ page, qaEnv, isMobile }, testInfo) => {
  test.skip(qaEnv.name !== 'preprod', 'Produits QA : préprod uniquement');
  const enStock = produitFixe('QA01');
  const precommande = produitFixe('QA05');
  const header = new Header(page, isMobile);
  const fiche = new ProductPage(page);
  const panier = new CartPage(page);
  const checkout = new CheckoutPage(page);
  testInfo.annotations.push({ type: 'Produits testés', description: `${enStock.id} (${enStock.handle}) en stock, ${precommande.id} (${precommande.handle}) en précommande, expédition le ${precommande.datePrecommande}` });
  const prixLigne = async (handle: string) => (await panier.linePriceCents(handle))!;
  let sousTotal!: number;

  await etape(page, testInfo, `1. Mettre ${enStock.id} au panier : une ligne, « 1 product »`, async () => {
    await panier.addByUrl(enStock.handle);
    await expect(panier.lines, 'Le panier doit contenir une seule ligne').toHaveCount(1);
    await expect(panier.itemCountLabel, 'Le compteur du panier doit dire « 1 product » (singulier)').toHaveText(/^\s*1\s+(product|produit|article|item)\s*$/i);
  });

  await etape(page, testInfo, `2. Précommander ${precommande.id} depuis sa fiche`, async () => {
    await fiche.goto(precommande.handle);
    await expect.poll(() => fiche.mainButton.innerText(), { message: 'Le bouton principal doit proposer de précommander' }).toMatch(MENTION_PRECOMMANDE);
    await centrer(fiche.mainButton);
    await fiche.mainButton.click();
    await expect(fiche.cartNotification, 'La notification « ajouté au panier » doit apparaître').toBeVisible();
    await expect(fiche.cartNotification, 'La notification doit dire qu\'il s\'agit d\'une précommande').toContainText(MENTION_PRECOMMANDE);
    await expect.poll(() => header.cartCount(), { message: 'Le compteur du panier doit passer à 2' }).toBe(2);
  });

  await etape(page, testInfo, '3. Vérifier le panier : deux lignes, précommande sur la seule ligne concernée, sous-total = somme des lignes', async () => {
    await page.goto('cart', { waitUntil: 'domcontentloaded' });
    await panier.expectLoaded();
    await expect(panier.lines, 'Le panier doit contenir deux lignes').toHaveCount(2);
    await expect(panier.itemCountLabel, 'Le compteur du panier doit dire « 2 products » (pluriel)').toHaveText(/^\s*2\s+(products|produits|articles|items)\s*$/i);
    await expect(panier.line(precommande.handle), `La ligne ${precommande.id} doit dire qu'il s'agit d'une précommande`).toContainText(MENTION_PRECOMMANDE);
    await expect(panier.line(precommande.handle), `La ligne ${precommande.id} doit donner la date d'expédition`).toContainText(/Shipping on|Expédition/i);
    await expect(panier.line(enStock.handle), `La ligne ${enStock.id} (en stock) ne doit pas parler de précommande`).not.toContainText(/Pre-?order:|Précommande\s*:|Shipping on|Expédition le/i);
    sousTotal = (await panier.subtotalCents())!;
    const lignes = { [enStock.id]: await prixLigne(enStock.handle), [precommande.id]: await prixLigne(precommande.handle) };
    testInfo.annotations.push({ type: 'Prix des lignes', description: Object.entries(lignes).map(([id, p]) => `${id} ${formatCents(p)}`).join(', ') });
    expect(sousTotal, `Le sous-total doit être la somme des deux lignes (${formatCents(lignes[enStock.id] + lignes[precommande.id])})`).toBe(lignes[enStock.id] + lignes[precommande.id]);
    // Ce que le panier transmettra à la commande : seule la précommande porte les propriétés cachées.
    const contenu = await (await appelShopify(page, 'La lecture du panier', () => page.request.get('cart.js'))).json() as { items: { handle: string; properties: Record<string, string> | null }[] };
    const proprietes = (handle: string) => contenu.items.find(i => i.handle === handle)?.properties ?? {};
    expect(proprietes(precommande.handle)._is_preorder, `${precommande.id} doit être marqué comme précommande (_is_preorder)`).toBe('true');
    expect(proprietes(precommande.handle)._preorder_date, `${precommande.id} doit porter sa date de précommande (_preorder_date)`).toBe(precommande.datePrecommande);
    expect(proprietes(enStock.handle)._is_preorder, `${enStock.id} (en stock) ne doit pas être marqué comme précommande`).toBeUndefined();
  });

  await etape(page, testInfo, '4. Arriver au checkout, sans rien saisir : les deux produits et le même total', async () => {
    await panier.goToCheckout();
    await checkout.expectLoaded();
    await checkout.expectProductInSummary('QA Numéro Un');
    await checkout.expectProductInSummary('QA Solé');
    await checkout.expectTotalVisible(sousTotal);
  });

  await etape(page, testInfo, `5. Retirer ${precommande.id} avec la croix : reste ${enStock.id}, « 1 product »`, async () => {
    await page.goto('cart', { waitUntil: 'domcontentloaded' });
    await panier.expectLoaded();
    const prixRestant = await prixLigne(enStock.handle);
    await centrer(panier.removeButton(precommande.handle));
    await panier.removeButton(precommande.handle).click();
    // La croix demande confirmation, comme la corbeille du « − » à 1 (fenêtre lente à venir sous Safari).
    await expect(panier.removeDialog, 'La croix doit ouvrir la fenêtre « Remove item ? »').toBeVisible();
    await expect(panier.removeDialog, `La fenêtre doit rappeler le produit retiré (${precommande.id})`).toContainText(/QA Sol/i);
    await panier.removeDialog.getByRole('button', { name: /Yes, remove|Oui, (supprimer|retirer)/i }).click();
    await expect(panier.lines, `Seule la ligne ${enStock.id} doit rester`).toHaveCount(1);
    await expect(panier.line(enStock.handle)).toBeVisible();
    await expect(panier.itemCountLabel, 'Le compteur du panier doit revenir à « 1 product »').toHaveText(/^\s*1\s+(product|produit|article|item)\s*$/i);
    await expect.poll(() => panier.subtotalCents(), { message: `Le sous-total doit revenir au prix de ${enStock.id} (${formatCents(prixRestant)})` }).toBe(prixRestant);
    await expect.poll(() => header.cartCount(), { message: 'Le compteur de l\'en-tête doit revenir à 1' }).toBe(1);
  });
});

test('Panier · vide : connexion, réassurance, assistance et suggestions @tnr @cart', async ({ page, qaEnv, isMobile }, testInfo) => {
  const panier = new CartPage(page);
  const header = new Header(page, isMobile);
  const suggestions = panier.main.getByRole('listitem').filter({ has: page.getByRole('button', { name: /- (Add to cart|Ajouter au panier)$/i }) });

  await etape(page, testInfo, '1. Ouvrir le panier sans rien ajouter : « Votre panier est vide », découvrir la sélection, se connecter', async () => {
    await page.goto('cart', { waitUntil: 'domcontentloaded' });
    await expect(panier.emptyHeading, 'Le panier doit annoncer qu\'il est vide').toBeVisible();
    const decouvrir = panier.main.getByRole('link', { name: /Discover polène selection|Découvrir la sélection Polène/i });
    await expect(decouvrir, 'Le panier vide doit proposer la sélection Polène').toHaveAttribute('href', /\/collections\/[a-z-]+$/);
    // Fiche TNR CART-01 : un visiteur peut se connecter depuis le panier vide pour retrouver son panier et ses favoris.
    const connexion = panier.main.getByRole('link', { name: /^(Login|Se connecter|Sign in)$/i });
    await expect(connexion, 'Le panier vide doit proposer la connexion').toBeVisible();
    const href = (await connexion.getAttribute('href')) ?? '';
    testInfo.annotations.push({ type: 'Lien de connexion', description: href });
    expect(href, 'Le lien doit mener à la connexion').toMatch(/account\/login|customer_authentication|authentication/);
    if (qaEnv.name === 'preprod' && /account\/login/.test(href)) {
      // Constat 44 : la préprod se connecte par code, mais ce lien mène encore à l'ancienne connexion par mot de passe.
      testInfo.annotations.push({ type: 'Constat 44', description: `« Login » du panier vide mène à ${href} (ancienne connexion), l'icône Account de l'en-tête à la connexion par code` });
    }
  });

  await etape(page, testInfo, '2. Réassurance : retours sous 30 jours, suivi, garantie 2 ans, logos des paiements', async () => {
    for (const texte of [/30 days return|Retours sous 30 jours/i, /Track every steps?|Suivi de chaque étape/i, /2 years? warranty|Garantie 2 ans/i]) {
      // Deux exemplaires (ordinateur et mobile), l'un masqué.
      await expect(panier.main.getByText(texte).filter({ visible: true }).first(), `Réassurance « ${texte.source} »`).toBeVisible();
    }
    const paiements = panier.main.getByRole('heading', { name: /100 ?% (secure payments|sécurisé)/i }).filter({ visible: true }).first();
    await expect(paiements, 'Le titre « Paiement 100 % sécurisé » doit s\'afficher').toBeVisible();
    // Logos dessinés en SVG, nommés par leur titre (« Visa », « Mastercard »…).
    const logos: string[] = [];
    for (const logo of await panier.main.getByRole('img').filter({ visible: true }).all()) {
      const nom = await logo.evaluate(e => e.getAttribute('aria-label') ?? e.getAttribute('alt') ?? e.querySelector('title')?.textContent ?? '');
      if (/^(Visa|Mastercard|Maestro|American Express|Apple Pay|Google Pay|PayPal|Shop Pay|Cartes Bancaires|Bancontact|Bizum|Diners Club|Discover|MB WAY|Satispay|Klarna)$/i.test(nom) && !logos.includes(nom)) logos.push(nom);
    }
    testInfo.annotations.push({ type: 'Logos de paiement', description: logos.join(', ') });
    expect(logos, 'Les logos des cartes acceptées doivent s\'afficher (au moins Visa et Mastercard)').toEqual(expect.arrayContaining(['Visa', 'Mastercard']));
  });

  await etape(page, testInfo, '3. Accordéon « Assistance » : fermé au départ, s\'ouvre au clic, se ferme avec Entrée', async () => {
    const bouton = panier.main.getByRole('button', { name: /^Assistance$/i }).filter({ visible: true }).first();
    const contenu = panier.main.getByRole('region', { name: /^Assistance$/i });
    await centrer(bouton);
    await expect(bouton, 'L\'accordéon doit être fermé au départ').toHaveAttribute('aria-expanded', 'false');
    await bouton.click();
    await expect(bouton, 'Un clic doit ouvrir l\'accordéon').toHaveAttribute('aria-expanded', 'true');
    await expect(contenu, 'Le texte du service client doit s\'afficher').toBeVisible();
    const email = contenu.getByRole('link', { name: /by email|par e-?mail/i });
    await expect(email, 'Le contact par email doit être proposé').toHaveAttribute('href', /^mailto:\S+@polene-paris\.com$/);
    const formulaire = contenu.getByRole('link', { name: /Contact us form|^Contactez-nous$/i });
    const href = (await formulaire.getAttribute('href')) ?? '';
    // Constat 45 : en préprod, le lien du formulaire de contact est vide (il recharge le panier). Contribution de la
    // préprod à corriger (QA, 22 octobre 2026) ; juste en prod.
    expect.soft(href, 'Le formulaire de contact doit mener au support Polène (constat 45 en préprod : lien vide, contribution à corriger)').toMatch(/^https:\/\/support\.polene-paris\.com\/hc\/[a-z-]+\/requests\/new$/);
    await bouton.focus();
    await page.keyboard.press('Enter');
    await expect(bouton, 'Entrée doit refermer l\'accordéon').toHaveAttribute('aria-expanded', 'false');
    await expect(contenu, 'Le texte doit se masquer').toBeHidden();
  });

  await etape(page, testInfo, '4. Suggestions (« Polène suggère ») : 10 produits, cartes complètes, flèches au clavier', async () => {
    const titre = panier.main.getByRole('heading', { name: /^(Polène suggère|You may also like|Complétez votre panier)$/i });
    await centrer(titre);
    await expect(titre, 'Le bloc de suggestions doit s\'afficher').toBeVisible();
    const noms = await panier.main.getByRole('listitem', { name: /\d+ (of|sur) \d+$/ }).evaluateAll(ls => ls.map(l => l.getAttribute('aria-label') ?? ''));
    const total = Number(noms[0]?.match(/(\d+)$/)?.[1] ?? 0);
    testInfo.annotations.push({ type: 'Suggestions', description: `${total} produits` });
    expect(total, 'Le bloc doit suggérer plusieurs produits').toBeGreaterThanOrEqual(4);
    const premiere = suggestions.first();
    await expect(premiere.getByRole('heading', { level: 3 }), 'La carte doit afficher le nom du produit').toBeVisible();
    expect(parsePriceToCents(await premiere.innerText()), 'La carte doit afficher un prix').not.toBeNull();
    // Flèches de 1 × 1 px, réservées aux lecteurs d'écran : testées au clavier.
    const precedent = panier.main.getByRole('button', { name: /^(Previous|Précédent)$/i });
    const suivant = panier.main.getByRole('button', { name: /^(Next|Suivant)$/i });
    await expect(precedent, '« Précédent » doit être inactif sur la première suggestion').toBeDisabled();
    await suivant.focus();
    await page.keyboard.press('Enter');
    await expect(precedent, 'Après « Suivant », « Précédent » doit devenir actif').toBeEnabled();
    await precedent.focus();
    await page.keyboard.press('Enter');
    await expect(precedent, '« Précédent » doit ramener à la première suggestion (et redevenir inactif)').toBeDisabled();
  });

  await etape(page, testInfo, '5. Ajouter une suggestion au panier : le panier n\'est plus vide, compteur à 1', async () => {
    // Première suggestion qui commence à l'écran (après « Suivant », la première est sortie à gauche).
    const index = await suggestions.evaluateAll(ls => ls.findIndex(l => { const r = l.getBoundingClientRect(); return r.width > 0 && r.left >= -1 && r.left + r.width / 2 <= window.innerWidth; }));
    expect(index, 'Une suggestion doit être à l\'écran').toBeGreaterThanOrEqual(0);
    const carte = suggestions.nth(index);
    const nom = (await carte.getAttribute('aria-label'))?.replace(/, \d+ (of|sur) \d+$/, '') ?? '';
    const bouton = carte.getByRole('button', { name: /- (Add to cart|Ajouter au panier)$/i });
    await centrer(bouton);
    if (!isMobile) await carte.hover();
    const ajout = page.waitForResponse(r => /\/cart\/add/.test(r.url()) && r.request().method() === 'POST');
    await bouton.click();
    expect((await ajout).status(), `Shopify doit accepter l'ajout de « ${nom} »`).toBe(200);
    await expect(panier.emptyHeading, 'Le panier ne doit plus être vide').toBeHidden();
    await expect(panier.lines, `« ${nom} » doit être dans le panier`).toHaveCount(1);
    await expect.poll(() => header.cartCount(), { message: 'Le compteur de l\'en-tête doit passer à 1' }).toBe(1);
  });
});

test(`Panier · favoris depuis la ligne et depuis « Remove item ? », le produit reste au panier (${produitFixe('QA01').id}) @tnr @cart`, async ({ page, qaEnv, isMobile }, testInfo) => {
  test.skip(qaEnv.name !== 'preprod', 'Produits QA : préprod uniquement');
  const produit = produitFixe('QA01');
  const header = new Header(page, isMobile);
  const panier = new CartPage(page);
  const favoris = new Wishlist(page);
  testInfo.annotations.push({ type: 'Produit testé', description: `${produit.id} (${produit.handle})` });
  // Favoris d'un visiteur : gardés dans le navigateur (localStorage wishlist_products), sous l'identifiant du produit.
  const enregistres = () => page.evaluate(() => JSON.parse(localStorage.getItem('wishlist_products') ?? '[]') as string[]);
  const coeurLigne = panier.line(produit.handle).locator('[data-ref="wishlist-button"]').filter({ visible: true }).first();
  const boutonFenetre = panier.removeDialog.locator('[data-ref="wishlist-button"]');
  const DEJA = /Already in your wishlist|Déjà dans (vos|tes) favoris/i;
  // Le bouton contient ses deux libellés (« Add to Wishlist », « Already in your wishlist ») : on lit celui affiché.
  const libelleFenetre = async () => (await boutonFenetre.innerText()).replace(/\s+/g, ' ').trim();
  let idProduit = '';

  const ouvrirFenetre = async () => {
    await centrer(panier.removeButton(produit.handle));
    await panier.removeButton(produit.handle).click();
    await expect(panier.removeDialog, 'La croix doit ouvrir la fenêtre « Remove item ? »').toBeVisible();
  };
  const fermerFenetre = async () => {
    await panier.removeDialog.getByRole('button', { name: /Close modal|Fermer/i }).click();
    await expect(panier.removeDialog, 'La fenêtre doit se fermer').toBeHidden();
    await expect(panier.lines, 'Le produit doit toujours être au panier').toHaveCount(1);
  };

  await etape(page, testInfo, `1. Mettre ${produit.id} au panier, aucun favori`, async () => {
    await panier.addByUrl(produit.handle);
    await expect(panier.lines, 'Le panier doit contenir une seule ligne').toHaveCount(1);
    expect(await favoris.headerCount(), 'Aucun favori au départ (navigateur neuf)').toBe(0);
    idProduit = (await coeurLigne.getAttribute('data-product-id'))!;
  });

  await etape(page, testInfo, '2. Cœur de la ligne : produit en favori, message, compteur des favoris à 1, toujours au panier', async () => {
    await favoris.toggle(coeurLigne, true);
    await expect.poll(() => favoris.headerCount(), { message: 'Le compteur des favoris de l\'en-tête doit passer à 1' }).toBe(1);
    expect(await enregistres(), 'Le produit doit être enregistré dans les favoris du navigateur').toContain(idProduit);
    await expect(panier.lines, 'Mettre en favori ne doit pas retirer le produit du panier').toHaveCount(1);
  });

  await etape(page, testInfo, '3. Croix de la ligne : sans recharger, la fenêtre « Remove item ? » dit « Already in your wishlist ». Fermer sans retirer', async () => {
    await ouvrirFenetre();
    // Constat 55 (15 octobre 2026) : la fenêtre ignorait le cœur de la ligne tant que la page n'était pas rechargée.
    // Corrigé (QA, 22 octobre 2026) : vérifié depuis, pour qu'un retour du bug soit vu.
    await expect.poll(libelleFenetre, { message: 'Le produit vient d\'être mis en favori par le cœur de la ligne : la fenêtre doit le dire sans rechargement (constat 55)' }).toMatch(DEJA);
    await fermerFenetre();
  });

  await etape(page, testInfo, '4. Recharger le panier : cœur de la ligne plein, la fenêtre dit « Already in your wishlist »', async () => {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await panier.expectLoaded();
    await expect(coeurLigne, 'Le cœur de la ligne doit rester plein après rechargement').toHaveAttribute('aria-pressed', 'true');
    await ouvrirFenetre();
    await expect.poll(libelleFenetre, { message: 'Le produit étant en favori, la fenêtre doit le dire' }).toMatch(DEJA);
    await fermerFenetre();
  });

  await etape(page, testInfo, '5. Cœur de la ligne de nouveau : retiré des favoris, compteur à 0', async () => {
    await favoris.toggle(coeurLigne, false);
    await expect.poll(() => favoris.headerCount(), { message: 'Le compteur des favoris de l\'en-tête doit revenir à 0' }).toBe(0);
    expect(await enregistres(), 'Le produit ne doit plus être dans les favoris du navigateur').not.toContain(idProduit);
  });

  await etape(page, testInfo, '6. Recharger, croix, « Add to wishlist » dans la fenêtre : en favori, le bouton devient « Already in your wishlist », le cœur de la ligne se remplit', async () => {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await panier.expectLoaded();
    await ouvrirFenetre();
    await expect.poll(libelleFenetre, { message: 'La fenêtre doit proposer « Add to wishlist »' }).toMatch(/^(Add to wishlist|Ajouter aux favoris)$/i);
    await boutonFenetre.click();
    await expect(favoris.snackbar.first(), 'Un message doit confirmer l\'ajout aux favoris').toContainText(/added to your favorites|ajouté à vos favoris/i);
    await expect.poll(libelleFenetre, { message: 'Le bouton doit dire que le produit est maintenant en favori' }).toMatch(DEJA);
    await expect.poll(() => favoris.headerCount(), { message: 'Le compteur des favoris de l\'en-tête doit passer à 1' }).toBe(1);
    expect(await enregistres(), 'Le produit doit être enregistré dans les favoris du navigateur').toContain(idProduit);
    await fermerFenetre();
    await expect.poll(() => header.cartCount(), { message: 'Le compteur du panier doit rester à 1' }).toBe(1);
    await expect(coeurLigne, 'Produit mis en favori depuis la fenêtre : le cœur de la ligne doit se remplir sans rechargement (constat 55)').toHaveAttribute('aria-pressed', 'true');
  });

  await etape(page, testInfo, '7. Page des favoris : le produit y est', async () => {
    await page.goto('pages/wishlist', { waitUntil: 'domcontentloaded' });
    // La liste est remplie après le chargement de la page, d'après les favoris gardés dans le navigateur.
    await expect(page.getByRole('main').locator(`component-accordion a[href*="/products/${produit.handle}"]`).first(), `${produit.id} doit apparaître dans les favoris`).toBeAttached({ timeout: 20_000 });
    const rubriques = await favoris.expectSections([produit.handle]);
    testInfo.annotations.push({ type: 'Rubriques', description: rubriques.map(r => `${r.titre} : ${r.cartes.map(c => c.handle).join(', ') || 'vide'}`).join(' | ') });
  });
});

/** Nombre de lignes d'un grand panier (fiche TNR CART-02 : « 10 articles et plus »). */
const GRAND_PANIER = 10;

test(`Panier · ${GRAND_PANIER} produits : lignes complètes, sous-total, chaque ligne atteignable @tnr @cart`, async ({ page, qaEnv, isMobile }, testInfo) => {
  test.skip(qaEnv.name !== 'preprod', 'Produits QA : préprod uniquement');
  const header = new Header(page, isMobile);
  const panier = new CartPage(page);
  let handles: string[] = [];

  await etape(page, testInfo, `1. Mettre ${GRAND_PANIER} produits QA de remplissage au panier, en un seul appel`, async () => {
    // Produits de remplissage de la collection C2 (en stock, tag qa-filler). Un seul appel à cart/add.js pour les
    // ${GRAND_PANIER} produits : dix passages par /cart/add?id=… déclencheraient la limite de Shopify (429).
    const collection = await (await appelShopify(page, 'La lecture de la collection C2', () => page.request.get('collections/qa-collection-infinite-scroll/products.json?limit=30'))).json() as
      { products: { handle: string; tags: string[]; variants: { id: number; available: boolean }[] }[] };
    // La collection contient aussi des produits QA à état particulier (précommande retardée…) : seulement le remplissage.
    const choisis = collection.products.filter(p => p.tags.includes('qa-filler') && p.variants[0]?.available).slice(0, GRAND_PANIER);
    expect(choisis.length, `La collection C2 doit avoir au moins ${GRAND_PANIER} produits en stock`).toBe(GRAND_PANIER);
    handles = choisis.map(p => p.handle);
    await appelShopify(page, `L'ajout de ${GRAND_PANIER} produits au panier`, () => page.request.post('cart/add.js', {
      data: { items: choisis.map(p => ({ id: p.variants[0].id, quantity: 1 })) },
    }));
    testInfo.annotations.push({ type: 'Produits', description: handles.join(', ') });
  });

  await etape(page, testInfo, `2. Ouvrir le panier : ${GRAND_PANIER} lignes, « ${GRAND_PANIER} products », compteur de l'en-tête`, async () => {
    await page.goto('cart', { waitUntil: 'domcontentloaded' });
    await panier.expectLoaded();
    await expect(panier.lines, `Le panier doit afficher ${GRAND_PANIER} lignes`).toHaveCount(GRAND_PANIER);
    await expect(panier.itemCountLabel, `Le compteur du panier doit dire « ${GRAND_PANIER} products »`).toHaveText(new RegExp(`^\\s*${GRAND_PANIER}\\s+(products|produits|articles|items)\\s*$`, 'i'));
    await expect.poll(() => header.cartCount(), { message: `Le compteur de l'en-tête doit dire ${GRAND_PANIER}` }).toBe(GRAND_PANIER);
  });

  await etape(page, testInfo, '3. Sous-total = somme des lignes', async () => {
    const prix = await Promise.all(handles.map(async h => (await panier.linePriceCents(h))!));
    const somme = prix.reduce((a, b) => a + b, 0);
    expect(prix.every(p => p > 0), 'Chaque ligne doit afficher son prix').toBe(true);
    expect(await panier.subtotalCents(), `Le sous-total doit être la somme des ${GRAND_PANIER} lignes (${formatCents(somme)})`).toBe(somme);
  });

  await etape(page, testInfo, '4. Faire défiler le panier : chaque ligne s\'affiche avec photo et quantité, son « + » peut être touché', async () => {
    for (const handle of handles) {
      const ligne = panier.line(handle);
      await centrer(ligne);
      await expect(ligne.getByRole('img').first(), `La photo de ${handle} doit être affichée`).toBeVisible();
      await expect(panier.quantity(handle), `La quantité de ${handle} doit être 1`).toHaveValue('1');
      // Sur mobile, le récapitulatif collé au bas de l'écran prend jusqu'à la moitié de l'écran (Android) : une ligne
      // centrée peut passer dessous. Le clic d'essai (sans clic réel) fait défiler la page comme un client jusqu'à ce
      // que le « + » ne soit plus recouvert, et échoue s'il l'est toujours.
      const atteint = await panier.increaseButton(handle).click({ trial: true, timeout: 5_000 }).then(() => true, () => false);
      expect.soft(atteint, `Le bouton « + » de ${handle} doit pouvoir être touché (pas recouvert par le récapitulatif ou l'en-tête)`).toBe(true);
    }
  });

  await etape(page, testInfo, '5. En bas du panier : « Continue » visible, page pas plus large que l\'écran', async () => {
    await centrer(panier.line(handles.at(-1)!));
    await expect(panier.checkoutButton, '« Continue » doit rester accessible après le défilement').toBeVisible();
    if (isMobile) await expect(panier.checkoutButton, 'Sur mobile, « Continue » doit rester à l\'écran (récapitulatif collé en bas)').toBeInViewport();
    await verifierLargeur(page, testInfo);
  });
});
