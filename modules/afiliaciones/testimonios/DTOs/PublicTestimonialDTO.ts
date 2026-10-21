export interface PublicTestimonialDTO {
  id: number;
  nombre: string;
  categoria: string;
  carrera: string;
  institucion: string;
  testimonio: string;
  avatarUrl: string;
  destacado: boolean;
}

export interface CreateTestimonialDTO {
  documentNumber: string;
  fullName: string;
  category: "ASOCIADO ACTIVO" | "ASOCIADO ESTUDIANTE";
  role: string;
  institution: string;
  content: string;
}
