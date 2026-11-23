# AFILIACIONES IIMP — DEV-WORKFLOW-OPT-01

**Estado:** Política operativa propuesta para adopción por el equipo  
**Versión:** 1.0 — 26/10/2026  
**Aplicación:** Desarrollo local, ramas, PR, CI, despliegue QA y promoción PROD en `iimp-projects/new-afiliaciones-iimp`  
**Responsable de aprobación:** responsable técnico / equipo autorizado IIMP

> **REGLA PRINCIPAL:** Cambio pequeño → alcance pequeño → una rama temporal → validaciones pertinentes → QA → PROD. No repetir auditorías ni cambiar de estrategia sin un hallazgo nuevo y verificable.

## 1. Propósito y obligatoriedad

Este documento es la **referencia de trabajo** que el agente debe leer **antes de iniciar cualquier nueva tarea** de Afiliaciones IIMP. Define el procedimiento por defecto para entregar cambios de forma rápida, segura y trazable. No sustituye `AGENTS.md`, las protecciones de GitHub, políticas institucionales, controles de privacidad ni aprobaciones del entorno PROD: si existe un conflicto, **prevalece el control de seguridad o autorización más restrictivo** y se documenta la discrepancia.

**Alcance estricto:** los requisitos del usuario y los archivos expresamente autorizados. Un hallazgo fuera de alcance se registra, pero no habilita refactorizaciones, migraciones, sincronizaciones de ramas, actualizaciones globales ni cambios de infraestructura sin una decisión explícita.

## 2. Preflight único y breve (una vez por tarea)

Antes de modificar algo, registrar:

1. **Objetivo y aceptación:** qué comportamiento o contenido cambia y cómo se demostrará.
2. **Repositorio, base y destino reales:** `git status`, `git fetch --prune`, `git log`, `git branch -avv`, diferencias relevantes y mecanismo vigente de QA/PROD. No asumir que `qa/stable` es la rama más completa solo por su nombre. **En octubre 2026 se observó `master` 17 commits por delante de `qa/stable`; verificarlo de nuevo, no tratarlo como hecho permanente.**
3. **Estado de trabajos ajenos:** preservar cambios no commiteados, worktrees y ramas activas. Si hay cambios ajenos, trabajar en worktree aislado.
4. **Tipo de cambio y riesgos:** contenido/UI, lógica, esquema/datos, dependencias, pagos/auth/infra, datos personales e imágenes.
5. **Permisos necesarios:** publicación de fotografías en repo público, secretos, accesos, PR y approvals de deploy. Detectar bloqueos **antes** de implementar. Aprobación para publicar en web no implica automáticamente aprobación para versionar en GitHub público.

**Salida del preflight:** un breve reporte: `BASE`, `DESTINO_QA`, `TIPO`, `ARCHIVOS`, `RIESGOS`, `BLOQUEOS`, `PLAN`. No iniciar investigaciones generales si la información ya está documentada y vigente.

## 3. Política de ramas y commits

- **Una rama temporal por cambio** desde la base vigente y apropiada: `feat/<alcance>`, `fix/<alcance>`, `hotfix/<incidente>`, `refactor/<alcance>`, `chore/<alcance>`, `docs/<alcance>`.
- Preferir la base más reciente **que vaya a ser efectivamente promovida** y cumpla los controles. No mezclar una rama antigua de QA con una feature de master si eso arrastra commits ajenos o CI desactualizado.
- Si QA puede probar una rama basada en master mediante `workflow_dispatch`, usar esa capacidad **solo después de comprobar** qué commit e imagen exactos despliega; no cambiar `qa/stable` implícitamente. Si la política exige integrar a `qa/stable`, diseñar la integración mínima y obtener aprobación antes de incorporar commits ajenos.
- Commit pequeño y preciso, con Conventional Commits: `feat(postulacion): ...`, `fix(otp): ...`, `chore(ci): ...`.
- Verificar `git diff --stat` y lista de archivos antes del commit, PR y despliegue. No incluir archivos no solicitados.
- No crear ramas QA/PROD/avatares/fotos adicionales para el mismo cambio salvo una razón demostrable. Cuando se necesiten dos ramas para dos bases, documentar por qué y rastrear el **mismo cambio funcional**.
- **Prohibido:** `push --force`, `reset --hard` sobre trabajo ajeno, `git clean` indiscriminado, bypass `--admin` para saltar protecciones, borrado de ramas permanentes.
- Eliminar ramas temporales **solo después de integración y verificación del despliegue**, revisando worktrees, commits pendientes y usando `git branch -d` donde proceda.

## 4. Matriz de validaciones basada en riesgo

| Tipo | Validación local mínima | Controles antes de despliegue |
|---|---|---|
| Contenido, estilos o fotografías | comprobación de archivos/rutas, lint del archivo, typecheck si aplica, inspección visual local | CI obligatorio existente, build de artefacto, smoke de página, integridad de assets |
| Lógica de negocio / APIs | lint/typecheck, tests focalizados, pruebas de casos límite | CI, suite requerida por política, build, integración/smoke |
| Dependencias / seguridad | lockfile reproducible, auditoría enfocada, tests relevantes | security gates completos y regresión necesaria |
| Prisma / migraciones / datos | generación de cliente, validación de esquema y migración, tests | backup/rollback, revisión de migraciones, gates y smoke de BD |
| Auth, OTP, pagos, Niubiz, infraestructura | pruebas específicas completas, análisis de seguridad y cambios de configuración | approvals, integración, plan rollback, health y observabilidad |

**No significa omitir CI:** las pruebas obligatorias del repositorio siguen siendo obligatorias. Evitar repetir localmente suites completas **si ya hay evidencia válida para el mismo SHA y entorno**; ejecutar localmente pruebas focalizadas y dejar la suite completa al CI cuando la política lo permita. Los cambios de seguridad, auth y pagos no usan atajos por urgencia.

**Regla de no-repetición:** si ya existe un `PASS` verificable para el **mismo commit**, mismo lockfile y misma configuración relevante, **reutilizar evidencia**. Si cambian base, dependencias, configuración o código, invalidar solo las evidencias afectadas y repetir lo necesario. Un build local no sustituye el build de la imagen deployable ni la verificación de QA.

## 5. Flujo de entrega QA → PROD

1. **Implementar una sola vez:** rama/worktree aislado, alcance exacto, diff revisado.
2. **Validación enfocada:** completar lo requerido según §4; no correr manualmente todos los controles múltiples veces sin motivo.
3. **Push y PR:** crear un PR con descripción, capturas si procede, riesgos, pruebas y **solo archivos previstos**. Esperar CI y aprobaciones exigidas; no usar `--admin` como atajo.
4. **QA:** desplegar **ref/commit SHA exacto** a través del workflow oficial (`qa-deploy.yml` si continúa vigente); verificar que el pipeline esté autorizado para ese ref. **No confundir workflow iniciado con despliegue exitoso.**
5. **Verificación QA:** run concluido, imagen/tag y SHA, health, página/flujo probado, sin errores de consola/red y verificación de responsive/assets según alcance. Registrar `QA_STATUS=PASS/FAIL/BLOCKED`.
6. **PROD:** solo con QA PASS y aprobación aplicable. Integrar el cambio previsto en la rama productiva, comprobar diff, preparar el SHA de contenido autorizado según el workflow real (`prod-deploy.yml`, `AUTHORIZED_COMMIT_SHA`, `IMAGE_TAG`), build ECR, aprobación `environment: prod`, despliegue blue/green y health. **No modificar gates para acelerar el release.**
7. **Cierre:** comprobar SHA desplegado y funcionalidad en producción, `PROD_STATUS`, punto de rollback, limpieza segura de ramas temporales, registro de PR y run IDs.

**Cambios base:** si QA y master están desalineados, evaluar y declarar el contenido extra del despliegue. Nunca sincronizar 17 commits o aplicar un parche masivo automáticamente para un cambio de una sola página. Un despliegue desde master puede incluir esos 17 commits en la imagen aunque el diff de la feature sea de un archivo: reconocer el riesgo y requerir la validación correspondiente.

## 6. Fotografía, identidad y contenido personal

- Verificar **antes del push** si personas y entidad autorizaron la finalidad y distribución pública concreta, especialmente en repositorios públicos.
- No convertir una ausencia de permiso en permiso implícito ni incorporar fotos como Base64 o en otro archivo rastreado para eludir esta revisión.
- Si no hay autorización suficiente, elegir **una sola** salida acordada con el responsable: a) esperar autorización; b) avatares provisionales; c) almacenamiento institucional aprobado para servir fotografías, sin añadir las fotos a Git.
- **No retirar fotografías sin avisar** si las imágenes forman parte del criterio de aceptación: reportar expresamente que la versión es provisional.
- La autorización y el almacén elegido se registran una sola vez por release; no formular repetidamente la misma pregunta mientras no cambie la evidencia.

## 7. Política de ejecución del agente

**Obligatorio para el agente:**

1. Leer este documento al comienzo de cada tarea y mencionar el ID `DEV-WORKFLOW-OPT-01` en el plan.
2. Presentar **plan breve y ejecutable**, con la base y el SHA objetivo; no generar documentos extra de auditoría salvo solicitud del usuario.
3. Reutilizar ramas, PR y resultados existentes. Evitar ciclos de recreación y validación.
4. Avanzar sin pedir confirmaciones innecesarias para trabajo local de bajo riesgo. **Pedir o respetar autorización** para publicación de datos/fotografías, cambios fuera de alcance, PROD y acciones irreversibles según los controles aplicables.
5. Dar un solo reporte de bloqueo: causa, evidencia, impacto, opción recomendada y siguiente acción concreta. No volver a consultar la misma cuestión sin información nueva.
6. Nunca usar tests verdes locales como sinónimo de QA desplegado; nunca llamar `PASS` a un run iniciado.
7. Reportar cronología y métricas por etapa: preflight, implementación, tests, espera CI, build imagen, despliegue SSM/ASG, smoke. Identificar la etapa lenta con datos reales.
8. No limpiar Docker, volúmenes, cachés compartidas, ramas o worktrees sin alcance y confirmación de seguridad; no confundir optimización de desarrollo con limpieza de disco.

## 8. Optimización de CI/CD (tarea separada)

Realizar después de cerrar el release activo, con baseline y evidencia:

- Medir duración por job y etapa en 3 ejecuciones representativas (o las disponibles).
- Evaluar `npm ci` + cache de npm, cache BuildKit/Docker (sin compartir secretos), reutilización de imágenes por digest/SHA y pasos no duplicados.
- Mantener gates de seguridad, reproducibilidad, approvers y health checks.
- Validar que cualquier ejecución condicional de tests no deja de cubrir cambios indirectos en módulos compartidos.
- Comparar antes/después y revertir la optimización si pierde fiabilidad.

**Meta:** reducir trabajo duplicado; **no se garantiza un tiempo fijo de 2–5 minutos** para despliegues completos con Docker/AWS.

## 9. Checklist obligatorio de cada tarea

```text
[ ] Leí DEV-WORKFLOW-OPT-01 y AGENTS.md/políticas aplicables.
[ ] Definí cambio, archivos permitidos, riesgos y autorización requerida.
[ ] Elegí y verifiqué la base vigente; identifiqué qué entra realmente a QA.
[ ] Aislé trabajo ajeno en worktree y usé una rama temporal.
[ ] Diff mínimo validado y sin secretos/PII no autorizada.
[ ] Pruebas requeridas pasaron para el SHA candidato.
[ ] PR/CI sin omitir protecciones.
[ ] QA desplegado: SHA, run, health y prueba funcional verificables.
[ ] PROD aprobado y desplegado: SHA, run, health y rollback verificables (si aplica).
[ ] Limpieza segura, informe breve, tiempos y pendientes.
```

## 10. Formato de informe final (máximo una pantalla, salvo incidentes)

```text
CAMBIO:
BASE / RAMA / SHA:
ARCHIVOS:
VALIDACIONES: PASS / FAIL (evidencias)
PR / CI:
QA_STATUS: PASS / FAIL / BLOCKED | SHA | URL | run ID
PROD_STATUS: PASS / FAIL / BLOCKED / NOT_REQUESTED | SHA | run ID
RIESGOS / BLOQUEOS:
TIEMPOS POR ETAPA:
PRÓXIMO PASO ÚNICO:
```

## 11. Instalación como punto de referencia

1. Guardar este archivo en `docs/release-engineering/DEV-WORKFLOW-OPT-01.md` del repositorio, mediante un PR independiente `docs(workflow): establecer política de cambios y despliegues`.
2. Añadir en el `AGENTS.md` raíz, sin reemplazar sus reglas actuales, la directiva:

   > **Antes de modificar, integrar o desplegar Afiliaciones IIMP, leer `docs/release-engineering/DEV-WORKFLOW-OPT-01.md` y aplicar su checklist. Si entra en conflicto con protecciones, reglas de seguridad o autorizaciones, respetar el control más estricto.**

3. No afirmar que la política es vinculante en el repositorio hasta que ese PR sea revisado, aprobado e integrado. Para los próximos prompts, indicar expresamente: **«Aplica DEV-WORKFLOW-OPT-01 antes de ejecutar»**.

---

**Principio de cierre:** Primero entregar el cambio solicitado con seguridad y evidencia; después optimizar el pipeline. No usar una pequeña corrección visual como excusa para iniciar una migración o auditoría general.
