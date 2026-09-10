import { paymentConfig } from "../Config/PaymentConfig";
import { PaymentSettingsResolver } from "../../../security/system-settings/Services/PaymentSettingsResolver";
import { Prisma } from "@prisma/client";
import { SystemSettingsError } from "../../../security/system-settings/Services/SystemSettingsService";

export class PaymentAmountResolver {
  constructor(private readonly settings = new PaymentSettingsResolver()) {}

  async resolve(): Promise<{ registrationAmount: number; membershipFeeAmount: number; totalAmount: number; currency: "PEN" }> {
    const registrationPrice = await this.settings.getRegistrationPrice();
    const monthlyFee = await this.settings.getMonthlyFee();
    if (!monthlyFee || !(monthlyFee.value instanceof Prisma.Decimal) || monthlyFee.value.isNegative()) throw new SystemSettingsError("No existe una cuota de afiliación vigente válida configurada.", 503);
    const registrationAmount = registrationPrice.amount.toNumber();
    const membershipFeeAmount = monthlyFee.value.toNumber();
    return {
      registrationAmount,
      membershipFeeAmount,
      totalAmount: registrationAmount + membershipFeeAmount,
      currency: paymentConfig.currency,
    };
  }
}
