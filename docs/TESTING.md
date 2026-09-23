# Estrategia de pruebas

## Herramienta y alcance

Vitest 4 ejecuta pruebas unitarias y de integración liviana. La configuración usa entorno Node y excluye `.agents/**` para no ejecutar tests pertenecientes a skills instaladas.

```bash
npm test
npx vitest run ruta/al/archivo.test.ts
npx vitest run --grep="nombre del caso"
```

## Qué probar

- Services: reglas, transiciones, invariantes y errores de dominio.
- Repositories: filtros, selecciones y transacciones relevantes.
- Route Handlers/Actions: validación, autenticación, autorización, status y contrato JSON.
- Componentes/hooks: interacción observable y estados críticos.
- Seguridad: acceso negado, pertenencia del recurso, entradas manipuladas y no filtración.
- Bugs: prueba de regresión que falle antes de la corrección.

## Convenciones

- Nombres que describan escenario y resultado.
- Arrange, Act, Assert legibles; evita fixtures gigantes sin intención.
- `beforeEach` restaura mocks y estado compartido.
- Usa `vi.hoisted` cuando un mock de módulo necesite estado compartido.
- Mockea dependencias externas, reloj, red y persistencia cuando no sean el objeto de la prueba.
- No mockees la unidad bajo prueba.
- Usa tablas (`it.each`) para matrices de estados y permisos.
- No dependas del orden de ejecución.

## Límites

La suite normal no debe:

- enviar correos, SMS o WhatsApp reales;
- acceder a AWS, SAP, Niubiz u otros proveedores reales;
- modificar una base compartida;
- depender de secretos de producción;
- importar tests desde `.agents` o `node_modules`.

## Cobertura

No existe todavía una compuerta global de cobertura configurada. Prioriza riesgo sobre porcentaje: autenticación, autorización, pagos, OTP, carga de archivos, estados y mutaciones de datos requieren mayor profundidad.

Si se incorpora cobertura, debe acordarse por dominio y añadirse sin falsear resultados mediante exclusiones amplias.

## Antes de entregar

```bash
npm run check
```

Si el cambio toca Next.js, ejecuta además `npm run build`. Las pruebas aprobadas no sustituyen la compilación de producción.
