# Diagnóstico del protocolo después de la migración 14

El sondeo del 28 de septiembre de 2026 confirmó y auditó **200 de 200 respuestas**, sin errores técnicos. Su p95 de confirmación fue **3.867,53 ms**, superior al requisito de 1.500 ms. No se inició Q-06 completo después de este resultado.

## Entorno y procedimiento

Compilado local de producción `76aWxJ8Ymu77wqTlNGlZJ`, puerto 3002, y Supabase Free remoto con la migración `20260928130653` aplicada. El registro del repositorio al lanzar el generador fue `c030d6db69930ed93861b35a03edfc1b7525b6a7`; el identificador de compilado distingue el ejecutable utilizado y no supone que todos sus cambios estuvieran ya en ese commit.

La preparación comenzó a las **13:54:04 UTC** y dejó listas 204 sesiones, con renovaciones espaciadas por 2,5 segundos, sin esperas por límites de autenticación. La ventana medida fue **14:02:59.001–14:03:59.523 UTC**. No se cambió el código ni el esquema durante ella.

Se mantuvo el escenario de cuatro docentes y doscientos estudiantes distribuidos en cuatro actividades nuevas: huella cada segundo, peticiones escalonadas, una lectura acotada solo si cambia la revisión, y reintento progresivo de 1/2/4/8 segundos. El generador ahora respeta también `Retry-After`, en segundos o fecha HTTP, como el cliente compilado. Al segundo veinte despachó las doscientas respuestas en **1.878,58 ms**. La auditoría posterior contrastó cada clave confirmada con las respuestas persistidas.

## Resultado

| Operación | Solicitudes medidas | Fallos | p95 |
|---|---:|---:|---:|
| Huella de actividad | 10.363 | 0 | 1.127,92 ms |
| Lectura acotada | 411 | 0 | 4.324,72 ms |
| Envío de respuesta HTTP | 200 | 0 | 3.867,51 ms |
| Confirmación interpretada por el generador | 200 | 0 | 3.867,53 ms |

Las 200 claves confirmadas estaban guardadas, sin ausencias ni cambios. Se omitieron 1.837 ticks porque seguía activa una petición, correspondía esperar o había finalizado la ventana; no se cuentan como peticiones ejecutadas. El retraso del bucle de eventos del generador tuvo un p95 de 31,95 ms.

Incluyendo preparación y auditoría se observaron **15,42 MB** de cuerpos HTTP. La estimación preventiva de transferencia fue **42,50 MB**, por debajo del corte de 1 GB adicional. No equivale al contador facturable de Supabase. Tampoco se alcanzó el corte de más de 10 % de fallos técnicos por minuto.

## Interpretación

Frente al [sondeo anterior](datos-protocolo-60s.md), desaparecieron los errores técnicos y bajaron los p95 de lectura, pero el p95 de confirmación siguió por encima del objetivo. Son ejecuciones distintas de un entorno compartido; estos cambios no permiten atribuir causalidad exclusivamente a la migración 14.

La siguiente comprobación debe observar las esperas del motor durante una ráfaga. El contador docente sigue siendo una fila compartida que se actualiza dos veces por una respuesta automática; todavía falta comprobar si esa contención explica una parte relevante de la latencia remota. El diagnóstico de un minuto no mide calentamiento sostenido, quince minutos por modo ni propagación de preguntas guiadas, y no sustituye Q-06.

[Registro íntegro](datos-protocolo-60s-20260928135404.json) · [Ejecutor](../../tools/datos/load-protocol.mjs) · [Migración y regresiones](datos-proyeccion-docente.md).
