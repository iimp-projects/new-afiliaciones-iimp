# Reglas obligatorias de ingeniería

Estas reglas aplican a humanos y asistentes de IA. “Debe” indica requisito; una excepción exige justificación escrita y aprobación cuando afecte datos, seguridad o contratos.

## 1. Alcance y fuentes

- Lee `BIBLE.md`, este archivo y el documento del dominio antes de editar.
- Usa código, pruebas y `prisma/schema.prisma` como evidencia; no inventes comportamiento.
- Haz el cambio mínimo que resuelve el objetivo.
- Conserva cambios ajenos y no reformatees archivos no relacionados.
- Marca claramente lo implementado, lo propuesto y lo pendiente de confirmar.

## 2. TypeScript estricto

- `strict: true` permanece habilitado. No uses flags locales para evadirlo.
- Código nuevo o modificado no introduce `any`, `as any`, `@ts-ignore` ni tipos vacíos para silenciar errores.
- En fronteras externas usa `unknown` y valida antes de estrechar el tipo.
- Prefiere tipos de dominio, DTOs y esquemas Zod explícitos.
- Usa tipos generados por Prisma para payloads y operaciones persistentes.
- Evita assertions (`as`) salvo que exista una invariante comprobada que TypeScript no pueda expresar; documenta esa invariante.
- Para excepciones temporales usa `@ts-expect-error` con motivo y referencia de eliminación; nunca `@ts-ignore`.
- No dupliques enums persistidos como strings desconectados del schema.
- Las respuestas HTTP, resultados de Services y props públicas deben tener contratos estables y explícitos.
- Toda promesa se espera, retorna o marca intencionalmente con `void`.

## 3. ESLint y deuda

- `npm run lint` debe terminar con cero errores.
- `npm run lint:all` muestra warnings heredados; ningún cambio debe aumentar su cantidad sin justificación.
- Una regla no se desactiva globalmente para aprobar un archivo.
- La migración de `any` se hace por frontera o dominio, con pruebas, no mediante reemplazo ciego por `unknown`.

## 4. Next.js 16 y React 19

- Revisa la documentación instalada en `node_modules/next/dist/docs/` antes de cambiar APIs de Next.js.
- Server Components son el valor por defecto. Añade `"use client"` solo donde exista interacción, estado o API del navegador.
- Un Client Component nunca es `async`.
- Props Server → Client deben ser serializables; convierte `Date` a string y clases a DTOs planos.
- `params`, `searchParams`, `cookies()` y `headers()` se tratan como APIs asíncronas según Next.js 16.
- `useSearchParams()` debe quedar bajo `Suspense` cuando la ruta pueda prerenderizarse.
- No declares componentes dentro de componentes; usa composición y variantes explícitas.
- Evita proliferación de props booleanas; prefiere children, componentes compuestos o variantes con nombres.
- Usa `next/image` para imágenes de interfaz cuando sea compatible.
- Paraleliza operaciones independientes con `Promise.all`; evita waterfalls involuntarios.
- Usa `proxy.ts`; no recrees `middleware.ts`.

## 5. Capas y datos

- Componentes y Views no importan Prisma.
- Route Handlers y Server Actions validan entrada, autentican/autorizan y delegan.
- Services contienen casos de uso y reglas; no detalles visuales.
- Repositories encapsulan Prisma y no devuelven modelos de presentación.
- Para lecturas internas en Server Components, evita rondas HTTP innecesarias; para APIs externas/webhooks usa Route Handlers.
- Para mutaciones de UI, conserva el patrón existente del módulo; no mezcles Route Handler y Server Action sin razón.
- No amplíes accesos directos heredados a Prisma.

## 6. Prisma y PostgreSQL

- No edites schema, migraciones ni datos sin autorización explícita.
- Revisa relaciones, enums, índices, seeds y consumidores antes de cambiar persistencia.
- Reutiliza la instancia única de `lib/prisma.ts`.
- Usa transacciones para invariantes que abarcan varias escrituras.
- No uses SQL dinámico con entrada no confiable.
- Después de un cambio autorizado de schema, genera el cliente y valida schema/migración antes de compilar.

## 7. Seguridad

- Toda ruta protegida aplica autorización en servidor; ocultar un botón no protege nada.
- Valida y limita body, query, archivos, MIME, tamaño y URLs externas.
- Secretos solo en servidor y variables de entorno; nunca logs, commits, respuestas ni `NEXT_PUBLIC_*`.
- No registres OTP, tokens, cookies, contraseñas, PII completa ni payloads sensibles.
- Compara pagos contra monto, moneda, solicitud y proveedor persistidos; callbacks deben verificarse y ser idempotentes.
- Revisa [docs/SECURITY.md](docs/SECURITY.md) y el reporte de auditoría antes de tocar superficies críticas.

## 8. Pruebas

- Prueba comportamiento observable, autorización, errores y transiciones; no detalles internos triviales.
- Usa Vitest y mocks solo para dependencias externas o fronteras costosas.
- Restablece mocks y variables de entorno entre pruebas.
- Un bug corregido debe incluir una prueba de regresión cuando sea viable.
- Las pruebas no llaman servicios reales, no envían mensajes y no modifican bases compartidas.
- Los tests del proyecto excluyen `.agents/**`.

## 9. Documentación

- Si cambia un contrato, actualiza el documento del dominio en el mismo cambio.
- No copies reglas de negocio en varios archivos; enlaza la fuente canónica.
- Documentos históricos deben declararlo al inicio.
- No incluyas secretos ni valores reales de producción.
- Usa fechas absolutas y resultados reproducibles cuando documentes una verificación.

## 10. Definition of Done

```bash
npm run check
npm run build
```

Además:

- pruebas nuevas o actualizadas según riesgo;
- `npm run lint:all` sin aumento injustificado de warnings;
- ninguna migración, seed, despliegue, commit o push implícito;
- resumen final con archivos, verificaciones y riesgos pendientes.
