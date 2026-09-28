# Aceptación aislada de participación, juego y publicación

El ejecutor [game-acceptance.mjs](../../tools/datos/game-acceptance.mjs) recorre ocho escenarios de producto y una regresión adicional de publicación mediante los comandos y proyecciones públicos. El resultado con las quince migraciones es **103 comprobaciones aprobadas**, distribuidas en nueve secuencias. No son 103 escenarios de aceptación distintos.

| Escenario | Datos y resultado comprobados en PGlite |
|---|---|
| AP-08 | Dos preguntas dependientes A/B y dos independientes C/D; conserva conjunto, adyacencia y orden interno, explicaciones asociadas, corrección por identificador y orden de preguntas/opciones al recuperar el mismo intento. |
| AP-09 | E1/E2 entran sin consumir oportunidad; iniciar dos veces crea un intento por persona. E1 responde, E2 omite; el cierre requiere confirmación y rechaza respuestas posteriores. La última pregunta escrita queda pendiente en ambos; al corregir, E1 obtiene 20 y E2 12 por la omisión conservada. |
| AP-11 | Pista y doble consumidos una vez; repetición de pista y reenvío de respuesta no duplican consumo. El segundo intento conserva usos agotados y un envío rechazado no confirma respuesta. |
| AP-15 | Rechazo de racha/clasificación con ocultamiento; ACK, lecturas y snapshots no muestran correcciones ni soluciones. Publicar 20/20 no libera desglose ni clasificación oculta. |
| AP-16 | Actividad diferida cerrada, preguntas de 8 y 2 puntos; clasificación bloqueada hasta publicar a ambos. Una revisión privada posterior conserva clasificación individual, equipo, estado provisional, contenidos estudiantiles y huella de sincronización. La republicación cambia 10/10 a 10/8 y el promedio de equipo a 9. |
| AP-16, regresión de historial | Primer intento: base 6, doble 6, juego 12; segundo: base 10, juego 10, mejor nota 20. La clasificación usa juego 12. Corregir el primer intento a 8 conserva 12 para el estudiante y muestra 16 al docente, hasta republicar. |
| AP-18 | Puntos 10, 10 y 8 producen puestos 1, 1 y 3. Otra sesión cerrada conserva clasificación provisional hasta corregir la última respuesta manual. |
| AP-19 | Equipo de dos: (10+6)/2; equipo de tres: (12+12+0)/3. Ambos promedian 8 y empatan. E5 no inicia, aporta cero al equipo y sigue sin intento ni nota personal. |
| AP-20 | Cambio y reparto de equipos iniciados rechazados; listas conservadas. El docente identifica cuentas, los estudiantes reciben alias estables y puntos permitidos; cuentas ajenas y rol anónimo quedan denegados. |

## Defecto encontrado y corrección

Con las catorce migraciones anteriores, revisar de 2 a 0 una respuesta ya publicada cambiaba la clasificación diferida de 10/10 a 10/8, aunque el docente no hubiera republicado. La consulta utilizaba la corrección vigente y solo comprobaba que existiera alguna evaluación publicada. La [evidencia adversa](juego-aceptacion-regresion.json) conserva el resultado observado; no se contabiliza como prueba aprobada.

La [migración 15](../../supabase/migrations/20260928135711_aulify_deferred_ranking_publication.sql) reconstruye la clasificación diferida desde la última publicación individual. Para el intento publicado usa las referencias exactas de `evaluation_question_grades`; para otros intentos utiliza el historial conocido hasta `published_at`, incluyendo doble y resoluciones. Esto permite conservar el mejor juego aunque provenga de otro intento que la mejor nota. Los tamaños de equipo siguen usando la lista congelada, con cero para integrantes sin intento.

La clasificación publicada permanece visible con los mismos datos durante una revisión privada. La republicación explícita autoriza la nueva versión. La función conserva sus permisos y formato; no añade tablas ni cambia el total de 47 relaciones propias. El docente y la política inmediata siguen viendo las correcciones vigentes. La migración se verificó únicamente en PGlite en este informe; su archivo no demuestra aplicación remota.

## Reproducción y evidencia

Desde la raíz del repositorio, con las dependencias fijadas instaladas:

```text
node tools/datos/game-acceptance.mjs
node tools/datos/check.mjs --report docs/verificacion/juego-regresion-base.json
```

El [resultado corregido](juego-aceptacion-aislada.json) conserva hora real, revisión base y SHA-256 del ejecutor y de cada migración. El código nuevo se ejecutó antes de su commit: los hashes identifican los archivos efectivamente probados y evitan atribuirlos solo a la revisión base. La [regresión general](juego-regresion-base.json) aprueba las 84 comprobaciones existentes con la migración 15; ese conteo se conserva separado.

Para reproducir el fallo anterior, excluir expresamente la migración 15 y guardar otro informe. Se espera salida distinta de cero:

```text
node tools/datos/game-acceptance.mjs --through 20260928130653 --report docs/verificacion/juego-aceptacion-regresion.json
```

Las cuentas son ficticias y se insertan exclusivamente en el esquema mínimo de Auth. Los casos se ejecutan con rol `authenticated`, salvo el rechazo anónimo; no corrigen datos directamente en `app`. Los cierres guiados pasan por controles docentes y la regresión individual espera el cierre real del reloj de la base. Los snapshots contienen una `state.revision` basada en la hora de lectura: se excluye solo ese campo de la comparación de contenidos y se compara aparte la huella opaca exacta de `aulify_sync`.

## Límites

Esta evidencia aislada no acredita reconexión de red remota para AP-08, ni recorridos de navegador para AP-09/AP-11. En AP-15 demuestra rechazo y reserva de datos, pero no la explicación visual de incompatibilidades. No verifica JWT reales, correo, animación, sonido, accesibilidad ni capacidad. AP-10, AP-12, AP-17 y AP-21 quedan fuera de este ejecutor: ausencia de docente, carrera de pistas, efectos y archivos requieren sus comprobaciones específicas. PGlite con una conexión no demuestra concurrencia real. La cobertura integrada debe conservar esos límites al combinar este informe con otras evidencias.
