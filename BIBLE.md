# Bible del proyecto

Este documento es el mapa canónico de la Plataforma de Afiliaciones IIMP. Explica qué es el sistema, qué fuentes mandan y qué invariantes no deben romperse. No reemplaza la documentación detallada de `docs/`.

## 1. Propósito

La plataforma gestiona el ciclo de afiliación al IIMP:

- inicio, recuperación y envío de postulaciones;
- verificación OTP y consulta pública;
- avales, observaciones y subsanaciones;
- evaluación interna por áreas;
- expedientes, asociados e integraciones;
- autenticación, sesiones, roles, permisos y auditoría;
- preparación, autorización y registro del flujo de pagos.

## 2. Orden de autoridad

Cuando dos fuentes discrepen, usa este orden:

1. `prisma/schema.prisma` para estructura, relaciones y enums persistidos.
2. Código ejecutable y pruebas para comportamiento implementado.
3. `BIBLE.md`, `RULES.md` y documentos vigentes de `docs/`.
4. Documentos marcados como históricos, propuestas o auditorías puntuales.

Nunca inventes campos, estados, permisos, endpoints, montos, credenciales ni contratos de proveedores. Registra la discrepancia y solicita decisión cuando cambie el comportamiento del negocio.

## 3. Stack vigente

- Next.js 16.2 con App Router y `proxy.ts`.
- React 19 y TypeScript estricto.
- Prisma ORM 6.19 con PostgreSQL.
- Auth.js 5 beta, sesiones persistidas y RBAC.
- Tailwind CSS 4, React Hook Form y Zod.
- Vitest 4 para pruebas automatizadas.
- Servicios externos observados: AWS S3/SNS, SMTP, WhatsApp, SAP, APIS.net.pe y configuración de Niubiz.

## 4. Mapa de dominios

| Dominio | Ubicación principal | Responsabilidad |
| --- | --- | --- |
| Postulación | `modules/afiliaciones/postulacion` | Draft, validación, envío, OTP, avales y persistencia del expediente. |
| Consulta | `modules/afiliaciones/consulta` | Acceso verificado, estado, observaciones y continuación del flujo. |
| Expedientes | `modules/afiliaciones/expedientes` | Revisión interna, validaciones, observaciones y workspace. |
| Asociados | `modules/afiliaciones/asociados` | Consulta y operación sobre asociados. |
| Pagos | `modules/afiliaciones/payments` | Autorización, proveedores y estado del pago. Leer `docs/PAYMENTS.md`. |
| Autenticación | `modules/auth` | Login, activación, recuperación, sesiones y contexto autenticado. |
| Seguridad | `modules/security` | Usuarios, roles, permisos, auditoría y configuración. |
| Compartido | `modules/shared` | Servicios e interfaz reutilizable; no debe absorber reglas de dominio. |
| Rutas | `app` | Páginas, layouts, Route Handlers y composición del App Router. |
| Persistencia | `prisma` y repositorios | Schema, migraciones, seeds y acceso a PostgreSQL. |

## 5. Arquitectura preferida

```text
View/Component
  → API client/Hook
  → Route Handler o Server Action
  → Service
  → Repository
  → Prisma
```

- UI: presentación e interacción; sin Prisma ni secretos.
- Borde HTTP/acción: autentica, autoriza, valida y traduce el contrato.
- Service: caso de uso y reglas de negocio.
- Repository: persistencia y consultas.
- Prisma: modelo físico y transacciones.

`modules/afiliaciones/postulacion` es la referencia principal para casos nuevos. El repositorio contiene excepciones heredadas; no las amplíes por comodidad.

## 6. Invariantes de negocio

- `MembershipApplication.id`, `applicationCode` y `trackingCode` tienen propósitos distintos y no son intercambiables.
- El estado global usa los valores de `ApplicationStatus` del schema.
- `trackingCode` identifica una solicitud, pero no concede autorización por sí solo.
- El servidor vuelve a validar identidad, estado, permisos, montos y transiciones; la UI nunca es frontera de seguridad.
- Una corrección de solicitud observada solo puede alterar campos autorizados por observaciones pendientes.
- Cambios atómicos de solicitud, validaciones, observaciones y pagos requieren transacción cuando varias escrituras forman una sola operación.
- Los montos y la elegibilidad de pago se resuelven en servidor.
- Nunca se almacenan PAN, CVV ni secretos de proveedor.

La matriz vigente está en [docs/APPLICATION_MATRIX.md](docs/APPLICATION_MATRIX.md) y las reglas observadas en [docs/BUSINESS_RULES.md](docs/BUSINESS_RULES.md).

## 7. Autenticación y autorización

- Usa `contextService.requireAuth`, `requireRole` o `requirePermission` en cada frontera protegida.
- El proxy mejora navegación, pero no sustituye autorización dentro de páginas, Route Handlers o Server Actions.
- `manage:all` es el comodín administrativo observado.
- Los secretos y objetos Prisma permanecen en módulos de servidor.
- No confíes en IDs, emails, estados, roles o permisos enviados por el navegador.

## 8. Calidad vigente

`strict: true` y `npm run check` son obligatorios. “Cero errores” significa:

- cero diagnósticos TypeScript;
- cero reglas ESLint con severidad de error;
- cero pruebas fallidas.

`npm run lint:all` conserva advertencias heredadas para migración. No significa que el repositorio esté libre de `any`; consulta [docs/QUALITY_GATES.md](docs/QUALITY_GATES.md).

## 9. Operaciones sensibles

Requieren autorización explícita y revisión del impacto:

- modificar `prisma/schema.prisma`;
- crear o aplicar migraciones;
- ejecutar seeds o scripts que cambien datos;
- activar proveedores reales de pago o mensajería;
- cambiar secretos, IAM, buckets o credenciales;
- desplegar, hacer commit, push o reescribir historial.

## 10. Criterio de terminado

Un cambio está terminado cuando:

1. respeta `RULES.md` y la documentación del dominio;
2. valida entrada, autenticación y autorización donde corresponda;
3. incluye pruebas proporcionales al riesgo;
4. ejecuta `npm run check` sin errores;
5. ejecuta `npm run build` cuando afecta Next.js, configuración o fronteras RSC;
6. actualiza documentación si cambió un contrato o una regla;
7. declara deuda, supuestos y verificaciones no realizadas.
