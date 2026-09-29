# Principios de desarrollo de Aulify

**Estado: base de desarrollo 1.0.**

Este documento define los principios de diseño y desarrollo. El contexto general está en [producto y vocabulario](producto.md) y los requisitos en [specification.md](../specification.md).

## 1. Propósito y público

Facilitar la creación de recursos por bloques y la participación en quizzes interactivos en educación secundaria. Las materias, tareas, calificaciones y gráficos deben integrarse con ese recorrido.

## 2. Organización comprensible

El docente crea una materia y completa sus detalles de curso y año desde su configuración. Las materias de grupos distintos mantienen sus estudiantes y resultados separados y permiten reutilizar recursos.

La incorporación de un estudiante requiere una cuenta, un código de invitación y la aprobación del docente.

Las materias archivadas pueden restaurarse durante 30 días. Al vencer el plazo se eliminan la materia, sus notas y entregas; los recursos independientes de la biblioteca se conservan.

## 3. Control explícito de las actividades

El docente configura el propósito, valor, ritmo, tiempo, intentos, mezcla y mecánicas de juego. Las combinaciones disponibles deben presentar un comportamiento coherente y comprensible.

La configuración inicial muestra las opciones principales y agrupa los detalles en una sección avanzada desplegable. Un resumen permite comprobar las reglas antes de iniciar. Los potenciadores solo están disponibles cuando el docente los habilita: cada estudiante dispone de una pista y un doble para toda la actividad, sin recuperar los usos al repetir un intento.

Los recursos se guardan como borradores y se publican de forma explícita. Las modificaciones conservan la versión asociada a respuestas existentes.

La biblioteca personal permite crear quizzes independientes o incorporarlos a recursos. Su reutilización en otra materia genera una copia editable por separado.

## 4. Corrección acorde con la respuesta

Las respuestas escritas, incluidas palabras para completar espacios, y las tareas con archivos requieren corrección manual.

Las preguntas cerradas admiten corrección automática, con revisión manual configurable. La puntuación respeta el valor de cada pregunta y las reglas de corrección parcial definidas en la especificación.

## 5. Resultados comprensibles

El docente decide si las bonificaciones afectan la nota, sin superar el máximo de la actividad. Los promedios utilizan resultados normalizados y pesos configurables, con presentación sobre 100.

Las calificaciones pendientes se distinguen de un cero y se excluyen del promedio. La publicación de notas corresponde al docente; cada estudiante consulta las suyas. La clasificación es provisional mientras falta corrección y su visibilidad es configurable.

## 6. Incidencias y continuidad

Los controles contra trampas aportan reportes para revisión del docente dentro de la plataforma. Una señal detectada no produce una sanción automática. Los mecanismos documentan sus capacidades y límites.

Una desconexión permite retomar el mismo intento dentro del plazo configurado. Al vencer el tiempo, el intento se cierra conservando las respuestas guardadas. Los estados de guardado, envío y vencimiento deben ser comprensibles.

## 7. Usabilidad y accesibilidad

La creación, participación y revisión deben tener una buena experiencia en celular y computadora. Los gráficos se acompañan de tablas y los controles contemplan interacción táctil y con teclado.

El quiz mantiene una interacción continua. Cuando no se muestra la corrección, el avance individual pasa a la siguiente pregunta sin una pantalla de confirmación de guardado. En modo guiado, quien ya respondió pasa mediante una transición breve a una vista del progreso grupal hasta que el docente abra la siguiente pregunta. Los aciertos permanecen ocultos cuando así se configure.

Los criterios concretos están en la especificación y el plan de calidad; la [matriz de trazabilidad](calidad/trazabilidad.md) distingue las comprobaciones ejecutadas, su alcance y los pendientes. La conformidad se declarará únicamente con evidencia de verificación.

## 8. Desarrollo verificable

La documentación contiene requisitos, decisiones técnicas, pendientes y resultados comprobables del producto. Antes de implementar una función se precisan las reglas y criterios que permitan verificarla.

La selección de tecnologías y arquitectura se justifica frente a esos requisitos. No se establece una obligación de utilizar microservicios.

Las funcionalidades, verificaciones y limitaciones se describen según su estado real.

## 9. Ayuda inicial

Ofrecer ayuda breve por rol, opcional y reabrible. Omitirla no limita funciones. No consumir intentos, publicar datos o alterar plazos desde una guía. Mantener instrucciones y estados vacíos comprensibles.
