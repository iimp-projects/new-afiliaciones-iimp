# Despliegue y preflight

La plataforma de hosting, CI/CD y estrategia de rollback no están documentadas como contrato definitivo. Este archivo define comprobaciones independientes de proveedor.

## Preflight obligatorio

```bash
npm ci
npx prisma generate
npm run check
npm run build
```

Además:

- variables del ambiente presentes y separadas por TEST/PRODUCTION;
- base objetivo y permisos confirmados;
- migraciones revisadas y aprobadas por separado;
- secretos administrados por el sistema de despliegue;
- proveedores externos en el ambiente correcto;
- plan de rollback de aplicación y de datos;
- observabilidad sin PII ni secretos.

## Base de datos

El despliegue de aplicación y el de schema son decisiones separadas. No ejecutes `db push` en producción. Una migración requiere:

1. diff revisado;
2. compatibilidad hacia atrás durante el rollout;
3. respaldo/verificación;
4. ventana y responsable;
5. rollback o estrategia roll-forward;
6. `prisma migrate deploy` solo en el proceso autorizado.

## Verificación posterior

- health y carga de rutas públicas;
- login y control de acceso con cuentas de prueba;
- consulta/postulación sin enviar mensajes reales salvo plan de smoke test;
- conexión a PostgreSQL;
- errores y latencia;
- ningún secreto en HTML, bundles o logs.

Pagos, SAP, S3/SNS, correo y WhatsApp requieren checklist propio y credenciales de prueba. No actives Niubiz producción basándote únicamente en que el build sea verde.
