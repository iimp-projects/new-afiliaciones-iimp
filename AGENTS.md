# Plataforma de Afiliaciones IIMP — guía de trabajo

## Contexto y fuentes de verdad

Esta aplicación administra postulaciones, evaluaciones, avales, expedientes, asociados, seguridad y consulta pública del IIMP. El código y `prisma/schema.prisma` son la fuente de verdad cuando difieran de la documentación. No inventar reglas, campos, endpoints, credenciales ni contratos de proveedores.

Consultar antes de cambios en dominios críticos:

- [Arquitectura](docs/ARCHITECTURE.md)
- [Reglas de negocio](docs/BUSINESS_RULES.md)
- [Pagos](docs/PAYMENTS.md)
- [Base de datos](docs/DATABASE.md)

## Stack y arquitectura

- Next.js 16 con App Router, React 19 y TypeScript estricto.
- Prisma ORM con PostgreSQL; Tailwind CSS, React Hook Form, Zod y Auth.js.
- Código organizado principalmente por dominio en `modules/`.
- Flujo predominante: View/Component → API client/Hook → Route Handler o Server Action → Service → Repository → Prisma.
- Existen excepciones heredadas que usan Prisma directamente en rutas o servicios. No ampliarlas sin una razón explícita.

Antes de modificar código Next.js, leer la guía aplicable de la versión instalada en `node_modules/next/dist/docs/`.

## Convenciones por capa

- **Views y Components:** UI e interacción; no acceder a Prisma ni contener reglas críticas. Reutilizar componentes y clientes API existentes.
- **Route Handlers y Server Actions:** validar entrada, autenticar/autorizar cuando corresponda, delegar el caso de uso y devolver contratos claros.
- **Services:** concentran casos de uso y reglas de negocio. Usar transacciones para cambios atómicos; no incluir secretos ni detalles de UI.
- **Repositories:** encapsulan persistencia Prisma y devuelven estructuras de dominio, no modelos de presentación.
- **Validaciones:** mantener validación cliente y servidor; el servidor es la fuente de verdad. Reutilizar Zod o validadores existentes según el patrón del módulo.

`modules/afiliaciones/postulacion` es la referencia principal para nuevos casos de uso de afiliaciones: contiene DTOs, entidades, validadores, servicios y repositorios.

## Prisma, seguridad y acceso

- No modificar `prisma/schema.prisma`, ejecutar migraciones ni generar cambios destructivos sin autorización explícita.
- Antes de cambiar datos, revisar relaciones, enums, seeds y consumidores.
- Usar `contextService.requireAuth`, `requireRole` o `requirePermission` según el caso; no asumir que la UI protege una ruta.
- Secretos solo en servidor: nunca en componentes, logs, commits ni `NEXT_PUBLIC_*`. No almacenar PAN/CVV ni datos sensibles innecesarios.
- No confiar en IDs, estados, montos o permisos enviados por el navegador.

## Reglas de trabajo

- Analizar primero el flujo real, contratos y consumidores; distinguir lo implementado de lo propuesto o pendiente.
- Hacer el cambio mínimo dentro del alcance pedido; no reescribir módulos no relacionados.
- Preservar cambios locales ajenos. Revisar el estado del worktree si el entorno lo permite.
- No instalar dependencias, hacer commits, push ni cambiar configuración Git salvo pedido explícito.
- Documentar discrepancias relevantes entre código y documentación en vez de resolverlas silenciosamente.

## Pagos

El dominio futuro es `modules/afiliaciones/payments`. No implementar Niubiz, payloads, endpoints, firmas ni credenciales sin documentación oficial y requerimientos aprobados. El diseño nuevo debe seguir UI → PaymentApi → Route Handler/Server Action → PaymentService → PaymentRepository → Prisma, aislando proveedores detrás de un contrato. Consultar `docs/PAYMENTS.md` antes de tocar este dominio.

