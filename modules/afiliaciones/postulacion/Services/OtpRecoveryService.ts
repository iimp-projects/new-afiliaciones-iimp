import { prisma } from "@/lib/prisma";
import { MailService } from "@/modules/shared/Services/MailService";

export class OtpRecoveryService {
  private readonly mailService = new MailService();

  async generateAndSendOtp(trackingCode: string): Promise<void> {
    const app = await prisma.membershipApplication.findUnique({
      where: { trackingCode },
    });
    if (!app) throw new Error("Postulación no encontrada.");

    // Generar código numérico de 6 dígitos aleatorio
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // Expira en 15 minutos

    await prisma.verificationCode.create({
      data: {
        applicationId: app.id,
        purpose: "RESUME_APPLICATION",
        channel: "EMAIL",
        destination: app.email,
        code,
        expiresAt,
      },
    });

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://tudominio.com";
    // const logoUrl = `${baseUrl}/images/logo-iimp.png`;
    const logoUrl = "https://iimp.org.pe/images/iimp_logocolor.png";
    // Plantilla HTML Profesional para el correo
    const htmlTemplate = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; background-color: #f9f9f9; font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f9f9f9; padding: 40px 15px;">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" max-width="520px" border="0" cellspacing="0" cellpadding="0" style="max-width: 520px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 8px 24px rgba(127, 86, 30, 0.08); border: 1px solid #d4c4b5;">
                
                <!-- HEADER CON DEGRADADO DORADO INSTITUCIONAL -->
                <tr>
                  <td align="center" style="background: #7f561e; background: linear-gradient(135deg, #7f561e 0%, #c39254 100%); padding: 32px 20px; text-align: center;">
                    <img src="${logoUrl}" alt="IIMP Logo" width="160" style="display: block; max-width: 100%; height: auto; margin: 0 auto; border: 0; color: #ffffff; font-size: 20px; font-weight: bold;" />
                  </td>
                </tr>

                <!-- CUERPO PRINCIPAL -->
                <tr>
                  <td style="padding: 40px 35px; text-align: center; background-color: #ffffff;">
                    <h2 style="margin: 0 0 12px 0; color: #1a1c1c; font-size: 22px; font-weight: 700;">
                      Código de Verificación
                    </h2>
                    <p style="margin: 0 0 30px 0; color: #504539; font-size: 15px; line-height: 1.6;">
                      Has solicitado continuar con tu proceso de postulación. Ingresa el siguiente código de seguridad en la plataforma:
                    </p>

                    <!-- CAJA DEL CÓDIGO CON BORDES PUNTEADOS -->
                    <div style="margin: 0 auto; padding: 18px 36px; background-color: #FCFAF6; border: 2px dashed #c39254; border-radius: 16px; display: inline-block;">
                      <span style="font-size: 38px; font-weight: 800; letter-spacing: 12px; color: #7f561e; margin-left: 12px; font-family: Arial, sans-serif; display: inline-block;">
                        ${code}
                      </span>
                    </div>

                    <p style="margin: 30px 0 0 0; color: #827568; font-size: 13px;">
                      Este código expirará en <strong style="color: #7f561e;">15 minutos</strong>.
                    </p>
                  </td>
                </tr>

                <!-- FOOTER CON DEGRADADO DORADO INSTITUCIONAL -->
                <tr>
                  <td align="center" style="background: #7f561e; background: linear-gradient(135deg, #7f561e 0%, #c39254 100%); padding: 24px 30px; text-align: center; color: #ffffff;">
                    <p style="margin: 0 0 8px 0; font-size: 12px; opacity: 0.95; line-height: 1.5;">
                      Si no realizaste esta solicitud, puedes ignorar este correo de forma segura.
                    </p>
                    <p style="margin: 0; font-size: 12px; font-weight: 600; letter-spacing: 0.5px;">
                      &copy; ${new Date().getFullYear()} Instituto de Ingenieros de Minas del Perú
                    </p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;
    // Despachamos el correo real
    await this.mailService.sendMail({
      to: app.email,
      subject: "Código de Verificación - Postulación IIMP",
      html: htmlTemplate,
    });
  }

  async verifyOtp(trackingCode: string, code: string): Promise<boolean> {
    const app = await prisma.membershipApplication.findUnique({
      where: { trackingCode },
    });
    if (!app) throw new Error("Postulación no encontrada.");

    // Buscamos el último código generado para esta solicitud
    const activeOtp = await prisma.verificationCode.findFirst({
      where: {
        applicationId: app.id,
        purpose: "RESUME_APPLICATION",
        verifiedAt: null,
      },
      orderBy: { createdAt: "desc" },
    });

    if (!activeOtp) throw new Error("No hay códigos pendientes solicitados.");
    if (activeOtp.expiresAt < new Date())
      throw new Error(
        "El código de seguridad ha expirado. Solicite uno nuevo.",
      );
    if (activeOtp.attempts >= 3)
      throw new Error(
        "Demasiados intentos fallidos. Por seguridad, solicite un nuevo código.",
      );

    if (activeOtp.code !== code) {
      await prisma.verificationCode.update({
        where: { id: activeOtp.id },
        data: { attempts: { increment: 1 } },
      });
      throw new Error("Código incorrecto.");
    }

    // Marcamos el código como verificado/usado
    await prisma.verificationCode.update({
      where: { id: activeOtp.id },
      data: { verifiedAt: new Date() },
    });

    return true;
  }
}
