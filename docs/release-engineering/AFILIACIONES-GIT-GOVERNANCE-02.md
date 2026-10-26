# AFILIACIONES IIMP — GIT-GOVERNANCE-02

**Fecha:** 2026-10-26
**Referencia:** `DEV-WORKFLOW-OPT-01.md`
**Modalidad:** auditoría + normalización + gobernanza. **Sin eliminación masiva de ramas, sin merges funcionales, sin despliegues.**

---

## 1. FASE 01 — Auditoría (estado real)

### 1.1 Inventario global
- Ramas locales: **66** · Ramas remotas: **47** · Worktrees: **48** (≈15 en `detached HEAD` prunable).
- Worktree principal (`afiliaciones-desarrollo`) en `integration/niubiz-cert-02-qa` con **64 entradas sin confirmar** (Niubiz/pagos + docs locales) → trabajo ajeno, **no tocar**.
- PRs abiertos: **4** (#30, #28, #27, #19).

### 1.2 Código e imagen realmente desplegados (verificado)

| Entorno | SHA autorizado / desplegado | Contenido |
|---|---|---|
| **PROD** | `AUTHORIZED_COMMIT_SHA = a6289b46…` (prod-deploy.yml en master) | testimonios `/postulacion` + 12 fotos (merge #29) |
| **QA** | última imagen desde `perf/ci-cd-registry-cache` (run 40385851856), árbol = `master fb1d79b` | mismo contenido de app que PROD (a6289b4) |

> Nota: QA se despliega por `workflow_dispatch` sobre refs arbitrarios; **no** desde `qa/stable`. Existe divergencia entre la rama `qa/stable` (17 commits detrás de master) y lo realmente desplegado en QA.

### 1.3 Ramas y PRs abiertos
| PR | Head → Base | Estado |
|---|---|---|
| #30 | perf/ci-cd-build-cache → master | **NO-GO** (caché gha, CI-CD-PERFORMANCE-02) → cerrar |
| #28 | feat/postulacion-testimonios-avatares → qa/stable | obsoleto (superado por feat/postulacion-testimonios-master, ya mergeado) → cerrar |
| #27 | docs/afiliaciones-release-audit-01 → master | docs, pendiente de revisión |
| #19 | feature/actualizar-contenido → master | contenido, pendiente |

---

## 2. FASE 02 — Estructura definitiva

**Ramas permanentes objetivo:** `qa` y `master`.

- `master` existe y es la rama productiva (default branch, `fb1d79b`).
- **No existe la rama plana `qa`** hoy: hay `qa/stable` (869a117, 17 detrás de master) y muchas `qa/*`. La gobernanza propone consolidar en una sola `qa`, pero **no se recrea ni se sobrescribe `qa` a partir de master** sin antes comparar el código realmente desplegado en QA (ver §1.2).
- `development` **no se elimina** hasta confirmar que sus funcionalidades pendientes (pagos, 8 commits) estén integradas y verificadas.

**Ramas temporales permitidas:** `feature/*`, `fix/*`, `hotfix/*`, `perf/*`, `docs/*`, `chore/*`, `release/*` (solo si necesario).

---

## 3. FASE 03 — Gobernanza implementada (archivos en rama `chore/git-governance`)

| Artefacto | Archivo |
|---|---|
| Conventional Commits en títulos de PR (validación CI) | `.github/workflows/pr-title-validation.yml` |
| Plantilla de PR (alcance, pruebas, migraciones, riesgos, rollback) | `.github/pull_request_template.md` |
| CODEOWNERS (Prisma, Terraform, workflows, dependencias, auth, pagos) | `.github/CODEOWNERS` |
| Auto-borrado de rama al mergear | setting del repo (`delete_branch_on_merge`) — pendiente de habilitar con permiso admin |

Reglas de promoción QA → PROD (ya vigentes, documentadas en `RELEASE-ARCH-03` / `AFILIACIONES-TESTIMONIOS-RELEASE-02`):
1. Despliegue QA desde ref/SHA exacto (`qa-deploy.yml`, `confirm_deploy`).
2. QA PASS verificado (run, SHA, imagen, health, funcionalidad).
3. Merge a `master` (PR, CI verde, sin bypass).
4. Commit `ci(prod)` que fija `AUTHORIZED_COMMIT_SHA` + `IMAGE_TAG` al SHA de contenido.
5. `prod-deploy.yml` `build_publish` → ECR inmutable → `deploy` (aprobación `environment: prod`) → blue/green + health.
6. Registro obligatorio de commit + digest + workflow + ambiente.

---

## 4. FASE 04 — Clasificación de ramas remotas

### 4.1 MERGED (integradas en `master`) — 26
`feat/postulacion-testimonios-master`, `feature/carnet-visualizacion-directa`, `feature/correos-masivos-worker`, `feature/sie-code-sync`, `fix/afiliaciones-subsanacion-legacy-qa`, `fix/correos-masivos-contadores`, `fix/correos-masivos-personalizacion`, `fix/correos-masivos-smtp`, `hotfix/fijar-ami-prod`, `integration/pr-consolidacion-master`, `integration/prod-qa-consolidacion-20261017`, `integration/qa-consolidacion-20261017`, `qa/adjuntos-opcionales`, `qa/carnet-virtual-qa`, `qa/correos-masivos`, `qa/correos-masivos-contadores`, `qa/correos-masivos-personalizacion`, `qa/correos-masivos-smtp`, `qa/notificaciones-sobre-carnet`, `qa/ocultar-menu-seguridad`, `qa/stable`, `release/correos-masivos-worker-prod`, `release/legacy-specialty-compatibility-prod`, `release/smtp-multiprovider-prod`, `release/subsanacion-legacy-prod`, `master`.

### 4.2 EQUIVALENT (contenido ya presente por squash/cherry-pick)
`feat/postulacion-testimonios-avatares` (≡ `feat/postulacion-testimonios-master`), `feature/actualizar-postulacion`, `feature/smtp-multiprovider-qa`, `feature/smtp-security-patch-qa`, `fix/afiliaciones-legacy-specialty-compatibility`, `hotfix/aval-fix-01`, `hotfix/aval-prod-minimal`, `hotfix/containment-subsanacion`, `recovery10-subsanacion-integration`, `release/aval-next-16.4.3`.

### 4.3 PENDING (funcionalidades exclusivas pendientes)
`development` (pagos, 8), `consolidation/afiliaciones-consolidacion-03` (pagos, 8), `integration/niubiz-cert-02-qa` (Niubiz CERT-02 + pagos, 8), `integration/recuperar-api-asociados` (4), `feature/carnet-virtual-mvp` (3), `feature/actualizar-contenido` (PR #19), `docs/afiliaciones-release-audit-01` (PR #27), `fix/ci-prisma-generate` (1).

### 4.4 BACKUP (preservar)
`backup/local-master-e799400`.

### 4.5 WIP (worktree activo / cambios sin confirmar)
Worktree principal `integration/niubiz-cert-02-qa` (64 entradas sin confirmar). No tocar.

### 4.6 OBSOLETE (candidatas a eliminación tras verificación)
`perf/ci-cd-build-cache` (NO-GO), `perf/ci-cd-registry-cache` (NO-GO). Locales sin remoto: `feat/postulacion-testimonios-asociados`, `feat/postulacion-testimonios-qa`, `feat/postulacion-testimonios-prod`, `ci/prod-testimonios`, `chore/git-governance` (una vez mergeada).

> **Criterio de borrado seguro:** solo ramas temporales remotas en estado MERGED/EQUIVALENT demostrado, sin PR abierto, sin despliegue dependiente y sin worktree que las referencie. Antes de borrar, registrar SHA + evidencia (manifiesto). No `push --force`, no `reset --hard`, no `clean` indiscriminado.

---

## 5. FASE 05 — CI/CD (verificado, sin cambios AWS)

- Workflows QA y PROD separados y vigentes: `qa-deploy.yml` (workflow_dispatch + confirm_deploy), `prod-deploy.yml` (build_publish + deploy, `AUTHORIZED_COMMIT_SHA`).
- Despliegue por SHA autorizado ✓ · gates de seguridad (`security.yml`: secrets, `SECURITY_RUNTIME_GATE` bloqueante, typecheck/lint/test, build) ✓ · imágenes ECR **inmutables** ✓ · Terraform plan revisado (rechaza destroy/replace) ✓ · blue/green controlado ✓ · rollback por re-apuntar `app_image_tag` ✓.
- Sin despliegues automáticos no autorizados (todo vía `workflow_dispatch` con aprobación `environment: prod`).
- **No se modificó infraestructura AWS.**

---

## 6. FASE 06 — Documentación

- **Creado:** `docs/release-engineering/AFILIACIONES-GIT-GOVERNANCE-02.md` (este documento).
- **Actualizados:** `docs/DEPLOYMENT.md`, `docs/PROD_DEPLOYMENT_RUNBOOK.md`, `docs/consolidacion/AFILIACIONES_GIT_CONVERGENCE_PLAN.md` (alinear política de ramas qa/master y prevención de cruces).

---

## 7. FASE 07 — Entrega

```text
BRANCH_POLICY           = Conventional Commits + temporales + permanentes qa/master
PERMANENT_BRANCHES      = qa, master
MERGED_BRANCHES         = 26 (listadas en §4.1)
EQUIVALENT_BRANCHES     = 10 (listadas en §4.2)
PENDING_BRANCHES        = 8 (listadas en §4.3)
BACKUP_BRANCHES         = 1 (backup/local-master-e799400)
DELETE_CANDIDATES       = perf/ci-cd-build-cache, perf/ci-cd-registry-cache (+ locales superseded)
DELETED_BRANCHES        = 0
DOCUMENTATION           = AFILIACIONES-GIT-GOVERNANCE-02.md + DEPLOYMENT + RUNBOOK + CONVERGENCE
CI_VALIDATION           = workflows verificados (sin cambios)
QA_MODIFIED             = NO
PROD_MODIFIED           = NO
```

---

## 8. Estado final (GIT-CLEANUP-04 / GIT-GOVERNANCE-05)

### 8.1 Ramas permanentes

| Rama | HEAD |
|---|---|
| `master` | `27e8e0eb171ea7afb74d0357f8e63058c37d346c` |
| `qa` | `27e8e0eb171ea7afb74d0357f8e63058c37d346c` (creada desde master, mismo árbol) |

- `qa` se creó desde `master` (no desde `qa/stable`), que coincide con el contenido realmente desplegado en QA.
- `qa/stable` se archivó como `archive/qa-stable-20261026` (era ancestro de master, sin commits exclusivos).

### 8.2 Ramas eliminadas

**Remotas (13):**
- `perf/ci-cd-build-cache`, `perf/ci-cd-registry-cache` (NO-GO, solo workflows).
- `feat/postulacion-testimonios-avatares`, `feat/postulacion-testimonios-master` (superadas/mergeadas por #29).
- `qa/adjuntos-opcionales`, `qa/carnet-virtual-qa`, `qa/correos-masivos`, `qa/correos-masivos-contadores`, `qa/correos-masivos-personalizacion`, `qa/correos-masivos-smtp`, `qa/notificaciones-sobre-carnet`, `qa/ocultar-menu-seguridad`, `qa/stable` (mergeadas en master; namespace `qa/` liberado).

**Locales (9):**
- `feat/postulacion-testimonios-asociados`, `-avatares`, `-master`, `-prod`, `-qa`, `ci/prod-testimonios`, `perf/ci-cd-build-cache`, `perf/ci-cd-registry-cache`, `chore/git-governance`.

### 8.3 Worktrees
Reducción de **51 → 32** (10 `prune` de prunables + 9 `worktree remove` de temporales limpios, sin `--force`). El worktree principal (`integration/niubiz-cert-02-qa`) con **64 cambios WIP de Niubiz/pagos se conserva intacto**.

### 8.4 Ramas pendientes conservadas
`development`, `consolidation/afiliaciones-consolidacion-03`, `integration/niubiz-cert-02-qa`, `integration/recuperar-api-asociados`, `feature/carnet-virtual-mvp`, `feature/actualizar-contenido` (PR #19), `docs/afiliaciones-release-audit-01` (PR #27), `fix/ci-prisma-generate`, `backup/local-master-e799400`, `archive/qa-stable-20261026`.

### 8.5 Política de auto-delete
`delete_branch_on_merge = true` habilitado en el repositorio. Las ramas temporales de PR se eliminan automáticamente tras el merge; `master`, `qa` y ramas de respaldo/archivo se preservan.

### 8.6 Flujo de cambios

```text
feature/* (rama temporal, Conventional Commits)
   └─ PR → qa   (CI + aprobación) → merge → qa-deploy.yml (solo desde 'qa')
        └─ QA PASS (SHA + digest + run + health verificados)
             └─ PR → master → merge → ci(prod) fija AUTHORIZED_COMMIT_SHA + IMAGE_TAG
                  └─ prod-deploy.yml (build_publish → deploy, aprobación environment: prod)
```

**Registro obligatorio de despliegue:** commit (SHA), digest de imagen ECR, workflow/run ID y ambiente (QA/PROD). La rama Git (`qa`/`master`) y la imagen realmente desplegada son cosas distintas: el SHA desplegado se registra aparte de la rama.

### 8.7 Guard propuesto para QA (QA_BRANCH_GUARD = READY)

`qa-deploy.yml` es `workflow_dispatch` sin ref fijo: hoy acepta cualquier rama `feature/*`. Propuesta (no aplicada en esta fase, sin despliegue de prueba):

```yaml
on:
  workflow_dispatch:
    inputs:
      confirm_deploy:
        description: "Confirm controlled deployment to QA"
        required: true
        default: false
        type: boolean
      rollback_image_tag:
        description: "Tag inmutable de imagen QA ya aprobada para rollback (vacío = despliegue normal)"
        required: false
        type: string
```

Guard (primer paso del job `build-and-deploy`):

```yaml
      - name: Verificar rama autorizada (qa) o rollback aprobado
        run: |
          if [ "$GITHUB_REF_NAME" != "qa" ]; then
            if [ -z "${{ inputs.rollback_image_tag }}" ]; then
              echo "Despliegue QA ordinario solo desde la rama 'qa' (actual: $GITHUB_REF_NAME)."
              exit 1
            fi
            echo "Rollback autorizado con imagen ${{ inputs.rollback_image_tag }}"
          fi
```

Reglas:
- Despliegue ordinario: **solo** desde la rama `qa` (no desde `feature/*`, no solo por SHA).
- Rollback controlado: vía `rollback_image_tag` (imagen previamente aprobada), sin saltarse el guard.
- No se modifica el mecanismo de seguridad; solo se restringe el ref permitido.
