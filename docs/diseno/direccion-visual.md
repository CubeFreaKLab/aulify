# Dirección visual de Aulify

Estado: refinamiento 1.1, 28 de septiembre de 2026. Las comprobaciones técnicas y la evaluación visual se registran por separado.

## Dos experiencias, una identidad

La portada presenta un aula que cobra vida. La plataforma facilita preparar, compartir y responder recursos en secundaria. Comparten logotipo, Inter, verde y contornos ilustrados; su composición y su movimiento se adaptan a cada tarea.

Inter es la única familia de interfaz. El logotipo conserva sus trazos originales. Títulos de presentación en 800–900; títulos de trabajo en 700; controles en 600; lectura en 400–500. La jerarquía se apoya en tamaño, espacios y peso, sin mezclar fuentes.

Paleta de origen: verde #049A4E, menta #B8FAC6, papel #FAFAF8, gris claro #ECECE7, gris oscuro #60615A y tinta #0F0F0F. Los colores semánticos de error y advertencia se acompañan de texto. Blanco sobre el verde original no alcanza el contraste de texto pequeño; las acciones principales usan tinta y papel o menta y tinta.

## Composición elegida

La apertura enfrenta una frase breve y dos acciones con una escena de materiales escolares. El cuaderno conserva el dibujo de partida; las hojas y el lápiz forman planos independientes. Los márgenes, tamaños y desplazamientos se recomponen en móvil, manteniendo el título y las acciones antes de la ilustración.

```
marca                   idea / probar / apariencia / acceso
Que tu clase       |   hoja de pregunta      hoja de ciencias
tome parte.        |         cuaderno abierto
explicación        |                  lápiz en primer plano
explorar / probar  |
```

La primera composición central de tres líneas se sustituyó por esta apertura lateral. Se retiraron etiquetas promocionales repetidas, indicaciones decorativas de desplazamiento y textos que no ayudaban a reconocer una acción. Se conserva la información útil: materia, consigna, cantidad de preguntas y condición de demostración.

El recorrido pasa de reconocer materiales de una clase a leer una explicación, responder una pregunta, probar la creación y explorar el espacio de cada rol. El momento principal es participar realmente en el ejemplo: elegir una respuesta produce una devolución y permite continuar. La prueba del editor admite cambiar el título, escribir una explicación y añadir o quitar una pregunta; explica que los cambios no se guardan ni publican.

La emoción buscada cambia de curiosidad a comprensión, participación y confianza. La apertura aporta la expresión visual; el interior mantiene controles orientados a preparar, responder y revisar. El desplazamiento es natural, sin inmovilizar el documento ni pedir esperas para acceder al contenido.

Referencias de presentación: [Leonardo](https://leonardo.ai/) y [Mind Robotics](https://www.mindrobotics.com/). Aportan referencias de jerarquía y presencia visual; la composición y los recursos pertenecen a Aulify.

## Plataforma

Barra lateral de destinos, encabezado con contexto y un área principal amplia. El docente ve acciones y trabajo pendiente; el estudiante ve su siguiente actividad. El editor usa una hoja central, herramientas junto al bloque activo y propiedades en un panel cuando hacen falta. La configuración muestra primero decisiones esenciales y despliega las avanzadas.

El quiz utiliza una pregunta protagonista, alternativas amplias y progreso discreto. Sus transiciones mantienen continuidad. Los colores, sonidos y puntuaciones respetan la visibilidad del resultado configurada. Las respuestas escritas pasan a revisión manual. Los gráficos tienen tablas equivalentes.

## Movimiento

Se aplica [Material Design 3: patrones de transición](https://m3.material.io/styles/motion/transitions/transition-patterns): transformación de contenedor para vista previa; avance/retroceso para detalle; lateral para pestañas; fundido para destinos principales; entrada/salida para paneles; skeleton solo durante carga real. Los tokens de duración y curvas se centralizan en CSS.

Las animaciones admiten interrupción, mantienen el foco comprensible y respetan movimiento reducido. Las escenas decorativas no bloquean acciones. El usuario no espera a una animación para leer una pregunta. Se verifican apertura, punto intermedio y salida de la escena, además del móvil.

## Assets y evidencia

Los SVG originales de marca se conservan. Se generaron dos conceptos de composición y un cuaderno ilustrado con transparencia; las pantallas del producto se construyeron con componentes reales. Los conceptos raster no se presentan como capturas de una aplicación ejecutada. La [evidencia visual del prototipo](capturas/README.md) identifica versión y entorno.

## Apariencia y verificación del refinamiento

Claro, oscuro y sistema comparten la misma jerarquía. La preferencia se conserva por navegador y se sincroniza entre pestañas; un script temprano aplica el fondo antes de presentar el contenido. El cambio utiliza una transición breve, con alternativa inmediata al pedir movimiento reducido. Los colores de acción y sus textos se separan de los colores de marca para mantener contraste.

La [verificación visual 1.1](verificacion-visual-1.1.md) registra los recorridos y límites de esta revisión. Las [capturas del refinamiento](capturas/refinamiento/README.md) sustituyen la evidencia inválida de la primera portada.
