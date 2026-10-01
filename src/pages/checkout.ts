import { expect, type Page } from '@playwright/test';
import { formatCents, parsePriceToCents } from '../price';

export interface TestBuyer {
  email: string;
  civility: 'M.' | 'Mme' | 'Mx';
  firstName: string;
  lastName: string;
  address: string;
  postalCode: string;
  city: string;
  phone: string;
}

export interface TestCard {
  number: string;
  expiry: string;
  cvv: string;
  name: string;
}

/** Checkout Shopify (une seule page : contact, livraison, expédition, paiement). */
export class CheckoutPage {
  constructor(private readonly page: Page) {}

  get orderSummaryToggle() {
    return this.page.getByRole('button', { name: /Résumé de la commande|Order summary/i });
  }

  async expectLoaded() {
    await expect(this.page).toHaveTitle(/Paiement|Checkout/i);
    await expect(this.page.getByRole('heading', { name: /^(Contact)$/i })).toBeVisible();
    await expect(this.page.getByRole('heading', { name: /^(Livraison|Delivery)$/i })).toBeVisible();
  }

  /** Sur mobile, le résumé de commande est replié : on l'ouvre pour voir les produits. */
  async openOrderSummaryIfCollapsed() {
    const toggle = this.orderSummaryToggle;
    if (await toggle.isVisible() && (await toggle.getAttribute('aria-expanded')) === 'false') {
      await toggle.click();
    }
  }

  async expectProductInSummary(title: string) {
    await this.openOrderSummaryIfCollapsed();
    await expect(this.page.getByRole('row').filter({ hasText: title }).first()).toBeVisible();
  }

  /** Vérifie qu'un montant égal au total attendu est affiché, quel que soit son format (640,00 €, €495,95…). */
  async expectTotalVisible(expectedCents: number) {
    // Le total existe en double (résumé mobile replié + colonne desktop) : on ne lit que les prix affichés.
    const prices = this.page.getByText(/[€$£]\s*\d|\d\s*[€$£]/).filter({ visible: true });
    await expect.poll(
      async () => (await prices.allInnerTexts()).map(parsePriceToCents),
      { message: `Le total ${formatCents(expectedCents)} doit être affiché au checkout` },
    ).toContain(expectedCents);
  }

  async expectPaymentMethods(methods: RegExp[]) {
    for (const method of methods) {
      // Avec plusieurs moyens de paiement, chacun est un bouton radio ; s'il n'y en a qu'un, c'est un simple titre.
      const option = this.page.getByRole('radio', { name: method }).or(this.page.getByRole('heading', { name: method }));
      await expect(option.first(), `Moyen de paiement ${method}`).toBeAttached();
    }
  }

  async fillContactAndAddress(buyer: TestBuyer) {
    await this.page.getByRole('textbox', { name: /Adresse e-mail|Email/i }).fill(buyer.email);
    // Bloc Contact spécifique à Polène : civilité, prénom et nom obligatoires.
    const civility = this.page.getByRole('combobox', { name: /^(Titre|Title)$/i });
    if (await civility.count()) {
      await civility.selectOption({ label: buyer.civility });
      await this.page.getByRole('textbox', { name: /^(Prénom|First name)$/i }).first().fill(buyer.firstName);
      await this.page.getByRole('textbox', { name: /^(Nom de famille|Last name)$/i }).first().fill(buyer.lastName);
    }
    const delivery = this.page.locator('form').filter({ has: this.page.getByRole('heading', { name: /^(Livraison|Delivery)$/i }) }).first();
    await delivery.getByRole('textbox', { name: /^Prénom|^First name/i }).last().fill(buyer.firstName);
    await delivery.getByRole('textbox', { name: /^Nom$|^Last name/i }).last().fill(buyer.lastName);
    const address = this.page.getByRole('combobox', { name: /^Adresse$|^Address$/i });
    await address.fill(buyer.address);
    await address.press('Escape');
    await this.page.getByRole('textbox', { name: /Code postal|Postal code|ZIP/i }).fill(buyer.postalCode);
    await this.page.getByRole('textbox', { name: /^Ville$|^City$/i }).fill(buyer.city);
    const phone = this.page.getByRole('textbox', { name: /^Téléphone$|^Phone$/i });
    if (await phone.count()) await phone.fill(buyer.phone);
    // Les cases newsletter / SMS sont pré-cochées : on les décoche pour ne pas inscrire l'adresse de test.
    for (const optIn of await this.page.getByRole('checkbox', { name: /newsletter|SMS/i }).all()) {
      if (await optIn.isChecked()) await optIn.uncheck();
    }
  }

  async expectShippingMethodsOffered() {
    await expect(this.page.getByRole('heading', { name: /Mode d.expédition|Shipping method/i })).toBeVisible();
    // Une fois l'adresse saisie, Shopify affiche les modes d'expédition avec leur prix
    // (boutons radio s'il y en a plusieurs, simple bloc s'il n'y en a qu'un).
    const methods = this.page.getByRole('group', { name: /Choisissez un mode d.expédition|Choose a shipping method/i });
    await expect(methods, 'Au moins un mode d\'expédition doit être proposé').toBeVisible({ timeout: 20_000 });
    await expect(methods.getByText(/\d.*[€$£]|[€$£].*\d|Gratuit|Free/i).first()).toBeVisible();
  }

  async payWithCard(card: TestCard) {
    const cardRadio = this.page.getByRole('radio', { name: /Carte de crédit|Credit card/i });
    if (await cardRadio.count()) await cardRadio.first().check();
    // Les champs de carte sont dans des iframes sécurisées Shopify.
    await this.page.frameLocator('iframe[name^="card-fields-number"]').getByRole('textbox').fill(card.number);
    await this.page.frameLocator('iframe[name^="card-fields-expiry"]').getByRole('textbox').fill(card.expiry);
    await this.page.frameLocator('iframe[name^="card-fields-verification_value"]').getByRole('textbox').fill(card.cvv);
    const nameFrame = this.page.frameLocator('iframe[name^="card-fields-name"]');
    await nameFrame.getByRole('textbox').fill(card.name);
    await this.page.getByRole('button', { name: /^(Payer maintenant|Pay now|Complete order)$/i }).click();
  }

  /** Attend la page de confirmation et renvoie le numéro de confirmation affiché. */
  async expectOrderConfirmed(): Promise<string> {
    await this.page.waitForURL(/thank[-_]you|\/orders\//, { timeout: 60_000 });
    await expect(this.page.getByRole('heading', { name: /Merci|Thank you/i }).first()).toBeVisible();
    // Shopify affiche "En cours de traitement…" quelques secondes avant de finaliser la commande.
    await expect(this.page.getByText(/En cours de traitement|Processing/i)).toBeHidden({ timeout: 30_000 });
    const confirmation = this.page.getByText(/Confirmation (n°|#)\s*\w+/i).first();
    await expect(confirmation).toBeVisible();
    return ((await confirmation.innerText()).match(/(?:n°|#)\s*(\w+)/i)?.[1]) ?? '?';
  }
}
