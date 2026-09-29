# Revisión del editor y apariencia

29 de septiembre de 2026 · RF-03, RF-13, RNF-01 y RNF-02.

## Problemas y cambios

La pantalla de edición anteponía un encabezado promocional, un panel de consejos y varias franjas de herramientas al contenido. En celular esto alejaba la explicación de la primera pantalla. Se retiró el panel, se compactaron las acciones y se alinearon título, contenido y preguntas. Deshacer, rehacer, inserción, formato contextual y orden por botones siguen disponibles. La ayuda se puede desplegar sin ocupar permanentemente el documento.

El tema oscuro tenía superficies teñidas de verde y los menús de la biblioteca del editor mantenían colores propios. Ahora comparten superficies grafito y colores de texto; el verde se usa para acentos. Las imágenes mantienen sus proporciones. El cuaderno de portada se salía del ancho móvil: el contenedor lo ocultaba aunque la página no mostrase desplazamiento horizontal. Se redujo y centró la composición contemplando la rotación.

## Comprobaciones locales

- TypeScript sin errores y análisis estático de los componentes modificados.
- `editor-bloques.spec.ts` y `appearance.spec.ts`: 14 ejecuciones aprobadas, siete escenarios en escritorio y móvil. Incluyen búsqueda de bloques, formato, pegado, tablas, listas, deshacer, recuperación tras recarga, imágenes, preguntas escritas, lector, tema persistente, contraste automatizado y movimiento reducido.
- Menús visibles en ambos temas, dentro del ancho de 1440 y 390 px. Capturas reales en [la carpeta de esta revisión](capturas/revision-2026-09-29/). Se conservan medidas de posición y color del menú en `editor-mediciones.json`.
- Portada inspeccionada a 1440, 390 y 320 px, en claro y oscuro. Cuaderno dentro del ancho en 18 posiciones medidas (inicio y desplazamientos de 250 y 500 px). Sin incidencias de contraste en el análisis automatizado de esas seis combinaciones.

Las primeras comprobaciones se hicieron con webpack en desarrollo. El servidor Turbopack de esa sesión devolvía 404 en las rutas interiores; no se atribuyó ese resultado a las funciones de edición. Después se construyó producción correctamente (`9W6ImkUKBiaC_HkNQmGk3`) y se repitieron los mismos 14 casos: todos aprobados en 26,4 s. Las capturas del editor corresponden a ese compilado; las de portada e inicio proceden de la inspección en desarrollo con el mismo CSS. No se suman las repeticiones como escenarios nuevos. El resultado remoto de CI sigue pendiente.

Se incorporó `interactive-widget=resizes-content` al viewport, conforme a la advertencia del editor, conservando el zoom. Se comprobó la etiqueta generada y una pantalla de 320 px: ancho de documento 320 px y menú entre x=24 y x=320, sin desbordamiento. El efecto del teclado virtual todavía requiere una comprobación física en los navegadores que soportan esta opción.

## Límites

Estas comprobaciones no equivalen a una evaluación con usuarios ni a conformidad completa con WCAG. No se probó arrastrar bloques físicamente en un teléfono: los recorridos automatizados cubren la alternativa por botones. La comparación con el editor de la versión anterior sigue pendiente de localizar su referencia exacta. La biblioteca, navegación móvil, lector y demás pantallas siguen en revisión; el diseño completo no está cerrado. Figma y las capturas de los documentos aún no reflejan esta revisión.
