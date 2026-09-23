# Desarrollo local

## Requisitos

- Node.js 20.9 o superior.
- npm.
- PostgreSQL accesible.
- Variables de entorno locales basadas en `.env.example`.

## Preparación

```powershell
npm.cmd install
Copy-Item .env.example .env
npx.cmd prisma generate
npm.cmd run dev
```

En shells donde `npm.ps1` esté bloqueado, usa `npm.cmd` y `npx.cmd`.

No copies credenciales reales a documentación, issues o conversaciones. `.env` es local y no debe versionarse.

## Flujo diario

1. Lee `BIBLE.md`, `RULES.md` y el documento del dominio.
2. Ubica el flujo completo y sus consumidores antes de editar.
3. Implementa el cambio mínimo.
4. Añade o actualiza pruebas.
5. Ejecuta `npm run check`.
6. Ejecuta `npm run build` si tocaste rutas, Server/Client Components, configuración o dependencias.
7. Revisa `npm run lint:all` para no aumentar warnings.
8. Actualiza documentación si cambió un contrato.

## Prisma

Comandos de solo verificación o generación local:

```powershell
npx.cmd prisma validate
npx.cmd prisma generate
```

No ejecutes automáticamente:

- `prisma migrate dev`, `migrate deploy` o `db push`;
- seeds;
- scripts de backfill, merge, deactivación o migración;
- consultas que modifiquen datos.

Esas operaciones requieren autorización, base objetivo confirmada, respaldo y plan de reversión.

## Estructura de un caso de uso

Para funcionalidad nueva dentro de afiliaciones:

1. Define DTO/tipo/esquema de entrada.
2. Valida en la frontera del servidor.
3. Aplica autenticación y permiso.
4. Delega reglas a un Service.
5. Encapsula persistencia en Repository.
6. Usa transacción si hay una invariante multi-escritura.
7. Retorna un contrato pequeño y serializable.
8. Prueba éxito, rechazo, autorización y error relevante.

Consulta `modules/afiliaciones/postulacion` como referencia, sin asumir que todas sus decisiones aplican a otros dominios.

## Diagnóstico

- Error de tipos: `npm run typecheck`.
- Error de lint: `npm run lint`.
- Advertencias completas: `npm run lint:all`.
- Prueba concreta: `npx vitest run ruta/al/archivo.test.ts`.
- Schema: `npx prisma validate`.
- Error RSC/prerender: `npm run build`; no confíes solo en `next dev`.
