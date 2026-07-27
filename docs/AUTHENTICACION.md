# 📘 Documentación Técnica Exhaustiva: Arquitectura de Seguridad, Autenticación y Autorización

**Proyecto:** Plataforma de Afiliaciones y Asociados IIMP (Instituto de Ingenieros de Minas del Perú)
**Nivel de Arquitectura:** Enterprise (Nivel Empresarial)
**Patrón utilizado:** Híbrido (Auth.js + Sesiones en Base de Datos + Control de Acceso Basado en Roles - RBAC)

Esta documentación está diseñada para que cualquier persona, desde un desarrollador junior hasta un líder de proyecto, entienda exactamente cómo funciona el corazón de la seguridad de esta plataforma.

---

## 🏗️ 1. Conceptos Clave (El Glosario)

Antes de ver cómo funciona el sistema, es vital entender estos tres conceptos:

1. **Autenticación (Authentication):** Es el proceso de responder a la pregunta *"¿Quién eres?"*. Es cuando pones tu correo y contraseña.
2. **Autorización (Authorization):** Es el proceso de responder a la pregunta *"¿Qué tienes permitido hacer?"*. Sucede después de que ya sabemos quién eres.
3. **Token Opaco (Opaque Token):** Imagina la llave electrónica de un hotel. La tarjeta plástica no tiene escrito tu nombre ni tu número de habitación (es "opaca"). Cuando la acercas a la puerta, la puerta se comunica con el sistema central del hotel (Base de Datos) y le pregunta: *"La tarjeta X, ¿puede abrir esta puerta?"*. Si pierdes la tarjeta, el hotel la desactiva en el sistema y la tarjeta plástica se vuelve inútil al instante. **Así funciona nuestro sistema.**

*(Nota: Los tutoriales básicos suelen usar "JWTs". Un JWT es como una credencial de plástico donde sí está impreso tu nombre y tus permisos. Si alguien te roba esa credencial, puede usarla hasta que la fecha de caducidad llegue, porque el servidor no la verifica en tiempo real. Por eso elegimos Tokens Opacos).*

---

## 🛡️ 2. Fase 1: El Flujo de Autenticación (El Login)

El proceso de inicio de sesión no es solo validar una contraseña. Sigue un estricto protocolo de seguridad y auditoría auditado por el `LoginService`[cite: 18].

### Paso a paso:
1. **El usuario hace clic en "Ingresar":** La interfaz web (`LoginView.tsx`) envía el correo y la contraseña ingresada a nuestro servidor.
2. **Búsqueda en la Base de Datos:** El sistema busca si ese correo existe y trae su contraseña encriptada (Hasheada con `bcrypt`)[cite: 18].
3. **El guardián de seguridad (`SecurityService`):**
   * Antes de revisar la contraseña, el `SecurityService` verifica si la cuenta no está bloqueada (`isAccountLocked`)[cite: 18].
   * Si un hacker intentó adivinar la contraseña 5 veces antes, el sistema bloquea la cuenta por 15 minutos automáticamente[cite: 18]. Si este es el caso, te deniega el acceso de inmediato[cite: 18].
4. **Verificación de la contraseña:**
   * **Si la contraseña es incorrecta:** El sistema suma "1" al contador de intentos fallidos en la base de datos[cite: 18, 19]. Además, registra en un historial de seguridad (Log) que alguien falló al intentar entrar, guardando su IP y su navegador (`handleLoginFailure`)[cite: 18].
   * **Si la contraseña es correcta:** El sistema resetea los intentos fallidos a "0"[cite: 18]. Actualiza la fecha de "Último ingreso" y registra el éxito en el historial (`handleLoginSuccess`)[cite: 18].
5. **Creación de la Sesión:** Una vez verificado, el sistema **no** le entrega tus datos personales al navegador. Le pide al `SessionService` que cree un "Token Opaco"[cite: 18].

---

## 🎟️ 3. Fase 2: Gestión de Sesiones (El Token Opaco)

Aquí es donde creamos nuestra "llave de hotel".

1. **Generación Segura:** El `SessionService` crea una cadena de texto aleatoria, indescifrable y extremadamente larga (ej. `a1b2c3d4e5f6...`) llamada `sessionToken` usando algoritmos criptográficos[cite: 18].
2. **Almacenamiento Centralizado:** En nuestra base de datos PostgreSQL, en la tabla `auth_user_sessions`[cite: 19], guardamos una nueva fila que dice: 
   * *"El token `a1b2c3...` le pertenece al Usuario #5. Vence en 24 horas. Fue creado desde Chrome en Windows, con la IP 192.168.1.5"*[cite: 18, 19].
3. **Entrega al Navegador:** El servidor le entrega **únicamente este token** al navegador del usuario, guardándolo en una "Cookie" de máxima seguridad[cite: 18].

> **💡 Ventaja gigante:** Si un administrador detecta un comportamiento raro, puede entrar a la base de datos y cambiar el campo `isRevoked` a `true`[cite: 18, 19]. Al instante, la llave del usuario deja de funcionar en el servidor, expulsándolo del sistema inmediatamente.

---

## 💧 4. Fase 3: Hidratación del Contexto (Reconociendo al Usuario)

Ahora el usuario ya entró y quiere ver su "Dashboard". Cada vez que carga una página privada, el servidor necesita saber quién es y qué puede hacer. De esto se encarga el **`ContextService`**[cite: 18].

### El problema a resolver (Consultas N+1)
Si la página tiene un Menú que verifica permisos, un Botón de Borrar que verifica permisos y una Tabla que verifica permisos... ¿Le preguntamos a la base de datos 3 veces en el mismo segundo? No, eso colapsaría el servidor.

### La solución: `React cache()` y "Memoización"
El `ContextService` utiliza una función mágica llamada `cache()`[cite: 18]. Esto significa que, durante una petición (un clic o la carga de una página), la primera vez que pregunten por el usuario, el sistema irá a la base de datos. Si preguntan 50 veces más en esa misma fracción de segundo, el sistema **recordará la primera respuesta** y no volverá a la base de datos.

### ¿Qué datos trae el sistema (`getHydratedUser`)?[cite: 18]
Cuando el sistema valida que el token opaco de la cookie es correcto y no está revocado, hace una gran consulta a la base de datos que trae "El árbol de Identidad"[cite: 18]:
* **El Usuario (`User`):** Su email y estado[cite: 18].
* **La Persona (`Person`):** Sus nombres reales y su DNI[cite: 18].
* **El Rol (`Role`):** Si es Validador, Administrador o Postulante[cite: 18].
* **Sus Permisos (`Permissions`):** Toda la lista de acciones que ese rol puede hacer[cite: 18].

---

## 🚦 5. Fase 4: Autorización (Roles y Permisos RBAC)

El "Control de Acceso Basado en Roles" (RBAC) es la última barrera de seguridad. 

### Aplanamiento de Permisos para velocidad extrema O(1)
Para no buscar en listas largas si un usuario puede hacer algo, el `ContextService` toma la lista de permisos de la base de datos y los fusiona en textos simples[cite: 18].
* Una "Acción" (`read`, `update`, `delete`)[cite: 19].
* Un "Sujeto" (`applications`, `users`, `payments`)[cite: 19].

El sistema crea un `Set` (una colección de datos muy rápida) de textos como: `"read:applications"`, `"update:users"`, `"delete:documents"`[cite: 18].

### Las barreras de código (Guardians)[cite: 18]
Cuando un programador quiere proteger una página o un botón, usa tres funciones:

1. **`requireAuth()`**: Actúa como un portero. *"Si no tienes sesión activa, lárgate a la página de login"*[cite: 18].
2. **`requireRole(['VALIDADOR'])`**: *"Solo los que tengan el cargo de VALIDADOR pueden pasar de aquí"*[cite: 18].
3. **`requirePermission('approve', 'applications')`**: *"Revisaré en tu lista rápida si tienes la etiqueta `approve:applications`. Si no la tienes, muestro un Error de Acceso Denegado"*[cite: 18].

### El "Súper Poder" (Comodín `manage:all`)[cite: 18]
Para no tener que asignarle manualmente 500 permisos al "Súper Administrador", el sistema tiene una trampa de oro. En la función de revisar permisos, el código dice:
> *Si en tu lista tienes el permiso especial `"manage:all"`, siempre te responderé "Sí, puedes pasar" a cualquier pregunta que me hagas.*[cite: 18]

---

## 📂 6. Arquitectura de Archivos (Diseño Orientado al Dominio - DDD)

Todo esto no está amontonado en un solo archivo. Está estructurado limpiamente en carpetas dentro de `modules/auth/`[cite: 18]:

* **`login/`**: Todo lo visual (`views`), lo interactivo (`hooks`) y la conexión al backend (`action.ts`, `service.ts`) exclusivo para iniciar sesión[cite: 18].
* **`forgot-password/` & `reset-password/`**: Todo lo relacionado a la recuperación segura de contraseñas mediante códigos OTP al correo[cite: 18].
* **`session/`**: Módulo dedicado exclusivamente a crear, validar y revocar los Tokens Opacos[cite: 18].
* **`security/`**: El guardián de auditoría. Se encarga de contar fallos, bloquear cuentas y guardar logs de todo lo que ocurre[cite: 18].
* **`context/`**: El encargado de reconocer al usuario en cada navegación y validar sus permisos en milisegundos[cite: 18].

---

## 🗺️ 7. Diagrama Visual del Flujo Completo

```mermaid
sequenceDiagram
    autonumber
    actor Usuario
    participant Interfaz as Pantalla (Frontend)
    participant NextAuth as Gestor de Cookie (Auth.js)
    participant Service as Lógica de Servidor (Services)
    participant BD as Base de Datos (PostgreSQL)

    %% FASE DE LOGIN
    rect rgb(234, 242, 255)
    Note over Usuario, BD: FASE 1 Y 2: AUTENTICACIÓN Y SESIÓN
    Usuario->>Interfaz: Ingresa Email y Password
    Interfaz->>NextAuth: Enviar datos
    NextAuth->>Service: Por favor verifica estas credenciales
    
    Service->>BD: Trae al usuario y su contraseña encriptada
    BD-->>Service: Datos obtenidos
    
    Service->>Service: ¿Cuenta bloqueada? ¿Contraseña coincide? (Seguridad)
    Service->>BD: Si todo es OK, guarda en la tabla auth_user_sessions un Token Aleatorio larguísimo.
    BD-->>Service: Ok, guardado (ej. token_xyz123)
    Service-->>NextAuth: Devuelve "token_xyz123"
    NextAuth-->>Interfaz: Guarda "token_xyz123" en la cookie segura del navegador
    end

    %% FASE DE NAVEGACIÓN Y PERMISOS
    rect rgb(255, 245, 234)
    Note over Usuario, BD: FASE 3 Y 4: NAVEGACIÓN Y PERMISOS (RBAC)
    Usuario->>Interfaz: Hace clic en "Aprobar Postulación"
    Interfaz->>Service: Intenta ejecutar la acción (requirePermission)
    
    Service->>NextAuth: ¿Cuál es la cookie del usuario?
    NextAuth-->>Service: Su cookie dice "token_xyz123"
    
    Service->>BD: ¿Este token sigue activo? Si es así, tráeme sus datos y permisos (User, Role, Permissions)
    BD-->>Service: Todo el Árbol de Identidad (Hidratación)
    
    Service->>Service: Convierte permisos en memoria ("approve:applications")
    Service->>Service: ¿Tiene el permiso para hacer esto?
    
    alt Tiene el Permiso
        Service-->>Interfaz: Acción Ejecutada con Éxito
    else NO tiene el permiso
        Service-->>Interfaz: Error 403: Acceso Denegado
    end
    end