import { test, expect, etape } from '../src/fixtures';
import { CartPage } from '../src/pages/cart';
import { CheckoutPage } from '../src/pages/checkout';
import { produitFixe } from '../src/produits-fixes';
import { formatCents } from '../src/price';

/**
 * Checkout, ce qui se lit sans rien saisir (roadmap phase 2.3, fiches TNR CHECKOUT-01, 02 et 08) : résumé de la
 * commande (replié sur mobile), paiement express, blocs d'information de la colonne du résumé ; et le pays de
 * livraison (CHECKOUT-03 et 04 : champs qui suivent le pays, clavier numérique). Arrivée au checkout seulement, en prod
 * comme en préprod : seul le pays est changé, aucun autre champ rempli, aucun bouton de paiement touché.
 */

const PRODUITS: Record<string, string> = {
  preprod: produitFixe('QA01').handle,
  prod: produitFixe('P08').handle,
};

test('Checkout · résumé de la commande, paiement express et blocs d\'information @tnr @checkout', async ({ page, qaEnv, isMobile }, testInfo) => {
  const handle = PRODUITS[qaEnv.name];
  const panier = new CartPage(page);
  const checkout = new CheckoutPage(page);
  let total = 0;
  testInfo.annotations.push({ type: 'Produit testé', description: handle });

  await etape(page, testInfo, `1. Mettre ${handle} au panier et aller au checkout`, async () => {
    await panier.addByUrl(handle);
    total = (await panier.subtotalCents())!;
    expect(total, 'Le panier doit afficher un sous-total').toBeGreaterThan(0);
    await panier.goToCheckout();
    await checkout.expectLoaded();
  });

  await etape(page, testInfo, isMobile
    ? '2. Mobile : résumé replié en haut avec le total, qui s\'ouvre sur le produit puis se referme'
    : '2. Ordinateur : résumé de la commande à droite, avec le produit et le total', async () => {
    if (isMobile) {
      const bouton = checkout.orderSummaryToggle.filter({ visible: true }).first();
      await expect(bouton, 'Le résumé doit être replié au départ').toHaveAttribute('aria-expanded', 'false');
      await expect(bouton, `Le résumé replié doit afficher le total (${formatCents(total)})`).toContainText(/Prix total|Total/i);
      await checkout.expectTotalVisible(total);
      // La fiche TNR CHECKOUT-01 le disait fixé en haut de l'écran : il défile avec la page, c'est normal (QA, 15 octobre 2026).
      await bouton.click();
      await expect(bouton, 'Un toucher doit ouvrir le résumé').toHaveAttribute('aria-expanded', 'true');
      await expect(page.getByRole('row').filter({ visible: true }).first(), 'Le résumé ouvert doit montrer le produit').toBeVisible();
      await bouton.click();
      await expect(bouton, 'Un second toucher doit refermer le résumé').toHaveAttribute('aria-expanded', 'false');
    } else {
      await expect(page.getByRole('row').filter({ visible: true }).first(), 'Le résumé doit montrer le produit').toBeVisible();
      await checkout.expectTotalVisible(total);
    }
  });

  await etape(page, testInfo, '3. Paiement express en haut du checkout', async () => {
    const zone = page.getByRole('region', { name: /Paiement express|Express checkout/i });
    await expect(zone, 'La zone « Paiement express » doit s\'afficher').toBeVisible();
    // Boutons : cadres « Payer avec PayPal », « Payer avec Google Pay », lien « Shop » (Shop Pay), insérés après coup.
    const lireBoutons = async () => [...new Set((await zone.locator('iframe[title], a, button').evaluateAll(es => es
      .filter(e => (e as HTMLElement).checkVisibility())
      .map(e => e.getAttribute('title') ?? e.getAttribute('aria-label') ?? e.textContent ?? ''))).map(s => s.trim()).filter(Boolean))];
    const attendu = qaEnv.name === 'prod' ? zone.locator('iframe[title*="PayPal"]') : zone.getByRole('link', { name: /^Shop/i });
    await expect(attendu.first(), `Le paiement express doit proposer ${qaEnv.name === 'prod' ? 'PayPal' : 'Shop Pay'}`).toBeVisible({ timeout: 20_000 });
    // Google Pay (et Apple Pay) dépendent du navigateur : notés, sans échec.
    testInfo.annotations.push({ type: 'Paiement express', description: (await lireBoutons()).join(', ') });
  });

  await etape(page, testInfo, '4. Blocs « Besoin d\'aide ? », « Paiement 100 % sécurisé », « Politique de retour et d\'expédition », une seule fois chacun', async () => {
    const blocs: [RegExp, RegExp][] = [
      [/^Besoin d.aide ?\?$|^Need help\?$/i, /service client|customer service/i],
      [/^Paiement 100 ?% sécurisé$|^100 ?% secure payment$/i, /sécurité|secure/i],
      [/^Politique de retour et d.expédition$|^Return and shipping policy$/i, /30 jours|30 days/i],
    ];
    // Sur mobile, les blocs sont en bas de page, affichés à l'arrivée à l'écran : on descend d'abord.
    await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' }));
    for (const [titre, texte] of blocs) {
      const titres = page.getByRole('heading', { name: titre }).filter({ visible: true });
      // Constat 46 : en préprod sous Android, les trois blocs restent masqués. Constat 56 : en prod sous Android,
      // « Besoin d'aide ? » n'est plus affiché depuis le 21 octobre 2026 (bug confirmé par la QA le 22 octobre).
      await expect(titres, `Le bloc ${titre.source} doit s'afficher une seule fois (sous Android : constat 46 en préprod, 56 en prod)`).toHaveCount(1);
      await titres.first().scrollIntoViewIfNeeded();
      await expect(titres.first().locator('xpath=..'), `Le bloc ${titre.source} doit avoir son texte`).toContainText(texte);
    }
    await expect(page.getByRole('link', { name: /Contactez-nous par e-?mail|Contact us by e-?mail/i }).filter({ visible: true }).first(),
      '« Besoin d\'aide ? » doit proposer un email de contact').toHaveAttribute('href', /^mailto:\S+@polene-paris\.com$/);
  });
});

test('Checkout · pays de livraison : le formulaire d\'adresse suit le pays, clavier numérique en France @tnr @checkout', async ({ page, qaEnv }, testInfo) => {
  const handle = PRODUITS[qaEnv.name];
  const panier = new CartPage(page);
  const checkout = new CheckoutPage(page);
  const pays = page.getByRole('combobox', { name: /Pays|Country/i });
  // Champ région : « Province » pour le Canada, « État » pour les États-Unis. Les champs cachés d'auto-remplissage du
  // checkout portent le même nom mais sont masqués aux lecteurs d'écran : le rôle ne trouve que le vrai champ.
  const region = page.getByRole('combobox', { name: /^(Province|État|Région|State|Region)/i });
  testInfo.annotations.push({ type: 'Produit testé', description: handle });

  await etape(page, testInfo, `1. Mettre ${handle} au panier et aller au checkout, sans rien saisir`, async () => {
    await panier.addByUrl(handle);
    await panier.goToCheckout();
    await checkout.expectLoaded();
  });

  await etape(page, testInfo, '2. France par défaut : pas de région, code postal et téléphones au clavier numérique', async () => {
    await expect(pays, 'Le pays de livraison doit être la France par défaut').toHaveValue('FR');
    await expect(region, 'Pas de champ région pour une adresse en France').toHaveCount(0);
    await expect(checkout.postalCodeField, 'Le code postal français doit ouvrir le clavier numérique sur téléphone').toHaveAttribute('inputmode', 'numeric');
    const telephones = page.getByRole('textbox', { name: /Téléphone|Phone/i }).filter({ visible: true });
    expect(await telephones.count(), 'Le checkout doit demander un téléphone').toBeGreaterThan(0);
    for (const tel of await telephones.all()) {
      await expect(tel, `« ${await tel.getAttribute('name')} » doit ouvrir le clavier du téléphone (type tel)`).toHaveAttribute('type', 'tel');
    }
    testInfo.annotations.push({ type: 'Nombre de pays proposés', description: `${new Set(await pays.locator('option').evaluateAll(os => os.map(o => (o as HTMLOptionElement).value))).size}` });
  });

  await etape(page, testInfo, '3. Choisir le Canada : le champ « Province » apparaît, le code postal accepte les lettres', async () => {
    await pays.selectOption('CA');
    await expect(region, 'Le Canada doit demander une province').toBeVisible();
    await expect(region, 'Le champ « Province » doit être obligatoire').toHaveAttribute('required');
    await expect(checkout.postalCodeField, 'Le code postal canadien contient des lettres : plus de clavier numérique').not.toHaveAttribute('inputmode', 'numeric');
  });

  await etape(page, testInfo, '4. Revenir à la France : la région disparaît, le clavier numérique revient', async () => {
    await pays.selectOption('FR');
    await expect(region, 'Plus de champ région une fois revenu en France').toHaveCount(0);
    await expect(checkout.postalCodeField, 'Le code postal français doit de nouveau ouvrir le clavier numérique').toHaveAttribute('inputmode', 'numeric');
  });
});
