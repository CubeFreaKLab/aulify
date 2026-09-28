# Editor de recursos y preguntas

La edición conserva un documento estructurado para mostrar la misma jerarquía, formato y orden al leer. La representación semántica adicional sirve para validación y búsqueda; no sustituye al documento enriquecido.

## Comportamiento implementado

- Menú `/` con búsqueda en español; barra de inserción y formato de selección de BlockNote 0.55.0.
- Encabezados de cuatro niveles, párrafos, listas con viñetas y numeradas, casillas, desplegables, citas, tablas, código, imágenes, enlaces de video y acceso a las preguntas.
- Mover, duplicar o eliminar bloques con botones, incluida la estructura anidada. Duplicar renueva los identificadores. Deshacer y rehacer separan los comandos de organización para recuperar una eliminación individual.
- Pegado de texto y HTML con formato. El código de un bloque se muestra como texto; no se ejecuta.
- Imágenes PNG/JPEG/WebP con descripción alternativa obligatoria y pie opcional. Los enlaces HTTPS se comprueban antes de insertarse y se informa del contacto con el sitio externo. El lector muestra un estado de error si una imagen deja de cargar.
- En `/demo`, las imágenes se guardan localmente como datos del navegador (máximo 3 MiB por archivo). En `/aula`, el editor usa el servicio autenticado de archivos (máximo 5 MiB), conservando el identificador del archivo. Esta verificación de interfaz no sustituye las pruebas del servicio de almacenamiento.
- Ocho tipos de preguntas, opciones editables, orden de secuencias y parejas ajustables, varios espacios en una frase y grupos para preguntas dependientes. Los espacios muestran nombres legibles; su identidad interna es UUID.
- Guía privada de corrección para las respuestas escritas; explicación al estudiante separada. Las soluciones y guías se mantienen fuera de `editorDocument`.
- El lector presenta listas agrupadas, tablas con encabezados, desplegables mediante teclado, casillas, código y texto con formato. No convierte enlaces con esquemas ejecutables en enlaces activos.
- Los campos para completar aparecen dentro de la frase con numeración y etiquetas accesibles; no se exponen identificadores internos en el texto visible.

## Verificación local

Verificado el 28 de septiembre de 2026 sobre el servidor de desarrollo en localhost:3002:

| Comprobación | Resultado |
| --- | --- |
| `tests/unit/rich-document.test.ts` | 4 pruebas aprobadas |
| `tests/e2e/editor-bloques.spec.ts` | 8 recorridos aprobados; escritorio y móvil |
| Recorrido existente «ocho tipos» de `participacion.spec.ts` | 2 pruebas aprobadas tras integrar campos en la frase |
| TypeScript | Sin errores |
| ESLint del alcance modificado | Sin errores |
| axe: editor con bloques en tema oscuro y movimiento reducido | Sin infracciones detectadas por las reglas usadas |
| axe: lector enriquecido y editor con imagen | Sin infracciones detectadas por las reglas usadas |

Se comprobó inserción por menú, texto en negrita, pegado HTML, tabla, casilla, desplegable y código; organización por teclado, duplicado, eliminación, deshacer/rehacer, persistencia y recarga. La prueba de preguntas verificó dos espacios con UUID, guía privada obligatoria, grupo compartido y cambio de orden. Las imágenes locales no enviaron solicitudes a `/api/files` desde la demostración.

Se corrigieron durante la comprobación el nombre accesible del desplegable, la etiqueta y tamaño de la casilla y el contraste de las citas en modo oscuro. Los chequeos automáticos no constituyen una certificación completa de accesibilidad ni una evaluación con usuarios.

Las pruebas del editor desactivan las APIs nativas de captura y bloqueo del puntero como protección del entorno Windows sin interfaz. Verifican botones, teclado y desplazamiento; no acreditan arrastrar bloques con el ratón. Las capturas provienen de recorridos de demostración y no representan cuentas o clases reales.

## Evidencias y alcance

Las cuatro capturas de `capturas/editor/` corresponden al editor en escritorio y móvil. El contenido fue creado durante los recorridos de prueba; la tabla vacía es una comprobación de inserción, no un recurso listo para publicar. La imagen oscura se toma después de una recarga con navegación por teclado, por lo que conserva el indicador de foco.

La edición colaborativa simultánea, la ejecución de código y la carga de archivos de video no forman parte de este editor. Los videos se comparten como enlaces HTTPS. La validación integral del almacenamiento real, la publicación y el aislamiento entre cuentas se documenta junto al servicio de datos.

Fuentes técnicas: [BlockNote: menús de sugerencias](https://www.blocknotejs.org/docs/react/components/suggestion-menus), [BlockNote: bloques personalizados](https://www.blocknotejs.org/docs/features/custom-schemas/custom-blocks), [ProseMirror: historial](https://prosemirror.net/docs/ref/#history.closeHistory). Las firmas utilizadas se contrastaron con las declaraciones de las versiones instaladas.
