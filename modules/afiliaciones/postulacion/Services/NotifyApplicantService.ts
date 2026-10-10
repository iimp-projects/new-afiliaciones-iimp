import { MailService } from "@/modules/shared/Services/MailService";
import { getAppBaseUrl } from "@/lib/config/env";
import { emailLayout } from "@/modules/shared/Email/EmailLayout";
import { emailCta, emailInfoBox } from "@/modules/shared/Email/EmailComponents";
import { escapeHtml } from "@/modules/shared/Email/EmailEscaping";
import { StatusChangeAttachmentService, type StatusChangeAttachmentRef, type ResolvedEmailAttachment } from "@/modules/afiliaciones/expedientes/Services/StatusChangeAttachmentService";
import type { ApplicationDraft } from "../Models/ApplicationDraft";
import type { Application } from "../Entities/Application";

const nameOf = (p: any) => p ? `${p.names || ""} ${p.fatherLastName || ""} ${p.motherLastName || ""}`.trim() || "Postulante" : "Postulante";
const consultationUrl = () => `${getAppBaseUrl()}/consulta`;
export class NotifyApplicantService {
  private readonly mailService = new MailService();
  async execute(application: Application, draft: ApplicationDraft, signedDeclarationBuffer?: Buffer) {
    const p = (draft as any)?.personalInformation; const to = application.email || p?.primaryEmail || p?.email || (draft as any)?.email; if (!to) return;
    const name = nameOf(p); const html = emailLayout({ category: "Estado de Postulación", title: "Confirmación de Solicitud", summary: "Tu solicitud fue registrada correctamente.", variant: "success", content: `<p>Estimado(a) <strong>${escapeHtml(name)}</strong>,</p><p>Confirmamos que su solicitud de incorporación como asociado al <strong>Instituto de Ingenieros de Minas del Perú (IIMP)</strong> ha sido registrada exitosamente.</p><p>Puede hacer seguimiento al estado de su trámite ingresando a nuestro portal con su tipo de documento, número de documento y correo registrado.</p>${emailCta("Consultar Estado de Solicitud", consultationUrl())}<p style="font-size:12px;color:#667085;text-align:center;">Adjunto a este correo encontrará su Declaración Jurada firmada registrada en el sistema.</p>` });
    await this.mailService.sendMail({ to, subject: "Confirmación de Solicitud - Postulación IIMP", html, attachments: signedDeclarationBuffer ? [{ filename: "Declaracion_Jurada_Firmada_IIMP.pdf", content: signedDeclarationBuffer, contentType: "application/pdf" }] : [] });
  }
  async notifyCorrectionReceived(application: Application, draft?: any) {
    const p = draft?.personalInformation; const to = application.email || p?.primaryEmail || p?.email; if (!to) return; const name = nameOf(p);
    const html = emailLayout({ category: "Estado de Postulación", title: "Subsanación de Solicitud Recibida", summary: "La información y documentación actualizada fueron recibidas.", variant: "info", content: `<p>Estimado(a) <strong>${escapeHtml(name)}</strong>,</p><p>Le confirmamos que la información y documentación corregida para su solicitud de incorporación al IIMP ha sido registrada exitosamente.</p>${emailInfoBox("Tu expediente ha pasado nuevamente a estado de <strong>evaluación</strong>. Por favor, permanece atento(a) a la respuesta institucional.", "info")}${emailCta("Consultar Estado de Solicitud", consultationUrl())}` });
    try { await this.mailService.sendMail({ to, subject: `IIMP | Subsanación recibida_ ${name}`, html }); } catch { /* notification remains non-blocking */ }
  }
  async notifyObservationCreated(applicationId: number, observationComment?: string, observedFieldPaths: string[] = [], attachment?: StatusChangeAttachmentRef) {
    const { prisma } = await import("@/lib/prisma"); const { OBSERVATION_FIELDS } = await import("@/modules/afiliaciones/observations/ObservationFields");
    const app = await prisma.membershipApplication.findUnique({ where: { id: applicationId }, include: { person: true } }); if (!app) return;
    const p = (app.draftData as any)?.personalInformation; const to = app.email || p?.primaryEmail || p?.email || (app.person as any)?.email; if (!to) return;
    const name = app.person ? `${app.person.firstName || ""} ${app.person.paternalLastName || ""}`.trim() || "Postulante" : nameOf(p);
    const fields = observedFieldPaths.map(path => OBSERVATION_FIELDS.find((f: any) => f.key === path)?.label || path);
    const details = `${observationComment ? `<p><strong>Motivo de la observación:</strong><br>${escapeHtml(observationComment)}</p>` : ""}${fields.length ? `<p><strong>Campos o documentos a corregir:</strong></p><ul>${fields.map((f: string) => `<li>${escapeHtml(f)}</li>`).join("")}</ul>` : ""}`;
    const html = emailLayout({ category: "Observación de Solicitud", title: "Tu solicitud requiere atención", summary: "Se han registrado observaciones en tu solicitud de afiliación.", variant: "warning", content: `<p>Estimado(a) <strong>${escapeHtml(name)}</strong>,</p><p>El equipo evaluador ha registrado observaciones que requieren su subsanación.</p>${emailInfoBox(details || "Revisa el detalle de las observaciones registradas en tu solicitud.", "warning")}<p><strong>Cuenta con un plazo de 5 días hábiles</strong> para ingresar al portal y subsanar las observaciones.</p>${emailCta("SUBSANAR OBSERVACIONES EN EL PORTAL", consultationUrl())}` });

    let attachments: ResolvedEmailAttachment[] = [];
    if (attachment?.attachmentUrl) {
      try {
        attachments = await new StatusChangeAttachmentService().resolve(attachment);
      } catch (error) {
        console.error("[NotifyObservation] No se pudo adjuntar la evidencia al correo:", error instanceof Error ? error.message : "error desconocido");
        return;
      }
    }

    try { await this.mailService.sendMail({ to, subject: `IIMP | Observaciones en Su Solicitud ${name}`, html, ...(attachments.length > 0 ? { attachments } : {}) }); } catch { /* notification remains non-blocking */ }
  }
}
