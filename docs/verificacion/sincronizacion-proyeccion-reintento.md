# Reintento de una proyección que todavía no se recibió

Verificación local: 30 de septiembre de 2026, 01:02–01:04 UTC.

## Problema reproducido

El sondeo aceptaba una revisión nueva antes de esperar los datos de `/api/workspace`. Como `refreshDemo` mostraba los errores sin rechazar su promesa, una respuesta 503 dejaba aquella revisión aceptada, pero la proyección anterior seguía en memoria. Si `/api/sync` volvía a responder la misma revisión, no se pedían nuevamente los datos.

La prueba inicial reprodujo exactamente esa secuencia: revisión R, snapshot fallido y revisión R repetida. Esperaba una tercera lectura del workspace y observó solamente dos.

## Corrección

`src/demo/store.ts` separa el resultado interno de actualización en tres estados: aplicado, descartado por quedar obsoleto y fallido. La función pública `refreshDemo()` conserva su contrato de resolución sin rechazos y el error visible para sus llamadas existentes.

El sondeo incorpora la revisión solo después de aplicar una proyección correspondiente a la generación y época de proyección vigentes. Un error llega al control de reintentos; los contadores de fallos se reinician después de recuperarse. Se mantiene `Retry-After` y el intervalo creciente entre intentos fallidos.

Si una lectura anterior al sondeo sigue en curso, no se utiliza para aceptar la revisión recibida. El siguiente sondeo puede solicitar una proyección nueva. También se comprueba la generación al completar la lectura de sincronización, para ignorar respuestas de una sesión anterior.

Se conserva la protección de los ACK: una lectura iniciada antes de confirmar una respuesta no puede reemplazarla. Cuando esa lectura se descarta, tampoco se acepta su revisión como ya proyectada. Los rechazos 401 y 403 del workspace llegan ahora a la limpieza existente de datos y detención del sondeo.

## Verificación

```text
npx vitest run tests/unit/workspace-sync.test.ts --maxWorkers=1
npx eslint src/demo/store.ts tests/unit/workspace-sync.test.ts
```

Resultado: **8 pruebas aprobadas**, duración informada por Vitest de **0,368 s**. ESLint finalizó correctamente y Prettier se aplicó a los dos archivos.

Las pruebas importan el módulo real del almacén, utilizan su parser HTTP, sus funciones públicas y su ciclo de sondeo. Se simulan transporte, reloj y puntos de entrada de los hooks para ejecutar el efecto sin renderizar una interfaz. Cubren:

- Reintento con la misma revisión después de un 503, respetando `Retry-After`.
- Intervalo creciente ante fallos consecutivos de la proyección.
- Compatibilidad de la función pública de actualización.
- Lectura anterior al sondeo todavía en curso.
- ACK recibido mientras llega una proyección obsoleta.
- Limpieza y detención ante 401 y 403.
- Proyección tardía de una sesión o ámbito anterior.

No hubo tráfico HTTP real, carga remota, cambios visuales, compilación ni reinicio del servidor. Esta verificación no sustituye una prueba de navegador posterior ni demuestra mejora de latencia o cumplimiento de Q-06.

## Verificación posterior de navegador

El 30 de septiembre de 2026, a las **01:14:47 UTC**, se ejecutó un único caso en `chromium-escritorio`, con un trabajador y sin reintentos del ejecutor, sobre `http://127.0.0.1:3001`. Antes de ejecutarlo se verificó que el build en disco y el servido eran `kWhdsczTz0VM4q1tEx6j6`; el proyecto remoto tenía la migración 20, versión `20260930011205`.

```text
AULIFY_REMOTE_E2E=1
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3001
node node_modules/@playwright/test/cli.js test tests/e2e/integrado.spec.ts --grep "responde, reintenta sin duplicar" --project chromium-escritorio --workers 1 --retries 0 --reporter=json
```

Resultado: **1 prueba aprobada, 0 fallos y 0 reintentos**, en **17,134 segundos** de prueba; duración total del ejecutor de 17,776 segundos. El [registro focal](integracion-sync-reintento.json) contiene build, fechas, resultado y hashes, sin cookies ni credenciales.

Se utilizaron dos cuentas ficticias existentes. El caso creó datos de actividad por los comandos de la aplicación y comprobó la misma clave de idempotencia después de interrumpir el primer ACK, avance a la siguiente pregunta con la lectura anterior retenida y ausencia de retroceso al liberarla. Después recargó la página, retomó el intento y verificó tres respuestas persistidas, cierre del intento, privacidad de la proyección estudiantil y navegación a resultados.

No se crearon cuentas, cambiaron credenciales, reinició el servidor ni modificó el código. Este caso de navegador cubre la regresión de ACK y reconexión; la secuencia concreta `sync 200 → workspace 503 → misma revisión` se verificó en las pruebas unitarias anteriores. No es una prueba de carga ni acredita Q-06. El caso aprobado no generó capturas, vídeo o trazas.
