# Sondeo de un minuto después de la migración 16

29 de septiembre de 2026. **La capacidad sigue sin aprobarse.** La única ejecución de este corte confirmó 193 de 200 respuestas, con p95 de confirmación de **7.929,24 ms**, y registró **133 fallos en 9.969 solicitudes medidas (1,334 %)**. Las 193 respuestas confirmadas estaban persistidas, sin claves ausentes o modificadas. No se repitió el sondeo ni se inició el protocolo completo de Q-06.

## Entorno y preparación

Se utilizó el servidor compilado `http://127.0.0.1:3001`, build `T_5qSEJ-EXz4mAThM-uhx`, con Supabase Free remoto y la migración `20260929224538_aulify_participant_teacher_revision.sql`. La revisión Git registrada al iniciar fue `b8f0ad19d1abbfce753ba0737e849800f9cf096e`. No se utilizó el servidor de desarrollo.

El ejecutor exige base y compilado explícitos, comprueba el proyecto de cuentas, fixtures y `.env.local`, y verifica el build en disco y en el HTML servido. Las guardas se aprobaron al comenzar la preparación y justo antes de medir. El hash de la migración y el del ejecutor quedan registrados.

Las 204 sesiones ficticias existentes estaban vencidas. Se renovaron con separación de 2,5 segundos, sin crear cuentas y sin esperas por límites temporales de Auth. La preparación comenzó a las 22:54:32 UTC. El minuto medido fue **23:03:16.476–23:04:16.640 UTC**; la auditoría terminó a las 23:04:17.697 UTC. Renovación, creación de actividades e inicio de intentos están fuera de la medición.

Se conservó el escenario del [sondeo de migración 14](datos-protocolo-60s-migracion14.md): cuatro docentes y doscientos estudiantes, cuatro actividades, consulta de huella cada segundo escalonada y sin superposición por sesión, descarga acotada solo ante cambio y reintentos de 1/2/4/8 segundos respetando `Retry-After`. Al segundo veinte se enviaron 200 respuestas en **1.887,59 ms**. Se respondió una pregunta por estudiante; no hubo fase guiada ni calentamiento sostenido.

## Resultado

| Operación | Solicitudes | Fallos | p95 HTTP (ms) |
|---|---:|---:|---:|
| Huella | 9.333 | 101 | 1.112,65 |
| Lectura acotada | 436 | 25 | 10.322,41 |
| Respuesta | 200 | 7 | 7.963,85 |

El p95 de confirmación, calculado sobre las 193 respuestas cuyo ACK incluía la clave enviada, fue 7.929,24 ms. La diferencia con el p95 HTTP se debe a que no usan la misma población: el segundo incluye las 200 solicitudes de respuesta. Las siete solicitudes restantes no quedaron confirmadas ni aparecieron entre las respuestas de estas actividades en la auditoría; no se cuentan como respuestas confirmadas perdidas.

Se omitieron 2.834 ticks por consulta activa, espera de reintento o final de ventana. El retraso p95 del bucle de eventos del generador fue 32,36 ms. El registro observó 17.066.625 bytes de cuerpos y estimó de forma preventiva 44.763.394 bytes de transferencia para las solicitudes registradas, incluyendo preparación y auditoría. No es el contador de Supabase ni incluye las dos lecturas HTML de la guarda del build. No se alcanzaron los cortes de 1 GB adicional o más del 10 % de fallos en un minuto.

`status: completed` significa que el ejecutor terminó la ventana y la auditoría; **no significa que el requisito haya aprobado**. Se incumplieron tanto la latencia de 1.500 ms como la tasa de fallos inferior al 1 %.

## Comparación e interpretación

| Indicador | Migración 14 | Migración 16 |
|---|---:|---:|
| Confirmadas / enviadas | 200 / 200 | 193 / 200 |
| Confirmadas ausentes o modificadas | 0 | 0 |
| p95 de confirmación (ms) | 3.867,53 | 7.929,24 |
| Fallos técnicos | 0 | 133 |

La eliminación de la fila técnica compartida **no produjo una mejora observable en esta ejecución**. Las pruebas aisladas demuestran que la escritura compartida desaparece de ese recorrido, pero los tiempos remotos no permiten atribuir a ese cambio la diferencia entre días, carga del servicio y compilados. Tampoco demuestran que la migración sea por sí sola la causa del empeoramiento.

Los errores fueron 101 HTTP 503 en huella, 25 HTTP 503 en lectura y siete HTTP 400 en respuesta. Las longitudes de sus cuerpos coinciden con los mensajes de error de las rutas RPC de esta versión: 80, 55 y 84 bytes respectivamente. El mensaje de indisponibilidad de autenticación tiene 78 bytes y no coincide con estos fallos. El ejecutor conserva estado, tiempo y tamaño, pero no el código interno o la causa del error RPC; no se puede distinguir un timeout de transporte, un error SQL o una excepción del servicio únicamente con el HTTP 400.

Se comprobó solo la cabecera criptográfica de las 204 sesiones ficticias: todas usan **ES256 y tienen `kid`**, sin publicar tokens ni identidades. La hipótesis de una validación remota por firma HS256 no corresponde a estas sesiones. La biblioteca instalada dispone además de caché global de JWKS; no se cambió la configuración de firma.

La consulta agregada de logs para 23:03:15–23:04:18 UTC devolvió 9.378 entradas REST con estado 200 y diez entradas de Pgbouncer. No devolvió entradas de PostgreSQL; los diez mensajes de Pgbouncer no contenían los términos `timeout` o `deadlock`. Estos resultados no cubren uno a uno las solicitudes del generador ni explican los fallos que no alcanzan el servicio. No se presentan como prueba de ausencia de timeouts o interbloqueos. Se consultaron únicamente agregados, sin exportar cabeceras de autorización, cuentas o texto SQL.

## Siguiente paso

Antes de ejecutar otra carga, añadir observabilidad acotada en el servidor que distinga validación de identidad, solicitud RPC y lectura de respuesta, registrando duración y una categoría segura de error. Los mensajes al usuario deben permanecer comprensibles y los registros no deben contener JWT, contraseñas, cookies ni respuestas de estudiantes. Una comprobación aislada de errores simulados puede verificar esa clasificación. La siguiente medición solo se justifica cuando pueda localizar el origen de las esperas de aproximadamente diez segundos; repetir la misma carga sin esa información no resolvería la causa.

Los usuarios, duración y umbrales de Q-06 se mantienen. Faltan la medición completa de ambos modos y la propagación guiada; este minuto no los sustituye.

[Registro íntegro](datos-protocolo-60s-20260929225432.json) · [Ejecutor](../../tools/datos/load-protocol.mjs) · [Cambio de contador](datos-revision-participante.md).
