# Silenciamiento durante la confirmación de una respuesta

El control de sonido se actualizaba visualmente, pero la continuación del envío conservaba el valor anterior de la preferencia. Una intercalación controlada en la demostración reprodujo una llamada a `oscillator.start()` cuando el botón ya indicaba «Activar sonidos» y `aria-pressed=false`.

La corrección consulta una referencia actualizada sincrónicamente al pulsar el control, tanto al preparar el audio como inmediatamente antes de reproducir. También comprueba que la actividad permita sonidos. No altera la respuesta ni su puntuación.

## Comprobación

Los [resultados del 30 de septiembre de 2026](preferencia-sonido.json) identifican el compilado y las huellas de código, prueba y observación previa. La [prueba de regresión](../../tests/e2e/preferencia-sonido.spec.ts) ejecuta dos casos en Chromium de escritorio y móvil emulado:

| Condición | Antes de la corrección | Después de la corrección |
|---|---|---|
| Sonido activo | Una invocación a `oscillator.start()` | Una invocación en ambos tamaños. |
| Silenciar tras persistir y antes de continuar | El botón indica desactivado, pero se invoca `oscillator.start()`. | Cero invocaciones en ambos tamaños; botón desactivado y respuesta conservada. |

Cuatro ejecuciones aprobadas, sin omitidos, errores de página ni reintentos; una respuesta persistida por ejecución. Construcción y tipos, ESLint y formato aprobados. La observación previa adversa se conserva en el registro, con sus eventos y huella, y no se suma como casos nuevos.

La instrumentación conserva `AudioContext` y los osciladores nativos. El silenciamiento se fuerza mediante una microtarea después del almacenamiento local y antes de que continúe el envío. Como `/demo` guarda síncronamente, no representa una interacción humana posible en esa ventana ni una petición remota lenta. Se comprueban invocaciones de audio, no una medición acústica.

Para reproducir sobre la aplicación compilada local:

```powershell
$env:PLAYWRIGHT_BASE_URL='http://127.0.0.1:3001'
npx playwright test tests/e2e/preferencia-sonido.spec.ts --workers=1
```

Este resultado aporta a RF-06 y AP-17. AP-17 sigue parcial: falta comprobar su secuencia completa de dos aciertos, respuesta manual y otro acierto, con rachas y puntuación contrastadas. No acredita dispositivos físicos ni producción.
