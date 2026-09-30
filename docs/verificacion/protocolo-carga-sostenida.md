# Protocolo sostenido y comprobación de muestras

El ejecutor `tools/datos/load-run.mjs` mantiene el escenario del plan de calidad: cuatro docentes, 200 estudiantes, diez preguntas, cinco minutos de calentamiento y quince minutos de medición por modalidad. Se conserva el sondeo de un segundo y una ráfaga de 200 respuestas en dos segundos durante cada medición. No se rebajan p95 ni integridad.

Antes de cada fase comprueba que el servidor local entrega el identificador de compilación esperado. Reutiliza las 204 sesiones ficticias existentes, espacia las renovaciones y limita los reintentos de lectura de preparación. No crea cuentas, restablece credenciales ni sustituye un rechazo de autorización por un nuevo acceso. La preparación acota las lecturas estudiantiles a una actividad existente de su grupo.

Las descargas iniciadas antes de una respuesta confirmada no aceptan una revisión antigua como actual. Los reintentos de respuesta conservan la misma clave, respetan la espera del servidor y no repiten rechazos 400/401/403. Cada archivo de resultados tiene fecha propia para conservar ensayos anteriores.

El cálculo exige las 2.000 confirmaciones y respuestas esperadas, ausencia de pérdidas y duplicaciones, y 2.000 observaciones de apertura en guiado. También registra las 200 lecturas de resultados publicados. Un percentil favorable calculado sobre muestras incompletas no aprueba el escenario. Tres pruebas locales del evaluador cubren límites, muestras faltantes, pérdidas, duplicados, demora y ráfagas inválidas; las tres pasaron.

La preparación y la publicación/auditoría están fuera de los quince minutos medidos, pero dentro del presupuesto de transferencia. El límite predeterminado sigue siendo 1 GB; el máximo explícito de 2,5 GB sólo se utiliza tras comprobar [cuotas disponibles](cuotas-supabase-20260929.md). Se registra el valor elegido en cada resultado. Este documento describe el procedimiento; no afirma que el ensayo completo haya pasado.
