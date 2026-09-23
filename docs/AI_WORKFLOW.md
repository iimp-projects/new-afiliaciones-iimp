# Flujo de trabajo con IA

## Archivos de entrada

| Herramienta | Archivo inicial |
| --- | --- |
| Codex y agentes compatibles | `AGENTS.md` |
| Claude Code | `CLAUDE.md`, que importa `AGENTS.md` |
| Gemini CLI | `GEMINI.md` |

Todos convergen en `BIBLE.md`, `RULES.md` y este índice. No mantengas tres versiones de las reglas.

## Protocolo para una tarea

1. Leer instrucciones raíz y documento del dominio.
2. Inspeccionar código, schema, pruebas y consumidores reales.
3. Explicar evidencia, supuestos y alcance.
4. Implementar el cambio mínimo.
5. Probar primero el área afectada y luego `npm run check`.
6. Ejecutar `npm run build` para cambios Next.js/RSC/configuración.
7. Actualizar documentación del contrato.
8. Entregar resultado, verificaciones y pendientes.

## Prompt recomendado

```text
Lee AGENTS.md, BIBLE.md, RULES.md y docs/README.md.
Después revisa el documento del dominio y el flujo real en código.
No inventes contratos ni modifiques schema/datos sin autorización.
Implementa el cambio mínimo, añade pruebas y ejecuta npm run check.
Si afecta Next.js, ejecuta también npm run build.
```

## Información que debe incluir una solicitud

- objetivo observable;
- usuario/rol afectado;
- ruta o módulo conocido;
- comportamiento actual y esperado;
- restricciones de datos, seguridad o compatibilidad;
- autorización explícita si implica schema, migraciones, datos o despliegue.

## Handoff entre asistentes

Una IA que entrega trabajo a otra debe registrar:

```text
Objetivo:
Estado:
Archivos modificados:
Decisiones tomadas:
Pruebas ejecutadas:
Resultados:
Riesgos/pendientes:
Acciones no autorizadas/no realizadas:
```

## Reglas contra alucinaciones

- No afirmar que una ruta, tabla o proveedor existe sin localizarlo.
- No convertir un documento histórico en estado actual.
- No inferir permisos desde la UI.
- No proponer un enum distinto del schema sin migración aprobada.
- No afirmar “todo limpio” si `lint:all` conserva warnings; indica la métrica exacta.
- No afirmar que una integración externa funciona sin prueba en un ambiente autorizado.
