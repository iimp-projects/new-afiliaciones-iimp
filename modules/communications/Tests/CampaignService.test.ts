import { describe, expect, it, vi } from "vitest";
import { EmailCampaignStatus } from "@prisma/client";
import { renderTemplate } from "../Services/TemplateRenderer";
import { CampaignService, CampaignServiceError } from "../Services/CampaignService";
import type { CampaignRepository } from "../Repositories/CampaignRepository";
import type { CampaignDetail } from "../Models/Campaign";

const ACTOR = { userId: 1, email: "admin@iimp.org.pe" };

function campaign(overrides: Partial<CampaignDetail> = {}): CampaignDetail {
  return {
    id: 1,
    name: "Encuesta Sostenibilidad 2026",
    subject: "Asunto de prueba",
    senderName: "IIMP",
    senderEmail: null,
    replyTo: null,
    htmlContent: "<p>Contenido</p>",
    textContent: "Contenido texto",
    status: EmailCampaignStatus.DRAFT,
    createdAt: "2026-09-29T00:00:00.000Z",
    updatedAt: "2026-09-29T00:00:00.000Z",
    createdBy: 1,
    createdByName: "Admin",
    recipientCount: 5,
    ...overrides,
  };
}

function makeRepository(): CampaignRepository {
  return {
    listCampaigns: vi.fn().mockResolvedValue([]),
    getCampaign: vi.fn(),
    createCampaign: vi.fn().mockResolvedValue({ id: 1 }),
    updateCampaign: vi.fn().mockResolvedValue(undefined),
    setStatus: vi.fn().mockResolvedValue(undefined),
    getSelectionData: vi.fn().mockResolvedValue({ lists: [], recipients: [] }),
    getCampaignRecipientIds: vi.fn().mockResolvedValue([]),
    getRecipientIdsByLists: vi.fn().mockResolvedValue([]),
    setCampaignRecipients: vi.fn().mockResolvedValue({ count: 0 }),
    getCampaignRecipientsForPreview: vi.fn().mockResolvedValue([]),
    writeAudit: vi.fn().mockResolvedValue(undefined),
  } as unknown as CampaignRepository;
}

describe("TemplateRenderer", () => {
  it("sustituye {{nombre}}", () => {
    expect(renderTemplate("Estimado(a) {{nombre}},", { name: "Juan" })).toBe("Estimado(a) Juan,");
  });

  it("sustituye {{empresa}}", () => {
    expect(renderTemplate("Empresa: {{empresa}}", { company: "Empresa A" })).toBe("Empresa: Empresa A");
  });

  it("fallback sin nombre (no produce 'Estimado(a) ,')", () => {
    expect(renderTemplate("Estimado(a) {{nombre}},", {})).toBe("Estimado(a),");
  });

  it("variable no permitida no se ejecuta", () => {
    expect(renderTemplate("Hola {{codigo}}", {})).toBe("Hola {{codigo}}");
  });

  it("sustituye {{cargo}} y {{email}}", () => {
    expect(renderTemplate("{{cargo}} - {{email}}", { position: "Gerente", email: "juan@empresa.com" })).toBe("Gerente - juan@empresa.com");
  });
});

describe("CampaignService", () => {
  it("crea campaña válida (inicia DRAFT vía repositorio)", async () => {
    const repository = makeRepository();
    const service = new CampaignService(repository);
    await service.createCampaign({ name: "Campaña", subject: "Asunto", htmlContent: "<p>Hola</p>" }, ACTOR);
    expect(repository.createCampaign).toHaveBeenCalledWith(expect.objectContaining({ name: "Campaña", subject: "Asunto" }), 1);
    expect(repository.writeAudit).toHaveBeenCalledWith(ACTOR, "CAMPAIGN_CREATED", 1, "Campaña");
  });

  it("rechaza crear campaña sin asunto", async () => {
    const service = new CampaignService(makeRepository());
    await expect(service.createCampaign({ name: "Campaña", subject: " ", htmlContent: "" }, ACTOR)).rejects.toThrow("asunto");
  });

  it("rechaza crear campaña con replyTo inválido", async () => {
    const repository = makeRepository();
    const service = new CampaignService(repository);
    await expect(service.createCampaign({ name: "Campaña", subject: "Asunto", replyTo: "no-es-correo", htmlContent: "<p>Hola</p>" }, ACTOR)).rejects.toMatchObject({ fields: ["replyTo"] });
    expect(repository.createCampaign).not.toHaveBeenCalled();
  });

  it("acepta crear campaña con replyTo válido", async () => {
    const repository = makeRepository();
    const service = new CampaignService(repository);
    await service.createCampaign({ name: "Campaña", subject: "Asunto", replyTo: "soporte@iimp.org.pe", htmlContent: "<p>Hola</p>" }, ACTOR);
    expect(repository.createCampaign).toHaveBeenCalled();
  });

  it("rechaza editar campaña con replyTo inválido", async () => {
    const repository = makeRepository();
    repository.getCampaign = vi.fn().mockResolvedValue(campaign());
    const service = new CampaignService(repository);
    await expect(service.updateCampaign(1, { name: "X", subject: "Y", replyTo: "invalido", htmlContent: "" }, ACTOR)).rejects.toMatchObject({ fields: ["replyTo"] });
    expect(repository.updateCampaign).not.toHaveBeenCalled();
  });

  it("campaña sin asunto no pasa a READY", async () => {
    const repository = makeRepository();
    repository.getCampaign = vi.fn().mockResolvedValue(campaign({ subject: "" }));
    const service = new CampaignService(repository);
    await expect(service.markReady(1, ACTOR)).rejects.toBeInstanceOf(CampaignServiceError);
    expect(repository.setStatus).not.toHaveBeenCalled();
  });

  it("campaña sin contenido no pasa a READY", async () => {
    const repository = makeRepository();
    repository.getCampaign = vi.fn().mockResolvedValue(campaign({ htmlContent: "", textContent: "" }));
    const service = new CampaignService(repository);
    await expect(service.markReady(1, ACTOR)).rejects.toBeInstanceOf(CampaignServiceError);
    expect(repository.setStatus).not.toHaveBeenCalled();
  });

  it("campaña sin destinatarios no pasa a READY", async () => {
    const repository = makeRepository();
    repository.getCampaign = vi.fn().mockResolvedValue(campaign({ recipientCount: 0 }));
    const service = new CampaignService(repository);
    await expect(service.markReady(1, ACTOR)).rejects.toBeInstanceOf(CampaignServiceError);
    expect(repository.setStatus).not.toHaveBeenCalled();
  });

  it("campaña válida pasa a READY", async () => {
    const repository = makeRepository();
    repository.getCampaign = vi.fn().mockResolvedValue(campaign());
    const service = new CampaignService(repository);
    await service.markReady(1, ACTOR);
    expect(repository.setStatus).toHaveBeenCalledWith(1, EmailCampaignStatus.READY);
  });

  it("mismo recipient en dos listas → una sola entrada (dedup)", async () => {
    const repository = makeRepository();
    repository.getCampaign = vi.fn().mockResolvedValue(campaign());
    repository.getRecipientIdsByLists = vi.fn().mockResolvedValue([15, 15, 16]);
    const service = new CampaignService(repository);
    await service.setRecipients(1, { listIds: [1, 2], recipientIds: [15, 17] }, ACTOR);
    expect(repository.setCampaignRecipients).toHaveBeenCalledWith(1, [15, 16, 17], ACTOR, "Encuesta Sostenibilidad 2026");
  });

  it("READY no permite editar contenido", async () => {
    const repository = makeRepository();
    repository.getCampaign = vi.fn().mockResolvedValue(campaign({ status: EmailCampaignStatus.READY }));
    const service = new CampaignService(repository);
    await expect(service.updateCampaign(1, { name: "X", subject: "Y", htmlContent: "" }, ACTOR)).rejects.toBeInstanceOf(CampaignServiceError);
  });

  it("READY no permite modificar destinatarios", async () => {
    const repository = makeRepository();
    repository.getCampaign = vi.fn().mockResolvedValue(campaign({ status: EmailCampaignStatus.READY }));
    const service = new CampaignService(repository);
    await expect(service.setRecipients(1, { listIds: [], recipientIds: [1] }, ACTOR)).rejects.toBeInstanceOf(CampaignServiceError);
  });

  it("volver a DRAFT desde READY permite editar", async () => {
    const repository = makeRepository();
    repository.getCampaign = vi.fn().mockResolvedValue(campaign({ status: EmailCampaignStatus.READY }));
    const service = new CampaignService(repository);
    await service.backToDraft(1, ACTOR);
    expect(repository.setStatus).toHaveBeenCalledWith(1, EmailCampaignStatus.DRAFT);
  });

  it("CANCELLED no permite editar", async () => {
    const repository = makeRepository();
    repository.getCampaign = vi.fn().mockResolvedValue(campaign({ status: EmailCampaignStatus.CANCELLED }));
    const service = new CampaignService(repository);
    await expect(service.updateCampaign(1, { name: "X", subject: "Y", htmlContent: "" }, ACTOR)).rejects.toBeInstanceOf(CampaignServiceError);
  });

  it("cancela una campaña DRAFT", async () => {
    const repository = makeRepository();
    repository.getCampaign = vi.fn().mockResolvedValue(campaign());
    const service = new CampaignService(repository);
    await service.cancel(1, ACTOR);
    expect(repository.setStatus).toHaveBeenCalledWith(1, EmailCampaignStatus.CANCELLED);
  });
});
