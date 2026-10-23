# Acceso ilustrado y encuadres

## Criterios de aceptación

- La barra lateral conserva el símbolo de 48 × 48 y el logo completo de 130 × 44 al alternar repetidamente, sin reutilizar una imagen de distinta proporción.
- El encabezado de materia reserva lugares separados para título, ilustración y acción; no se superponen en móvil ni escritorio.
- Acceso, registro y recuperación permiten volver a portada mediante una X con nombre accesible y área de 44 píxeles.
- Las etiquetas de nombre, correo y contraseña empiezan dentro del campo y suben al enfocar, autocompletar o conservar un valor; los errores no sustituyen a la etiqueta.
- La etiqueta sube con una secuencia breve por letra. La entrada de un carácter tiene un ascenso breve; pegar, seleccionar, editar en medio y usar composición mantienen la interacción nativa. El movimiento reducido desactiva los efectos. No hay sonido.
- Docente y estudiante tienen ilustraciones originales vectorizadas y opciones nativas de selección con teclado.

La referencia de etiqueta es [warm-eel-62 de liyaxu123](https://uiverse.io/liyaxu123/warm-eel-62); se conserva el estilo de campo de Aulify con una implementación propia. La ampliación de landing (texto cinético y carrusel de arco) permanece como propuesta visual pendiente de aprobación, sin incorporarse a la página.

## Implementación y comprobación local

Los retratos de rol se generaron a partir de los avatares de la marca y se convirtieron en trazados SVG. El fondo circular es verde opaco; solo el exterior es transparente. Las imágenes no determinan el rol: la selección continúa siendo un control de radio nativo.

El campo de contraseña conserva su control nativo. La capa decorativa utiliza únicamente puntos, se elimina al seleccionar, borrar, pegar o salir del campo y no se usa mientras la contraseña está visible. No se guarda en Web Storage.

Comprobación del 23 de octubre de 2026:

- TypeScript, ESLint de los tres componentes cambiados y compilación de producción: aprobados.
- Diez casos de Playwright: acceso, registro, recuperación, validación, reflujo a 320 píxeles y auditoría automática de accesibilidad, en escritorio y móvil: aprobados.
- Revisión visual de nueve capturas a 1440 y 390 píxeles, en claro y oscuro. Sin superposición de dibujo y acción en materia, sin desbordamiento horizontal y sin errores de navegador.
- Seis alternancias de barra: símbolo de 48 × 48 y logo de 130 × 44, sin aumento de tamaño.
- La contraseña animada mostró solamente puntos; con movimiento reducido no se creó la capa animada. La X volvió a portada.

Estos resultados corresponden a la aplicación local. No acreditan envío de correo, acceso remoto con credenciales ni una nueva prueba de capacidad.
