# Autenticación, sesiones y autorización

Este documento describe el flujo observado en `modules/auth`, `lib/auth.config.ts` y `proxy.ts`. El código y el schema son la fuente de verdad.

## Componentes

| Componente | Responsabilidad |
| --- | --- |
| Auth.js | Cookie/JWT de transporte y callbacks de sesión. |
| `LoginService` | Credenciales, estado de cuenta, bloqueo, auditoría y creación de sesión. |
| `SessionService` | Token opaco, expiración, inactividad, actividad y revocación. |
| `ContextService` | Sesión/usuario actual y guards de autorización. |
| `ContextRepository` | Hidratación de persona, rol y permisos desde Prisma. |
| `proxy.ts` | Redirección temprana para navegación; no reemplaza autorización de servidor. |

## Login

1. El repositorio localiza al usuario y su credencial activa.
2. Se rechaza una cuenta bloqueada o no activa.
3. `bcrypt` compara la contraseña.
4. `SecurityService` registra éxito o fallo y administra intentos.
5. `SessionService` crea un token opaco aleatorio de 32 bytes y una sesión persistida con expiración de 24 horas.
6. Auth.js transporta el identificador de esa sesión mediante su estrategia JWT.

Los mensajes de credenciales deben evitar enumerar si un email existe.

## Validación de sesión

`ContextService.getCurrentSession()`:

1. obtiene el identificador desde Auth.js;
2. busca la sesión persistida;
3. rechaza ausencia, revocación, expiración o más de 30 minutos de inactividad;
4. actualiza actividad como máximo una vez cada cinco minutos;
5. usa `React.cache()` para deduplicar dentro de la misma petición.

Una sesión inválida no se convierte en un usuario anónimo con permisos parciales.

## Contexto de usuario

`ContextRepository` carga:

- cuenta y estado;
- persona asociada;
- rol;
- permisos del rol;
- avatar firmado cuando existe.

Los permisos se materializan como `Set<string>` con forma `acción:sujeto`. `manage:all` actúa como comodín.

## Guards

| Guard | Resultado esperado |
| --- | --- |
| `requireAuth()` | Devuelve usuario activo o redirige al limpiador de sesión/lanza error. |
| `requireRole(slugs)` | Exige uno de los roles; afiliados se redirigen a su portal. |
| `requirePermission(action, subject)` | Exige permiso exacto o `manage:all`. |
| `requireAdministrativeUser()` | Excluye usuarios afiliados del workspace administrativo. |
| `requireAffiliate()` | Exige usuario afiliado. |

Cada Page, Route Handler y Server Action protegida debe aplicar el guard apropiado. El proxy solo protege navegación y excluye `/api`; por tanto, una API sin guard permanece expuesta.

## Rutas públicas observadas en proxy

El proxy considera públicos prefijos de login, recuperación, postulación, afiliaciones, beneficios, consulta y SAP. Esta lista no es una autorización de negocio. Toda ruta pública debe minimizar datos, validar entradas y aplicar sus propios tokens/OTP/rate limits.

## Reglas para cambios

- No guardar roles o permisos confiables en el navegador.
- No usar visibilidad de UI como autorización.
- No registrar cookies, tokens, contraseñas u OTP.
- No ampliar duración, inactividad o privilegios sin requerimiento aprobado.
- Mantener errores Auth.js/Next.js fuera de `catch` que impida redirecciones internas.
- Añadir pruebas para acceso anónimo, permiso insuficiente, cuenta inactiva y recurso ajeno.

## Riesgos conocidos a revalidar

La auditoría existente señala rutas sin guards, ausencia de rate limiting en superficies y que la hidratación de permisos puede no filtrar entidades inactivas. Revisa [SECURITY.md](SECURITY.md) y [auditoria_seguridad.md](../auditoria_seguridad.md) antes de modificar este dominio.

## Archivos principales

- `modules/auth/login/`
- `modules/auth/session/`
- `modules/auth/security/`
- `modules/auth/context/`
- `lib/auth.ts`
- `lib/auth.config.ts`
- `proxy.ts`
