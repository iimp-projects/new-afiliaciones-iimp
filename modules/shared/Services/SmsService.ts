import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import { getAwsRegion } from "@/lib/config/env";

export class SmsService {
  private client?: SNSClient;

  /**
   * El cliente se construye bajo demanda usando la cadena de credenciales por
   * defecto del AWS SDK (variables de entorno, shared config, ECS Task Role,
   * EC2 IMDS). No requiere AWS_ACCESS_KEY_ID ni AWS_SECRET_ACCESS_KEY.
   */
  private getClient(): SNSClient {
    if (!this.client) {
      this.client = new SNSClient({ region: getAwsRegion() });
    }
    return this.client;
  }

  public async sendSms(phoneNumber: string, message: string): Promise<void> {
    // La configuración se valida antes de la llamada de red; el error de
    // configuración se propaga explícitamente y no se enmascara.
    const client = this.getClient();
    try {
      // AWS SNS requiere que el número tenga el código de país (Ej: +51 para Perú)
      let formattedPhone = phoneNumber.trim();
      if (!formattedPhone.startsWith("+")) {
        formattedPhone = `+51${formattedPhone}`;
      }

      const command = new PublishCommand({
        PhoneNumber: formattedPhone,
        Message: message,
        MessageAttributes: {
          'AWS.SNS.SMS.SMSType': {
            DataType: 'String',
            StringValue: 'Transactional' // Fundamental para que llegue al instante
          },
          'AWS.SNS.SMS.SenderID': {
            DataType: 'String',
            StringValue: 'IIMP' // Puedes cambiarlo, pero no pases de 11 letras (sin espacios raros ni tildes)
          }
        }
      });

      await client.send(command);
      console.log(`[SmsService] SMS enviado exitosamente a: ${formattedPhone}`);
    } catch (error) {
      console.error("[SmsService] Error enviando SMS:", error);
      throw new Error("No se pudo enviar el mensaje de texto de verificación.");
    }
  }
}
