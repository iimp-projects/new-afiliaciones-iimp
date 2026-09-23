# Calidad, tipado estricto y compuertas

## Definición de “cero errores”

El repositorio está configurado con TypeScript `strict: true`. La compuerta principal es:

```bash
npm run check
```

Debe producir:

- 0 diagnósticos de `tsc --noEmit`;
- 0 errores ESLint;
- 0 pruebas Vitest fallidas.

El build de producción se valida por separado:

```bash
npm run build
```

Esto descubre fallos de prerender, límites RSC, `Suspense`, rutas y configuración que `tsc` no detecta.

## Línea base verificada

Última verificación local: 17 de septiembre de 2026.

| Control | Resultado |
| --- | --- |
| TypeScript strict | 0 errores |
| ESLint bloqueante | 0 errores |
| Vitest | 51 archivos, 413 pruebas aprobadas |
| Next.js production build | Aprobado |
| ESLint completo | 613 warnings heredados |

La línea base de warnings incluye aproximadamente 405 usos explícitos de `any`. Por eso “strict” no equivale todavía a “sin `any`”. `strict` controla inferencia y seguridad del compilador; un `any` explícito evade deliberadamente esos controles.

## Scripts

| Script | Uso |
| --- | --- |
| `npm run typecheck` | Compilador TypeScript sin emitir archivos. |
| `npm run lint` | Solo errores ESLint que bloquean cambios. |
| `npm run lint:all` | Errores y warnings para pagar deuda. |
| `npm test` | Suite Vitest completa. |
| `npm run check` | Typecheck + lint bloqueante + tests. |
| `npm run build` | Validación de producción Next.js. |

## Política de tipado

- No introducir `any` nuevo.
- Sustituir `any` existente por tipos de dominio de forma incremental.
- Usar `unknown` en JSON, webhooks y excepciones hasta validar.
- No cambiar un error por una assertion insegura.
- No desactivar `strict`, `isolatedModules` ni reglas globales para aprobar un cambio.
- No modificar `skipLibCheck` como sustituto de corregir tipos propios.

## Reducción de deuda

Trabaja por frontera, no por búsqueda/reemplazo global:

1. Selecciona un módulo.
2. Identifica entradas externas y modelo interno.
3. Añade Zod o type guards en la frontera.
4. Reemplaza `any` por tipos validados.
5. Añade pruebas de valores inválidos.
6. Ejecuta `npm run check` y compara `npm run lint:all`.

El objetivo es que el número de warnings solo baje. Si sube, el cambio debe justificarlo explícitamente.
