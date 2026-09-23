# QA Chromium — Perfil seccomp mínimo (QA app container)

> **Fecha:** 2026-09-21 · **Ámbito:** QA `afiliaciones-qa.iimp.org.pe` · **Contenedor:** `afiliaciones-qa-app-1` únicamente.

---

## 1. Root cause

Chromium requiere crear **user namespaces** para su sandbox (namespace sandbox). El perfil
seccomp por defecto de Docker solo permite `unshare`, `clone` (flags de namespace), `setns`,
`clone3`, etc. **cuando el contenedor tiene `CAP_SYS_ADMIN`**. El contenedor QA es non-root y
su `CapBnd` no incluye `CAP_SYS_ADMIN`, por lo que:

- `unshare(CLONE_NEWUSER)` → `EPERM`.
- `clone` con flags de namespace → bloqueado.
- `clone3` → `ENOSYS` (errno 38).

Sin user namespaces, Chromium no puede inicializar ningún sandbox y aborta (`No usable sandbox`).

## 2. Syscall / argumentos bloqueados

- `unshare` (bloqueada sin `CAP_SYS_ADMIN`).
- `clone` con flags de namespace (`CLONE_NEWUSER|CLONE_NEWPID|CLONE_NEWNET|CLONE_NEWNS|…`).
- `clone3` (devuelve `ENOSYS`; Chromium cae a `clone`).

## 3. Comportamiento Docker default

El perfil `moby/profiles/seccomp/default.json` incluye una regla que permite el grupo
`bpf, clone, clone3, mount, setns, unshare, …` **solo con `CAP_SYS_ADMIN`**, y otra que
restringe `clone` por argumentos. `clone3` es `SCMP_ACT_ERRNO 38` sin `CAP_SYS_ADMIN`.

## 4. Excepción aplicada

Se parte del perfil **por defecto de Docker** y se **antepone una única regla**:

```json
{ "names": ["unshare", "clone"], "action": "SCMP_ACT_ALLOW" }
```

Generación reproducible en el host QA:

```bash
curl -sSL https://raw.githubusercontent.com/moby/profiles/main/seccomp/default.json -o default-seccomp.json
jq '.syscalls = ([{"names":["unshare","clone"],"action":"SCMP_ACT_ALLOW"}] + .syscalls)' \
   default-seccomp.json > /opt/afiliaciones-qa/qa-app-seccomp.json
```

- `ADDITIONAL_ALLOWED_SYSCALLS = unshare, clone`
- `ARGUMENT_FILTERS = ninguno` (la regla antepuesta permite ambos sin filtro; el resto del perfil permanece idéntico)
- `DEFAULT_DENY_BEHAVIOR = SCMP_ACT_ERRNO (1)` (sin cambios)
- `SCOPE = QA_APP_CONTAINER_ONLY` (vía `security_opt` del servicio `app`; no afecta a Docker global, ni a `postgres`/`caddy`, ni a producción/legacy)

## 5. Por qué NO equivale a `seccomp=unconfined`

- Se conserva **todo** el perfil por defecto de Docker (misma lista de ~300 syscalls, mismo `defaultAction=ERRNO`).
- Solo se añaden **2 syscalls** (`unshare`, `clone`) que el host ya permite a procesos no privilegiados (`user.max_user_namespaces=7519`, `unshare -U` OK en el host).
- **No** se otorga `CAP_SYS_ADMIN`, **no** hay privileged, **no** se cambia el perfil global.

## 6. Security impact

- El contenedor gana la capacidad de crear user namespaces (necesaria para el sandbox de Chromium).
- El contenedor permanece **non-root** (uid 1001), **sin capabilities** (`CapEff=0`), **sin privileged**.
- Chromium mantiene su **sandbox interno** (obligatorio; sin él aborta).

## 7. Aplicación (docker-compose, servicio `app`)

```yaml
  app:
    shm_size: "512mb"
    security_opt:
      - seccomp:/opt/afiliaciones-qa/qa-app-seccomp.json
```

## 8. Pruebas

| Prueba | Resultado |
|---|---|
| `unshare -U` con perfil custom | OK |
| `unshare -U` con default | EPERM |
| Puppeteer 1 PDF | PASS (6,083 B) |
| 2 PDFs concurrentes | PASS (5,538 / 5,646 B) |
| 3 PDFs secuenciales | PASS (16,818 B) |
| PDF tipo Declaration (logo + Chromium) | PASS (17,573 B, 771 ms) |
| `--no-sandbox` en cmdline | **NO** |
| Zombies | 0 |

## 9. Rollback

Quitar `security_opt` del servicio `app` y `docker compose up -d app`. El contenedor vuelve al
perfil por defecto (Chromium vuelve a fallar). No afecta a datos ni a otros servicios.

## 10. Resultado

```text
CHROMIUM_SANDBOX_ENABLED = YES
NO_SANDBOX_FLAG = NO
CUSTOM_SECCOMP_MINIMAL = YES (2 syscalls)
SYS_ADMIN = NO
PRIVILEGED = NO
SECCOMP_UNCONFINED = NO
```
