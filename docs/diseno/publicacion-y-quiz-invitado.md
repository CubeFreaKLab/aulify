# Publicación, edición y práctica por enlace

## Comportamiento acordado

- El botón Publicar de la barra abre el diálogo sin animación. La confirmación recorre el botón una sola vez con el documento y su rastro, oculta el texto durante ese recorrido y ejecuta la publicación al terminar. El éxito se muestra antes de navegar; un fallo permite reintentar sin afirmar que se publicó. Se evita el doble envío y se respeta movimiento reducido.
- El lápiz aparece en portada, acceso y registro, apunta arriba a la izquierda y conserva la punta como punto de clic. Los campos conservan su cursor de texto.
- La carga de archivos utiliza el estilo de los demás controles y separa la acción de guardar. Las tablas anchas se desplazan dentro de la hoja, con controles accesibles. Los integrantes muestran su avatar elegido.
- Los campos de texto incorporan una entrada breve de la letra escrita, sin alterar valor, selección, pegado, composición o accesibilidad. Las contraseñas nunca se duplican en texto visible ni se incorporan a registros.
- La demostración incluye un quiz con imágenes y tiempo limitado, accesible desde la materia y el inicio del estudiante. El tiempo restante se representa con una barra superior y texto.
- El docente puede compartir una práctica por URL y QR y programar su disponibilidad. El invitado entra sin cuenta con nombre y avatar aleatorio. Su participación no crea matrícula, intento académico ni nota. Las claves de corrección no se envían antes de responder. El servidor comprueba disponibilidad y vencimiento. El enlace puede desactivarse.

## Implementación y verificación previstas

1. Corregir controles de publicación, cursor, carga y tabla; comprobar teclado, doble envío, error y movimiento reducido.
2. Añadir fixture de quiz conservando los borradores existentes, barra de tiempo y avatar en integrantes. Verificar finalización como estudiante.
3. Implementar el acceso público separado con límites, permisos y programación; generar el QR localmente. Verificar acceso desde un navegador sin sesión, respuestas, expiración y ausencia de notas.
4. Registrar resultados reales y pendientes de correo y liberación. El clon de producción/demostración y los materiales de presentación son una etapa posterior.

La verificación local no acredita envío de correo, capacidad alojada ni disponibilidad de producción.

## Resultado implementado

Publicar en la barra es estático. El botón final oculta el texto, desplaza el documento con rastro durante 850 ms, espera ese recorrido antes de publicar y muestra «Publicado» durante 650 ms antes de navegar. El bloqueo evita envíos repetidos; la preferencia de movimiento reducido omite el recorrido. El lápiz conserva su punta fija y gira 90 grados respecto al asset original. Los campos nativos conservan valor, selección, pegado y composición; la capa animada es decorativa. La tabla usa un área desplazable con espacio para sus controles y revela las columnas añadidas.

«Reto del ecosistema» tiene seis preguntas ilustradas, cuatro minutos, pista y diez intentos de demostración. No aporta al promedio. Se añade a demostraciones ya guardadas sin reiniciarlas. El acceso está en Inicio y Biología como estudiante; como docente, la actividad ofrece Invitar por QR. En demo ese QR abre el ejemplo fijo; en una cuenta comparte una copia del quiz propio con apertura, cierre, duración y revocación. No reproduce todas las funciones de Wayground: los invitados realizan una práctica individual sin nota académica.

El [modelo 1.4](../modelado/invitados.md) documenta las dos tablas privadas, restricciones y permisos. La migración 38 está aplicada en Supabase. El QR se genera localmente con `qrcode`, sin enviar el enlace a un proveedor de imágenes. El servidor comprueba la programación y el plazo y solo expone la pregunta actual sin soluciones. El nombre, avatar, progreso y recibos quedan separados de matrículas, intentos y notas académicas.

## Verificación

- Compilación Next.js 16.4.3 y tipos aprobados; 232 pruebas unitarias aprobadas. La actualización de dependencias deja `npm audit` sin avisos en la ejecución registrada.
- Dieciocho [comprobaciones de datos aisladas](../verificacion/invitados-aislado.json) y ocho [permisos remotos](../verificacion/invitados-permisos-remotos.json) aprobados. Las 38 migraciones compilan en PostgreSQL aislado.
- Navegador de escritorio y móvil: publicación posterior a la animación, confirmación visible, carga y separación, animación al escribir, tabla de doce columnas y adición de una decimotercera, avatar en integrantes, QR, quiz con imagen y tiempo. La partida invitada real conserva progreso, impide duplicar puntos y termina sin nota. El lápiz se comprueba con ratón; se excluye en móvil.
- La ejecución general inicial recorrió 152 casos: 93 aprobados, 22 fallidos y 37 exclusiones explícitas. Se corrigieron selectores que asumían un único ejemplo, contraste del reel y carga de SVG fuera del encuadre. Las repeticiones dirigidas aprobaron los 22 casos y los controles de tabla y foco posteriores. Las exclusiones corresponden a funciones de ratón o integraciones que necesitan cuentas y configuración privadas. Esto no equivale a volver a ejecutar todas las integraciones alojadas.
- Las capturas locales están en `output/publicacion-quiz`, fuera del repositorio. El CI incorpora la prueba aislada de invitados; el caso HTTP con PostgreSQL alojado se ejecuta localmente y se excluye de CI sin credenciales. El resultado de GitHub Actions y la Preview se registran por separado.

La [revisión previa a producción](../operacion/revision-produccion.md) concentra los pendientes operativos. No se ejecutaron nuevas cargas ni envío de correo, ni se promovió producción.
