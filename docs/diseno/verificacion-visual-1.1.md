# Verificación del refinamiento visual 1.1

28 de septiembre de 2026. Entorno local de desarrollo con Chromium, sobre la aplicación en construcción. No acredita todavía el despliegue ni las funciones integradas de servidor.

## Cambios comprobados

- Portada con apertura lateral, título breve y materiales escolares conservados. Eliminación de etiquetas decorativas redundantes.
- Cuaderno SVG de 427 trazados y 253.413 bytes, sin elementos `image` ni raster incrustado. PNG original preservado. Conversión reproducible mediante `tools/diseno/vectorizar-cuaderno.py` y VTracer 0.6.12; no es un redibujo manual ni promete una separación semántica de cada objeto.
- Planos del cuaderno, hojas y lápiz animados con líneas de tiempo CSS. Desplazamiento menor en móvil y alternativa estática con movimiento reducido o sin soporte.
- Ejemplo público de preguntas y pequeño editor operables. La edición de prueba no publica ni guarda contenido.
- Tema claro, oscuro y del sistema, persistido en el navegador y sincronizado entre pestañas. Colores semánticos para superficies, textos, selección, error y foco.
- Opciones del quiz con mayor contraste de forma, relieve moderado y estado presionado; las señales de corrección siguen dependiendo de las reglas funcionales.

## Comprobaciones ejecutadas

`tests/e2e/appearance.spec.ts` contiene tres casos, ejecutados en escritorio (1440 × 900) y móvil (390 × 844): **6 ejecuciones aprobadas**.

| Caso | Resultado observado |
|---|---|
| Apariencia por teclado, recarga, otra pestaña y sistema | Elección mediante Enter; preferencia conservada; otra pestaña actualizada; cambios del sistema aplicados solo al elegir Sistema. |
| Portada operable y movimiento reducido | Ilustraciones cargadas; sin desborde horizontal; planos sin animaciones; título editable y pregunta añadida/quitada; respuesta con devolución. |
| Contraste del espacio docente y participación en oscuro | Axe sin infracciones en los estados iniciales de ambos recorridos, en los dos tamaños. |

Se capturó la portada en apertura, posición intermedia, salida y página completa con tamaños 1440 × 900, 390 × 844 y 360 × 640, incluyendo oscuro y movimiento reducido. Se inspeccionaron las imágenes: título, acciones, materias ilustradas y controles permanecen legibles. El manifiesto identifica el navegador, entorno, dimensiones y huellas de cada archivo.

Un barrido adicional de diez rutas en oscuro no encontró infracciones axe WCAG A/AA: inicio, materias, biblioteca, revisión, resultados, tareas, preferencias, ayuda, acceso y registro. La revisión visual comprobó también la variante del logo, los fondos de tabla y los estados seleccionados. No se encontraron imágenes rotas, errores de ejecución ni desbordes horizontales en las capturas de la portada.

Se corrigieron dos problemas detectados durante la revisión: texto atenuado por una animación inicial y una hoja móvil que se acercaba demasiado a las acciones. El texto conserva opacidad completa y las capas móviles tienen recorridos acotados.

Análisis estático de los componentes modificados y comprobación TypeScript sin errores al cerrar esta unidad.

## Límites

Las capturas son del entorno de desarrollo. Deben renovarse sobre la compilación y el despliegue finales para la documentación de la entrega. El análisis automático complementa la inspección; no demuestra conformidad completa ni una evaluación con usuarios. No se midieron aquí Core Web Vitals en producción.

## Fuentes técnicas

- [MDN: líneas de tiempo de animación CSS](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/animation-timeline).
- [MDN: transición entre estados de la vista](https://developer.mozilla.org/en-US/docs/Web/API/Document/startViewTransition).
- [Patrones de transición de Material Design 3](https://m3.material.io/styles/motion/transitions/transition-patterns).
