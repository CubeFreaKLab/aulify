# Carrusel, guía contextual y edición

## Criterios de aceptación

- La portada incorpora las siete ilustraciones aprobadas entre «De la explicación a la práctica» y la muestra del editor. El reel verde y el arco recorren un bucle continuo con rueda, desplazamiento de página y arrastre con inercia. Se eliminan contador, flechas y puntos inferiores. El teclado conserva flechas y Espacio; un control de pausa aparece al enfocarlo. La rueda no cancela el desplazamiento normal de página y el movimiento reducido desactiva deriva e inercia.
- Acceso y registro presentan ilustraciones mayores, cierre X claramente visible y cabecera sin línea divisoria.
- Cada tipo de página ofrece una guía con un foco visual sobre controles reales, pasos específicos para docentes o estudiantes, anterior/siguiente, cierre y repetición. La primera visita ofrece la guía; la preferencia por pantalla se guarda por perfil y navegador. Una guía no ejecuta operaciones ni interrumpe automáticamente intentos activos.
- El editor conserva escritura por bloques, guardado y publicación. La vista previa usa anteojos animados; publicar permite deslizar un documento y conserva una alternativa mediante botón/teclado. No se publica antes de revisar la configuración y confirmar.
- Las preguntas se integran bajo el documento con márgenes coherentes. El menú de bloques conserva sus nombres, teclado y comportamiento y recibe pequeños pictogramas de marca.
- Se pueden insertar dos columnas o colocar dos bloques consecutivos lado a lado desde Ordenar bloques. Guardado, recarga y vista previa conservan el contenido; en celular se apilan y la opción Apilar contenido recupera el flujo normal.
- El lápiz aprobado funciona solo en portada con puntero fino. La punta coincide con el punto de clic y el cuerpo puede inclinarse alrededor de ella. No intercepta eventos; se retira en campos de edición, con pantalla táctil y al salir de la portada. Movimiento reducido conserva la posición sin animación de pulsación.
- Ctrl+V reconoce imágenes del portapapeles, muestra una vista y pide la descripción antes de insertar en el bloque capturado. Conserva los tipos y límites de carga actuales y el guardado/recarga. Imagen, Dos columnas y Tabla tienen accesos visibles.
- Biblioteca ofrece Crear quiz, que abre las preguntas directamente. Quiz y preguntas se puede abrir también desde la barra del editor. Las rutas superiores son enlaces y muestran la materia o el recurso actual.
- Una lectura sin preguntas se puede publicar en la demo y abrir tras recargar. No genera intentos ni calificaciones. La confirmación mantiene alternativas de arrastre, clic y teclado.
- Ayuda amplía la ilustración y sustituye los números decorativos por cinco iconos SVG de marca.

## Implementación

Componentes React y CSS propios, apoyados en React Aria ya instalado para el diálogo y el foco. No se añade un proveedor ni dependencia de pago. Las referencias de RewampUI orientan geometría e interacción; las ilustraciones y estilos corresponden a Aulify. Se evita capturar la rueda del ratón para que la página siga desplazándose normalmente.

Las siete tarjetas y el documento son SVG de trazados; no contienen bitmaps incrustados. Los originales se conservan fuera del repositorio. Las columnas utilizan bloques anidados `columns` y `column` del documento JSON existente; el lector conserva su estructura, y el contenido semántico sigue disponible para muestras y exportación.

La revisión de movimiento utiliza una fase continua en requestAnimationFrame, geometría circular y envoltura fuera del área visible. El lápiz mantiene posición exacta; únicamente su cuerpo tiene respuesta al movimiento. Los iconos de libros, participantes y resultados parten de PNG generados y se vectorizan a tres colores opacos; se reutilizan el lápiz y el documento aprobados. Las lecturas de demo guardan únicamente referencias a versiones y materias en almacenamiento local separado, que se limpia al reiniciar la demo. No cambia el modelo remoto ni los permisos de publicación de cuentas.

La guía inicial utiliza la preferencia de cuenta versión 3. Las guías de cada página y la elección de apertura manual se guardan por perfil en el navegador; no se presenta esa parte como sincronizada entre dispositivos. React Aria gestiona el diálogo, Escape y el foco. Los pasos omiten controles ausentes y no ejecutan acciones de clase.

La confirmación con documento admite arrastre, clic, Enter y Espacio. Un arrastre parcial se cancela y no bloquea la siguiente pulsación de teclado. Abrir la configuración no publica; el segundo control mantiene validación del formulario y exclusión de envíos concurrentes.

## Verificación

Revisión de movimiento y descubrimiento: cuatro casos nuevos aprobados (ratón/rueda/vuelta completa/cursor y Ctrl+V en escritorio; publicación de lectura local, recarga, rutas, quiz y Ayuda en escritorio y móvil). Dos casos existentes de confirmación de publicación también pasaron. Compilación, tipos y lint de cambios correctos. El portapapeles se verificó con ClipboardItem y Ctrl+V reales en Chromium local, incluida imagen visible, descripción, guardado y recarga. Se revisaron capturas locales de portada, Ayuda, editor y biblioteca en escritorio y móvil. La carga de cuenta reutiliza el flujo existente; no se ejecutó una nueva prueba de almacenamiento remoto.

Validación de la primera integración:

- TypeScript, ESLint de archivos modificados y compilación local correctos.
- Ocho casos de `ayuda.spec.ts` aprobados en Chromium de escritorio y móvil: roles, navegación, foco, cierre, repetición, preferencia de apertura manual y ayuda sin alterar el intento activo.
- Cuatro casos de `carrusel-editor.spec.ts` aprobados: columnas guardadas y recuperadas, lectura y apilado sin pérdida de texto; arrastre parcial, teclado, cancelación de configuración y una única publicación confirmada.
- Revisión visual local de carrusel claro/oscuro, acceso, guía, editor y lectura en escritorio y 390 px; sin desbordes observados. Comprobación automática de accesibilidad de la guía sin infracciones detectadas. Carrusel con siete tarjetas y movimiento reducido comprobados.
- Los ensayos de cuentas remotas se adaptaron al nuevo recorrido, pero no se ejecutaron sobre servicios en esta entrega. No se acredita una evaluación manual con lector de pantalla ni una nueva prueba de capacidad o correo. GitHub Actions se consulta por separado.
