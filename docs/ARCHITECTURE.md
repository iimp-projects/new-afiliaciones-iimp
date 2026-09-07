# Arquitectura real del repositorio

## Estado de esta documentación

Este documento describe el código observado. No presenta la arquitectura objetivo como si ya estuviera implementada. La documentación previa de este archivo trataba autenticación y se solapaba con `AUTHENTICACION.md`; ese archivo conserva la documentación específica de autenticación.

## Stack actual

- Next.js 16.2 con App Router y Route Handlers.
- React 19, TypeScript, Tailwind CSS y React Hook Form.
- Prisma 6 sobre PostgreSQL.
- Auth.js v5, con sesiones persistidas/revocables en base de datos.
- Zod en algunos módulos; validadores propios en postulación.
- Infraestructura compartida: S3, correo, SMS, WhatsApp, SAP y APIS.net.pe en `modules/shared/Services`.

## Organización modular actual

`app/` contiene páginas, layouts y rutas HTTP. La lógica se distribuye principalmente en `modules/`, organizada por funcionalidad:

- `modules/afiliaciones/postulacion`: postulación, DTOs, entidades, validadores, repositorios, servicios, hooks, vistas y componentes.
- `modules/afiliaciones/expedientes`: workspace administrativo, validaciones y adaptadores de presentación.
- `modules/afiliaciones/consulta`: consulta pública y experiencia de pago.
- `modules/auth`: login, recuperación, sesión, contexto y seguridad.
- `modules/security`, `dashboard`, `navigation` y `shared`: capacidades transversales y administrativas.

Esto corresponde predominantemente a una organización Feature First/modular, no a una separación estricta de capas globales.

## Flujo predominante implementado

```text
View/Component
  → API client o Hook
  → Route Handler o Server Action
  → Service
  → Repository
  → Prisma
  → PostgreSQL
```

Ejemplos: `ApplicationApi` llama rutas de postulación; servicios como `StartApplicationService` y `SubmitApplicationService` dependen de `IApplicationRepository`; `ApplicationRepository` encapsula Prisma. Las Server Actions se usan, por ejemplo, en seguridad y dashboard. Las API routes se usan ampliamente para postulación, catálogos, consulta, expedientes y servicios externos.

## Excepciones actuales

La separación no es uniforme. Algunas rutas de `app/api`, como consulta y expedientes, y algunos servicios, acceden a `prisma` directamente. Esto es implementación actual, no un patrón que deba ampliarse por defecto.

También hay variaciones en validación y respuestas: postulación usa validadores de dominio, usuarios usa Zod y varias rutas validan manualmente el request.

## Referencia para desarrollos nuevos

Para funcionalidades de afiliaciones, tomar como referencia principal `modules/afiliaciones/postulacion`:

1. Definir DTOs/modelos o entidades necesarios.
2. Implementar el caso de uso en un Service.
3. Encapsular persistencia en un Repository y, cuando aplique, una interfaz.
4. Exponerlo mediante Route Handler o Server Action con controles de acceso.
5. Consumirlo desde un cliente API/hook y una View/Component.

Mantener las excepciones existentes si modificarlas excede el alcance, pero no introducir acceso directo a Prisma desde componentes cliente ni duplicar casos de uso ya existentes.

## Autenticación y autorización

`contextService` obtiene el ID de sesión desde Auth.js, valida la sesión en BD e hidrata usuario, rol y permisos. Expone `requireAuth`, `requireRole` y `requirePermission`. La aplicación usa RBAC basado en `Role`, `Permission` y `RolePermission`; `manage:all` funciona como comodín. Ver `AUTHENTICACION.md` para el detalle observado.

## Arquitectura recomendada para nuevos desarrollos

Aplicar el flujo predominante anterior, controles de autorización explícitos, validación en servidor y transacciones para cambios atómicos. Esto es una recomendación de evolución; no implica que todas las rutas actuales ya cumplan el patrón.

