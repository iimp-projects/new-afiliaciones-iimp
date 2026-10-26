# AFILIACIONES-RELEASE-AUDIT-01 — Consolidación general

> Auditoría integral del repositorio `iimp-projects/new-afiliaciones-iimp`.
> Modalidad: **solo lectura** (sin merges, rebases, cherry-picks, resets, force-push, migraciones, `terraform apply`, ni cambios AWS).
> Fecha: 2026-10-26 · Autor: auditoría automatizada (agente) · Cuenta GitHub: `maxichajaya2` · AWS: `564914947461` (solo `describe`/`get`, sin mutación).

- **Rama por defecto:** `master`.
- **Remoto:** `origin` = https://github.com/iimp-projects/new-afiliaciones-iimp.git (único).
- **Tags / releases:** ninguno (sin `git tag`, sin releases de GitHub).
- **Worktrees:** 30+ (varios `detached`/`prunable`). Ninguno tocado.
- **Worktree auditado:** `C:\xampp\htdocs\afiliaciones-desarrollo` (rama `integration/niubiz-cert-02-qa`, con cambios sin confirmar).

Cada hallazgo se marca **CONFIRMADO**, **PROBABLE** o **NO VERIFICADO**.

---

## 1. FASE 01 — Inventario

### 1.1 Versiones realmente desplegadas (CONFIRMADO vía AWS + GitHub)

| Ambiente | Ref / SHA | Imagen / digest | Evidencia |
|---|---|---|---|
| **PROD** | commit `ba591b4` (merge PR #26) | `prod-ba591b49b5e6827237167922951adc9e65c77779` — `sha256:3d8e09f4f93d1f9bf16bc7cbec18647fbd39150ebf2f53927a022d92493f231d` | Launch Template `afiliaciones-prod-lt-20261002165621212700000001` (`$Latest`) → `IMAGE=...:prod-ba591b49...`. ASG `afiliaciones-prod-asg` 1/1/1 (instancia `i-0efa71babfe37aa17`). Deploy record `7305543977` (ref `master` SHA `a204222`, 2026-10-24T22:45:47Z). |
| **QA** | `feature/smtp-security-patch-qa` SHA `56510f0` | `qa-56510f0a8eb8b882963ef0c5b5a241a8654712df-40025112228-1` — `sha256:3fcb21b293881a8e5d46fbecc0c1535840ca8acc9a300bd1cca1a19ede3afb6e` | Instancia `i-095d15242588ec268` (EC2, deploy por SSM `AfiliacionesQaDeploy`). Deploy record `7288957042` (2026-10-23T21:15:26Z). |

> Nota PROD: el registro de deployment apunta a `a204222` (commit "autorizar despliegue del commit ba591b4"), pero **el código realmente ejecutado es `ba591b4`** (constante `AUTHORIZED_COMMIT_SHA` del workflow `prod-deploy.yml`). Esta indirección es deliberada (release gate).

### 1.2 Topología actual (CONFIRMADO)

```
origin/master  (a204222, PROD: ba591b4 = SMTP multiproveedor + seguridad)
      ▲ 11 commits de CI/seguridad no están en development
      │
origin/development (184dfb5, DEV: Niubiz CERT-02 + sync documental + importe real/código postal)
      ▲ 8 commits de Niubiz/pagos no están en master
      │
integration/niubiz-cert-02-qa (local 4dc5df9) — WIP con cambios sin confirmar
```

`master` y `development` **divergieron** (no es cadena lineal): master aporta 11 commits (CI prod + seguridad + SMTP), development aporta 8 (Niubiz + pagos + sync documental). Ya **no** se cumple `qa/stable → master → dev` del audit anterior.

### 1.3 Matriz por rama

Convenciones: **INTEGRADA** = tip ancestro de `origin/master` (o contenido presente por squash/patch-id). **PENDIENTE** = contenido no en `origin/master`. **DIVERGENTE** = contenido incompatible. **OBSOLETA** = superada. **EQUIV** = duplicado por patch-id (no es funcionalidad faltante).

| Rama | HEAD | Relación con master | Clasificación | Recomendación |
|---|---|---|---|---|
| `origin/master` | `a204222` | — (trunk/PROD) | TRUNK | Conservar |
| `origin/development` | `184dfb5` | +8 / −11 | PENDIENTE (Niubiz+pagos+sync) | Integrar a master |
| `integration/niubiz-cert-02-qa` (local) | `4dc5df9` | +10 / −11 | PENDIENTE (WIP sin confirmar) | Investigar (tiene WIP no commiteado) |
| `origin/integration/niubiz-cert-02-qa` | `5937cdb` | +8 / −11 | OBSOLETA (superada por development) | Archivar |
| `consolidation/afiliaciones-consolidacion-03` | `184dfb5` | = development | EQUIV | Archivar |
| `master` (local) | `e799400` | +2 / −100 | DIVERGENTE (2 commits superseded) | Archivar (preservar `backup/local-master-e799400`) |
| `backup/local-master-e799400` | `e799400` | idem | BACKUP | Conservar |
| `origin/qa/stable` | `869a117` | −17 | OBSOLETA (QA nominal desactualizada) | Archivar / realinear |
| `qa/adjuntos-opcionales` (local) | `496a5d5` | +1 / −99 | INTEGRADA + 1 commit (reconcile SIE/SYS_ADMIN) | Investigar |
| `origin/qa/adjuntos-opcionales` | `41dcba2` | ancestro | INTEGRADA | Archivar |
| `feature/smtp-security-patch-qa` | `56510f0` | +3 / −17 | INTEGRADA (≡ `f30150f` en master) | Archivar (desplegada en QA) |
| `release/aval-next-16.4.3` | `a0621a6` | +11 / −11 | INTEGRADA (Next 16.4.3 + aval activo) | Archivar |
| `feature/smtp-multiprovider-qa` | `5aa625c` | +1 / −17 | EQUIV (≡ `cf0508b` en master) | Archivar |
| `release/smtp-multiprovider-prod` | `1a06033` | ancestro | INTEGRADA | Archivar |
| `hotfix/aval-fix-01` | `0157765` | +9 / −11 | PENDIENTE (aval histórico SIE) | Integrar (con resolución de conflicto) |
| `hotfix/aval-prod-minimal` | `d04302c` | +9 / −11 | PENDIENTE (fix "to destroy" PROD) | Investigar (se desplegó a PROD el 24-oct) |
| `feature/carnet-virtual-mvp` | `613ff4d` | +3 / −99 | INTEGRADA (PR #20 squash; tip +1 test) | Archivar |
| `feature/carnet-visualizacion-directa` | `d9dc544` | ancestro | INTEGRADA | Archivar |
| `qa/carnet-virtual-qa` | `3776eea` | ancestro | INTEGRADA | Archivar |
| `release/carnet-preview-prod` | `144803d` | ancestro | INTEGRADA | Archivar |
| `release/carnet-notifications-prod` | `c91137d` | ancestro | INTEGRADA | Archivar |
| `qa/notificaciones-sobre-carnet` | `ae04ebb` | ancestro | INTEGRADA | Archivar |
| `feature/sie-code-sync` | `95f15a8` | ancestro | INTEGRADA | Archivar |
| `fix/afiliaciones-legacy-specialty-compatibility` | `c579216` | +1 / −99 | OBSOLETA (≡ `f00a5d3` en master) | Archivar |
| `fix/afiliaciones-subsanacion-legacy-qa` | `fa3ec71` | ancestro | INTEGRADA | Archivar |
| `release/legacy-specialty-compatibility-prod` | `f00a5d3` | ancestro | INTEGRADA | Archivar |
| `release/subsanacion-legacy-prod` | `10e73ba` | ancestro | INTEGRADA | Archivar |
| `recovery09-subsanacion-fix` | `8fe8b9f` | +2 / −99 | PENDIENTE→development (≡ `8c4de8e`) | Conservar hasta merge a master |
| `recovery10-subsanacion-integration` | `d0a0aba` | +3 / −99 | PARCIAL (compat legacy en master; arrastra `8fe8b9f`) | Conservar |
| `hotfix/containment-subsanacion` | `6da2bfc` | +1 / −89 | OBSOLETA (contención temporal, no activar) | Archivar |
| `integration/recuperar-api-asociados` | `d6f2845` | +4 / −11 | PARCIAL (API asociados + subsanación) | Investigar |
| `release/directorio-unificado-prod` | `6aad2e3` | ancestro (PR #24) | INTEGRADA | Archivar |
| `release/sie-historicos-qa` | `a7f55ff` | −61 | PRESERVADA (provisión PENDING) | Conservar (no activar) |
| `hotfix/fijar-ami-prod` | `3d2eda2` | ancestro (PR #25) | INTEGRADA | Archivar |
| `fix/ci-prisma-generate` | `951b544` | +1 / −100 | INTEGRADA (PR #21) | Archivar |
| `deploy/prod-c9dccbe` | `c9dccbe` | −12 | OBSOLETA | Archivar |
| `feature/actualizar-contenido` | `134372e` | +1 / −195 | PENDIENTE (PR #19 OPEN, contenidos) | Investigar |
| `hotfix/qa-whatsapp-wamid-tracing` | `e77e70d` | +1 / −61 | PENDIENTE (trazabilidad wamid OTP) | Investigar |
| `integration/pr-consolidacion-master` | `03e7155` | ancestro (PR #22) | INTEGRADA | Archivar |
| `integration/qa-consolidacion-20261017` | `7285d0e` | ancestro (PR #23) | INTEGRADA | Archivar |
| `integration/prod-qa-consolidacion-20261017` | `662983a` | ancestro (PR #24) | INTEGRADA | Archivar |
| `integration/afiliaciones-consolidacion-20261016` | `daee113` | −63 | OBSOLETA | Archivar |
| `release/prod-summary-80032` | `0ecdaf1` | +2 / −107 | OBSOLETA | Archivar |
| `qa/correos-masivos*`, `fix/correos-masivos*`, `feature/correos-masivos-worker`, `release/correos-masivos-worker-prod`, `release/correos-masivos-prod` | varios | ancestros | INTEGRADA | Archivar |

---

## 2. FASE 02 — Detección de conflictos

### 2.1 Equivalencias de parche (CONFIRMADO — NO son funcionalidades faltantes)

| Funcionalidad | Commit A | Commit B | Resultado |
|---|---|---|---|
| Selección SMTP DEFAULT/PROV | `cf0508b` (master) | `4dc5df9` (local) / `5aa625c` (feature) | **Idénticos** (21 archivos, +403/−56, misma migración `20261023000000_add_email_campaign_smtp_account`) |
| fix `follow-redirects` 1.16.1 | `18deb84` (dev) | `9d304c2` (master, además Next 16.4.3) | Equivalente; master es superset |
| Importe real + código postal | `6a77039` (local) | `184dfb5` (dev, "(6a77039)") | Idénticos (10 archivos, +84/−13) |
| Sincronización documental no destructiva | `8fe8b9f` (recovery09) | `8c4de8e` (dev, "(8fe8b9f)") | Idénticos (8 archivos, +444/−117) |
| SMTP + cuota (maestro local viejo) | `74bb8d8` (master local) | `cf0508b` (master nuevo) | `74bb8d8` **SUPERSEDED** (3 migraciones `2026100900*` con `DEFAULT 'PROV'`, ya no vigentes) |

### 2.2 Conflictos reales / puntos calientes

1. **Prisma `schema.prisma` + migración (ALTO).** `master` tiene `enum EmailSmtpAccount` + `smtpAccount ... @default(DEFAULT)` + migración `20261023000000`. `development` **no** los tiene (base anterior). Cualquier merge `development → master` debe conservar el enum/migración de master y no borrarlos (el diff muestra `D prisma/migrations/20261023000000...` desde development).

2. **Avales institucionales (ALTO).** `1a06033` (aval por **asociado activo**, en master) y `0157765` (aval por **asociado histórico SIE**, no en master) modifican ambos `SponsorEligibility.ts` y `SponsorEligibility.test.ts`. Resolución manual por archivo, no `ours/theirs`.

3. **Dependencias de seguridad (ALTO).** `development` sigue en `next 16.3.8`, `zod 4.4.3`, `puppeteer 25.3.0`; `master` tiene `next 16.4.3`, `zod 4.6.7`, `puppeteer 25.16.0`, `follow-redirects 1.16.1`. Mergear development sin cuidado **revertiría** los parches de seguridad (GHSA-mrhx-c7xc-m3w5).

4. **Infraestructura PROD sin confirmar (MEDIO).** En el worktree `afiliaciones-desarrollo` hay un diff sin commitear en `infra/terraform/environments/prod/variables.tf` que añade CIDRs `193.186.4.220/32` y `190.187.145.18/32` a `pgproxy_allowed_cidrs`. No forma parte de ninguna rama ni commit.

5. **Niubiz / pagos (ALTO, en curso).** `integration/niubiz-cert-02-qa` tiene ~30 archivos modificados **sin confirmar** (NiubizAuthorization/Response/Session/Security/Diagnostics, checkout, tests). No es mergeable hasta confirmar.

6. **Next.js / workflows (MEDIO).** `prod-deploy.yml` hardcodea `AUTHORIZED_COMMIT_SHA=ba591b49...`; el patrón de "release gate" requiere un commit en master por cada despliegue PROD. Sin rama `release/*` de larga vida; el tag de imagen PROD es `prod-<sha>`.

### 2.3 Pull requests

| PR | Estado | Rama | Notas |
|---|---|---|---|
| #26 | MERGED | `release/smtp-multiprovider-prod` | = PROD actual (`ba591b4`) |
| #25 | MERGED | `hotfix/fijar-ami-prod` | en master |
| #24 | MERGED | `integration/prod-qa-consolidacion-20261017` | en master |
| #23 | MERGED | `integration/qa-consolidacion-20261017` | en master |
| #22 | MERGED | `integration/pr-consolidacion-master` | en master |
| #21 | MERGED | `fix/ci-prisma-generate` | en master |
| #20 | MERGED | `feature/carnet-virtual-mvp` | en master (squash) |
| #19 | **OPEN** | `feature/actualizar-contenido` | contenidos/textos, sin movimiento desde 01-oct |

---

## 3. FASE 03 — Documentación

Documentos actualizados en esta rama (`docs/afiliaciones-release-audit-01`):

- `docs/DEPLOYMENT.md` — añadido procedimiento de **release incremental** (verificación de commit, comparación exacta, gates, ECR, Terraform, blue/green, rollback, registro).
- `docs/PROD_DEPLOYMENT_RUNBOOK.md` — marcado como histórico/no vigente para primer provisioning; referencia al workflow `prod-deploy.yml` actual.
- `docs/consolidacion/AFILIACIONES_GIT_CONVERGENCE_PLAN.md` — marcado como histórico; nuevo estado y secuencia de PRs.

Histórico conservado (no vigente, marcado): runbook PHASE 0–9 (provisioning inicial `c3a7127`), convergencia Fase 5A–5D (`e856422`/`13b26ea`), audit `AFILIACIONES-GIT-AUDIT-01.md`.

---

## 4. FASE 04 — Plan de consolidación (propuesta, sin ejecutar)

Orden de integración (cada lote = un PR independiente):

1. **PR-A — Seguridad:** alinear `development` a `master` en dependencias (`next 16.4.3`, `zod 4.6.7`, `puppeteer 25.16.0`) y en `prisma/schema.prisma` (preservar `EmailSmtpAccount` + migración `20261023000000`). *Criterio:* tsc/eslint/vitest/build verdes; `npm audit --omit=dev` sin CRITICAL/HIGH; sin migraciones nuevas.
2. **PR-B — Niubiz CERT-02 + pagos:** integrar `dd0aecb`, `af878a8`, `18b7292`, `18deb84`(≡ ya en master), `c153a21`, `0345d13` + importe real/código postal (`184dfb5`). *Criterio:* `npm run check` + tests Niubiz; sin secretos; PDF términos OK.
3. **PR-C — Sincronización documental:** `8c4de8e` (≡ `8fe8b9f`). *Criterio:* `DocumentSync`/`deepMerge` tests; no borra referencias.
4. **PR-D — Aval histórico SIE:** `0157765`, reconciliado con `1a06033`. *Criterio:* ambos SponsorEligibility tests verdes (activo + histórico SIE).
5. **PR-E (opcional/decidir):** `feature/actualizar-contenido` (#19), `hotfix/qa-whatsapp-wamid-tracing`, `hotfix/aval-prod-minimal`, `qa/adjuntos-opcionales` (reconcile SIE/SYS_ADMIN).

**Rollback:** cada PR es un merge; revertir con `git revert -m 1 <merge>` (historial intacto). PROD: re-apuntar `app_image_tag` a `prod-ba591b49...` + `start-instance-refresh`.

**Fuera del PR (preservar en origen, NO activar):** SMTP+cuota viejo (`74bb8d8`, 3 migraciones `2026100900*`), provisión SIE PENDING (`a7f55ff`), enriquecimiento histórico, variante SIE carnet.

---

## 5. ENTREGABLE (resumen)

```text
GIT_AUDIT_STATUS = PASS
BRANCHES_AUDITED = 75 (locales + remotas) + 30 worktrees
DIVERGENT_BRANCHES = master(local e799400), integration/niubiz-cert-02-qa, origin/development, origin/qa/stable, hotfix/aval-fix-01, hotfix/aval-prod-minimal
PENDING_FEATURES = Niubiz CERT-02, importe real/código postal, sync documental no destructiva, aval histórico SIE, trazabilidad wamid OTP, contenidos PR#19
DUPLICATED_CHANGES = SMTP (cf0508b=4dc5df9=5aa625c), follow-redirects (18deb84⊂9d304c2), importe real (6a77039=184dfb5), sync doc (8fe8b9f=8c4de8e), SMTP viejo 74bb8d8 (superseded)
MERGE_RISKS = schema.prisma (EmailSmtpAccount), deps seguridad (Next/zod/puppeteer), aval (SponsorEligibility), terraform PROD sin confirmar, WIP Niubiz sin confirmar
DOCUMENTATION_UPDATED = YES (DEPLOYMENT.md, PROD_DEPLOYMENT_RUNBOOK.md, AFILIACIONES_GIT_CONVERGENCE_PLAN.md)
RECOMMENDED_PR_SEQUENCE = PR-A seguridad → PR-B Niubiz/pagos → PR-C sync documental → PR-D aval histórico → PR-E (opcionales)
QA_MODIFIED = NO
PROD_MODIFIED = NO
```

---

### Limitaciones registradas

- **AWS:** acceso de solo lectura (`sara-aws-cli`, cuenta `564914947461`). Verificado el estado de ECR/ASG/Launch Template/SSM sin mutación. No se ejecutó `terraform apply`, `start-instance-refresh`, ni migraciones.
- **Git:** no se ejecutaron merges/rebases/cherry-picks/resets/force-push; no se eliminaron ramas ni worktrees; no se hizo push.
- **Commit PROD ejecutado** inferido del Launch Template (`prod-ba591b49...`) y del workflow `prod-deploy.yml` (`AUTHORIZED_COMMIT_SHA`); el registro de deployment en GitHub usa el SHA del "commit autorizador" (`a204222`).
