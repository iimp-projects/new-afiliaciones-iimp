import { paymentConfig } from "../Config/PaymentConfig";
import { PaymentSettingsResolver } from "../../../security/system-settings/Services/PaymentSettingsResolver";

export class PaymentAmountResolver {
  constructor(private readonly settings = new PaymentSettingsResolver()) {}

  async resolve(): Promise<{ amount: number; currency: "PEN" }> {
    const registrationPrice = await this.settings.getRegistrationPrice();
    return {
      amount: registrationPrice.amount.toNumber(),
      currency: paymentConfig.currency,
    };
  }
}
