# Plataforma de Afiliaciones IIMP

Aplicación web del Instituto de Ingenieros de Minas del Perú para postulaciones, avales, evaluación de expedientes, asociados, consulta pública, seguridad y pagos.

## Estado técnico

- Next.js 16.2, React 19 y TypeScript con `strict: true`.
- Prisma 6 y PostgreSQL.
- Auth.js v5 con sesiones persistidas y RBAC.
- Vitest: 51 archivos y 413 pruebas aprobadas en la última verificación local.
- `npm run check`: cero errores de TypeScript, ESLint y pruebas.
- `npm run build`: compilación de producción aprobada.
- Deuda visible: `npm run lint:all` reporta advertencias heredadas, principalmente usos explícitos de `any`. No se permite aumentarlas.

## Inicio rápido

Requisitos: Node.js 20.9 o superior, npm y una instancia PostgreSQL accesible.

```bash
npm install
copy .env.example .env
npx prisma generate
npm run dev
```

No ejecutes migraciones, seeds ni scripts de corrección de datos sin revisar primero [Base de datos](docs/DATABASE.md) y obtener autorización para el ambiente correspondiente.

## Verificación obligatoria

```bash
npm run check
npm run build
```

Comandos específicos:

```bash
npm run typecheck   # TypeScript estricto
npm run lint        # Solo errores bloqueantes
npm run lint:all    # Errores y deuda en warnings
npm test            # Vitest una vez
```

## Fuentes de verdad

Lee en este orden antes de modificar el proyecto:

1. [BIBLE.md](BIBLE.md): propósito, dominios, invariantes y decisiones vigentes.
2. [RULES.md](RULES.md): reglas obligatorias de ingeniería y definición de terminado.
3. [Índice de documentación](docs/README.md): rutas hacia cada dominio.
4. Código, pruebas y `prisma/schema.prisma`: autoridad final cuando exista una discrepancia.

## Arquitectura resumida

```text
View / Component
  → API client o Hook
  → Route Handler o Server Action
  → Service
  → Repository
  → Prisma
  → PostgreSQL
```

El código se organiza principalmente por dominio dentro de `modules/`. Las excepciones heredadas no deben convertirse en patrones nuevos. Consulta [Arquitectura](docs/ARCHITECTURE.md).

## Documentación esencial

| Tema | Documento |
| --- | --- |
| Contexto canónico | [BIBLE.md](BIBLE.md) |
| Reglas de código | [RULES.md](RULES.md) |
| Arquitectura | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| Arquitecturas AWS propuestas | [docs/AWS_ARCHITECTURE.md](docs/AWS_ARCHITECTURE.md) |
| Reglas de negocio | [docs/BUSINESS_RULES.md](docs/BUSINESS_RULES.md) |
| Matriz de estados | [docs/APPLICATION_MATRIX.md](docs/APPLICATION_MATRIX.md) |
| Autenticación y RBAC | [docs/AUTHENTICACION.md](docs/AUTHENTICACION.md) |
| Modelo de datos | [docs/DATABASE.md](docs/DATABASE.md) |
| Pagos | [docs/PAYMENTS.md](docs/PAYMENTS.md) |
| Desarrollo local | [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) |
| Calidad y tipado | [docs/QUALITY_GATES.md](docs/QUALITY_GATES.md) |
| Pruebas | [docs/TESTING.md](docs/TESTING.md) |
| Seguridad | [docs/SECURITY.md](docs/SECURITY.md) |
| Trabajo con IA | [docs/AI_WORKFLOW.md](docs/AI_WORKFLOW.md) |

## Asistentes de IA

- Codex y agentes compatibles: [AGENTS.md](AGENTS.md).
- Claude Code: [CLAUDE.md](CLAUDE.md).
- Gemini CLI: [GEMINI.md](GEMINI.md).

Los tres deben seguir la misma `BIBLE.md` y `RULES.md`; sus archivos no mantienen reglas de negocio duplicadas.
