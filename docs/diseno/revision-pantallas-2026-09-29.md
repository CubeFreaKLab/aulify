# Revisión de pantallas de la plataforma

29 de septiembre de 2026. Alcance: inicio docente, materia, participación de estudiante, revisión y resultados. Se inspeccionaron los temas claro y oscuro en escritorio de 1440 px y en anchos móviles de 390 y 320 px, con datos ficticios de demostración. Esta unidad complementa la [revisión de biblioteca y editor](revision-biblioteca-editor-2026-09-29.md).

## Defectos observados y correcciones

| Pantalla | Observación | Comportamiento corregido |
|---|---|---|
| Quiz | A 320 px, «Salir» saltaba a una segunda fila debajo del logotipo; el progreso competía con ambos controles. | El logotipo y la salida comparten la primera fila. El progreso ocupa una fila completa y los sonidos, cuando están habilitados, conservan su espacio. |
| Pregunta de relaciones | Los selectores medían 110 px a 320 px y recortaban «Elegir relación» y las respuestas. | Cada selector ocupa una fila completa debajo del término. «Descomponedor» se ve completo. Las relaciones y la corrección mantienen sus reglas. |
| Pregunta de orden | El texto y las flechas compartían una fila con controles pequeños. | Las flechas tienen un área de 44 × 44 px en móvil y el texto puede ajustarse sin desplazar los controles. |
| Materia | A 320 px, el título, icono y acción se comprimían en una sola fila; «Ver actividad» quedaba partido. El bloque siguiente aparecía pegado al listado. | La acción ocupa su propia fila en anchos menores de 380 px y se añade separación entre recursos y actividades de clase. |
| Resultados | Los filtros se estrechaban en dos columnas y recortaban opciones y fechas en móvil. | El ancho mínimo permite que pasen a una columna cuando no caben completos. Se comprobaron 320 y 390 px. |
| Calificaciones | Las columnas de nota y detalle quedaban fuera del primer tramo de la tabla sin una señal visual de desplazamiento. | Un texto móvil indica cómo desplazarse, incluida la alternativa con flechas del teclado. La primera columna permanece visible al recorrer la tabla. |

El inicio conserva su ilustración completa y la revisión mantiene sus campos y estados sin cortes en los anchos inspeccionados. No se sustituyeron el logotipo, Inter ni las ilustraciones. Los cambios se limitan a distribución, tamaño de controles y una ayuda visible; no alteran puntuaciones, permisos, plazos ni publicación de notas.

## Evidencia visual

Las [32 capturas y su manifiesto](capturas/pantallas-2026-09-29/manifest.json) proceden del servidor local de desarrollo Next.js con webpack en el puerto 3002. No son capturas de producción ni acreditan un despliegue. Cada entrada identifica ruta, ancho y tema.

| Pantalla | Escritorio | Móvil 390 px | Móvil 320 px |
|---|---|---|---|
| Inicio | [Claro](capturas/pantallas-2026-09-29/inicio-escritorio-light.png) · [Oscuro](capturas/pantallas-2026-09-29/inicio-escritorio-dark.png) | [Claro](capturas/pantallas-2026-09-29/inicio-movil390-light.png) · [Oscuro](capturas/pantallas-2026-09-29/inicio-movil390-dark.png) | [Claro](capturas/pantallas-2026-09-29/inicio-movil320-light.png) · [Oscuro](capturas/pantallas-2026-09-29/inicio-movil320-dark.png) |
| Materia | [Claro](capturas/pantallas-2026-09-29/materia-escritorio-light.png) · [Oscuro](capturas/pantallas-2026-09-29/materia-escritorio-dark.png) | [Claro](capturas/pantallas-2026-09-29/materia-movil390-light.png) · [Oscuro](capturas/pantallas-2026-09-29/materia-movil390-dark.png) | [Claro](capturas/pantallas-2026-09-29/materia-movil320-light.png) · [Oscuro](capturas/pantallas-2026-09-29/materia-movil320-dark.png) |
| Quiz | [Claro](capturas/pantallas-2026-09-29/quiz-escritorio-light.png) · [Oscuro](capturas/pantallas-2026-09-29/quiz-escritorio-dark.png) | [Claro](capturas/pantallas-2026-09-29/quiz-movil390-light.png) · [Oscuro](capturas/pantallas-2026-09-29/quiz-movil390-dark.png) | [Claro](capturas/pantallas-2026-09-29/quiz-movil320-light.png) · [Oscuro](capturas/pantallas-2026-09-29/quiz-movil320-dark.png) |
| Revisión | [Claro](capturas/pantallas-2026-09-29/revision-escritorio-light.png) · [Oscuro](capturas/pantallas-2026-09-29/revision-escritorio-dark.png) | [Claro](capturas/pantallas-2026-09-29/revision-movil390-light.png) · [Oscuro](capturas/pantallas-2026-09-29/revision-movil390-dark.png) | [Claro](capturas/pantallas-2026-09-29/revision-movil320-light.png) · [Oscuro](capturas/pantallas-2026-09-29/revision-movil320-dark.png) |
| Resultados | [Claro](capturas/pantallas-2026-09-29/resultados-escritorio-light.png) · [Oscuro](capturas/pantallas-2026-09-29/resultados-escritorio-dark.png) | [Claro](capturas/pantallas-2026-09-29/resultados-movil390-light.png) · [Oscuro](capturas/pantallas-2026-09-29/resultados-movil390-dark.png) | [Claro](capturas/pantallas-2026-09-29/resultados-movil320-light.png) · [Oscuro](capturas/pantallas-2026-09-29/resultados-movil320-dark.png) |

La pregunta de relaciones también se conserva a 320 px en [claro](capturas/pantallas-2026-09-29/quiz-relaciones-movil320-light.png) y [oscuro](capturas/pantallas-2026-09-29/quiz-relaciones-movil320-dark.png). Las capturas de resultados contienen una nota ficticia de 95, publicada mediante la interfaz local después de corregir dos respuestas, para mostrar barras con datos y distinguirlas de participaciones sin nota.

En las 32 capturas, el ancho del documento coincide con el ancho de la ventana. El manifiesto registra elementos de las tablas que quedan fuera del tramo visible de su región desplazable; esto no equivale a desbordamiento horizontal de la página.

## Comprobaciones

- `tests/e2e/pantallas.spec.ts`: seis casos aprobados en Chromium, escritorio y móvil. Cubren el inicio, la acción de materia a 320 px, revisión, filtros, desplazamiento por teclado de la tabla conservando la primera columna, cabecera del quiz y selección de relaciones. Los dos casos móviles de pantallas se repitieron después del ajuste final de filtros; las repeticiones no incrementan el número de casos.
- Análisis axe de resultados en ambos temas y tres anchos: sin violaciones detectadas en el alcance automatizado del contenido principal.
- TypeScript y ESLint de los archivos modificados: correctos. Formato y comprobación del diff: correctos.
- Inspección visual de las capturas de la revisión, con atención a proporción de ilustraciones, reflujo, legibilidad de controles y estados de ambos temas.

Estas comprobaciones no acreditan aceptación estética, evaluación con personas ni conformidad completa con WCAG. Los tamaños móviles se verificaron mediante emulación de Chromium; no se declara una prueba física de teclado virtual o dispositivo táctil. La construcción y verificación integrada de esta unidad quedan separadas de estos resultados de desarrollo.

## Verificación integrada

La construcción de producción `NM4iMNbRDIkrz8dBQyrB4` terminó correctamente. Sobre ese compilado local se repitieron los seis casos de `pantallas.spec.ts`, con seis aprobados en 9,3 segundos. Esta repetición confirma el comportamiento fuera del servidor de desarrollo y no aumenta el número de casos distintos ni acredita un despliegue remoto.
