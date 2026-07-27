import puppeteer from "puppeteer";
import QRCode from "qrcode";
import type { ApplicationDraft } from "../Models/ApplicationDraft";
import { prisma } from "@/lib/prisma";
import { S3StorageService } from "@/modules/shared/Services/S3StorageService";

export class DeclarationPdfService {
  /**
   * Función auxiliar para convertir una URL de imagen a Base64
   * Esto garantiza que Puppeteer siempre renderice el logo y la foto sin fallos de red.
   */
  private async fetchImageToBase64(url: string): Promise<string | null> {
    if (!url) return null;
    try {
      const response = await fetch(url);
      if (!response.ok) return null;
      const buffer = await response.arrayBuffer();
      const base64 = Buffer.from(buffer).toString("base64");
      const mimeType = response.headers.get("content-type") || "image/png";
      return `data:${mimeType};base64,${base64}`;
    } catch (error) {
      console.error("Error convirtiendo imagen a Base64:", error);
      return null;
    }
  }

  /**
   * Genera el buffer del PDF basado en el borrador de la postulación
   */
  public async generate(draft: ApplicationDraft): Promise<Uint8Array> {
    const personal = draft.personalInformation || ({} as any);
    const academic = draft.academicStudies?.[0] || ({} as any);
    const employment = draft.employmentInformation || ({} as any);

    // Extracción correcta de los avales
    const endorsements = draft.endorsements || ({} as any);
    const aval1 = endorsements.firstEndorsement || {};
    const aval2 = endorsements.secondEndorsement || {};

    // ==========================================
    // 1. TRADUCCIÓN DE IDs A NOMBRES CON PRISMA
    // ==========================================
    let countryName = "PERÚ";
    let departmentName = "----------------";
    let provinceName = "----------------";
    let districtName = "----------------";
    let universityName = academic.otherInstitution || "----------------";

    if (personal.countryId) {
      const country = await prisma.country.findUnique({
        where: { id: Number(personal.countryId) },
      });
      if (country) countryName = country.name;
    }
    if (personal.departmentId) {
      const dept = await prisma.department.findUnique({
        where: { id: Number(personal.departmentId) },
      });
      if (dept) departmentName = dept.name;
    }
    if (personal.provinceId) {
      const prov = await prisma.province.findUnique({
        where: { id: Number(personal.provinceId) },
      });
      if (prov) provinceName = prov.name;
    }
    if (personal.districtId) {
      const dist = await prisma.district.findUnique({
        where: { id: Number(personal.districtId) },
      });
      if (dist) districtName = dist.name;
    }
    if (academic.institutionId && academic.institutionId !== 0) {
      const uni = await prisma.university.findUnique({
        where: { id: Number(academic.institutionId) },
      });
      if (uni) universityName = uni.name;
    }

    personal.resolvedCountry = countryName;
    personal.resolvedDepartment = departmentName;
    personal.resolvedProvince = provinceName;
    personal.resolvedDistrict = districtName;
    academic.resolvedInstitution = universityName;

    // ==========================================
    // 2. CONVERSIÓN DE IMÁGENES A BASE64 Y S3
    // ==========================================
    const logoUrl = "https://iimp.org.pe/images/iimp_logocolor.png";
    const logoBase64 = (await this.fetchImageToBase64(logoUrl)) || logoUrl;

    const photoRawUrl = personal.photo?.url || personal.photoUrl;
    let photoBase64 = null;

    if (photoRawUrl) {
      try {
        const s3Service = new S3StorageService();
        const presignedUrl = await s3Service.getPresignedUrl(photoRawUrl);
        photoBase64 = await this.fetchImageToBase64(presignedUrl);
      } catch (err) {
        console.error("Error obteniendo URL firmada de S3:", err);
      }

      if (!photoBase64) {
        photoBase64 = await this.fetchImageToBase64(photoRawUrl);
      }
    }
    personal.resolvedPhoto = photoBase64;

    // ==========================================
    // 3. DATOS GLOBALES Y QR
    // ==========================================
    const trackingCode = (draft as any).trackingCode || "demo";
    const validationUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://iimp.org.pe"}/verificar/${trackingCode}`;
    const fechaActual = new Date().toLocaleDateString("es-PE");
    const horaActual = new Date().toLocaleTimeString("es-PE", {
      hour: "2-digit",
      minute: "2-digit",
    });
    const codigoExpediente = `EXP-${Math.floor(1000 + Math.random() * 9000)}`;
    const categoria =
      (draft as any).category || draft.membershipType || "ASOCIADO ACTIVO";

    const qrCodeDataUrl = await QRCode.toDataURL(validationUrl, {
      errorCorrectionLevel: "H",
      margin: 1,
      color: { dark: "#1a1c1c", light: "#ffffff" },
    });

    // ==========================================
    // 4. CONSTRUCCIÓN DE TEMPLATES
    // ==========================================
    const headerHtml = this.buildHeaderTemplate(
      logoBase64,
      qrCodeDataUrl,
      fechaActual,
      horaActual,
      codigoExpediente
    );
    const footerHtml = this.buildFooterTemplate();
    const bodyHtml = this.buildBodyTemplate(
      personal,
      academic,
      employment,
      aval1,
      aval2,
      fechaActual,
      categoria
    );

    // ==========================================
    // 5. GENERACIÓN DEL PDF CON PUPPETEER
    // ==========================================
    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();

    await page.setContent(bodyHtml, { waitUntil: "load" });

    const pdfUint8Array = await page.pdf({
      format: "A4",
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: headerHtml,
      footerTemplate: footerHtml,
      // Márgenes ajustados: 35mm arriba asegura que el header entre perfecto y el body inicie justo debajo
      margin: {
        top: "35mm",
        bottom: "35mm",
        left: "15mm",
        right: "15mm",
      },
    });

    await browser.close();
    return pdfUint8Array;
  }

  /**
   * TEMPLATE DEL ENCABEZADO (Solo logos y datos, SIN etiqueta de categoría)
   */
  private buildHeaderTemplate(
    logoBase64: string,
    qrCodeDataUrl: string,
    fechaActual: string,
    horaActual: string,
    codigoExpediente: string
  ): string {
    return `
      <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; width: 100%; padding: 0 15mm; padding-top: 5mm; box-sizing: border-box; display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #7f561e; padding-bottom: 10px; background-color: white;">
        
        <div style="width: 25%;">
          <img src="${logoBase64}" style="width: 130px; height: auto;" />
        </div>
        
        <div style="width: 50%; text-align: center;">
          <h1 style="margin: 0; font-size: 15pt; font-weight: 900; letter-spacing: 0.5px; color: #1a1c1c;">SOLICITUD DE ASOCIADO</h1>
          <div style="font-size: 8.5pt; color: #7f561e; font-weight: bold; letter-spacing: 1.5px; text-transform: uppercase; margin-top: 3px;">Registro Oficial Institucional</div>
        </div>
        
        <div style="width: 25%; display: flex; gap: 10px; align-items: center; justify-content: flex-end;">
          <div style="font-size: 6.5pt; color: #504539; line-height: 1.4; text-align: right;">
            <strong style="color: #1a1c1c;">FECHA:</strong> ${fechaActual}<br>
            <strong style="color: #1a1c1c;">HORA:</strong> ${horaActual}<br>
            <strong style="color: #1a1c1c;">CÓDIGO:</strong> ${codigoExpediente}<br>
            <strong style="color: #1a1c1c;">ESTADO:</strong> <span style="color: #827568;">EN EVALUACIÓN</span>
          </div>
          <img src="${qrCodeDataUrl}" style="width: 55px; height: 55px; border: 1px solid #e4e2e0; padding: 2px; border-radius: 4px;" />
        </div>
      </div>
    `;
  }

  /**
   * TEMPLATE DEL PIE DE PÁGINA
   */
  private buildFooterTemplate(): string {
    return `
      <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; width: 100%; padding: 0 15mm; box-sizing: border-box; margin-bottom: 15mm; background-color: white;">
        <div style="border-top: 1px solid #dadada; padding-top: 10px; font-size: 6.5pt; color: #5f5e5d; text-align: justify; line-height: 1.5; display: flex; justify-content: space-between; gap: 20px;">
          <div style="flex-grow: 1;">
            <strong style="color: #1a1c1c;">SISTEMA INTEGRADO DE REGISTROS - IIMP.</strong> Documento generado electrónicamente. La información contenida en este expediente está protegida bajo la Ley de Protección de Datos Personales (Ley N° 29733) y tiene carácter estrictamente confidencial. La autenticidad de los datos puede ser verificada escaneando el código QR ubicado en el margen superior derecho de este documento.
          </div>
          <div style="white-space: nowrap; font-weight: bold; padding-top: 2px;">
            Página <span class="pageNumber"></span> de <span class="totalPages"></span>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * TEMPLATE DEL CUERPO DEL DOCUMENTO
   */
  private buildBodyTemplate(
    personal: any,
    academic: any,
    employment: any,
    aval1: any,
    aval2: any,
    fechaActual: string,
    categoria: string
  ): string {
    const nombres = personal.names || "";
    const apellidos = `${personal.fatherLastName || ""} ${personal.motherLastName || ""}`.trim();
    const documentType = personal.documentType || "DNI";

    return `<!DOCTYPE html>
  <html lang="es">
  <head>
    <meta charset="UTF-8">
    <style>
      body { 
        font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; 
        color: #1a1c1c; 
        font-size: 8.5pt; 
        background-color: #ffffff;
        margin: 0;
        padding: 0;
      }

      /* LA PESTAÑA SUPERIOR ESTÁ AQUÍ EN EL BODY PARA NO DESAPARECER */
      .categoria-badge {
        background-color: #7f561e;
        color: white;
        display: inline-block;
        padding: 6px 18px;
        border-radius: 0 0 6px 6px;
        font-weight: bold;
        font-size: 9pt;
        letter-spacing: 0.5px;
        margin-top: -1px; /* Ajuste sutil para pegar al header */
        margin-bottom: 25px;
      }

      .section {
        margin-bottom: 25px;
        page-break-inside: avoid;
      }
      .section-title {
        font-size: 11pt;
        font-weight: 800;
        color: #7f561e;
        text-transform: uppercase;
        border-bottom: 1px solid #dadada;
        padding-bottom: 6px;
        margin-bottom: 15px;
      }
      
      /* CONTENEDOR TIPO TARJETA CLARA */
      .data-container {
        border: 1px solid #eaeaea;
        background-color: #fdfdfd;
        border-radius: 8px;
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      
      .row { display: flex; width: 100%; gap: 20px; }
      .col { display: flex; flex-direction: column; }
      
      .w-25 { width: 25%; }
      .w-33 { width: 33.333%; }
      .w-50 { width: 50%; }
      .w-100 { width: 100%; }
      
      .label {
        font-size: 6.5pt;
        color: #827568;
        text-transform: uppercase;
        font-weight: 700;
        margin-bottom: 3px;
        letter-spacing: 0.5px;
      }
      .value {
        font-size: 8.5pt;
        color: #1a1c1c;
        font-weight: 500;
        border-bottom: 1px solid #e0e0e0; 
        padding-bottom: 4px;
        min-height: 14px;
        word-wrap: break-word;
      }

      .personal-layout { display: flex; gap: 25px; }
      .personal-data { flex-grow: 1; }
      
      .photo-box {
        width: 35mm;
        height: 45mm;
        background-color: #f7f7f7;
        border: 2px dashed #d4c4b5;
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        flex-shrink: 0;
      }
      .photo-box img { width: 100%; height: 100%; object-fit: cover; }
      .photo-placeholder { font-size: 6.5pt; color: #827568; text-align: center; line-height: 1.5; padding: 5px; }

      /* =========================================
         ESTILOS CORREGIDOS DECLARACIÓN JURADA 
         ========================================= */
      .declaration-page {
        page-break-before: always;
        padding: 15px 40px; /* MÁS MARGEN LATERAL E INTERNO */
      }
      .declaration-title {
        font-size: 13pt;
        font-weight: 900;
        color: #1a1c1c;
        text-align: center;
        margin-bottom: 25px;
        text-decoration: underline;
        text-underline-offset: 4px;
      }
      .declaration-content p {
        font-size: 8.5pt; /* LETRA MÁS PEQUEÑA */
        line-height: 1.35; /* MENOS ESPACIO ENTRE LÍNEAS */
        color: #1a1c1c;
        text-align: justify;
        margin-bottom: 10px;
      }
      .declaration-list {
        font-size: 8.5pt; /* LETRA MÁS PEQUEÑA */
        line-height: 1.35; /* MENOS ESPACIO ENTRE LÍNEAS */
        color: #1a1c1c;
        text-align: justify;
        margin-top: 10px;
        margin-bottom: 20px;
        padding-left: 25px;
      }
      .declaration-list li {
        margin-bottom: 6px; /* MENOS ESPACIO ENTRE ITEMS */
      }
      .declaration-date {
        text-align: right;
        margin-top: 30px;
        font-size: 8.5pt;
        color: #1a1c1c;
      }
      .signature-box {
        margin-top: 60px;
        display: flex;
        flex-direction: column;
        align-items: center;
      }
      .signature-line {
        width: 300px;
        border-top: 1px solid #1a1c1c;
        margin-bottom: 8px;
      }
      .signature-info {
        font-size: 8.5pt;
        color: #1a1c1c;
        text-align: center;
        line-height: 1.4;
      }
    </style>
  </head>
  <body>

    <!-- CATEGORÍA ESTÁ DE REGRESO AQUÍ -->
    <div class="categoria-badge">
      CATEGORÍA SOLICITADA: ${categoria === 'ACTIVE' ? 'ASOCIADO ACTIVO' : categoria === 'STUDENT' ? 'ASOCIADO ESTUDIANTE' : categoria.toUpperCase()}
    </div>

    <!-- SECCIÓN 1: DATOS PERSONALES Y FOTO -->
    <div class="section">
      <div class="section-title">1. Datos Personales</div>
      
      <div class="personal-layout">
        <div class="personal-data">
          <div class="data-container">
            
            <div class="row">
              <div class="col w-50">
                <div class="label">Nombres</div>
                <div class="value">${nombres || "----------------"}</div>
              </div>
              <div class="col w-50">
                <div class="label">Apellidos</div>
                <div class="value">${apellidos || "----------------"}</div>
              </div>
            </div>

            <div class="row">
              <div class="col w-33">
                <div class="label">DOCUMENTO (${documentType})</div>
                <div class="value">${personal.documentNumber || "----------------"}</div>
              </div>
              <div class="col w-33">
                <div class="label">Fecha de Nacimiento</div>
                <div class="value">${personal.birthDate || "----------------"}</div>
              </div>
              <div class="col w-33">
                <div class="label">Lugar de Nacimiento</div>
                <div class="value">${personal.birthPlace || "----------------"}</div>
              </div>
            </div>

            <div class="row">
              <div class="col w-100">
                <div class="label">Dirección Completa</div>
                <div class="value">${personal.address || "----------------"}</div>
              </div>
            </div>

            <div class="row">
              <div class="col w-25">
                <div class="label">País</div>
                <div class="value">${personal.resolvedCountry}</div>
              </div>
              <div class="col w-25">
                <div class="label">Departamento</div>
                <div class="value">${personal.resolvedDepartment}</div>
              </div>
              <div class="col w-25">
                <div class="label">Provincia</div>
                <div class="value">${personal.resolvedProvince}</div>
              </div>
              <div class="col w-25">
                <div class="label">Distrito</div>
                <div class="value">${personal.resolvedDistrict}</div>
              </div>
            </div>

            <div class="row">
              <div class="col w-33">
                <div class="label">Correo Electrónico</div>
                <div class="value">${personal.primaryEmail || "----------------"}</div>
              </div>
              <div class="col w-33">
                <div class="label">Celular</div>
                <div class="value">${personal.phone || "----------------"}</div>
              </div>
              <div class="col w-33">
                <div class="label">Teléfono Fijo</div>
                <div class="value">${personal.landline || "----------------"}</div>
              </div>
            </div>

          </div>
        </div>
        
        <div class="photo-box">
          ${
            personal.resolvedPhoto
              ? `<img src="${personal.resolvedPhoto}" alt="Foto Postulante" />`
              : `<div class="photo-placeholder">FOTOGRAFÍA<br>TAMAÑO<br>PASAPORTE</div>`
          }
        </div>
      </div>
    </div>

    <!-- SECCIÓN 2: ESTUDIOS -->
    <div class="section">
      <div class="section-title">2. Formación Académica</div>
      <div class="data-container">
        <div class="row">
          <div class="col w-50">
            <div class="label">Universidad / Instituto</div>
            <div class="value">${academic.resolvedInstitution}</div>
          </div>
          <div class="col w-25">
            <div class="label">Año de Ingreso</div>
            <div class="value">${academic.admissionYear || "----------------"}</div>
          </div>
          <div class="col w-25">
            <div class="label">Año de Egreso</div>
            <div class="value">${academic.graduationYear || "----------------"}</div>
          </div>
        </div>

        <div class="row">
          <div class="col w-50">
            <div class="label">Título o Diploma</div>
            <div class="value">${academic.degreeTitle || "----------------"}</div>
          </div>
          <div class="col w-25">
            <div class="label">Especialidad</div>
            <div class="value">${academic.specialty || "----------------"}</div>
          </div>
          <div class="col w-25">
            <div class="label">Tiempo en el Sector</div>
            <div class="value">${academic.sectorExperience || "----------------"}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- SECCIÓN 3: INFORMACIÓN LABORAL -->
    <div class="section">
      <div class="section-title">3. Información Laboral</div>
      <div class="data-container">
        
        <div class="row">
          <div class="col w-50">
            <div class="label">Empresa o Institución</div>
            <div class="value">${employment.companyName || "----------------"}</div>
          </div>
          <div class="col w-25">
            <div class="label">RUC</div>
            <div class="value">${employment.companyTaxId || "----------------"}</div>
          </div>
          <div class="col w-25">
            <div class="label">Cargo Actual</div>
            <div class="value">${employment.positionName || "----------------"}</div>
          </div>
        </div>

        <div class="row">
          <div class="col w-100">
            <div class="label">Dirección de la Empresa</div>
            <div class="value">${employment.workingAddress || "----------------"}</div>
          </div>
        </div>

        <div class="row">
          <div class="col w-50">
            <div class="label">Correo Electrónico Corporativo</div>
            <div class="value">${employment.workEmail || "----------------"}</div>
          </div>
          <div class="col w-50">
            <div class="label">Teléfono Corporativo</div>
            <div class="value">${employment.workPhone || "----------------"}</div>
          </div>
        </div>

      </div>
    </div>

    <!-- SECCIÓN 4: AVALES -->
    <div class="section">
      <div class="section-title">4. Avales y Referencias (Uso Institucional)</div>
      <div class="data-container">
        <div class="row">
          <div class="col w-50">
            <div class="label">Nombre del Aval 1</div>
            <div class="value">${aval1.sponsorFullName || "--------------------------------"}</div>
          </div>
          <div class="col w-50">
            <div class="label">DNI Aval 1</div>
            <div class="value">${aval1.sponsorDocumentNumber || "--------------------------------"}</div>
          </div>
        </div>
        <div class="row">
          <div class="col w-50">
            <div class="label">Nombre del Aval 2</div>
            <div class="value">${aval2.sponsorFullName || "--------------------------------"}</div>
          </div>
          <div class="col w-50">
            <div class="label">DNI Aval 2</div>
            <div class="value">${aval2.sponsorDocumentNumber || "--------------------------------"}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- ============================================== -->
    <!-- NUEVA PÁGINA: DECLARACIÓN JURADA -->
    <!-- ============================================== -->
    <div class="declaration-page">
      <div class="declaration-title">DECLARACIÓN JURADA</div>
      
      <div class="declaration-content">
        <p>
          Yo, <strong>${nombres} ${apellidos}</strong>, identificado(a) con ${documentType} N.° <strong>${personal.documentNumber}</strong>, con domicilio en <strong>${personal.address}</strong>, en el marco de mi solicitud de incorporación como asociado(a) del Instituto de Ingenieros de Minas del Perú, en adelante el IIMP) declaro bajo juramento lo siguiente:
        </p>

        <ul class="declaration-list">
          <li>Que la información y documentación proporcionada para mi solicitud de incorporación son veraces, completas y actualizadas.</li>
          <li>Que no me encuentro inhabilitado(a) para el ejercicio de mi profesión ni sujeto(a) a sanciones éticas o disciplinarias vigentes impuestas por autoridad competente, colegio profesional, u organismo equivalente.</li>
          <li>Que no cuento con condenas vigentes por delitos dolosos que pudieran afectar la reputación, integridad o fines institucionales de la asociación.</li>
          <li>Que no mantengo situaciones de conflicto de interés conocidas que resulten incompatibles con los fines, actividades o intereses institucionales del IIMP y que me comprometo a informar oportunamente cualquier situación que pudiera generarlas.</li>
          <li>Que me comprometo a utilizar el nombre, imagen, logotipos, instalaciones y demás recursos institucionales únicamente conforme a las autorizaciones y lineamientos establecidos por el IIMP, absteniéndome de realizar actos que puedan generar confusión entre actividades personales, profesionales o comerciales y las actividades institucionales.</li>
          <li>Que, en caso de ser admitido como asociado, me comprometo a cumplir con el Estatuto, el Código de Ética, el Código de Conducta, y con las políticas y demás disposiciones internas del IIMP; así como a actuar con integridad, buena fe y respeto institucional; evitar situaciones de conflicto de interés y abstenerme de realizar actos que puedan afectar la reputación, imagen o fines institucionales del IIMP.</li>
          <li>Que declaro conocer y aceptar que el proceso de incorporación como asociado está sujeto a los procedimientos de evaluación, debida diligencia e integridad establecidos por el IIMP. Asimismo autorizo al IIMP a efectuar verificaciones respecto a la información proporcionada, conforme a su normativa interna y a la legislación aplicable.</li>
        </ul>

        <p>
          Declaro conocer que la falsedad, omisión o inexactitud relevante en la presente declaración podrá dar lugar al rechazo de mi solicitud.
        </p>
        
        <div class="declaration-date">
          Lima, ${fechaActual}
        </div>
        
        <div class="signature-box">
          <div class="signature-line"></div>
          <div class="signature-info">Firma</div>
          <div class="signature-info"><strong>Nombre:</strong> ${nombres} ${apellidos}</div>
          <div class="signature-info"><strong>${documentType}:</strong> ${personal.documentNumber}</div>
        </div>
      </div>
    </div>

  </body>
  </html>`;
  }
}