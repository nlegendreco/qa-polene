import { test, expect, etape } from '../src/fixtures';
import { CartPage } from '../src/pages/cart';
import { CheckoutPage } from '../src/pages/checkout';
import { produitFixe } from '../src/produits-fixes';
import { formatCents } from '../src/price';

/**
 * Checkout, ce qui se lit sans rien saisir (roadmap phase 2.3, fiches TNR CHECKOUT-01, 02 et 08) : résumé de la
 * commande (replié sur mobile), paiement express, blocs d'information de la colonne du résumé. Arrivée au checkout
 * seulement, en prod comme en préprod : aucun champ rempli, aucun bouton de paiement touché.
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
      // Constat 46 : en préprod sous Android, les trois blocs restent masqués (affichés en prod sur le même appareil).
      await expect(titres, `Le bloc ${titre.source} doit s'afficher une seule fois`).toHaveCount(1);
      await titres.first().scrollIntoViewIfNeeded();
      await expect(titres.first().locator('xpath=..'), `Le bloc ${titre.source} doit avoir son texte`).toContainText(texte);
    }
    await expect(page.getByRole('link', { name: /Contactez-nous par e-?mail|Contact us by e-?mail/i }).filter({ visible: true }).first(),
      '« Besoin d\'aide ? » doit proposer un email de contact').toHaveAttribute('href', /^mailto:\S+@polene-paris\.com$/);
  });
});
