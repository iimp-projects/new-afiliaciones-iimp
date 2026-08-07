import type { Prisma } from "@prisma/client";

export const specialtiesData: Prisma.SpecialtyCreateManyInput[] = [
  // --- CIENCIAS DE LA TIERRA Y MINERÍA ---
  { code: "ESP-MIN", name: "Ingeniería de Minas", description: "Especialidad orientada a la explotación y gestión de recursos minerales.", isActive: true },
  { code: "ESP-GEO", name: "Ingeniería Geológica", description: "Especialidad enfocada en geología aplicada y exploración.", isActive: true },
  { code: "ESP-MET", name: "Ingeniería Metalúrgica", description: "Especialidad orientada al procesamiento de minerales y metalurgia.", isActive: true },
  { code: "ESP-GEOL", name: "Geología", description: "Ciencias de la Tierra.", isActive: true },
  { code: "ESP-GEOPHYS", name: "Geofísica", description: "Aplicación de la física al estudio terrestre.", isActive: true },
  { code: "ESP-GEOTEC", name: "Geotecnia", description: "Estudio de las propiedades mecánicas de la tierra.", isActive: true },

  // --- OTRAS INGENIERÍAS Y TECNOLOGÍA ---
  { code: "ESP-CIVIL", name: "Ingeniería Civil", description: "Diseño y construcción de infraestructura.", isActive: true },
  { code: "ESP-IND", name: "Ingeniería Industrial", description: "Optimización de procesos industriales.", isActive: true },
  { code: "ESP-MEC", name: "Ingeniería Mecánica", description: "Diseño y mantenimiento de sistemas mecánicos.", isActive: true },
  { code: "ESP-ELE", name: "Ingeniería Eléctrica", description: "Sistemas eléctricos de potencia y distribución.", isActive: true },
  { code: "ESP-ELECTRON", name: "Ingeniería Electrónica", description: "Diseño de sistemas electrónicos y automatización.", isActive: true },
  { code: "ESP-MECATRON", name: "Ingeniería Mecatrónica", description: "Integración de mecánica, electrónica y software.", isActive: true },
  { code: "ESP-QUIM", name: "Ingeniería Química", description: "Procesos químicos industriales.", isActive: true },
  { code: "ESP-SIST", name: "Ingeniería de Sistemas", description: "Arquitectura y desarrollo de sistemas de información.", isActive: true },
  { code: "ESP-SOFT", name: "Ingeniería de Software", description: "Desarrollo de software y arquitectura empresarial.", isActive: true },
  { code: "ESP-INF", name: "Ingeniería Informática", description: "Tecnologías de la información y computación.", isActive: true },
  { code: "ESP-TELECOM", name: "Ingeniería de Telecomunicaciones", description: "Infraestructura y comunicaciones digitales.", isActive: true },
  { code: "ESP-AGRO", name: "Ingeniería Agrónoma / Agrícola", description: "Gestión de producción agrícola y recursos naturales.", isActive: true },

  // --- AMBIENTE Y SEGURIDAD ---
  { code: "ESP-AMB", name: "Ingeniería Ambiental", description: "Gestión ambiental y sostenibilidad.", isActive: true },
  { code: "ESP-SAN", name: "Ingeniería Sanitaria", description: "Diseño de sistemas de agua y saneamiento.", isActive: true },
  { code: "ESP-SEG", name: "Ingeniería de Seguridad e Higiene Industrial", description: "Prevención de riesgos laborales y seguridad industrial.", isActive: true },

  // --- ADMINISTRACIÓN, FINANZAS Y GESTIÓN ---
  { code: "ESP-ADM-GEN", name: "Administración", description: "Gestión empresarial.", isActive: true },
  { code: "ESP-ADM-EMP", name: "Administración de Empresas", description: "Dirección estratégica de organizaciones.", isActive: true },
  { code: "ESP-ECO", name: "Economía", description: "Análisis económico.", isActive: true },
  { code: "ESP-CONT", name: "Contabilidad", description: "Gestión financiera y contable.", isActive: true },
  { code: "ESP-FIN", name: "Finanzas", description: "Administración financiera.", isActive: true },
  { code: "ESP-NEG", name: "Negocios Internacionales", description: "Comercio internacional y logística.", isActive: true },
  { code: "ESP-RRHH", name: "Recursos Humanos / Gestión del Talento", description: "Gestión de personal y clima organizacional.", isActive: true },

  // --- CIENCIAS SOCIALES, SALUD, EDUCACIÓN Y HUMANIDADES ---
  { code: "ESP-DER", name: "Derecho", description: "Ciencias jurídicas.", isActive: true },
  { code: "ESP-EDU", name: "Educación", description: "Formación y pedagogía.", isActive: true },
  { code: "ESP-COM", name: "Ciencias de la Comunicación", description: "Periodismo, comunicación corporativa y relaciones públicas.", isActive: true },
  { code: "ESP-SOC", name: "Sociología / Relaciones Comunitarias", description: "Gestión social y relaciones comunitarias.", isActive: true },
  { code: "ESP-MED", name: "Medicina Humana / Salud Ocupacional", description: "Medicina humana y salud en el trabajo.", isActive: true },
  { code: "ESP-PSIC", name: "Psicología Ocupacional", description: "Salud mental y psicología organizacional.", isActive: true },
  { code: "ESP-ARQ", name: "Arquitectura y Urbanismo", description: "Diseño espacial y desarrollo urbano.", isActive: true },

  // --- OPCIÓN OTRA ---
  { code: "ESP-OTH", name: "Otra especialidad", description: "Especialidad no especificada en el catálogo.", isActive: true }
];