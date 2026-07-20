import { DocumentType, UserType } from "@prisma/client";

export interface SeedUser {
  email: string;
  role: string;
  type: UserType;
  person: {
    documentType: DocumentType;
    documentNumber: string;
    firstName: string;
    paternalLastName: string;
    maternalLastName: string;
  };
}

export const usersData: SeedUser[] = [
  // ====================== SUPER_ADMIN ======================
  {
    email: "super_admin.01@iimp.org.pe",
    role: "SUPER_ADMIN",
    type: UserType.SYSTEM_ADMIN,
    person: {
      documentType: DocumentType.DNI,
      documentNumber: "41000000",
      firstName: "Carlos",
      paternalLastName: "Pérez",
      maternalLastName: "Gómez",
    },
  },
  {
    email: "super_admin.02@iimp.org.pe",
    role: "SUPER_ADMIN",
    type: UserType.SYSTEM_ADMIN,
    person: {
      documentType: DocumentType.DNI,
      documentNumber: "41000001",
      firstName: "José",
      paternalLastName: "Silva",
      maternalLastName: "Cruz",
    },
  },

  // ====================== SYSTEM_ADMIN ======================
  {
    email: "system_admin.01@iimp.org.pe",
    role: "SYSTEM_ADMIN",
    type: UserType.SYSTEM_ADMIN,
    person: {
      documentType: DocumentType.DNI,
      documentNumber: "41000002",
      firstName: "Luis",
      paternalLastName: "Navarro",
      maternalLastName: "Luna",
    },
  },
  {
    email: "system_admin.02@iimp.org.pe",
    role: "SYSTEM_ADMIN",
    type: UserType.SYSTEM_ADMIN,
    person: {
      documentType: DocumentType.DNI,
      documentNumber: "41000003",
      firstName: "Juan",
      paternalLastName: "Quispe",
      maternalLastName: "Delgado",
    },
  },
  {
    email: "system_admin.03@iimp.org.pe",
    role: "SYSTEM_ADMIN",
    type: UserType.SYSTEM_ADMIN,
    person: {
      documentType: DocumentType.DNI,
      documentNumber: "41000004",
      firstName: "Pedro",
      paternalLastName: "Mendoza",
      maternalLastName: "Morales",
    },
  },

  // ====================== GERENCIA_GENERAL ======================
  {
    email: "gerencia_general.01@iimp.org.pe",
    role: "GERENCIA_GENERAL",
    type: UserType.VALIDATOR,
    person: {
      documentType: DocumentType.DNI,
      documentNumber: "41000005",
      firstName: "Miguel",
      paternalLastName: "Espinoza",
      maternalLastName: "Peña",
    },
  },
  {
    email: "gerencia_general.02@iimp.org.pe",
    role: "GERENCIA_GENERAL",
    type: UserType.VALIDATOR,
    person: {
      documentType: DocumentType.DNI,
      documentNumber: "41000006",
      firstName: "Jorge",
      paternalLastName: "Ramírez",
      maternalLastName: "Reyes",
    },
  },

  // ====================== SECRETARIA_GENERAL ======================
  {
    email: "secretaria_general.01@iimp.org.pe",
    role: "SECRETARIA_GENERAL",
    type: UserType.VALIDATOR,
    person: {
      documentType: DocumentType.DNI,
      documentNumber: "41000007",
      firstName: "Diego",
      paternalLastName: "Salazar",
      maternalLastName: "Ortega",
    },
  },
  {
    email: "secretaria_general.02@iimp.org.pe",
    role: "SECRETARIA_GENERAL",
    type: UserType.VALIDATOR,
    person: {
      documentType: DocumentType.DNI,
      documentNumber: "41000008",
      firstName: "André",
      paternalLastName: "Huamán",
      maternalLastName: "Mora",
    },
  },

  // ====================== COMITE_EVALUADOR ======================
  {
    email: "comite_evaluador.01@iimp.org.pe",
    role: "COMITE_EVALUADOR",
    type: UserType.VALIDATOR,
    person: {
      documentType: DocumentType.DNI,
      documentNumber: "41000009",
      firstName: "Marco",
      paternalLastName: "Torres",
      maternalLastName: "Cáceres",
    },
  },
  {
    email: "comite_evaluador.02@iimp.org.pe",
    role: "COMITE_EVALUADOR",
    type: UserType.VALIDATOR,
    person: {
      documentType: DocumentType.DNI,
      documentNumber: "41000010",
      firstName: "Ana",
      paternalLastName: "Campos",
      maternalLastName: "Núñez",
    },
  },
  {
    email: "comite_evaluador.03@iimp.org.pe",
    role: "COMITE_EVALUADOR",
    type: UserType.VALIDATOR,
    person: {
      documentType: DocumentType.DNI,
      documentNumber: "41000011",
      firstName: "María",
      paternalLastName: "Cárdenas",
      maternalLastName: "Ruiz",
    },
  },
  {
    email: "comite_evaluador.04@iimp.org.pe",
    role: "COMITE_EVALUADOR",
    type: UserType.VALIDATOR,
    person: {
      documentType: DocumentType.DNI,
      documentNumber: "41000012",
      firstName: "Patricia",
      paternalLastName: "Castro",
      maternalLastName: "Valencia",
    },
  },

  // ====================== LOGISTICA ======================
  {
    email: "logistica.01@iimp.org.pe",
    role: "LOGISTICA",
    type: UserType.VALIDATOR,
    person: {
      documentType: DocumentType.DNI,
      documentNumber: "41000013",
      firstName: "Rosa",
      paternalLastName: "León",
      maternalLastName: "Díaz",
    },
  },
  {
    email: "logistica.02@iimp.org.pe",
    role: "LOGISTICA",
    type: UserType.VALIDATOR,
    person: {
      documentType: DocumentType.DNI,
      documentNumber: "41000014",
      firstName: "Lucía",
      paternalLastName: "Gutiérrez",
      maternalLastName: "Rivera",
    },
  },
  {
    email: "logistica.03@iimp.org.pe",
    role: "LOGISTICA",
    type: UserType.VALIDATOR,
    person: {
      documentType: DocumentType.DNI,
      documentNumber: "41000015",
      firstName: "Diana",
      paternalLastName: "Rojas",
      maternalLastName: "Vega",
    },
  },

  // ====================== OPERACIONES ======================
  {
    email: "operaciones.01@iimp.org.pe",
    role: "OPERACIONES",
    type: UserType.VALIDATOR,
    person: {
      documentType: DocumentType.DNI,
      documentNumber: "41000016",
      firstName: "Sandra",
      paternalLastName: "Soto",
      maternalLastName: "Suárez",
    },
  },
  {
    email: "operaciones.02@iimp.org.pe",
    role: "OPERACIONES",
    type: UserType.VALIDATOR,
    person: {
      documentType: DocumentType.DNI,
      documentNumber: "41000017",
      firstName: "Andrea",
      paternalLastName: "Paredes",
      maternalLastName: "Gil",
    },
  },
  {
    email: "operaciones.03@iimp.org.pe",
    role: "OPERACIONES",
    type: UserType.VALIDATOR,
    person: {
      documentType: DocumentType.DNI,
      documentNumber: "41000018",
      firstName: "Carmen",
      paternalLastName: "Flores",
      maternalLastName: "Aguilar",
    },
  },

  // ====================== TESORERIA ======================
  {
    email: "tesoreria.01@iimp.org.pe",
    role: "TESORERIA",
    type: UserType.VALIDATOR,
    person: {
      documentType: DocumentType.DNI,
      documentNumber: "41000019",
      firstName: "Paola",
      paternalLastName: "Vargas",
      maternalLastName: "Paz",
    },
  },
  {
    email: "tesoreria.02@iimp.org.pe",
    role: "TESORERIA",
    type: UserType.VALIDATOR,
    person: {
      documentType: DocumentType.DNI,
      documentNumber: "41000020",
      firstName: "Julio",
      paternalLastName: "Pérez",
      maternalLastName: "Gómez",
    },
  },
  {
    email: "tesoreria.03@iimp.org.pe",
    role: "TESORERIA",
    type: UserType.VALIDATOR,
    person: {
      documentType: DocumentType.DNI,
      documentNumber: "41000021",
      firstName: "Fernando",
      paternalLastName: "Silva",
      maternalLastName: "Cruz",
    },
  },

  // ====================== CONTABILIDAD ======================
  {
    email: "contabilidad.01@iimp.org.pe",
    role: "CONTABILIDAD",
    type: UserType.VALIDATOR,
    person: {
      documentType: DocumentType.DNI,
      documentNumber: "41000022",
      firstName: "Ricardo",
      paternalLastName: "Navarro",
      maternalLastName: "Luna",
    },
  },
  {
    email: "contabilidad.02@iimp.org.pe",
    role: "CONTABILIDAD",
    type: UserType.VALIDATOR,
    person: {
      documentType: DocumentType.DNI,
      documentNumber: "41000023",
      firstName: "Kevin",
      paternalLastName: "Quispe",
      maternalLastName: "Delgado",
    },
  },
  {
    email: "contabilidad.03@iimp.org.pe",
    role: "CONTABILIDAD",
    type: UserType.VALIDATOR,
    person: {
      documentType: DocumentType.DNI,
      documentNumber: "41000024",
      firstName: "Alonso",
      paternalLastName: "Mendoza",
      maternalLastName: "Morales",
    },
  },

  // ====================== CAJA ======================
  {
    email: "caja.01@iimp.org.pe",
    role: "CAJA",
    type: UserType.VALIDATOR,
    person: {
      documentType: DocumentType.DNI,
      documentNumber: "41000025",
      firstName: "Fiorella",
      paternalLastName: "Espinoza",
      maternalLastName: "Peña",
    },
  },
  {
    email: "caja.02@iimp.org.pe",
    role: "CAJA",
    type: UserType.VALIDATOR,
    person: {
      documentType: DocumentType.DNI,
      documentNumber: "41000026",
      firstName: "Valeria",
      paternalLastName: "Ramírez",
      maternalLastName: "Reyes",
    },
  },
  {
    email: "caja.03@iimp.org.pe",
    role: "CAJA",
    type: UserType.VALIDATOR,
    person: {
      documentType: DocumentType.DNI,
      documentNumber: "41000027",
      firstName: "Katherine",
      paternalLastName: "Salazar",
      maternalLastName: "Ortega",
    },
  },

  // ====================== LEGAL ======================
  {
    email: "legal.01@iimp.org.pe",
    role: "LEGAL",
    type: UserType.VALIDATOR,
    person: {
      documentType: DocumentType.DNI,
      documentNumber: "41000028",
      firstName: "Brenda",
      paternalLastName: "Huamán",
      maternalLastName: "Mora",
    },
  },
  {
    email: "legal.02@iimp.org.pe",
    role: "LEGAL",
    type: UserType.VALIDATOR,
    person: {
      documentType: DocumentType.DNI,
      documentNumber: "41000029",
      firstName: "César",
      paternalLastName: "Torres",
      maternalLastName: "Cáceres",
    },
  },

  // ====================== COMUNICACIONES ======================
  {
    email: "comunicaciones.01@iimp.org.pe",
    role: "COMUNICACIONES",
    type: UserType.VALIDATOR,
    person: {
      documentType: DocumentType.DNI,
      documentNumber: "41000030",
      firstName: "Renzo",
      paternalLastName: "Campos",
      maternalLastName: "Núñez",
    },
  },
  {
    email: "comunicaciones.02@iimp.org.pe",
    role: "COMUNICACIONES",
    type: UserType.VALIDATOR,
    person: {
      documentType: DocumentType.DNI,
      documentNumber: "41000031",
      firstName: "Gabriel",
      paternalLastName: "Cárdenas",
      maternalLastName: "Ruiz",
    },
  },

  // ====================== ATENCION_ASOCIADO ======================
  {
    email: "atencion_asociado.01@iimp.org.pe",
    role: "ATENCION_ASOCIADO",
    type: UserType.VALIDATOR,
    person: {
      documentType: DocumentType.DNI,
      documentNumber: "41000032",
      firstName: "Cristian",
      paternalLastName: "Castro",
      maternalLastName: "Valencia",
    },
  },
  {
    email: "atencion_asociado.02@iimp.org.pe",
    role: "ATENCION_ASOCIADO",
    type: UserType.VALIDATOR,
    person: {
      documentType: DocumentType.DNI,
      documentNumber: "41000033",
      firstName: "Melissa",
      paternalLastName: "León",
      maternalLastName: "Díaz",
    },
  },
  {
    email: "atencion_asociado.03@iimp.org.pe",
    role: "ATENCION_ASOCIADO",
    type: UserType.VALIDATOR,
    person: {
      documentType: DocumentType.DNI,
      documentNumber: "41000034",
      firstName: "Nicole",
      paternalLastName: "Gutiérrez",
      maternalLastName: "Rivera",
    },
  },
  {
    email: "atencion_asociado.04@iimp.org.pe",
    role: "ATENCION_ASOCIADO",
    type: UserType.VALIDATOR,
    person: {
      documentType: DocumentType.DNI,
      documentNumber: "41000035",
      firstName: "Silvia",
      paternalLastName: "Rojas",
      maternalLastName: "Vega",
    },
  },

  // ====================== MESA_PARTES ======================
  {
    email: "mesa_partes.01@iimp.org.pe",
    role: "MESA_PARTES",
    type: UserType.VALIDATOR,
    person: {
      documentType: DocumentType.DNI,
      documentNumber: "41000036",
      firstName: "Elena",
      paternalLastName: "Soto",
      maternalLastName: "Suárez",
    },
  },
  {
    email: "mesa_partes.02@iimp.org.pe",
    role: "MESA_PARTES",
    type: UserType.VALIDATOR,
    person: {
      documentType: DocumentType.DNI,
      documentNumber: "41000037",
      firstName: "Hugo",
      paternalLastName: "Paredes",
      maternalLastName: "Gil",
    },
  },
  {
    email: "mesa_partes.03@iimp.org.pe",
    role: "MESA_PARTES",
    type: UserType.VALIDATOR,
    person: {
      documentType: DocumentType.DNI,
      documentNumber: "41000038",
      firstName: "Raúl",
      paternalLastName: "Flores",
      maternalLastName: "Aguilar",
    },
  },

  // ====================== VALIDADOR ======================
  {
    email: "validador.01@iimp.org.pe",
    role: "VALIDADOR",
    type: UserType.VALIDATOR,
    person: {
      documentType: DocumentType.DNI,
      documentNumber: "41000039",
      firstName: "Víctor",
      paternalLastName: "Vargas",
      maternalLastName: "Paz",
    },
  },
  {
    email: "validador.02@iimp.org.pe",
    role: "VALIDADOR",
    type: UserType.VALIDATOR,
    person: {
      documentType: DocumentType.DNI,
      documentNumber: "41000040",
      firstName: "Carlos",
      paternalLastName: "Pérez",
      maternalLastName: "Gómez",
    },
  },
  {
    email: "validador.03@iimp.org.pe",
    role: "VALIDADOR",
    type: UserType.VALIDATOR,
    person: {
      documentType: DocumentType.DNI,
      documentNumber: "41000041",
      firstName: "José",
      paternalLastName: "Silva",
      maternalLastName: "Cruz",
    },
  },
  {
    email: "validador.04@iimp.org.pe",
    role: "VALIDADOR",
    type: UserType.VALIDATOR,
    person: {
      documentType: DocumentType.DNI,
      documentNumber: "41000042",
      firstName: "Luis",
      paternalLastName: "Navarro",
      maternalLastName: "Luna",
    },
  },
  {
    email: "validador.05@iimp.org.pe",
    role: "VALIDADOR",
    type: UserType.VALIDATOR,
    person: {
      documentType: DocumentType.DNI,
      documentNumber: "41000043",
      firstName: "Juan",
      paternalLastName: "Quispe",
      maternalLastName: "Delgado",
    },
  },

  // ====================== AUDITOR ======================
  {
    email: "auditor.01@iimp.org.pe",
    role: "AUDITOR",
    type: UserType.VALIDATOR,
    person: {
      documentType: DocumentType.DNI,
      documentNumber: "41000044",
      firstName: "Pedro",
      paternalLastName: "Mendoza",
      maternalLastName: "Morales",
    },
  },
  {
    email: "auditor.02@iimp.org.pe",
    role: "AUDITOR",
    type: UserType.VALIDATOR,
    person: {
      documentType: DocumentType.DNI,
      documentNumber: "41000045",
      firstName: "Miguel",
      paternalLastName: "Espinoza",
      maternalLastName: "Peña",
    },
  },
  {
    email: "auditor.03@iimp.org.pe",
    role: "AUDITOR",
    type: UserType.VALIDATOR,
    person: {
      documentType: DocumentType.DNI,
      documentNumber: "41000046",
      firstName: "Jorge",
      paternalLastName: "Ramírez",
      maternalLastName: "Reyes",
    },
  },

  // ====================== POSTULANTE ======================
  {
    email: "postulante.01@iimp.org.pe",
    role: "POSTULANTE",
    type: UserType.APPLICANT,
    person: {
      documentType: DocumentType.DNI,
      documentNumber: "41000047",
      firstName: "Diego",
      paternalLastName: "Salazar",
      maternalLastName: "Ortega",
    },
  },
  {
    email: "postulante.02@iimp.org.pe",
    role: "POSTULANTE",
    type: UserType.APPLICANT,
    person: {
      documentType: DocumentType.DNI,
      documentNumber: "41000048",
      firstName: "André",
      paternalLastName: "Huamán",
      maternalLastName: "Mora",
    },
  },
  {
    email: "postulante.03@iimp.org.pe",
    role: "POSTULANTE",
    type: UserType.APPLICANT,
    person: {
      documentType: DocumentType.DNI,
      documentNumber: "41000049",
      firstName: "Marco",
      paternalLastName: "Torres",
      maternalLastName: "Cáceres",
    },
  },
  {
    email: "postulante.04@iimp.org.pe",
    role: "POSTULANTE",
    type: UserType.APPLICANT,
    person: {
      documentType: DocumentType.DNI,
      documentNumber: "41000050",
      firstName: "Ana",
      paternalLastName: "Campos",
      maternalLastName: "Núñez",
    },
  },
  {
    email: "postulante.05@iimp.org.pe",
    role: "POSTULANTE",
    type: UserType.APPLICANT,
    person: {
      documentType: DocumentType.DNI,
      documentNumber: "41000051",
      firstName: "María",
      paternalLastName: "Cárdenas",
      maternalLastName: "Ruiz",
    },
  },
  {
    email: "postulante.06@iimp.org.pe",
    role: "POSTULANTE",
    type: UserType.APPLICANT,
    person: {
      documentType: DocumentType.DNI,
      documentNumber: "41000052",
      firstName: "Patricia",
      paternalLastName: "Castro",
      maternalLastName: "Valencia",
    },
  },
  {
    email: "postulante.07@iimp.org.pe",
    role: "POSTULANTE",
    type: UserType.APPLICANT,
    person: {
      documentType: DocumentType.DNI,
      documentNumber: "41000053",
      firstName: "Rosa",
      paternalLastName: "León",
      maternalLastName: "Díaz",
    },
  },
  {
    email: "postulante.08@iimp.org.pe",
    role: "POSTULANTE",
    type: UserType.APPLICANT,
    person: {
      documentType: DocumentType.DNI,
      documentNumber: "41000054",
      firstName: "Lucía",
      paternalLastName: "Gutiérrez",
      maternalLastName: "Rivera",
    },
  },
  {
    email: "postulante.09@iimp.org.pe",
    role: "POSTULANTE",
    type: UserType.APPLICANT,
    person: {
      documentType: DocumentType.DNI,
      documentNumber: "41000055",
      firstName: "Diana",
      paternalLastName: "Rojas",
      maternalLastName: "Vega",
    },
  },
  {
    email: "postulante.10@iimp.org.pe",
    role: "POSTULANTE",
    type: UserType.APPLICANT,
    person: {
      documentType: DocumentType.DNI,
      documentNumber: "41000056",
      firstName: "Sandra",
      paternalLastName: "Soto",
      maternalLastName: "Suárez",
    },
  },

  // ====================== ASOCIADO_ACTIVO ======================
  {
    email: "asociado_activo.01@iimp.org.pe",
    role: "ASOCIADO_ACTIVO",
    type: UserType.AFFILIATE,
    person: {
      documentType: DocumentType.DNI,
      documentNumber: "41000057",
      firstName: "Andrea",
      paternalLastName: "Paredes",
      maternalLastName: "Gil",
    },
  },
  {
    email: "asociado_activo.02@iimp.org.pe",
    role: "ASOCIADO_ACTIVO",
    type: UserType.AFFILIATE,
    person: {
      documentType: DocumentType.DNI,
      documentNumber: "41000058",
      firstName: "Carmen",
      paternalLastName: "Flores",
      maternalLastName: "Aguilar",
    },
  },
  {
    email: "asociado_activo.03@iimp.org.pe",
    role: "ASOCIADO_ACTIVO",
    type: UserType.AFFILIATE,
    person: {
      documentType: DocumentType.DNI,
      documentNumber: "41000059",
      firstName: "Paola",
      paternalLastName: "Vargas",
      maternalLastName: "Paz",
    },
  },
  {
    email: "asociado_activo.04@iimp.org.pe",
    role: "ASOCIADO_ACTIVO",
    type: UserType.AFFILIATE,
    person: {
      documentType: DocumentType.DNI,
      documentNumber: "41000060",
      firstName: "Julio",
      paternalLastName: "Pérez",
      maternalLastName: "Gómez",
    },
  },
  {
    email: "asociado_activo.05@iimp.org.pe",
    role: "ASOCIADO_ACTIVO",
    type: UserType.AFFILIATE,
    person: {
      documentType: DocumentType.DNI,
      documentNumber: "41000061",
      firstName: "Fernando",
      paternalLastName: "Silva",
      maternalLastName: "Cruz",
    },
  },
  {
    email: "asociado_activo.06@iimp.org.pe",
    role: "ASOCIADO_ACTIVO",
    type: UserType.AFFILIATE,
    person: {
      documentType: DocumentType.DNI,
      documentNumber: "41000062",
      firstName: "Ricardo",
      paternalLastName: "Navarro",
      maternalLastName: "Luna",
    },
  },
  {
    email: "asociado_activo.07@iimp.org.pe",
    role: "ASOCIADO_ACTIVO",
    type: UserType.AFFILIATE,
    person: {
      documentType: DocumentType.DNI,
      documentNumber: "41000063",
      firstName: "Kevin",
      paternalLastName: "Quispe",
      maternalLastName: "Delgado",
    },
  },
  {
    email: "asociado_activo.08@iimp.org.pe",
    role: "ASOCIADO_ACTIVO",
    type: UserType.AFFILIATE,
    person: {
      documentType: DocumentType.DNI,
      documentNumber: "41000064",
      firstName: "Alonso",
      paternalLastName: "Mendoza",
      maternalLastName: "Morales",
    },
  },
  {
    email: "asociado_activo.09@iimp.org.pe",
    role: "ASOCIADO_ACTIVO",
    type: UserType.AFFILIATE,
    person: {
      documentType: DocumentType.DNI,
      documentNumber: "41000065",
      firstName: "Fiorella",
      paternalLastName: "Espinoza",
      maternalLastName: "Peña",
    },
  },
  {
    email: "asociado_activo.10@iimp.org.pe",
    role: "ASOCIADO_ACTIVO",
    type: UserType.AFFILIATE,
    person: {
      documentType: DocumentType.DNI,
      documentNumber: "41000066",
      firstName: "Valeria",
      paternalLastName: "Ramírez",
      maternalLastName: "Reyes",
    },
  },

  // ====================== ASOCIADO_ESTUDIANTE ======================
  {
    email: "asociado_estudiante.01@iimp.org.pe",
    role: "ASOCIADO_ESTUDIANTE",
    type: UserType.AFFILIATE,
    person: {
      documentType: DocumentType.DNI,
      documentNumber: "41000067",
      firstName: "Katherine",
      paternalLastName: "Salazar",
      maternalLastName: "Ortega",
    },
  },
  {
    email: "asociado_estudiante.02@iimp.org.pe",
    role: "ASOCIADO_ESTUDIANTE",
    type: UserType.AFFILIATE,
    person: {
      documentType: DocumentType.DNI,
      documentNumber: "41000068",
      firstName: "Brenda",
      paternalLastName: "Huamán",
      maternalLastName: "Mora",
    },
  },
  {
    email: "asociado_estudiante.03@iimp.org.pe",
    role: "ASOCIADO_ESTUDIANTE",
    type: UserType.AFFILIATE,
    person: {
      documentType: DocumentType.DNI,
      documentNumber: "41000069",
      firstName: "César",
      paternalLastName: "Torres",
      maternalLastName: "Cáceres",
    },
  },
  {
    email: "asociado_estudiante.04@iimp.org.pe",
    role: "ASOCIADO_ESTUDIANTE",
    type: UserType.AFFILIATE,
    person: {
      documentType: DocumentType.DNI,
      documentNumber: "41000070",
      firstName: "Renzo",
      paternalLastName: "Campos",
      maternalLastName: "Núñez",
    },
  },
  {
    email: "asociado_estudiante.05@iimp.org.pe",
    role: "ASOCIADO_ESTUDIANTE",
    type: UserType.AFFILIATE,
    person: {
      documentType: DocumentType.DNI,
      documentNumber: "41000071",
      firstName: "Gabriel",
      paternalLastName: "Cárdenas",
      maternalLastName: "Ruiz",
    },
  },
  {
    email: "asociado_estudiante.06@iimp.org.pe",
    role: "ASOCIADO_ESTUDIANTE",
    type: UserType.AFFILIATE,
    person: {
      documentType: DocumentType.DNI,
      documentNumber: "41000072",
      firstName: "Cristian",
      paternalLastName: "Castro",
      maternalLastName: "Valencia",
    },
  },
  {
    email: "asociado_estudiante.07@iimp.org.pe",
    role: "ASOCIADO_ESTUDIANTE",
    type: UserType.AFFILIATE,
    person: {
      documentType: DocumentType.DNI,
      documentNumber: "41000073",
      firstName: "Melissa",
      paternalLastName: "León",
      maternalLastName: "Díaz",
    },
  },
  {
    email: "asociado_estudiante.08@iimp.org.pe",
    role: "ASOCIADO_ESTUDIANTE",
    type: UserType.AFFILIATE,
    person: {
      documentType: DocumentType.DNI,
      documentNumber: "41000074",
      firstName: "Nicole",
      paternalLastName: "Gutiérrez",
      maternalLastName: "Rivera",
    },
  },

  // ====================== INVITADO ======================
  {
    email: "invitado.01@iimp.org.pe",
    role: "INVITADO",
    type: UserType.APPLICANT,
    person: {
      documentType: DocumentType.DNI,
      documentNumber: "41000075",
      firstName: "Silvia",
      paternalLastName: "Rojas",
      maternalLastName: "Vega",
    },
  },
  {
    email: "invitado.02@iimp.org.pe",
    role: "INVITADO",
    type: UserType.APPLICANT,
    person: {
      documentType: DocumentType.DNI,
      documentNumber: "41000076",
      firstName: "Elena",
      paternalLastName: "Soto",
      maternalLastName: "Suárez",
    },
  },
  {
    email: "invitado.03@iimp.org.pe",
    role: "INVITADO",
    type: UserType.APPLICANT,
    person: {
      documentType: DocumentType.DNI,
      documentNumber: "41000077",
      firstName: "Hugo",
      paternalLastName: "Paredes",
      maternalLastName: "Gil",
    },
  },
  {
    email: "invitado.04@iimp.org.pe",
    role: "INVITADO",
    type: UserType.APPLICANT,
    person: {
      documentType: DocumentType.DNI,
      documentNumber: "41000078",
      firstName: "Raúl",
      paternalLastName: "Flores",
      maternalLastName: "Aguilar",
    },
  },
  {
    email: "invitado.05@iimp.org.pe",
    role: "INVITADO",
    type: UserType.APPLICANT,
    person: {
      documentType: DocumentType.DNI,
      documentNumber: "41000079",
      firstName: "Víctor",
      paternalLastName: "Vargas",
      maternalLastName: "Paz",
    },
  },
];