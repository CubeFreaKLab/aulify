# Dirección visual de Aulify

Estado: propuesta implementada en el prototipo 0.1.0, 27 de septiembre de 2026. Las comprobaciones técnicas y la aprobación visual se registran por separado.

## Dos experiencias, una identidad

La portada presenta un aula que cobra vida. La plataforma facilita preparar, compartir y responder recursos en secundaria. Comparten logotipo, Inter, verde y contornos ilustrados; su composición y su movimiento se adaptan a cada tarea.

Inter es la única familia de interfaz. El logotipo conserva sus trazos originales. Títulos de presentación en 800–900; títulos de trabajo en 700; controles en 600; lectura en 400–500. La jerarquía se apoya en tamaño, espacios y peso, sin mezclar fuentes.

Paleta de origen: verde #049A4E, menta #B8FAC6, papel #FAFAF8, gris claro #ECECE7, gris oscuro #60615A y tinta #0F0F0F. Los colores semánticos de error y advertencia se acompañan de texto. Blanco sobre el verde original no alcanza el contraste de texto pequeño; las acciones principales usan tinta y papel o menta y tinta.

## Composición elegida

Se compararon dos bocetos de apertura y sus conceptos visuales:

```
A · Escritorio que cobra vida
marca                         producto / explorar / entrar
            UNA CLASE. MUCHAS FORMAS
                 DE PARTICIPAR.
            explicación breve / explorar clase
       hoja ↘     cuaderno abierto     ↙ lápiz
                  recurso de clase

B · Cuaderno abierto
marca                         producto / explorar / entrar
Tu próxima clase,        | escena ilustrada
en movimiento.           | hojas y preguntas en planos
explicación y acciones   | cuaderno en primer plano
```

Se eligió A por ofrecer una escena central reconocible y una transición natural hacia una clase de ejemplo. B conserva una lectura clara pero se aproxima más a una composición habitual de texto e imagen. Los conceptos se inspeccionaron antes de integrar el cuaderno ilustrado y las capas independientes de la portada. La aprobación visual del producto sigue abierta.

El recorrido de la portada contiene escenas distintas: promesa comprensible; materiales que se ordenan; explicación y pregunta que se pueden explorar; vista del trabajo docente; cierre con entrada a la demostración. El momento principal es la transformación del cuaderno en un recurso interactivo. Las ilustraciones se mueven en planos independientes y dejan libre el texto. La página conserva desplazamiento normal y accesos directos.

La emoción cambia de curiosidad a comprensión, participación y confianza. El punto de mayor expresión es el armado de la clase; el editor y los resultados que siguen reducen la intensidad para mostrar claridad. La escena estática debe seguir contando esa transformación. En móvil el título, las acciones y la escena se recomponen verticalmente.

Referencias de presentación: [Leonardo](https://leonardo.ai/) y [Mind Robotics](https://www.mindrobotics.com/). Se toman como referencias de jerarquía y presencia visual, conservando recursos y composiciones propios.

## Plataforma

Barra lateral de destinos, encabezado con contexto y un área principal amplia. El docente ve acciones y trabajo pendiente; el estudiante ve su siguiente actividad. El editor usa una hoja central, herramientas junto al bloque activo y propiedades en un panel cuando hacen falta. La configuración muestra primero decisiones esenciales y despliega las avanzadas.

El quiz utiliza una pregunta protagonista, alternativas amplias y progreso discreto. Sus transiciones mantienen continuidad. Los colores, sonidos y puntuaciones respetan la visibilidad del resultado configurada. Las respuestas escritas pasan a revisión manual. Los gráficos tienen tablas equivalentes.

## Movimiento

Se aplica [Material Design 3: patrones de transición](https://m3.material.io/styles/motion/transitions/transition-patterns): transformación de contenedor para vista previa; avance/retroceso para detalle; lateral para pestañas; fundido para destinos principales; entrada/salida para paneles; skeleton solo durante carga real. Los tokens de duración y curvas se centralizan en CSS.

Las animaciones admiten interrupción, mantienen el foco comprensible y respetan movimiento reducido. Las escenas decorativas no bloquean acciones. El usuario no espera a una animación para leer una pregunta. Se verifican apertura, punto intermedio y salida de la escena, además del móvil.

## Assets y evidencia

Los SVG originales de marca se conservan. Se generaron dos conceptos de composición y un cuaderno ilustrado con transparencia; las pantallas del producto se construyeron con componentes reales. Los conceptos raster no se presentan como capturas de una aplicación ejecutada. La [evidencia visual del prototipo](capturas/README.md) identifica versión y entorno.
