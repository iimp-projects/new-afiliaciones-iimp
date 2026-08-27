export class WhatsAppService {
  // Estos datos te los dará Meta cuando crees tu app de WhatsApp Business
  private readonly apiUrl = process.env.WHATSAPP_API_URL || 'https://graph.facebook.com/v17.0/TU_PHONE_NUMBER_ID/messages';
  private readonly token = process.env.WHATSAPP_API_TOKEN || 'TU_TOKEN_DE_META';

  public async sendWhatsApp(phoneNumber: string, code: string): Promise<void> {
    try {
      // Limpiamos el número (WhatsApp API requiere el código de país sin el '+')
      let formattedPhone = phoneNumber.replace(/\D/g, '').trim();
      if (!formattedPhone.startsWith("51")) {
        formattedPhone = `51${formattedPhone}`; // Asumimos Perú (+51) por defecto
      }

      const payload = {
        messaging_product: "whatsapp",
        to: formattedPhone,
        type: "template",
        template: {
          name: "otp_verification", // El nombre de la plantilla aprobada en Meta
          language: { code: "es" },
          components: [
            {
              type: "body",
              parameters: [
                { type: "text", text: code } // Inyectamos el código en la plantilla
              ]
            },
            {
              type: "button",
              sub_type: "url",
              index: "0",
              parameters: [
                { type: "text", text: code } // Para el botón de "Copiar código" si lo configuras
              ]
            }
          ]
        }
      };

      // Si aún no tienes la API de Meta configurada, esto solo simulará el envío
      if (this.token === 'TU_TOKEN_DE_META') {
        console.log(`[WhatsAppService SIMULACRO] Código ${code} enviado a WhatsApp: +${formattedPhone}`);
        return;
      }

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("[WhatsAppService] Error de Meta:", errorData);
        throw new Error("Error en la API de WhatsApp");
      }

      console.log(`[WhatsAppService] WhatsApp enviado exitosamente a: +${formattedPhone}`);
    } catch (error) {
      console.error("[WhatsAppService] Falló el envío:", error);
    }
  }
}