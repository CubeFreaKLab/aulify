# Comprobación de una clase de 30 estudiantes

Perfil `classroom-30-v1`, fijado el 17 de octubre de 2026 antes de medir. Estado: preparado y ejecutado; recorrido funcional completo, objetivo de velocidad guiada todavía no aprobado. Resultados y límites en el [resumen del ensayo](../verificacion/clase-30-20261017.md).

El alcance de esta versión es una materia con un docente y treinta estudiantes ficticios activos a la vez. Se reutilizan cuentas de prueba existentes sin borrar su historial. Las otras cuentas del conjunto histórico no participan.

| Elemento | Condición definida |
|---|---|
| Recorridos | Avance individual y avance guiado, comprobados por separado. |
| Preguntas | Diez preguntas cerradas por actividad; treinta respuestas por pregunta. |
| Preparación | Verificar proyecto, compilado y sesiones; crear actividades independientes y abrir los avisos. Fuera de la medición. |
| Calentamiento | Un minuto por modo, con datos separados de la medición. |
| Medición | Dos minutos por modo, con las 31 sesiones activas. |
| Envíos | Distribuidos durante cada ronda; en la quinta pregunta medida, los treinta se despachan dentro de dos segundos. |
| Respuestas | Trescientas confirmadas y persistidas por fase, sin pérdida, alteración o duplicación. |
| Notas | Treinta publicaciones sin fallo y treinta notas correctas consultadas después de cada fase. |
| Tiempo de confirmación | Al menos el 95 % de las confirmaciones en 1,5 segundos o menos. |
| Avance guiado | Al menos el 95 % de las aperturas observadas en dos segundos o menos; trescientas observaciones medidas. |
| Fallos técnicos | Menos del 1 % de solicitudes válidas en cada medición. Los rechazos intencionados se evalúan aparte. |
| Consumo | Límite preventivo de 150 MB de transferencia adicional estimada, sin planes de pago; contrastar el consumo con los servicios. |
| Límite global | Doce minutos desde el inicio del ejecutor, incluida preparación, auditoría y ambos modos. Al agotarlo se cancelan solicitudes y se registra el corte. |

El ejecutor detiene la carga si se supera el presupuesto, si persiste una saturación grave en el calentamiento o si los fallos superan el límite preventivo del último minuto. No inicia automáticamente otro ensayo. Un corte, un modo ausente, una muestra incompleta o un resultado sin auditoría no se consideran aprobados.

## Preparación y ejecución

`node tools/datos/load-run.mjs --classroom --plan` muestra el protocolo sin leer credenciales, crear cuentas ni hacer solicitudes. Las pruebas aisladas del perfil se ejecutan con `node --test tools/datos/load-scenario.test.mjs tools/datos/load-criteria.test.mjs`.

La ejecución real requiere `--classroom`, el origen autorizado y el identificador exacto del compilado. Una Preview requiere además su manifiesto y acceso temporal privado. El ejecutor no modifica secretos de servicios, no activa facturación y no crea las 204 cuentas del escenario histórico. No usar `load-prepare.mjs` para preparar esta clase reducida.

Antes de medir: confirmar migraciones aplicadas y correspondencia entre fuente y compilado, que no exista otra carga, y cuotas suficientes. Mantener la misma aplicación, base y perfil durante el ensayo. Guardar el informe resultante aunque falle y retirar el acceso temporal cuando corresponda.

## Alcance de la conclusión

Esta comprobación mide el protocolo HTTP de 31 sesiones, no el dibujo de treinta navegadores ni una clase con personas. Un resultado local con Supabase remoto se identifica así; no demuestra el mismo rendimiento en Vercel. Las ventanas breves tampoco acreditan funcionamiento continuo durante horas.

La meta anterior de cuatro clases y 200 estudiantes no se validó. Sus [resultados anteriores](../verificacion/capacidad-postgres-pool-20261017.md) y el protocolo `legacy-200-v1` se conservan para comparación; no se ejecutan por omisión y no se aprueban mediante esta clase reducida. El cambio de alcance no modifica los límites de tiempos, errores e integridad después de medir.
