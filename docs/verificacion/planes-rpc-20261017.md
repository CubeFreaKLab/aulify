# Reutilización de planes de consulta

La migración `20261017182121_aulify_reuse_rpc_query_plans.sql` permite reutilizar el plan de ejecución dentro de cuatro funciones RPC de Aulify. Reduce la preparación repetida de consultas. Cada llamada sigue usando sus parámetros y consultando datos y permisos vigentes.

## Comprobación previa

Se compararon operaciones con planificación automática y con `force_generic_plan`, usando los mismos datos ficticios. Cada grupo se ejecutó en una conexión SQL separada, dentro de una transacción revertida. Las respuestas de perfil no quedaron guardadas como entregas de estudiantes.

| Operación | Muestras por modo | Planificación automática | Plan genérico |
|---|---:|---|---|
| Guardar respuestas | 8 | Entre 5 y 38 ms | Entre 5 y 18 ms |
| Leer el quiz | 3 | 154, 16 y 15 ms | 30, 9 y 9 ms |
| Leer la revisión de sincronización | 3 | 45, 7 y 6 ms | 7, 1 y 1 ms |
| Abrir el historial docente de prueba | 3 | 10,6; 5,7 y 3,5 s | 2,8; 2,7 y 2,6 s |

Son perfiles orientativos: las condiciones de caché no se igualaron y la muestra es pequeña. No sustituyen el ensayo HTTP con 204 sesiones, los calentamientos ni las mediciones completas de Q-06. Los valores se conservan en [el registro JSON](planes-rpc-20261017.json).

## Aplicación y permisos

El ajuste se aplicó a `aulify_command(text,jsonb)`, `aulify_activity_snapshot(uuid)`, `aulify_workspace_overview()` y `aulify_service_sync_batch(jsonb)`. Su configuración de búsqueda, propietarios y permisos se conservaron. La revisión remota confirmó 31 migraciones, ejecución autenticada para las tres funciones ordinarias y acceso exclusivo de servicio para el lote. Ninguna de las cuatro concede ejecución anónima.

La reconstrucción aislada de las 31 migraciones superó las 85 comprobaciones existentes de reglas, aislamiento y permisos. La comparación específica del algoritmo por conjuntos mantiene su alcance en la migración 30; no se presenta como otra medición de esta configuración.

El ajuste se limita a la ejecución de esas funciones. Puede retirarse con `ALTER FUNCTION ... RESET plan_cache_mode` en una nueva migración. No modifica la configuración global de PostgreSQL.

La [documentación de PostgreSQL 17](https://www.postgresql.org/docs/17/runtime-config-query.html#GUC-PLAN-CACHE-MODE) explica que los planes genéricos ahorran preparación, aunque su conveniencia depende de las consultas y los parámetros. El resultado de capacidad se registra por separado.
