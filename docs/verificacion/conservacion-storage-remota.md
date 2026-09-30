# Conservación y reintento con Storage remoto

El ensayo aprobó **29 comprobaciones** sobre PostgreSQL y Storage de Supabase. Eliminó dos objetos exclusivos de una materia ficticia vencida y conservó íntegro el objeto compartido con la biblioteca. Tras un borrado parcial, la confirmación rechazó el lote, mantuvo los metadatos pendientes y permitió reintentarlo sin duplicar eliminaciones. [Resultado](conservacion-storage-remota.json) y [estados SQL observados](conservacion-storage-sql.json).

Se reutilizaron dos cuentas ficticias existentes, con sesiones JWT independientes, y se subieron tres PNG de un píxel. La materia, tarea, entrega, borrador, publicación y archivo se crearon mediante comandos del producto. El intento de entregar un archivo de otra cuenta fue rechazado. La referencia compartida biblioteca/entrega se añadió por SQL como topología histórica de prueba; no se atribuye esa posibilidad al flujo público actual.

| Momento | Archivo compartido | Exclusivos | Trabajo de purga |
|---|---|---|---|
| Preparación | Borrador, publicación y entrega lo referencian | Dos objetos presentes y listos | Programado |
| Primer mantenimiento | Mantiene borrador, publicación y bytes; desaparece la referencia vencida | Dos metadatos pendientes y dos objetos presentes | En curso |
| Borrado parcial y confirmación rechazada | Conservado | Dos metadatos pendientes; sólo un objeto presente | En curso |
| Reintento y confirmación | Conservado y accesible al docente | Sin objetos ni metadatos | Completado |
| Repetición | Conservado | Cero eliminaciones adicionales y cola vacía | Completado |

El SHA-256 de los bytes compartidos se contrastó antes y después. Las huellas de las otras materias, la materia de control, el borrador, la versión publicada y los demás metadatos de archivo permanecieron iguales en cada fase. También se conservaron la cantidad de cuentas y el conjunto de identificadores de perfiles, sin extraer credenciales ni contenido de Auth.

El mantenimiento sigue siendo global. El [script SQL](../../tools/datos/retention-storage-state.sql) comprueba los candidatos antes de llamar a `tick` y revierte la transacción si detecta materias, archivos huérfanos o una cola de archivos ajenos al fixture. El [consumidor de prueba](../../tools/datos/retention-storage-remote.mjs) sólo puede borrar las rutas aleatorias de su manifiesto. Estas condiciones acotan este ensayo; no convierten el mantenimiento en una API pública de purga por materia.

La preparación representó el vencimiento mediante fechas sintéticas. Desde esa elegibilidad hasta completar el trabajo transcurrieron **62,409 segundos reales**, con ejecución manual y fallo parcial deliberado. No son treinta días transcurridos ni una medición del retraso del programador. AP-32 queda cubierto por el ensayo remoto; AP-31 conserva pendiente la carrera remota restauración/purga y la comprobación del objetivo operativo de 24 horas mediante ejecución programada.

La [observación programada posterior](conservacion-programada.md) verificó ese objetivo de 24 horas en otro caso ficticio, con espera real del programador. Permanece pendiente la carrera remota; ambos ensayos conservan separados sus procedimientos y resultados.

Las etapas están separadas en `prepare`, SQL de elegibilidad y mantenimiento, `partial`, nuevo mantenimiento, `finish` y lectura final. No deben repetirse sobre un manifiesto ya completado. El [validador de evidencias](../../tools/datos/retention-storage-evidence.mjs) compara los estados conservados con las condiciones esperadas. Las herramientas no se ejecutan contra Supabase desde CI.
