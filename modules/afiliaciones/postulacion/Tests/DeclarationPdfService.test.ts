import { describe, expect, it } from "vitest";
import { DeclarationPdfService } from "../Services/DeclarationPdfService";

const service = new DeclarationPdfService();

const personal = {
  names: "Ana",
  fatherLastName: "Pérez",
  motherLastName: "López",
  documentType: "DNI",
  documentNumber: "12345678",
  birthDate: "10/05/1999",
  birthPlace: "Lima",
  address: "Av. Siempre Viva 123",
  resolvedCountry: "PERÚ",
  resolvedDepartment: "Lima",
  resolvedProvince: "Lima",
  resolvedDistrict: "Miraflores",
  primaryEmail: "ana@example.com",
  phone: "999111222",
  landline: "",
  resolvedPhoto: null,
};

const buildBody = (overrides: {
  academic?: Record<string, unknown>;
  categoria?: string;
  employmentStatus?: string;
  isStudent?: boolean;
}) => {
  return (service as any).buildBodyTemplate(
    personal,
    overrides.academic ?? {},
    {},
    {},
    {},
    "01/01/2026",
    overrides.categoria ?? "STUDENT",
    overrides.employmentStatus ?? "NOT_WORKING",
    overrides.isStudent ?? true,
  ) as string;
};

const buildHeader = (isStudent: boolean) =>
  (service as any).buildHeaderTemplate("data:image/png;base64,logo", "data:image/png;base64,qr", "01/01/2026", "10:00", "EXP-1234", isStudent) as string;

describe("DeclarationPdfService — ficha de ESTUDIANTE", () => {
  const studentAcademic = {
    resolvedInstitution: "Universidad Nacional de Ingeniería",
    admissionYear: 2020,
    graduationYear: undefined,
    degreeTitle: "",
    specialty: "Ingeniería de Minas",
    sectorExperience: "",
    cycle: 7,
  };

  it("muestra el título SOLICITUD DE ASOCIADO ESTUDIANTE", () => {
    const header = buildHeader(true);
    expect(header).toContain("SOLICITUD DE ASOCIADO ESTUDIANTE");
    expect(header).not.toContain("SOLICITUD DE ASOCIADO</h1>");
  });

  it("muestra la etiqueta UNIVERSIDAD y no UNIVERSIDAD / INSTITUTO", () => {
    const body = buildBody({ academic: studentAcademic });
    expect(body).toContain("Universidad");
    expect(body).not.toContain("Universidad / Instituto");
  });

  it("muestra CICLO y renderiza el valor real del ciclo", () => {
    const body = buildBody({ academic: studentAcademic });
    expect(body).toContain("Ciclo");
    expect(body).toContain('<div class="value">7</div>');
  });

  it("renderiza un ciclo distinto correctamente", () => {
    const body = buildBody({ academic: { ...studentAcademic, cycle: 9 } });
    expect(body).toContain('<div class="value">9</div>');
  });

  it("NO muestra TÍTULO / DIPLOMA, AÑO DE EGRESO ni TIEMPO EN EL SECTOR", () => {
    const body = buildBody({ academic: studentAcademic });
    expect(body).not.toContain("Título o Diploma");
    expect(body).not.toContain("Año de Egreso");
    expect(body).not.toContain("Tiempo en el Sector");
  });

  it("NO muestra LUGAR DE NACIMIENTO", () => {
    const body = buildBody({ academic: studentAcademic });
    expect(body).not.toContain("Lugar de Nacimiento");
  });

  it("NO muestra las secciones laboral ni de avales", () => {
    const body = buildBody({ academic: studentAcademic });
    expect(body).not.toContain("Avales y Referencias");
  });
});

describe("DeclarationPdfService — ficha de ASOCIADO ACTIVO (sin regresión)", () => {
  const activeAcademic = {
    resolvedInstitution: "Universidad Nacional de Ingeniería",
    admissionYear: 2015,
    graduationYear: 2020,
    degreeTitle: "Ingeniero de Minas",
    specialty: "Ingeniería de Minas",
    sectorExperience: "5 años",
  };

  it("mantiene el título SOLICITUD DE ASOCIADO", () => {
    const header = buildHeader(false);
    expect(header).toContain("SOLICITUD DE ASOCIADO</h1>");
    expect(header).not.toContain("SOLICITUD DE ASOCIADO ESTUDIANTE");
  });

  it("conserva Universidad / Instituto, Título o Diploma, Año de Egreso y Tiempo en el Sector", () => {
    const body = buildBody({ academic: activeAcademic, categoria: "ACTIVE", employmentStatus: "EMPLOYED", isStudent: false });
    expect(body).toContain("Universidad / Instituto");
    expect(body).toContain("Título o Diploma");
    expect(body).toContain("Año de Egreso");
    expect(body).toContain("Tiempo en el Sector");
    expect(body).toContain("Lugar de Nacimiento");
  });

  it("NO muestra la etiqueta CICLO", () => {
    const body = buildBody({ academic: activeAcademic, categoria: "ACTIVE", employmentStatus: "EMPLOYED", isStudent: false });
    expect(body).not.toContain("Ciclo");
  });
});
