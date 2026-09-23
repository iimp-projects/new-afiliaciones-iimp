# Índice de documentación

Este directorio contiene documentación técnica y funcional. El [README principal](../README.md), la [Bible](../BIBLE.md) y las [reglas](../RULES.md) son las puertas de entrada.

## Fuentes vigentes

| Documento | Alcance |
| --- | --- |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Arquitectura observada, capas y excepciones. |
| [QA_ARCHITECTURE.md](QA_ARCHITECTURE.md) | Ambiente QA: arquitectura AWS, Terraform, CI/CD, despliegue, costos y operación. |
| [AWS_ARCHITECTURE.md](AWS_ARCHITECTURE.md) | Propuestas productivas AWS (planificación, no implementado). |
| [BUSINESS_RULES.md](BUSINESS_RULES.md) | Reglas de negocio respaldadas por código y pendientes. |
| [APPLICATION_MATRIX.md](APPLICATION_MATRIX.md) | Estados y acciones de postulación/consulta. |
| [AUTHENTICACION.md](AUTHENTICACION.md) | Login, sesiones, contexto y RBAC. |
| [DATABASE.md](DATABASE.md) | Entidades, relaciones, identificadores y enums Prisma. |
| [PAYMENTS.md](PAYMENTS.md) | Estado y restricciones del dominio de pagos. |
| [DEVELOPMENT.md](DEVELOPMENT.md) | Preparación local y flujo de desarrollo. |
| [QUALITY_GATES.md](QUALITY_GATES.md) | Tipado estricto, ESLint, build y línea base. |
| [TESTING.md](TESTING.md) | Estrategia y convenciones Vitest. |
| [ENVIRONMENT.md](ENVIRONMENT.md) | Variables de entorno por capacidad. |
| [SECURITY.md](SECURITY.md) | Reglas de seguridad y tratamiento de hallazgos. |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Preflight y despliegue sin asumir plataforma. |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Flujo de contribución y revisión. |
| [AI_WORKFLOW.md](AI_WORKFLOW.md) | Uso coherente con Codex, Claude y Gemini. |
| [DECISIONS.md](DECISIONS.md) | Registro de decisiones técnicas relevantes. |

## Documentos históricos o puntuales

- [CONSULTA_VERIFICATION.md](CONSULTA_VERIFICATION.md): historia de la extracción OTP; la matriz vigente está en `APPLICATION_MATRIX.md`.
- [../auditoria_seguridad.md](../auditoria_seguridad.md): auditoría source-only de un momento concreto. Sus hallazgos deben revalidarse contra el código actual antes de cerrarlos o citarlos como vigentes.

## Política de mantenimiento

- Código, pruebas y `prisma/schema.prisma` ganan ante una discrepancia.
- Actualiza el documento del dominio junto con el cambio de contrato.
- No dupliques reglas: enlaza la fuente canónica.
- Marca propuestas, evidencia histórica y pendientes de confirmación.
- Nunca escribas secretos, credenciales, tokens o PII real.
