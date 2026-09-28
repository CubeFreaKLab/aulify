# Recursos visuales y componentes

La interfaz conserva la marca Aulify y diferencia dos contextos: la portada presenta una experiencia; la plataforma permite preparar, participar y revisar con claridad. La [dirección visual](direccion-visual.md) explica esa decisión y el [inventario de pantallas](pantallas-y-estados.md) delimita las funciones del prototipo.

## Tipografía y tokens

Inter es la única familia de interfaz. Se carga localmente mediante `@fontsource-variable/inter`; el archivo de dependencias y su lockfile fijan la versión. El logotipo conserva sus trazos y no se recompone con una fuente aproximada.

Los valores compartidos están en [tokens.css](../../src/styles/tokens.css).

| Uso | Token o valor |
|---|---|
| Familia | `Inter Variable`, `Inter`, fuentes de sistema como respaldo. |
| Títulos de presentación | Pesos 800–900; la implementación utiliza pesos variables para ajustar cada jerarquía. |
| Títulos de trabajo y controles | Pesos aproximadamente 600–750. |
| Lectura | Pesos 400–500. |
| Verde de marca | `--green: #049A4E`. |
| Menta | `--mint: #B8FAC6`. |
| Papel | `--paper: #FAFAF8`. |
| Tinta | `--ink: #0F0F0F`. |
| Superficie secundaria y texto atenuado | `--surface-muted: #ECECE7`; `--muted: #60615A`. |
| Verde para texto y superficie suave | `--green-text: #086D3C`; `--mint-soft: #EAF8ED`. |
| Error | `--danger: #A42B20`; superficie `#FFF0ED`. |
| Advertencia | `--amber: #785112`; superficie `#FFF5DA`. |
| Foco | `--focus: #08753C`; contorno visible y separado del control. |
| Radios base | Botones 10 px; tarjetas 16 px. |
| Escala de espacios | 4, 8, 12, 16, 24, 32, 48 y 64 px. |
| Movimiento | 150, 250 y 350 ms; curvas estándar, entrada y salida centralizadas. |

Las acciones principales usan tinta y papel, o menta y tinta. El verde de marca no se toma automáticamente como fondo válido para texto blanco pequeño. Los errores y estados incorporan texto, además del color. Gráficos y notas usan valores escritos; los números se alinean con cifras tabulares donde corresponde.

## Componentes que existen en la aplicación

| Componente o módulo | Responsabilidad | Consideración de uso |
|---|---|---|
| `Button` | Envuelve `Button` de React Aria Components y aplica variantes visuales. | Mantiene estados de interacción; los controles solo con icono necesitan nombre accesible. |
| `DialogPanel` | Modal, diálogo, encabezado y cierre con React Aria Components. | Apertura y cierre claros; el foco y la navegación por teclado se verifican en cada flujo. |
| `Field` | Etiqueta, pista y mensaje de error para controles de formulario. | El control debe enlazar los identificadores de pista o error mediante `aria-describedby` cuando corresponda. |
| `Badge` | Estado breve: pendiente, publicado, borrador o contexto. | Su texto transmite el estado sin depender del color. |
| `PageHeading` | Título, descripción y acciones de la pantalla. | Evita repetir una cabecera promocional dentro de las tareas de trabajo. |
| `EmptyState` | Explica una lista vacía, un recurso ausente o un destino no disponible. | Debe ofrecer orientación acorde con la causa. |
| `AuthScreen` | Acceso, registro y recuperación con validación local. | Comunica la condición de demostración; no persiste contraseñas ni afirma enviar correo. |
| `Workspace` | Navegación docente/estudiante, materias, biblioteca, guía, preferencias y avisos. | Menú adaptado a móvil; la selección de perfil pertenece a la demostración. |
| `RichEditor` | Edición de bloques con BlockNote y la integración Ariakit. | Interfaz en español, contenido enriquecido y controles de orden con botones. |
| `QuestionAuthor` | Creación y edición de los ocho tipos de pregunta. | Las soluciones y guías manuales se guardan separadas del documento de lectura. |
| `QuestionInput` | Controles de respuesta reutilizados en vista previa y participación. | Selección mediante controles nativos; relación por selectores; orden por botones; escritura con etiqueta. |
| `ActivityScreen` | Lectura, vista previa, quiz y sala guiada local. | Presenta la versión y las reglas del intento; la retroalimentación depende de la configuración. |
| `ReviewScreen` | Respuestas, correcciones y publicación de notas. | La revisión docente distingue corrección automática, manual y nuevas revisiones justificadas. |
| `ResultsScreen` | Resultados filtrables, promedios, gráfico y tabla. | Promedio independiente por materia y estudiante; solo notas publicadas y elegibles. |
| `TasksScreen` | Consignas, metadatos de entregas, corrección manual y publicación. | No ofrece una descarga de archivos que no se almacenaron. |

Los iconos de interfaz se importan de `lucide-react`. Los componentes de la aplicación no son una implementación del sistema visual completo de Material Design; toman su referencia de movimiento y conservan la identidad de Aulify.

## Editor y preguntas

El esquema de BlockNote incorpora párrafos, encabezados, listas, imágenes, video y un bloque propio `quiz`. Este último funciona como referencia a la actividad: conduce a la sección de preguntas y explica su relación con la lectura. El formulario de preguntas se mantiene fuera del documento enriquecido para separar contenido y soluciones.

El adaptador conserva el documento de edición y una representación semántica de bloques. El borrador usa control de revisión; publicar crea una versión. La demostración conserva esos datos en el navegador. El cambio a persistencia remota requiere conservar este contrato y comprobarlo con operaciones autorizadas de servidor.

| Tipo | Control de participación | Corrección prevista en el prototipo |
|---|---|---|
| Una respuesta | Grupo de opciones exclusivas. | Automática, salvo revisión manual configurada. |
| Varias respuestas | Opciones de selección múltiple. | Conjunto completo según la regla de la pregunta. |
| Verdadero/falso | Dos opciones exclusivas. | Automática, salvo revisión manual configurada. |
| Relacionar | Un selector por elemento. | Puntos parciales según elementos correctos. |
| Ordenar | Lista con botones de subir/bajar y confirmación del orden inicial. | Puntos parciales según posiciones correctas. |
| Completar con opciones | Frase y selector por espacio. | Evaluación de opciones por espacio. |
| Completar escribiendo | Frase y campo por espacio. | Siempre manual. |
| Respuesta abierta | Área de texto. | Siempre manual, con guía reservada al docente. |

La edición y el quiz deben seguir siendo operables sin arrastrar. La ayuda inicial es breve, opcional, distinta por rol y reabrible. Su implementación actual utiliza diálogos y contenido propio; no depende de una biblioteca de recorridos guiados.

## Movimiento y Material Design 3

La referencia es [Material Design 3: patrones de transición](https://m3.material.io/styles/motion/transitions/transition-patterns). Los seis patrones organizan las decisiones de movimiento; su presencia como requisito no acredita una prueba visual terminada.

| Patrón | Aplicación en Aulify | Qué debe verificarse |
|---|---|---|
| Transformación de contenedor | Tarjeta de biblioteca y diálogo de vista previa unidos mediante View Transitions cuando está disponible. | Apertura, Escape, cierre rápido y retorno del foco comprobados con movimiento normal y reducido. Alternativa de diálogo sin transformación. |
| Avance y retroceso | Desplazamiento breve al abrir materia/editor y al regresar a su lista; disposición persistente durante la navegación. | Navegación de ida y vuelta comprobada; foco en el título del destino sin esperar la animación. |
| Lateral | Cambio de panel en las pestañas de materia y transición entre preguntas. | Pestañas operables con flechas, Inicio y Fin; sin retrasar la respuesta ni insertar una confirmación adicional cuando los aciertos están ocultos. |
| Destinos principales | Cambio entre inicio, biblioteca, revisión y resultados. | Entrada breve y discreta; el contenido debe quedar disponible al navegar. |
| Entrada y salida | Diálogos, paneles, avisos y retroalimentación. | Interrupción y cierre; sin acciones activas escondidas detrás del modal; mensaje legible. |
| Esqueletos de carga | Preparación inicial de la muestra y carga del editor. | Mostrar únicamente durante una carga real; estado `aria-busy` y ausencia de demora artificial. |

Los estilos compartidos contienen la entrada de páginas y diálogos; el quiz tiene una transición breve entre preguntas. La portada usa capas ilustradas con progreso de desplazamiento y conserva el scroll normal. Las verificaciones de estados concretos se registran en el [informe del prototipo](../verificacion/pruebas-prototipo.md).

Se comprobaron las [curvas y duraciones oficiales](https://m3.material.io/styles/motion/easing-and-duration/tokens-specs). Las curvas estándar, de entrada y de salida son respectivamente `cubic-bezier(.2,0,0,1)`, `cubic-bezier(0,0,0,1)` y `cubic-bezier(.3,0,1,1)`. Aulify selecciona 150, 250 y 350 ms según el recorrido; los nombres de tokens CSS son propios. La guía actual conserva este sistema para transiciones y propone física de resortes para componentes Expressive. El prototipo utiliza transiciones CSS y View Transitions; no incorpora un motor de resortes.

`prefers-reduced-motion` limita transiciones y animaciones. La escena de portada conserva una composición estática comprensible. Las pruebas deben incluir los estados de apertura, transición y cierre, así como la alternativa sin movimiento. Los colores, animaciones o sonidos no deben revelar una respuesta correcta que la actividad haya configurado como oculta.

## Archivos de marca e ilustraciones

| Archivo | Procedencia documentada | Uso |
|---|---|---|
| [aulify-logo.svg](../../public/brand/aulify-logo.svg) | Archivo de marca Aulify aportado al proyecto. | Cabeceras y navegación; se conservan sus trazos. |
| [aulify-logo-white.svg](../../public/brand/aulify-logo-white.svg) | Variante aportada con los originales. | Variante utilizada por el tema oscuro. |
| [aulify-symbol.svg](../../public/brand/aulify-symbol.svg) | Símbolo original aportado. | Icono del sitio y usos compactos. |
| [student-login.svg](../../public/brand/student-login.svg) | Ilustración aportada con los recursos existentes de Aulify. | Pantallas de acceso. |
| [cuaderno.png](../../public/illustrations/cuaderno.png) | Ilustración raster generada para el prototipo: cuaderno de ciencias, hojas y lápiz. | Original conservado para reproducir el trazado. La portada utiliza ahora la versión SVG. |
| [cuaderno.svg](../../public/illustrations/cuaderno.svg) | Trazado del PNG con VTracer 0.6.12. | 427 trazados, sin imágenes raster incrustadas. Ver `tools/diseno/vectorizar-cuaderno.py`. |
| Dibujos de planta, lápiz y papeles en `landing.tsx` | Trazos definidos en el componente para esta composición. | Capas independientes y elementos ilustrativos del relato de la portada. |

Los conceptos de apertura y los recursos de producción son entregables distintos. Una imagen de concepto con texto dibujado no se utiliza como interfaz ni como sustituto del logotipo SVG. El cuaderno final no contiene texto de interfaz; los títulos, preguntas y botones se renderizan como contenido accesible de la web.

La procedencia anterior no atribuye una licencia de redistribución que no conste en los archivos. Antes de distribuir un paquete de marca por separado, conservar las autorizaciones y condiciones de sus fuentes. Las licencias de Inter, iconos y bibliotecas deben consultarse en sus paquetes y repositorios de origen; no se deducen de su disponibilidad gratuita.

## Preparación para Figma

La aplicación proporciona una base reproducible: tokens CSS, SVG de marca, cuaderno vectorizado, componentes y pantallas en distintos tamaños. Estos recursos permiten preparar variables de color, tipografía, espacio y movimiento; componentes de controles; y lienzos por recorrido y estado.

La réplica editable en Figma sigue pendiente. No existe una equivalencia automática entre una captura y un lienzo con texto, componentes, restricciones y variantes editables. Al preparar esa réplica se deben conservar los SVG, reconstruir textos con Inter y comprobar los estados responsivos. La documentación debe reflejar el orden real del proceso y enlazar el archivo editable cuando exista.

## Fuentes de implementación

- [Componentes compartidos](../../src/components/ui.tsx) y [estilos generales](../../src/app/globals.css).
- [Editor enriquecido](../../src/components/rich-editor.tsx), [autoría de preguntas](../../src/components/question-author.tsx) y [controles de respuesta](../../src/components/question-input.tsx).
- [Portada](../../src/components/landing.tsx), [estilos de portada](../../src/styles/landing.css) y [estilos del quiz](../../src/styles/quiz.css).
- [Dependencias fijadas](../../package.json) y [lockfile](../../package-lock.json).

Las comprobaciones de componentes, rutas y accesibilidad se registran con sus resultados reales. Este catálogo describe la implementación; no sustituye los informes de pruebas.

El selector `ThemeSwitcher`, el proveedor y los hooks de `theme.tsx` aplican claro, oscuro o sistema. `useResolvedTheme()` comunica el tema efectivo a componentes como BlockNote. El comportamiento y las comprobaciones están en [verificación visual 1.1](verificacion-visual-1.1.md).
