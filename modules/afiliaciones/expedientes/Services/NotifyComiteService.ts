import { prisma } from "@/lib/prisma";
import { MailService } from "@/modules/shared/Services/MailService";

export class NotifyComiteService {
    private readonly mailService = new MailService();

    async execute(applicationId: number): Promise<void> {
        try {
            // 1. Obtenemos la data fresca del expediente
            const fullApp = await prisma.membershipApplication.findUnique({
                where: { id: applicationId },
                include: { 
                    validations: { include: { department: true } }, 
                    approvals: true,
                    person: true 
                }
            });

            if (!fullApp) return;

            // 2. Extraemos el estado de las áreas
            const isStudent = fullApp.affiliateType === 'STUDENT';
            const logistica = fullApp.validations.find(v => v.department.code === 'LOGISTICA');
            const asociados = fullApp.validations.find(v => v.department.code === 'ASOCIADOS');
            const comite = fullApp.validations.find(v => v.department.code === 'COMITE');

            const logisticaOk = logistica?.status === 'APPROVED';
            const asociadosOk = asociados?.status === 'APPROVED';
            const avalesOk = isStudent || fullApp.approvals.filter(a => a.status === 'APPROVED').length >= 2;

            // 3. REGLA DE NEGOCIO: Si TODO está OK y el Comité AÚN no lo ha revisado
            if (logisticaOk && asociadosOk && avalesOk && comite?.status === 'PENDING') {
                
                // [!] Puedes usar variables de entorno para los correos del comité
                const comiteEmails = process.env.COMITE_EMAILS || "comite1@iimp.org.pe, comite2@iimp.org.pe"; 
                const postulanteNombre = `${fullApp.person?.firstName} ${fullApp.person?.paternalLastName}`;

                // 4. Enviamos el correo
                await this.mailService.sendMail({
                    to: comiteEmails,
                    subject: "Nuevo Expediente Listo para Evaluación Final - IIMP",
                    html: `
                        <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
                            <h2 style="color: #7f561e;">Expediente Listo para el Comité</h2>
                            <p>Estimado Comité Evaluador,</p>
                            <p>El expediente de <strong>${postulanteNombre}</strong> (DNI: ${fullApp.documentNumber}) ha sido aprobado exitosamente por las áreas de Logística, Atención al Asociado y cuenta con los avales requeridos en regla.</p>
                            <p>Ya se encuentra visible y disponible en su bandeja de entrada de la Intranet para su revisión y conformidad final.</p>
                            <br/>
                            <p>Saludos cordiales,<br/>Sistema de Afiliaciones IIMP</p>
                        </div>
                    `
                });
            }
        } catch (error) {
            console.error("[NotifyComiteService] Error al notificar al comité:", error);
        }
    }
}