# Registro y primer uso

## Comportamiento y aceptación

- RF-01: registro y recuperación exigen entre 8 y 128 caracteres, mayúscula, minúscula, número y símbolo. Mostrar los requisitos solo como error rojo al enviar una contraseña incompleta, indicando el mínimo sin anunciar el máximo técnico. Verificar en formulario, API y Supabase; el acceso de cuentas existentes conserva su contraseña. No guardar contraseñas en Web Storage.
- RF-01: el error de cuenta existente y la identidad vacía de Supabase se presentan como correo ocupado, junto al campo y con accesos a iniciar sesión/recuperar. No mostrar éxito en esos casos ni consultar una lista administrativa. Una cuenta sin confirmar puede recibir de nuevo el enlace mediante el proveedor, conservando una sola cuenta.
- RF-01: el envío correcto sustituye el formulario por una tarjeta centrada, con carta SVG, correo de destino, explicación, acceso y corrección de dirección; foco en el título y reflujo móvil. Bienvenida independiente sin envío automático.
- RF-01: abrir `/` con sesión válida redirige a `/aula`, incluso tras cerrar la pestaña; conservar cookies renovadas. Sin sesión o con sesión revocada aparece la portada. Una avería de Auth no se interpreta como cierre de sesión.
- RF-02: Materias sin grupos muestra ilustración, explicación por rol y acción real de crear/unirse. Las solicitudes pendientes explican la espera de aprobación.
- RF-13: Resultados sin filas muestra una ilustración SVG de informe y lápiz en lugar del icono pequeño, con la explicación y los filtros existentes. La imagen decorativa no repite el título al lector de pantalla.
- RF-17: Ayuda conserva instrucciones escritas sin guía superpuesta ni botón para abrirla. Las otras guías animan posición, foco visual, contenido, entrada y salida; respetan movimiento reducido y teclado.
- RNF-01/RNF-02: primera visita clara incluso con sistema oscuro. Una elección guardada de tema se conserva.

## Implementación

Rama de revisión separada de producción. Política compartida en `password-policy.ts`; errores de duplicado interpretados después de `signUp`, bajo los límites del proveedor y comprobación de origen existente. Un identificador aleatorio en los metadatos correlaciona el alta: Supabase conserva los metadatos originales al repetir un registro sin confirmar. Se muestra entonces «registro pendiente» en lugar de otro éxito; el proveedor puede reenviar el enlace. Este identificador no autoriza acciones ni sustituye verificaciones de sesión. La recuperación conserva mensaje neutro. Informar correo ocupado es una decisión explícita: comunica existencia al enviar el formulario, sin exponer perfil ni identidad.

La navegación inicial usa el proxy SSR existente, respuesta privada sin caché, verificación de claims y propagación de cookies renovadas. Se reaprovecha el SVG de libros para Materias. Guías con transiciones CSS de geometría y opacidad y alternativa sin movimiento.

## Ilustración de correo

Herramienta integrada de generación de imágenes y trazado con `tools/diseno/vectorizar-correo.py` (VTracer). SVG de 16 trazados, sin bitmap incrustado, negro, blanco y verde. PNG original conservado en artefactos de trabajo. Prompt: sobre abierto con carta y marca de comprobación, pequeño avión de papel, trazo negro grueso ligeramente irregular, blanco y verde #85bd6e, fondo transparente, sin texto, degradados ni sombras. La vectorización aplana los colores.

## Verificación

La revisión final sustituye el icono vacío de Resultados por una ilustración generada y trazada con VTracer: 16 trazados, sin bitmap incrustado, en los tres colores de la marca. Se reutiliza el script de vectorización de la carta. El formulario de registro y cambio de contraseña omite el aviso fijo; la validación conserva el mínimo y las clases requeridas, con errores rojos junto al campo. 22 pruebas unitarias de registro y cuatro recorridos de primer uso aprobados localmente; estos comprueban aviso condicional, color rojo, ausencia de «128», desaparición al editar, SVG cargado y reflujo en escritorio y móvil. Tipos y lint de los archivos modificados aprobados. La publicación conserva los controles de CI y la compilación propia de Production.

46 comprobaciones unitarias aprobadas sobre registro, recuperación, duplicado confirmado/pendiente, enlaces de correo, renovación y rutas de proxy. Ocho recorridos de guías y cuatro de primer uso aprobados en escritorio/móvil; los primeros usan también movimiento reducido y navegación por teclado. Revisión visual de la tarjeta y del estado vacío, sin desbordamiento, imágenes cargadas y accesibilidad automática de confirmación sin incidencias. El primer ensayo del nuevo fixture navegó antes de terminar la selección de perfil; se corrigió esperando el inicio estudiantil y pasó en ambos tamaños. Tipos, lint de archivos modificados y compilación aprobados.

La batería de CI detectó expectativas antiguas que daban por hecho que cambiar el sistema operativo cambiaba también el tema inicial. Se actualizaron los recorridos de apariencia, biblioteca, editor y navegación para elegir el tema con los controles reales, conservando las comprobaciones de contraste, persistencia y reflujo en ambos modos. Se aprobó la selección local de 25 recorridos adicionales; uno exclusivo de móvil se omite en escritorio. El primer helper encontró dos botones de cierre y se acotó al diálogo de navegación; sus once casos afectados pasaron al repetirlos. La preferencia explícita `system` continúa comprobándose por separado.

Política de Supabase aplicada al proyecto alojado: ocho caracteres y las cuatro clases requeridas. Dos solicitudes inválidas directas al proveedor devolvieron 422/weak_password, por caracteres y por longitud; no se crearon cuentas ni enviaron correos en esas comprobaciones. La interfaz automatizada usa respuestas de Auth simuladas y datos ficticios: no acredita envío real. El propietario comprobó recepción de confirmación con imágenes en la versión anterior; recuperación por correo pendiente.

Referencias: [contraseñas](https://supabase.com/docs/guides/auth/password-security), [registro](https://supabase.com/docs/reference/javascript/auth-signup), [implementación del proveedor](https://github.com/supabase/auth/blob/master/internal/api/signup.go).
