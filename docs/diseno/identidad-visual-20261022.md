# Identidad visual y pantallas

22 de octubre de 2026. La presentación y la plataforma comparten Inter, el logotipo original y personajes de contorno negro, blanco opaco y verde hoja. El espacio de trabajo conserva los campos, permisos y reglas de las actividades.

## Color y composición

| Elemento | Decisión aplicada |
|---|---|
| Acento | `#85BD6E`, medido en la referencia de personajes. Se reserva a dibujos y detalles. |
| Lectura | Papel `#F7F7F2`, superficie blanca y tinta `#20231F`. El verde de texto y foco es `#385B2D`. |
| Tema oscuro | Fondo `#171717`, superficie `#222222` y texto `#F2F3F1`. Sin fondos verdes oscuros. |
| Presentación | Marca grande con tres personajes independientes, secuencia preparar/participar/revisar, muestra real del editor y pregunta de demostración. |
| Plataforma | Navegación persistente, materias compactas, listas y cabeceras con ilustración contextual. |
| Editor | Hoja por bloques con preguntas desplegables; conserva guardado, vista previa y publicación explícita. |
| Revisión | Índice de preguntas, apertura de la primera pendiente y conservación de lo escrito al cambiar de pregunta. La nota se publica de forma explícita. |
| Quiz | Una pregunta protagonista y opciones amplias. El personaje acompaña sin reemplazar instrucciones ni ocupar las respuestas. |

El [perfil de diseño](design-dna.json) reúne tokens, estilo y movimiento. Es una definición del producto; los conceptos visuales no agregan por sí mismos campos o funciones al sistema.

## Biblioteca de ilustraciones

Hay **34 SVG con rutas vectoriales** en [public/illustrations/aulify](../../public/illustrations/aulify): diecisiete escenas, nueve avatares y ocho objetos. Ninguno contiene una imagen raster incrustada. El [catálogo](../../public/illustrations/aulify/manifest.json) identifica los archivos y sus colores. Las variantes PNG de entrega tienen alfa y un lado largo de 2048 px; los originales y la conversión VTracer quedan conservados en la entrega local de diseño.

| Grupo | Nombres y usos |
|---|---|
| Presentación | `hero-boy-notebook`, `hero-girl-laptop`, `hero-boy-pencil`, `friends-high-five` |
| Acceso y cuentas | `student-reader`, `classroom-team`, `student-recovery`, `student-password` |
| Aula | `teacher-welcome`, `student-welcome`, `science-teacher`, `student-nature` |
| Interacción y progreso | `student-thinking`, `teacher-laptop`, `student-phone`, `student-progress`, `ecosystem` |
| Avatares | Nueve alternativas `avatar-*`, disponibles en el catálogo; no sustituyen automáticamente la identidad de una persona. |
| Objetos | `object-notebook`, `object-pencil`, `object-book`, `object-books`, `object-laptop`, `object-phone`, `object-plant`, `object-worksheets` |

El componente `BrandArt` conserva la proporción y permite marcar cada dibujo como decorativo mediante texto alternativo vacío. En oscuro, un contorno claro muy fino mantiene visibles las siluetas negras. Las fotografías, capturas del editor y dibujos no se usan como botones o campos.

## Movimiento

La landing separa tres planos con CSS scroll timelines, revela ilustraciones al entrar y completa el cierre con una aparición breve. No hay scroll secuestrado ni animaciones perpetuas. IntersectionObserver se desconecta al salir de la página.

La plataforma utiliza desplazamientos cortos al entrar a un detalle y un cambio suave entre destinos principales, inspirados en los [patrones de transición de Material 3](https://m3.material.io/styles/motion/transitions/transition-patterns). El botón de tema conserva el icono sol/luna y la transición circular. La composición sigue completa con movimiento reducido o sin soporte para los efectos.

## Comprobación

Se guardaron treinta y cuatro capturas comparables con las pantallas anteriores y otras vistas de móvil y oscuro. La [comprobación de interfaz](verificacion-redisenio-20261022.json) registra imágenes, contraste automático en las vistas indicadas, reflujo a 320 y 390 px, editor, revisión, quiz y movimiento. También se ejecutaron TypeScript, lint de los componentes modificados y la construcción de producción.

El alcance es local, con datos ficticios. No se realizaron nuevas pruebas de carga ni cambios en Supabase. La revisión automática no certifica WCAG completa ni sustituye una evaluación con personas. Las capturas y resultados no acreditan un despliegue público.

El cierre añadió catorce ejecuciones de los recorridos existentes en Chromium de escritorio y móvil, sobre el compilado `8J-SBxhayYcq5U_ABQsb0`: presentación y acceso, contraste con movimiento reducido, preguntas escritas, publicación, participación, corrección y sesión guiada entre dos pestañas. Todas pasaron. Las pruebas abren ahora el panel de preguntas como lo hace una persona y comprueban las imágenes diferidas al recorrer la página; no se retiraron las verificaciones de contenido ni se amplió la batería de carga.
