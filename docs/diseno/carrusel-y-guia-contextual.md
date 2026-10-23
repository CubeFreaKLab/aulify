# Carrusel, guía contextual y edición

## Criterios de aceptación

- La portada incorpora las siete ilustraciones aprobadas entre «De la explicación a la práctica» y la muestra del editor. Un texto verde en forma de reel acompaña un carrusel en arco; se puede recorrer con botones, teclado y arrastre, pausar el movimiento y respetar movimiento reducido.
- Acceso y registro presentan ilustraciones mayores, cierre X claramente visible y cabecera sin línea divisoria.
- Cada tipo de página ofrece una guía con un foco visual sobre controles reales, pasos específicos para docentes o estudiantes, anterior/siguiente, cierre y repetición. La primera visita ofrece la guía; la preferencia por pantalla se guarda por perfil y navegador. Una guía no ejecuta operaciones ni interrumpe automáticamente intentos activos.
- El editor conserva escritura por bloques, guardado y publicación. La vista previa usa anteojos animados; publicar permite deslizar un documento y conserva una alternativa mediante botón/teclado. No se publica antes de revisar la configuración y confirmar.
- Las preguntas se integran bajo el documento con márgenes coherentes. El menú de bloques conserva sus nombres, teclado y comportamiento y recibe pequeños pictogramas de marca.
- Se pueden insertar dos columnas o colocar dos bloques consecutivos lado a lado desde Ordenar bloques. Guardado, recarga y vista previa conservan el contenido; en celular se apilan y la opción Apilar contenido recupera el flujo normal.
- El lápiz se entrega como PNG y SVG para revisión. El cursor de la aplicación permanece sin cambios.

## Implementación

Componentes React y CSS propios, apoyados en React Aria ya instalado para el diálogo y el foco. No se añade un proveedor ni dependencia de pago. Las referencias de RewampUI orientan geometría e interacción; las ilustraciones y estilos corresponden a Aulify. Se evita capturar la rueda del ratón para que la página siga desplazándose normalmente.

Las siete tarjetas y el documento son SVG de trazados; no contienen bitmaps incrustados. Los originales se conservan fuera del repositorio. Las columnas utilizan bloques anidados `columns` y `column` del documento JSON existente; el lector conserva su estructura, y el contenido semántico sigue disponible para muestras y exportación.

La guía inicial utiliza la preferencia de cuenta versión 3. Las guías de cada página y la elección de apertura manual se guardan por perfil en el navegador; no se presenta esa parte como sincronizada entre dispositivos. React Aria gestiona el diálogo, Escape y el foco. Los pasos omiten controles ausentes y no ejecutan acciones de clase.

La confirmación con documento admite arrastre, clic, Enter y Espacio. Un arrastre parcial se cancela y no bloquea la siguiente pulsación de teclado. Abrir la configuración no publica; el segundo control mantiene validación del formulario y exclusión de envíos concurrentes.

## Verificación

- TypeScript, ESLint de archivos modificados y compilación local correctos.
- Ocho casos de `ayuda.spec.ts` aprobados en Chromium de escritorio y móvil: roles, navegación, foco, cierre, repetición, preferencia de apertura manual y ayuda sin alterar el intento activo.
- Cuatro casos de `carrusel-editor.spec.ts` aprobados: columnas guardadas y recuperadas, lectura y apilado sin pérdida de texto; arrastre parcial, teclado, cancelación de configuración y una única publicación confirmada.
- Revisión visual local de carrusel claro/oscuro, acceso, guía, editor y lectura en escritorio y 390 px; sin desbordes observados. Comprobación automática de accesibilidad de la guía sin infracciones detectadas. Carrusel con siete tarjetas y movimiento reducido comprobados.
- Los ensayos de cuentas remotas se adaptaron al nuevo recorrido, pero no se ejecutaron sobre servicios en esta entrega. No se acredita una evaluación manual con lector de pantalla ni una nueva prueba de capacidad o correo. GitHub Actions se consulta por separado.
