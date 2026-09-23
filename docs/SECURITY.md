# Seguridad de desarrollo

## Modelo básico

La aplicación procesa identidad, contactos, documentos, expedientes, decisiones de evaluación y pagos. Trata esos datos como sensibles aunque no todos sean secretos.

Fronteras principales:

- navegador ↔ Route Handler/Server Action;
- rutas públicas de postulación y consulta;
- usuarios internos ↔ recursos/áreas autorizadas;
- aplicación ↔ PostgreSQL, S3/SNS, SMTP, WhatsApp, SAP y pagos;
- callbacks y enlaces con tokens.

## Reglas obligatorias

- Autentica y autoriza en servidor por operación y recurso.
- Valida toda entrada externa con esquema o guard explícito.
- Aplica rate limiting a login, OTP, recuperación, uploads y proxies de costo.
- Minimiza PII en respuestas, logs y errores.
- Los tokens deben tener propósito, audiencia, expiración y, cuando aplique, uso único.
- Para archivos valida tamaño, MIME, extensión, prefijo de almacenamiento y ownership.
- No renderices HTML no confiable sin sanitización allow-list.
- No hagas `fetch` de URLs controladas por usuario sin allow-list y protección SSRF.
- No desactives TLS ni sandboxing fuera de un entorno aislado y documentado.
- Los callbacks de pago verifican autenticidad, idempotencia, monto y moneda.
- Seeds de producción nunca usan contraseñas conocidas o valores por defecto.

## Auditoría existente

[auditoria_seguridad.md](../auditoria_seguridad.md) contiene una revisión source-only y hallazgos de severidad crítica a media. Es evidencia puntual, no una garantía de estado actual.

Antes de cambiar autenticación, expedientes, S3, OTP, PDF, SAP o pagos:

1. revalida el hallazgo relacionado contra el código actual;
2. añade una prueba de explotación segura o regresión cuando sea viable;
3. corrige la causa raíz, no solo la UI;
4. actualiza el estado del hallazgo con evidencia y fecha.

El fallback hardcodeado para `APIS_NET_PE_TOKEN` fue eliminado del código el 17 de septiembre de 2026. El valor previamente expuesto debe seguir tratándose como comprometido hasta que su rotación en APIS.net.pe quede confirmada fuera del repositorio.

Los controles de propósito, uso único, restauración ligada y reconciliación de pagos fueron incorporados el 17 de septiembre de 2026. La firma/autenticidad específica del callback Niubiz permanece bloqueada hasta disponer del contrato oficial del producto contratado. La purga del secreto en el historial Git exige una reescritura coordinada y no debe ejecutarse unilateralmente.

## Reporte responsable

No incluyas secretos ni PII real en un reporte. Registra:

- superficie y precondiciones;
- impacto comprobado frente a impacto inferido;
- pasos mínimos de reproducción en entorno aislado;
- remediación propuesta;
- pruebas que demuestran el cierre.
