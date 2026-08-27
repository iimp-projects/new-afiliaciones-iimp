import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";

export class SmsService {
  private client: SNSClient;

  constructor() {
    // Reutilizamos las mismas credenciales de AWS que ya tienes para tu S3
    this.client = new SNSClient({
      region: process.env.AWS_DEFAULT_REGION!,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });
  }

  public async sendSms(phoneNumber: string, message: string): Promise<void> {
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

      await this.client.send(command);
      console.log(`[SmsService] SMS enviado exitosamente a: ${formattedPhone}`);
    } catch (error) {
      console.error("[SmsService] Error enviando SMS:", error);
      throw new Error("No se pudo enviar el mensaje de texto de verificación.");
    }
  }
}