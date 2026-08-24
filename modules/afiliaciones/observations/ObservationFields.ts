export interface ObservationFieldCategory {
  id: string;
  name: string;
  fields: { key: string; label: string; studentOnly?: boolean }[];
}

export const OBSERVATION_CATEGORIES: ObservationFieldCategory[] = [
  {
    id: "personal",
    name: "Datos Personales",
    fields: [
      { key: "personalInformation.birthDate", label: "Fecha de nacimiento" },
      { key: "personalInformation.gender", label: "Género" },
      { key: "personalInformation.phone", label: "Celular" },
      { key: "personalInformation.primaryEmail", label: "Correo principal" },
      { key: "personalInformation.secondaryEmail", label: "Correo secundario" },
      { key: "personalInformation.countryId", label: "País" },
      { key: "personalInformation.departmentId", label: "Departamento" },
      { key: "personalInformation.provinceId", label: "Provincia" },
      { key: "personalInformation.districtId", label: "Distrito" },
      { key: "personalInformation.address", label: "Dirección" },
    ],
  },
  {
    id: "academic",
    name: "Formación Académica",
    fields: [
      { key: "academicStudies.0.institutionId", label: "Institución de estudios" },
      { key: "academicStudies.0.otherInstitution", label: "Otra institución" },
      { key: "academicStudies.0.degreeTitle", label: "Título o grado" },
      { key: "academicStudies.0.specialty", label: "Especialidad" },
      { key: "academicStudies.0.professionalAssociation", label: "Colegio profesional" },
      { key: "academicStudies.0.registrationNumber", label: "Número de colegiatura" },
    ],
  },
  {
    id: "employment",
    name: "Experiencia Laboral",
    fields: [
      { key: "employmentInformation.companyTaxId", label: "RUC" },
      { key: "employmentInformation.area", label: "Área laboral" },
      { key: "employmentInformation.positionName", label: "Cargo" },
      { key: "employmentInformation.workPhone", label: "Teléfono laboral" },
      { key: "employmentInformation.workEmail", label: "Correo laboral" },
    ],
  },
  {
    id: "documents",
    name: "Documentos",
    fields: [
      { key: "personalInformation.photo", label: "Fotografía" },
      { key: "personalInformation.identityDocument", label: "Documento de identidad" },
      { key: "endorsements.declarationDocumentId", label: "Declaración jurada firmada" },
      { key: "academicStudies.0.universityLetter", label: "Constancia / Carta de estudios", studentOnly: true },
    ],
  },
  {
    id: "endorsements",
    name: "Avales",
    fields: [
      { key: "endorsements.firstEndorsement.sponsorDocumentNumber", label: "DNI del primer aval" },
      { key: "endorsements.secondEndorsement.sponsorDocumentNumber", label: "DNI del segundo aval" },
    ],
  },
];

export const OBSERVATION_FIELDS = OBSERVATION_CATEGORIES.flatMap((category) => category.fields);
export const OBSERVATION_FIELD_KEYS = new Set<string>(OBSERVATION_FIELDS.map((field) => field.key));

/**
 * Dependencias geográficas obligatorias:
 * - País obliga a observar Departamento, Provincia y Distrito.
 * - Departamento obliga a observar Provincia y Distrito.
 * - Provincia obliga a observar Distrito.
 */
export const GEOGRAPHIC_DEPENDENCIES: Record<string, string[]> = {
  "personalInformation.countryId": [
    "personalInformation.departmentId",
    "personalInformation.provinceId",
    "personalInformation.districtId",
  ],
  "personalInformation.departmentId": [
    "personalInformation.provinceId",
    "personalInformation.districtId",
  ],
  "personalInformation.provinceId": [
    "personalInformation.districtId",
  ],
};

export function applyGeographicDependencies(
  currentSelected: string[],
  toggledKey: string,
  willBeChecked: boolean
): string[] {
  let result = [...currentSelected];

  if (willBeChecked) {
    result.push(toggledKey);
    const deps = GEOGRAPHIC_DEPENDENCIES[toggledKey];
    if (deps) {
      result.push(...deps);
    }
  } else {
    result = result.filter((k) => k !== toggledKey);
    // Si deseleccionamos un hijo requerido por un padre activo, el padre también se deselecciona
    Object.entries(GEOGRAPHIC_DEPENDENCIES).forEach(([parentKey, children]) => {
      if (children.includes(toggledKey)) {
        result = result.filter((k) => k !== parentKey);
      }
    });
  }

  return [...new Set(result)];
}

