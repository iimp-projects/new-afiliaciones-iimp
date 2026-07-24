# Plataforma de Afiliaciones - Instituto de Ingenieros de Minas del Perú (IIMP)

> **README del Proyecto**  
> Versión: 1.0

## Bienvenido

Este repositorio contiene el desarrollo de la Plataforma de Afiliaciones del Instituto de Ingenieros de Minas del Perú (IIMP).

El propósito de este documento es ayudar a cualquier desarrollador a comprender el proyecto antes de escribir una sola línea de código.

---

## ¿Qué es este proyecto?

La plataforma permite administrar digitalmente el proceso completo de afiliación de nuevos miembros al IIMP.

Principales funcionalidades:

- Registro y autenticación.
- Gestión de postulaciones.
- Información personal.
- Información académica.
- Información laboral.
- Experiencia profesional.
- Carga de documentos.
- Panel administrativo.
- Seguimiento del estado de la postulación.

---

## Objetivos

- Arquitectura limpia.
- Escalabilidad.
- Separación de responsabilidades.
- Código reutilizable.
- Fácil mantenimiento.

---

## Stack Tecnológico

### Frontend

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS
- React Hook Form
- Zod

### Backend

- Server Actions
- Auth.js
- Prisma ORM

### Base de Datos

- PostgreSQL

---

## Arquitectura

Patrones implementados:

- Clean Architecture
- Modular Architecture
- Feature First
- Repository Pattern
- Service Layer

---

## Flujo General

```text
Usuario
   │
   ▼
Página (App Router)
   │
   ▼
View
   │
   ▼
Server Action
   │
   ▼
Service
   │
   ▼
Repository
   │
   ▼
Prisma ORM
   │
   ▼
PostgreSQL
```

---

## Estructura General

```text
app/
components/
modules/
lib/
hooks/
types/
public/
prisma/
docs/
```

### app/

Contiene únicamente las rutas de la aplicación.

### modules/

Contiene toda la lógica del negocio organizada por funcionalidades.

Ejemplo:

```text
modules/
 ├── auth/
 ├── authorization/
 ├── afiliaciones/
 │      └── postulacion/
 └── dashboard/
```

---

## Responsabilidades

### Views

Renderizan la interfaz.

### Server Actions

Reciben las solicitudes del frontend.

### Services

Implementan las reglas de negocio.

### Repository

Gestionan el acceso a la base de datos.

### Prisma

ORM encargado de la persistencia.

---

## Convenciones

- No acceder directamente a Prisma desde componentes.
- Toda la lógica vive en Services.
- Toda persistencia pasa por Repository.
- Validaciones mediante Zod.
- Evitar `any`.

---

## Instalación

```bash
npm install
npx prisma generate
npx prisma migrate dev
npm run dev
```

---

## Variables de Entorno

```env
DATABASE_URL=
AUTH_SECRET=
AUTH_URL=
NEXT_PUBLIC_APP_URL=
```

---

## Documentación

Este README es una introducción.

La documentación detallada estará en:

```text
docs/
 ├── ARCHITECTURE.md
 ├── AUTH.md
 ├── DATABASE.md
 ├── POSTULACION.md
 ├── BACKEND.md
 ├── FRONTEND.md
 └── CONTRIBUTING.md
```

---

## Estado

Proyecto en desarrollo siguiendo una arquitectura modular, mantenible y escalable.
