# Diseño editable en Figma

El [archivo de Aulify](https://www.figma.com/design/96LeZKgvvAvsYetQEbTrBC/Aulify) reúne la identidad visual, las bases del sistema de interfaz y las pantallas principales. Las composiciones se elaboraron a partir de la interfaz web implementada y se revisaron el 28 de septiembre de 2026. El tablero de marca existente se conservó.

## Pantallas

| Composición | Ancho | Nodo | Captura |
| --- | ---: | --- | --- |
| Landing clara | 892 px | `28:948` | [Ver](capturas/figma/landing-clara.png) |
| Landing oscura | 892 px | `28:258` | [Ver](capturas/figma/landing-oscura.png) |
| Acceso | 892 px | `46:2` | [Ver](capturas/figma/acceso.png) |
| Inicio docente | 892 px | `47:204` | [Ver](capturas/figma/inicio.png) |
| Materia | 892 px | `47:716` | [Ver](capturas/figma/materia.png) |
| Editor de recursos | 892 px | `57:582` | [Ver](capturas/figma/editor.png) |
| Participación | 892 px | `47:1546` | [Ver](capturas/figma/quiz.png) |
| Revisión de respuestas | 892 px | `47:1628` | [Ver](capturas/figma/revision.png) |
| Resultados | 892 px | `47:1958` | [Ver](capturas/figma/resultados.png) |
| Inicio docente móvil | 390 px | `48:2` | [Ver](capturas/figma/inicio-movil.png) |
| Participación móvil | 390 px | `48:128` | [Ver](capturas/figma/quiz-movil.png) |

La vista de escritorio corresponde a un ancho compacto de 892 px. Las pantallas móviles se obtuvieron con un área de contenido real de 390 px; tienen una composición propia, sin reducir a escala la de escritorio.

## Sistema de interfaz

Las páginas de fundamentos, botones, campos, opciones, respuestas y recursos separan las piezas reutilizables de las pantallas completas. Se incorporaron 38 variables primitivas, 21 colores semánticos con modos claro y oscuro, y 13 medidas de espaciado, radios y duración. Sus nombres y valores siguen los archivos de estilos del producto.

La tipografía es Inter, con pesos variables para reproducir títulos y controles. Los botones incluyen cuatro estilos y estados normal, foco y deshabilitado. Los campos contemplan foco, error y deshabilitado. Las respuestas del quiz tienen variantes de escritorio y móvil, además de estados normal, al pasar el puntero, seleccionado y foco. Los textos de las opciones se modifican mediante propiedades de instancia.

El logotipo, el cuaderno y la ilustración de acceso son componentes vectoriales. Las once pantallas no contienen rellenos de imagen rasterizada: texto, iconos, trazos y controles se mantienen como capas nativas. El detalle de nodos, cantidades y enlaces está en el [manifiesto](capturas/figma/manifest.json).

## Revisión y uso

Se compararon las exportaciones de Figma con las composiciones web, comprobando títulos, formularios, tablas, controles y distribución móvil. Se verificó la edición de una propiedad de respuesta y su restauración. Durante la revisión se detectó que las acciones del editor necesitaban pasar a otra fila en anchos intermedios; se corrigió la web y se actualizó la réplica.

Para modificar una pantalla, abre su página de Figma y selecciona el frame indicado. Las instancias de botón y de respuesta exponen propiedades de texto y estado. Los modos de la colección de colores permiten trabajar las variantes clara y oscura. Los frames conservan las dimensiones verificadas; para otros anchos se deben revisar los ajustes de auto layout y emplear las variantes móviles.

Las pantallas de plataforma muestran datos ficticios de la demostración. El archivo representa maquetas editables y componentes, no un prototipo navegable completo. Las animaciones, el guardado, la autenticación y los demás comportamientos se comprueban en la aplicación y en sus pruebas, no mediante estas imágenes estáticas.
