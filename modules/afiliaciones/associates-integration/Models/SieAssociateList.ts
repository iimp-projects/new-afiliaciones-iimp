export type SieAssociateListRequest = {
  pagina?: number;
  tamanioPagina?: number;
  tipo?: string;
};

export type SanitizedSieAssociate = {
  documentType: string;
  documentNumber: string;
  externalCode: string;
  sourceType: string;
  sourceDescription: string;
  passwordPresent: boolean;
  nombres?: string | null;
  apellidoPaterno?: string | null;
  apellidoMaterno?: string | null;
  fechaNacimiento?: string | null;
  telefono?: string | null;
  correo?: string | null;
  direccion?: string | null;
  pais?: string | null;
  paisNombre?: string | null;
  departamento?: string | null;
  departamentoNombre?: string | null;
  provincia?: string | null;
  provinciaNombre?: string | null;
  distrito?: string | null;
  distritoNombre?: string | null;
};

export type SieAssociateListPage = {
  pagina: number;
  tamanioPagina: number;
  totalRegistros: number;
  totalPaginas: number;
  associates: SanitizedSieAssociate[];
};

export type SieAssociateWithClave = {
  record: SanitizedSieAssociate;
  clave: string | null;
};

export type SieAssociateListPageWithClave = {
  pagina: number;
  tamanioPagina: number;
  totalRegistros: number;
  totalPaginas: number;
  associates: SieAssociateWithClave[];
};
