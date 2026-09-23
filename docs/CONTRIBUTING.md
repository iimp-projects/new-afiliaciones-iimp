# Guía de contribución

## Antes de empezar

Lee [BIBLE.md](../BIBLE.md), [RULES.md](../RULES.md) y el documento del dominio. Confirma el alcance y revisa cambios locales existentes.

## Cambio esperado

- Pequeño y enfocado.
- Sin reescrituras laterales.
- Contratos tipados y validados.
- Autorización en servidor.
- Pruebas proporcionales al riesgo.
- Documentación actualizada.

## Checklist de revisión

- [ ] No se introdujo `any`, `@ts-ignore` o una assertion insegura.
- [ ] No se accede a Prisma desde UI.
- [ ] Entradas y respuestas tienen contrato.
- [ ] Permisos y pertenencia del recurso se verifican en servidor.
- [ ] Escrituras atómicas usan transacción.
- [ ] No aparecen secretos o PII en logs/diffs.
- [ ] Existe prueba de regresión para bugs.
- [ ] `npm run check` pasa.
- [ ] `npm run build` pasa cuando corresponde.
- [ ] `npm run lint:all` no aumenta deuda sin explicación.
- [ ] La documentación refleja cualquier cambio de contrato.

## Commits y entrega

No existe una convención de commits confirmada en el repositorio; no inventes una como requisito. Describe en la entrega:

- resultado funcional;
- archivos principales;
- comandos ejecutados y resultados;
- migraciones/configuración necesarias;
- riesgos o trabajo pendiente.
