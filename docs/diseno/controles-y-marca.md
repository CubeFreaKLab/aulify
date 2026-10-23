# Controles y marca

## Criterios de aceptación

- Todos los selectores de la aplicación abren listas con el mismo estilo de Aulify. Conservan valores, campos obligatorios, envío de formularios, navegación con flechas y cierre con Escape.
- Las casillas conservan su semántica y muestran verde con una marca negra al activarse.
- Las tarjetas de portada permanecen por debajo de la navegación. La barra lateral se contrae y expande con una transición breve, desactivable mediante movimiento reducido.
- Las herramientas flotantes del editor muestran iconos legibles y ejecutan formato y acciones de tabla; la selección usa verde suave en ambos temas.
- El cursor cambia suavemente entre lápiz e inserción de texto, también en acceso y registro. Se conserva la posición real del clic y el cursor nativo en dispositivos sin ratón.
- La ilustración de entrada al quiz pierde únicamente sus tres trazos de énfasis. Las imágenes de las preguntas ganan tamaño sin desbordar móvil.
- El QR conserva margen de lectura, módulos negros, localizadores verdes y símbolo central de Aulify. Debe decodificarse a la URL original después de incorporar la marca.

## Alcance de verificación

Verificar controles, edición, navegación y QR localmente; registrar por separado compilación, CI y vista previa. La nueva prueba de carga se omite por decisión del solicitante; esta omisión no acredita capacidad. Correo transaccional, Figma y materiales de presentación pertenecen a entregas posteriores.

## Implementación y evidencia

Los selectores usan React Aria con listas de opciones visibles y campos ocultos para FormData. Insertar bloque ejecuta la acción después de desmontar el menú y restaurar el foco, para continuar escribiendo en el documento. No se alteran los valores ni los contratos de comandos. La selección de celdas y las herramientas de BlockNote conservan sus acciones; el ajuste evita que los SVG se compriman a ancho cero.

El cursor de escritura parte de un PNG generado y un trazado vectorial limpio de tres paths. El símbolo del QR conserva la geometría del SVG de marca, también exportado a PNG para revisión. Se mantienen cuatro módulos de margen, corrección H y una inserción central pequeña. jsQR se incorpora solo como dependencia de desarrollo para comprobar la lectura del SVG renderizado a 240 px.

Comprobaciones locales: 232 pruebas unitarias; tipos, lint, formato y compilación. Recorridos afectados de escritorio/móvil: filtros y teclado/Escape; FormData; color de casillas; ocho tipos de preguntas; edición y recarga; menús con iconos y negrita persistente en ambos temas; publicación; cursor de acceso/registro; QR leído con dos longitudes de URL; navegación por encima del carrusel; reflujo hasta 320 px. Las repeticiones corrigieron pérdida de foco tras insertar, etiquetas de espacios y ancho de relaciones. Las acciones de fila y su selección verde se verificaron manualmente en Chrome; el ensayo automatizado de ese menú flotante no resultó estable y no se usa como evidencia de aprobación. La ampliación de columnas conserva su prueba de navegador existente.

No hay cambios de base de datos ni pruebas nuevas de carga o correo. La auditoría actual de dependencias informa cuatro avisos altos de una misma cadena: Zod transitivo a través de @vercel/functions → @vercel/oidc → @vercel/cli-config (GHSA-mrhx-c7xc-m3w5). La actualización mayor propuesta se debe revisar antes de producción; no se aplicó una actualización forzada en esta entrega visual. CI y Preview se registran por separado al publicar.
