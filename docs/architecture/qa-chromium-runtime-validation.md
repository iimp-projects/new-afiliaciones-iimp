# QA Chromium/Puppeteer Runtime Validation — Afiliaciones IIMP

> **Fecha:** 2026-09-21 · **Entorno:** QA `https://afiliaciones-qa.iimp.org.pe` · EC2 `t3.small` (AL2023)
> **Resultado:** causa raíz demostrada; **sin remediación segura** dentro de las restricciones. No se aplicó ninguna reducción de seguridad.

---

## 1. Problema original

La generación de PDF con Puppeteer/Chromium falla en el contenedor de la aplicación en la EC2 QA.

## 2. Error original

```
Failed to launch the browser process: Code: null
[FATAL:zygote_host_impl_linux.cc] No usable sandbox! ... If you want to live dangerously
... you can try using --no-sandbox.
```
Tras corregir el helper SUID en caliente:
```
[FATAL:zygote_host_impl_linux.cc:207] Check failed: . : Operation not permitted (1)
```
Clasificación inicial: `SANDBOX_FAILURE` en `puppeteer.launch()`.

## 3. Baseline

- Kernel: `6.18.48-109.150.amzn2023.x86_64` · Amazon Linux 2023.12.
- Docker 25.0.14 · Compose v2.29.7.
- Contenedor app: `Privileged=false`, `SecurityOpt=[]`, `CapAdd=[]`, `CapDrop=[]`, `User=nextjs`, `ShmSize=64 MiB`.
- `/proc/self/status` en contenedor: `NoNewPrivs=0`, `Seccomp=2` (filtro activo), `CapEff=0`, `CapBnd=0x00000000a80425fb`.
- `uid=1001(nextjs)`.

## 4. Hipótesis evaluadas

| Hipótesis | Evidencia | Resultado |
|---|---|---|
| H1 nombre del helper | helper real = `chrome_sandbox` (guion bajo); Dockerfile buscaba `chrome-sandbox` | **CONFIRMED** (necesaria, no suficiente) |
| H2 ownership/permisos | tras corrección: `root root 4755` | **REJECTED** (ya correcto) |
| H3 filesystem `nosuid` | overlay sin `nosuid` | **REJECTED** |
| H4 Docker default seccomp | `unshare -U` en contenedor default → EPERM; con `seccomp=unconfined` → OK | **CONFIRMED (CAUSA RAÍZ)** |
| H5 SELinux | host Permissive; sin AVC bloqueantes | **REJECTED** |
| H6 user namespaces | host `unshare -U` OK (`max_user_namespaces=7519`); contenedor DENIED por seccomp | **CONFIRMED (consecuencia de H4)** |
| H7 `/dev/shm` | contenedor 64 MiB (no 1 GiB) | **INCONCLUSIVE** (no es el bloqueante de launch) |
| H8 librerías faltantes | no evaluado a fondo (launch falla antes) | **INCONCLUSIVE** |
| H9 incompatibilidad Puppeteer/Chrome | Puppeteer 25.3.0 ↔ Chrome for Testing 150.0.7871.24 | **REJECTED** |
| H10 COPY altera permisos | helper quedaba sin setuid por H1 | **CONFIRMED** (parcial) |
| H11 non-root incompatible | SUID sandbox necesita CAP_SYS_ADMIN, ausente en `CapBnd` | **CONFIRMED** |
| H12 memoria insuficiente | disponible ~1.2 GB; no OOM | **REJECTED** |
| H13 otra | — | **REJECTED** |

## 5. Evidencia clave

```
host:      unshare -U true        -> OK
container: unshare -U true        -> "Operation not permitted" (EXIT=1)
container (seccomp=unconfined): unshare -U true -> OK (EXIT=0)
CapBnd = 0x00000000a80425fb  (NO incluye CAP_SYS_ADMIN)
```

## 6. Causa raíz

```text
ROOT_CAUSE_CONFIRMED = YES
ROOT_CAUSE = El perfil seccomp por defecto de Docker bloquea las syscalls de
             creación de namespaces (unshare / clone con CLONE_NEWUSER) que
             Chromium necesita. Además, el conjunto de capacidades del contenedor
             (CapBnd) no incluye CAP_SYS_ADMIN, por lo que el sandbox SUID
             (chrome_sandbox) tampoco puede inicializar. Sin user namespaces ni
             CAP_SYS_ADMIN, Chromium no puede habilitar ningún sandbox y aborta.
EVIDENCE = unshare -U denegado con seccomp por defecto y permitido con
           seccomp=unconfined; CapBnd sin CAP_SYS_ADMIN; helper SUID presente.
```

## 7. Corrección aplicada

- **Dockerfile:** corregido el nombre del helper (`chrome_sandbox`) y se crea el
  symlink `chrome-sandbox` con `root:root 4755` (bug real, `DOCKERFILE_PERMISSION_REGRESSION`).
- **NO** se aplicó ninguna otra corrección.

## 8. Postura de seguridad (sin cambios)

```text
CHROMIUM_SANDBOX_ENABLED = NO (no se pudo habilitar)
NO_SANDBOX_FLAG = NO (no se usó --no-sandbox)
CONTAINER_NON_ROOT = YES
CONTAINER_PRIVILEGED = NO
SYS_ADMIN = NO
DEFAULT_SECCOMP = YES (sin modificar)
SELINUX_STATUS = Permissive (sin modificar)
```

## 9. Opciones de remediación (NO aplicadas)

| Opción | Efecto | ¿Permitida por las reglas? |
|---|---|---|
| Perfil seccomp personalizado que permita `unshare`/`clone(CLONE_NEWUSER)` | Mantiene el sandbox de Chromium; permite user namespaces en el contenedor | **Zona gris** (relaja aislamiento; no es `unconfined`) |
| `--cap-add=SYS_ADMIN` (para el sandbox SUID) | Habilita el sandbox SUID | **PROHIBIDO** |
| `seccomp=unconfined` | Habilita user namespaces | **PROHIBIDO** |
| `--no-sandbox` | Deshabilita el sandbox | **PROHIBIDO** |
| Servicio de PDF aislado (Fargate/gVisor) con política de sandbox propia | Aísla la generación de PDF | Requiere diseño/fase aparte |

## 10. Pruebas Chromium

No ejecutadas con éxito (launch bloqueado). `PDF_BYTES = N/A`.

## 11. Prueba `DeclarationPdfService`

No ejecutada (depende de Chromium). `DECLARATION_PDF_RUNTIME = BLOCKED`.

## 12. Memoria

`free`: total 1909 MB, available ~1194 MB; sin OOM. `T3_SMALL_SUFFICIENT` para web/DB;
PDF no medido.

## 13. Decisión t3.small

Se mantiene `t3.small` (el bloqueante es sandbox, no memoria).

## 14-18. Backup/restore, STOP/START, persistencia, HTTPS post-restart, scheduler

**NO ejecutados** (condicionados a Chromium OK). El backup a S3 ya está validado (fase previa).
Scheduler permanece **desactivado**.

## 19. Costo

Sin cambios respecto a la estimación (≈ USD 14–24/mes según horario).

## 20. Riesgos residuales

- PDF/Puppeteer no funcional en QA (bloqueante).
- Restore y STOP/START sin validar.
- Dockerfile corregido pero imagen no reconstruida/publicada.

## 21. Clasificación

```text
SECURE_CHROMIUM_CONTAINER_STRATEGY_NOT_VALIDATED
```
No existe remediación que mantenga el sandbox de Chromium y no reduzca el aislamiento del
contenedor, dentro de las restricciones establecidas. Se detiene para decisión humana.
