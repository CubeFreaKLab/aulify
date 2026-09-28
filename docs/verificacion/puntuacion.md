# Casos numéricos de calificación

Los escenarios AP-03 a AP-07, AP-13 y AP-14 se ejecutaron mediante el contrato público de comandos, primero en PGlite y después en Supabase con sesiones JWT de un docente y un estudiante ficticios. Ambos ensayos aprobaron veinte comprobaciones. El programa no introduce notas ni modifica respuestas directamente en tablas.

| Escenario | Resultado comprobado |
|---|---|
| AP-03 · selección múltiple | Conjunto exacto: 4; correcta omitida: 0; incorrecta adicional: 0 |
| AP-04 · relaciones | Tres pares correctos de cuatro, valor 8: 6 |
| AP-05 · secuencia | Dos posiciones correctas de cuatro, valor 5: 2,5 |
| AP-06 · espacios | Dos opciones correctas de tres, valor 6: 4; las mismas palabras escritas quedan pendientes |
| AP-07 · revisión manual | Pregunta cerrada pendiente; valores 6 y −1 fuera de [0,5] rechazados; estado o nota anterior conservados |
| AP-13 · doble | Adicional correcto: 2; erróneo: 0; manual: 3 solo después de corregir |
| AP-14 · juego y nota | B=6, Q=10, D=2, M=20: juego 8, nota 12 o 16 según configuración; nunca supera 20 |

La primera ejecución detectó una incompatibilidad entre AP-04 y la validación de respuestas. Exigir que el estudiante utilice todos los destinos exactamente una vez impide obtener tres aciertos de cuatro: una única elección equivocada repite necesariamente otro destino. La migración `20260928123500` permite puntuar cada par independientemente, manteniendo la solución docente uno a uno y la validación de identificadores. No permite elementos ajenos a la pregunta, no modifica calificaciones históricas y no cambia permisos. La demostración utiliza la misma regla.

La migración se aplicó en una transacción mediante el editor SQL del proyecto autorizado y se registró en su historial; la comprobación remota posterior confirma el comportamiento. No se usaron correcciones privilegiadas para obtener los resultados del ensayo. La materia ficticia se archivó al terminar.

Evidencias: [base aislada](puntuacion-aislada.json), [servicio remoto](puntuacion-remota.json), [ejecutor](../../tools/datos/scoring-acceptance.mjs) y [migración](../../supabase/migrations/20260928123500_aulify_independent_matching_answers.sql). La integración continua incorpora el ensayo aislado; su ejecución remota requiere las cuentas de prueba privadas y no se activa en CI.

Estos casos comprueban reglas numéricas y persistencia mediante RPC. No sustituyen pruebas visuales, de correo, accesibilidad, concurrencia ni el resto de escenarios del producto.

Los registros identifican `0c110a7` como revisión base. El ejecutor y la migración 13 estaban preparados sin commit durante la ejecución; se versionan junto con estos informes. No se atribuyen sus resultados al árbol anterior sin esos cambios.
