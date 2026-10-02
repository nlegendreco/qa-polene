import { expect, type Page, type Response } from '@playwright/test';
import { formatCents, parsePriceToCents } from '../price';

export interface TestBuyer {
  email: string;
  /** Réponse au questionnaire « Comment avez-vous connu Polène Paris ? » de la page de confirmation. */
  acquisitionSource: string;
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

  /** Version visible du questionnaire (la page en contient deux : desktop et mobile). */
  get acquisitionSurvey() {
    return this.page.locator('form, section, div')
      .filter({ hasText: /Comment avez-vous connu Polène|How did you hear about/i })
      .filter({ has: this.page.getByRole('radio').filter({ visible: true }) })
      .filter({ visible: true })
      .last();
  }

  /**
   * Répond au questionnaire de la page de confirmation.
   * L'ordre des réponses change à chaque affichage : on choisit par libellé.
   */
  async answerAcquisitionSurvey(source: string) {
    const survey = this.acquisitionSurvey;
    await expect(survey, 'Le questionnaire « Comment avez-vous connu Polène Paris ? » doit être affiché').toBeVisible({ timeout: 20_000 });
    // Le questionnaire existe en double dans la page (version desktop + version mobile masquée), avec les mêmes
    // identifiants : cliquer sur le libellé coche le bouton de la version masquée. On coche donc directement
    // le bouton radio de la version visible.
    const escaped = source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const option = survey.locator('div, label').filter({ has: this.page.getByRole('radio') })
      .filter({ hasText: new RegExp(`^\\s*${escaped}\\s*$`, 'i') }).last();
    const radio = option.getByRole('radio').filter({ visible: true });
    await radio.check();
    await expect(radio, `La réponse « ${source} » doit être cochée`).toBeChecked();

    // Preuve d'envoi : l'extension « source-survey » poste la réponse sur /api/checkout/order-source
    // (serveur de l'app checkout Polène). L'extension enregistre le choix de façon asynchrone :
    // si le clic sur « Envoyer » arrive trop tôt, rien ne part. On renvoie alors, jusqu'à 3 fois.
    const submit = survey.getByRole('button', { name: /^(Envoyer|Submit|Send)$/i });
    let response: Response | null = null;
    for (let attempt = 1; attempt <= 3 && !response; attempt++) {
      const saved = this.page.context().waitForEvent('response', {
        predicate: r => r.url().includes('/api/checkout/order-source'),
        timeout: 5_000,
      }).catch(() => null);
      if (await submit.isVisible()) await submit.click();
      response = await saved;
    }
    expect(response, 'Aucune réponse du questionnaire n\'a été envoyée au serveur (requête /api/checkout/order-source absente après 3 essais)').not.toBeNull();
    expect(response!.ok(), `L'enregistrement de la réponse a échoué (statut HTTP ${response!.status()})`).toBe(true);
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
