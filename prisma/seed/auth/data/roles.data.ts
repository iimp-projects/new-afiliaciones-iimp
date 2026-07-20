import type { Prisma } from "@prisma/client";

export const rolesData: Prisma.RoleCreateManyInput[] = [
  { name:"Super Administrador", slug:"SUPER_ADMIN", description:"Acceso total al sistema.", isActive:true },
  { name:"Administrador del Sistema", slug:"SYSTEM_ADMIN", description:"Administración funcional del sistema.", isActive:true },
  { name:"Gerencia General", slug:"GERENCIA_GENERAL", description:"Supervisión global del proceso de afiliaciones.", isActive:true },
  { name:"Secretaría General", slug:"SECRETARIA_GENERAL", description:"Administración documental y seguimiento.", isActive:true },
  { name:"Comité Evaluador", slug:"COMITE_EVALUADOR", description:"Evaluación técnica de postulaciones.", isActive:true },
  { name:"Logística", slug:"LOGISTICA", description:"Validación documental y expedientes.", isActive:true },
  { name:"Operaciones", slug:"OPERACIONES", description:"Operaciones internas.", isActive:true },
  { name:"Tesorería", slug:"TESORERIA", description:"Control de pagos.", isActive:true },
  { name:"Contabilidad", slug:"CONTABILIDAD", description:"Gestión financiera.", isActive:true },
  { name:"Caja", slug:"CAJA", description:"Recepción y validación de pagos.", isActive:true },
  { name:"Asesoría Legal", slug:"LEGAL", description:"Revisión legal.", isActive:true },
  { name:"Comunicaciones", slug:"COMUNICACIONES", description:"Difusión institucional.", isActive:true },
  { name:"Atención al Asociado", slug:"ATENCION_ASOCIADO", description:"Atención al postulante y asociado.", isActive:true },
  { name:"Mesa de Partes", slug:"MESA_PARTES", description:"Recepción documental.", isActive:true },
  { name:"Validador", slug:"VALIDADOR", description:"Validador de expedientes.", isActive:true },
  { name:"Auditor", slug:"AUDITOR", description:"Auditoría del sistema.", isActive:true },
  { name:"Postulante", slug:"POSTULANTE", description:"Usuario postulando a una membresía.", isActive:true },
  { name:"Asociado Activo", slug:"ASOCIADO_ACTIVO", description:"Miembro activo del IIMP.", isActive:true },
  { name:"Asociado Estudiante", slug:"ASOCIADO_ESTUDIANTE", description:"Miembro estudiante.", isActive:true },
  { name:"Invitado", slug:"INVITADO", description:"Acceso limitado al sistema.", isActive:true },
];
