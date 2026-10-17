# Sincronización por conjuntos

El 17 de octubre de 2026 se sustituyó el recorrido individual del lote de sincronización por una consulta que comparte el contexto de cada actividad. El sondeo sigue consultando permisos vigentes para cada identidad y devuelve únicamente revisión opaca, hora del servidor y próximo plazo.

La migración `20261017172026_aulify_set_based_service_sync.sql` se aplicó en Aulify después de comprobar su equivalencia en una base aislada. Conserva una función interna con el comportamiento anterior para conversiones UUID no canónicas. Ninguna de las dos funciones puede ejecutarse con las claves públicas de estudiante o docente; el punto de entrada requiere `service_role` y la ruta HTTP obtiene las identidades de sesiones verificadas.

## Comprobación

El ejecutor `tools/datos/sync-batch-set-check.mjs` reconstruye las migraciones en PGlite, crea datos ficticios y compara el resultado con la función anterior dentro de la misma transacción. Cubre permisos, cuentas sin confirmar, perfiles ausentes, retirada, archivo, publicación, duración, inicio futuro, revisiones y errores independientes por elemento. El informe [JSON](sync-lotes-conjuntos-local.json) conserva las comprobaciones y la medición aislada.

El lote de 64 elementos necesitó menos trabajo en esta comparación. Es una medición secuencial sin red: no demuestra concurrencia, capacidad del alojamiento ni cumplimiento de Q-06. Se añadió el ejecutor a GitHub Actions para conservar la equivalencia en cambios posteriores.

## Siguiente comprobación

Medir los endpoints reales con las 204 sesiones ficticias, ambas modalidades y sus ventanas completas. Mantener los umbrales de confirmación, propagación, errores e integridad. La aprobación de capacidad solo corresponde al informe completo y al consumo observado en los servicios.
