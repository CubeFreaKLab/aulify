# Aceptación de 001

Estado: versión 1.0; todos los casos pendientes de ejecución. Las decisiones D-01 a D-07 proceden de [spec.md](spec.md).

Datos de prueba ficticios: docente D1 con materias M1 y M2; docente D2 con M3; estudiante E1 aprobado en M1; E2 con solicitud pendiente; E3 aprobado solo en M2. Nunca usar nombres, correos o respuestas reales de estudiantes en capturas de prueba.

| Caso | Regla | Dado / cuando | Resultado esperado | Comprobación prevista |
|---|---|---|---|---|
| AC-01 | E1-01, D-01 | Cuenta sin confirmar intenta crear materia o solicitar ingreso. | Se solicita confirmar correo; no se crea el recurso de destino. | Integración y recorrido. |
| AC-02 | E1-01 | Se solicita recuperación y se utiliza un enlace válido; después se reutiliza o vence. | Primera operación permitida; reuso y vencimiento rechazados con opción de solicitar otro enlace. | Integración con correo de prueba. |
| AC-03 | E1-01 | Visitante solicita recuperación para correo existente e inexistente. | Mismo mensaje externo, sin revelar si hay cuenta; límites de frecuencia aplicados. | Integración. |
| AC-04 | E1-02 | E2 repite solicitud y D1 repite aprobación. | Una solicitud pendiente y una membresía; solo después de aprobación accede. | Integración y recorrido. |
| AC-05 | E1-02, D-02 | D1 renueva código; otra cuenta usa el anterior. | Nueva solicitud rechazada; E1 mantiene acceso y las solicitudes previas siguen identificables. | Integración. |
| AC-06 | Permisos | E2, E3 o D2 usan un identificador de M1, borrador, intento o nota de E1. | Lectura y escritura denegadas por servidor y políticas; ninguna solución o nota filtrada. | Pruebas directas de datos y operaciones. |
| AC-07 | E1-03 | D1 edita varios bloques, espera confirmación de guardado, cierra y reabre. | Último borrador confirmado idéntico en contenido y orden. | Recorrido en dos tamaños. |
| AC-08 | E1-03, D-03 | Dos pestañas editan desde la misma revisión y guardan sucesivamente. | Segundo guardado detecta conflicto; no sobrescribe silenciosamente. | Integración concurrente y recorrido. |
| AC-09 | E1-03 | Se intenta publicar sin título, con quiz inválido o con selección sin solución. | Publicación bloqueada; foco y error asociados al bloque; borrador conservado. | Recorrido y teclado. |
| AC-10 | E1-04 | E1 responde V1; D1 edita y publica V2. | El intento de E1 conserva V1, sus soluciones y valores; V2 no cambia su resultado. | Datos e integración. |
| AC-11 | E1-04, D-04 | Actualización de reglas e inicio de primer intento ocurren simultáneamente. | Una configuración íntegra por intento; si el intento gana, el cambio se rechaza. | Integración concurrente. |
| AC-12 | E1-05 | D1 configura práctica que no cuenta y examen que sí cuenta. | Resumen y cálculo respetan configuración explícita, máximo y peso. | Recorrido y reglas. |
| AC-13 | E1-06, E1-10 | Retroalimentación oculta; E1 responde una pregunta. | Avanza directamente; sin pantalla de guardado ni señales de acierto. Respuesta de red sin soluciones ni puntos. | Recorrido e inspección de contrato. |
| AC-14 | E1-06 | Retroalimentación inmediata; E1 responde bien y luego mal. | Texto e iconos explican ambos casos; lectura sin avance forzado; controles accesibles. | Recorrido y revisión manual. |
| AC-15 | E1-06, E1-08 | E1 escribe exactamente la solución orientativa de una pregunta abierta. | Queda pendiente de corrección manual; no recibe acierto ni nota automática. | Reglas e integración. |
| AC-16 | E1-06, E1-07 | Servidor persiste respuesta pero se pierde la confirmación; cliente reintenta. | Una respuesta y una puntuación; se recupera el resultado del mismo envío. | Integración con fallo de red. |
| AC-17 | E1-07 | Dos pestañas inician a la vez; luego se recarga una de ellas. | Un intento abierto, una oportunidad consumida y mismo orden/plazo. | Integración concurrente. |
| AC-18 | E1-07 | Se cambia reloj local y se envía tras el plazo del servidor. | No se amplía tiempo; envío tardío rechazado; respuestas confirmadas conservadas. | Integración con reloj controlado. |
| AC-19 | E1-07 | Vence intento con una respuesta abierta enviada y otra pregunta sin responder. | Intento cerrado; escrita pendiente, omitida cero; ninguna nota definitiva prematura. | Reglas e integración. |
| AC-20 | E1-07 | D1 amplía plazo antes del cierre. | Nuevo plazo coherente con cierre general; cambio registrado y comunicado. | Integración y recorrido. |
| AC-21 | E1-08, D-07 | Puntos obtenidos 2, 0 y 4 sobre máximos 2, 3 y 5; actividad de 20. | Resultado 12,00; con tercera respuesta pendiente, nota final ausente. | Pruebas de cálculo. |
| AC-22 | E1-08, D-07 | Tres intentos: 60 corregido, 80 corregido y uno pendiente. | Candidato 80 con revisión pendiente indicada; no reemplaza nota publicada sin publicar. | Pruebas de cálculo y recorrido. |
| AC-23 | E1-09, D-07 | 12/20 con peso 2 y 90/100 con peso 1; otra actividad pendiente. | Promedio 70,00; pendiente no añade peso. Cero publicado sí se incluye. | Pruebas de cálculo. |
| AC-24 | E1-09 | No hay notas publicadas que cuenten. | Mensaje de ausencia de calificaciones; sin división por cero ni promedio cero inventado. | Reglas y recorrido. |
| AC-25 | E1-09 | Nota 12 publicada, corrección privada a 14, posterior republicación. | Estudiante ve 12 hasta republicar, luego 14; versiones y motivo conservados. | Integración y recorrido. |
| AC-26 | E1-10 | Nota publicada antes del cierre con revisión diferida; o aciertos ocultos siempre. | Primer caso espera también al cierre; segundo nunca expone soluciones por publicar la nota. | Pruebas de acceso y recorrido. |
| AC-27 | Calidad | Completar creación, publicación, participación y revisión a 360 × 800 y 1440 × 900. | Todas las acciones accesibles, textos legibles y sin controles cortados. | Playwright y revisión visual. |
| AC-28 | Calidad | Mismos recorridos con teclado; editor sin arrastrar; texto al 200 % y ancho 320. | Sin trampas ni pérdida de contenido; foco visible y alternativas operables. | Revisión manual y automatización pertinente. |
| AC-29 | Calidad | Lector de pantalla en pregunta, error de envío, nueva pregunta y fin del intento. | Nombres/roles correctos y anuncios suficientes sin confirmaciones invasivas. | Revisión manual. |
| AC-30 | Calidad | Movimiento reducido y fallos de conexión en editor y quiz. | La interfaz sigue operable; se distingue lo confirmado de lo pendiente y se puede reintentar. | Recorrido y revisión visual. |
| AC-31 | E1-11 | Primera entrada de docente y estudiante confirmados. | Invitación breve con pasos del rol correcto; sin controles de otro rol. | Recorrido. |
| AC-32 | E1-11 | Omitir o cerrar tutorial, cerrar sesión y volver; luego abrir Ayuda. | No reaparece solo; sigue disponible y no limita funciones. | Integración y recorrido. |
| AC-33 | E1-11 | Completar guía con teclado, lector de pantalla, movimiento reducido y pantalla móvil. | Sin trampas ni control tapado; foco restaurado al cerrar; lectura comprensible. | Revisión manual y recorrido. |
| AC-34 | E1-11 | Avanzar guía sin datos y solicitar ayuda durante intento. | No crea/publica ni consume intentos; ayuda estática durante participación, sin pausa del reloj. | Integración y recorrido. |
| AC-35 | E1-03 | Publicar recurso con título y explicación sin quiz. | Lectura publicada válida, sin crear actividad evaluada ni nota. | Recorrido e integración. |
| AC-36 | E1-04, D-04 | Cambiar valor, peso, intentos o visibilidad después del primer inicio. | Rechazo explícito; versión intacta. Ampliación autorizada de plazo sí sigue su regla. | Integración. |
| AC-37 | E1-08, E1-09, D-07 | Resultado exacto de 1/3 sobre 100; resultado final exacto 1,005. | 33,33 y 1,01 respectivamente; sin redondeo prematuro. | Pruebas de cálculo. |
| AC-38 | E1-09 | Estudiante no inicia quiz; docente registra cero con motivo y lo publica. | Sin cero automático antes; después cuenta el cero publicado, distinguido de un intento respondido. | Reglas e integración. |

Cada ejecución registrará caso, versión de código, entorno, datos ficticios, resultado observado y evidencia. Los informes de GitHub Actions solo se enlazarán después de existir una ejecución. Un recorrido automático satisfactorio no sustituye la comprobación manual de accesibilidad ni una evaluación de facilidad de uso con personas.
