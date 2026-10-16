# Migración de asociados históricos SIE → Afiliaciones V2

Resumen de las fases de habilitación de acceso (FASE 3 y 4) y enriquecimiento de
perfiles (FASE 5) para asociados históricos SIE en PRODUCCIÓN.

- Fecha: 2026-10-15
- Rama de integración: `release/directorio-unificado-prod`
- Región AWS: `us-east-2` (cuenta `564914947461`)
- Fuente oficial: `C:\Users\maxic\Downloads\ASOCIADOS.xlsx` (leído in-situ, **no** versionado)

## Principios de seguridad

- La `Clave` SIE (columna 4 del Excel) **nunca** se procesa, registra ni exporta.
- Las contraseñas se importan únicamente como hash bcrypt (cost 12).
- No se sobrescriben credenciales ni cuentas existentes; sólo se llenan campos vacíos.
- No se envían correos; no se crean postulaciones ni pagos ficticios.
- El identificador de acceso es el **correo oficial SIE**; el DNI y el código no sustituyen al correo.

## FASE 3 — Activación de cuentas históricas PENDING

- Estado previo: `PENDING = 2901`, `ACTIVE = 3423`.
- Se importó la `Clave` SIE como bcrypt (cost 12), se marcó `mustChangePassword=true` y se
  transicionó `PENDING → ACTIVE` con `emailVerified`.
- Script: `scripts/sie-legacy-activate.ts` → `SieLegacyCredentialService.activateLegacyAccount`.
- Resultado: `ACTIVE = 6324`, `PENDING = 0`, 2901 credenciales importadas (0 duplicadas),
  2901 eventos de auditoría `SIE_LEGACY_ACCOUNT_ACTIVATION`.
- Commit: `e856422` (junto con FASE 4).

## FASE 4 — Provisión de cuentas históricas sin cuenta V2

- Históricos A/E LINKED sin cuenta: **280** (255 Activo + 25 Estudiante).
- Cuentas creadas: **266** (email oficial SIE + Clave bcrypt + `ACTIVE` + `mustChangePassword=true`
  + rol `ASOCIADO_ACTIVO`/`ASOCIADO_ESTUDIANTE` según categoría).
- Script: `scripts/sie-legacy-provision.ts` → `SieLegacyCredentialService.provisionLegacyAccount`.
- Resultado: `ACTIVE = 6590`; 14 casos sin provisionar por **email duplicado** en el padrón SIE
  (9 comparten un correo placeholder `ab…@fmi.com` y 5 comparten correo con una cuenta ya provisionada).
- Commit: `e856422` (`feat(sie): activar y provisionar cuentas históricas SIE …`).

## FASE 5 — Enriquecimiento de datos personales y geográficos

- Personas históricas analizadas: **11052**; con datos faltantes: **7871**.
- Campos completados (solo vacíos; sin sobrescribir):
  - Fecha de nacimiento: **311**
  - Teléfono: **242**
  - Dirección (calle + país + jerarquía ubigeo): **3482**
- Mapeo geográfico (SIE → V2):
  - Países: **30** (nombre normalizado + sinónimos)
  - Departamentos: **24**, Provincias: **91**, Distritos: **229** (ubigeo estándar 6 dígitos + códigos legacy `LEG-75:dept:prov:dist`)
- Script: `scripts/sie-historical-profile-enrichment.ts` (DRY-RUN por defecto, idempotente,
  transaccional, advisory-lock por persona, auditoría `SIE_HISTORICAL_PROFILE_ENRICHMENT`).
- Frontend: se añadió `country` al DTO (`asociados.actions.ts`) y los campos
  País/Departamento/Provincia/Distrito a la pestaña Información (`AsociadoDetailContent.tsx`).
- Imagen desplegada: `prod-e856422-enrich` (ASG instance-refresh `Successful`).

### Corrección de nacionalidad (residencia ≠ nacionalidad)

El campo SIE `Pais` está agrupado con la **dirección** (Direccion + Departamento + Provincia +
Distrito), por lo que representa el **país de residencia**, no la nacionalidad. La asignación
inicial de `persons.nationality_id` desde `Pais` fue **revertida** (7869 registros vueltos a
`NULL`) porque no constituía evidencia válida de nacionalidad. El país de residencia sigue
correctamente guardado en `person_addresses.country_id`.

## Exclusiones documentadas

- **Identidad**: 249 personas excluidas (nombres SIE no corresponden al multiconjunto de nombres V2).
- **Geografía**: 684 direcciones creadas sin distrito (códigos SIE ausentes, país extranjero sin
  jerarquía resoluble o sin correspondencia en el catálogo V2). No se asignaron ubicaciones aproximadas.
- **Cuentas**: 14 históricos sin cuenta por correo duplicado (pendiente de corrección en el padrón SIE).

## Respaldos

- `afiliaciones-prod-pre-access-migration-20261015` (antes de la activación/provisión).
- `afiliaciones-prod-pre-profile-enrichment-20261015` (antes del enriquecimiento de perfiles).

## Verificaciones

- Login con correo oficial + Clave SIE → `mustChangePassword=true`; `bcrypt.compare` verificado.
- DNI 07761343 (código 00893) y DNI 08200623 (código 00225): cuentas ACTIVE, perfil enriquecido,
  jerarquía geográfica verificada (Perú → Lima → Lima → distrito).
- `ACTIVE_USERS = 6590`; credenciales intactas (`CREDENTIALS_MODIFIED = 0`); `EMAILS_SENT = 0`.
- TypeScript / ESLint / Vitest (202 archivos, 1766 tests) en verde.

## Pendientes

1. Corregir en el padrón SIE el correo de los **14 asociados** con correo duplicado y re-ejecutar
   `sie-legacy-provision.ts` (idempotente).
2. Revisión manual de los **249 conflictos de identidad**.
3. Obtener una fuente oficial de **nacionalidad** (el SIE no expone nacionalidad distinta del país
   de residencia) antes de volver a poblar `nationality_id`.
4. **684 conflictos geográficos**: completar jerarquía cuando el padrón SIE disponga de códigos
   de departamento/provincia/distrito completos y correspondientes al catálogo V2.
