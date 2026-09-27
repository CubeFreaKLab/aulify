# Explorar el prototipo de Aulify

## Preparación

Instalar Node.js 24. Ejecutar `npm ci` y `npm run dev` desde la raíz del repositorio. Abrir `http://127.0.0.1:3000`. Para comprobar la versión construida, ejecutar `npm run build` y después `npm run start`, sin otro proceso ocupando el mismo puerto.

No se requieren variables de Supabase para la demostración. La configuración de servicios reales es una entrega posterior; no introducir secretos en el navegador ni en archivos públicos.

## Perfiles y datos

La muestra incluye a Elena como docente y a Camila, Mateo y Lucía como estudiantes. Son perfiles ficticios. El código inicial de Biología es `B3A7K2RX`. Las fechas se generan al crear o reiniciar la muestra; el cierre se sitúa varios días después para poder probarla.

Los datos se conservan en `localStorage`, bajo `aulify.demo.v1`. El perfil elegido se conserva por pestaña en `sessionStorage`. Cambiar el perfil permite probar ambos lados de la actividad y no representa un control de autenticación. La muestra no debe emplearse con información real de estudiantes.

Si los datos no pueden restaurarse, se muestra el problema y se ofrece un reinicio explícito. No se reemplazan silenciosamente datos dañados. Preferencias también permite volver al escenario inicial, después de confirmar la pérdida de cambios de muestra.

## Preparar y publicar

1. Entrar a la demostración como docente. La guía inicial puede omitirse y abrirse después desde Ayuda.
2. Abrir Biblioteca y crear un recurso o editar el ejemplo de ecosistemas.
3. Cambiar el título y la explicación. Usar `/` para insertar bloques. El menú «Ordenar bloques con botones» ofrece una alternativa al arrastre.
4. Añadir preguntas, sus valores y soluciones. Las preguntas escritas requieren guía y revisión manual. El guardado del borrador se indica en el encabezado.
5. Recargar para comprobar la persistencia. Si otra pestaña modificó el borrador, conservar una copia o recargar la versión guardada.
6. Usar Vista previa. No consume intentos ni comparte el borrador.
7. Publicar, elegir materia, práctica/examen, nota máxima y cierre. Las opciones avanzadas agrupan intentos, tiempo, retroalimentación, ritmo y potenciadores.

Publicar crea una instantánea independiente. Una modificación posterior del borrador no altera las respuestas vinculadas a la versión anterior.

## Participar y revisar

1. Cambiar al perfil de Camila y abrir la actividad desde su materia.
2. Leer el recurso y las reglas. Pulsar Empezar actividad; leer el recurso no consume un intento.
3. Elegir y confirmar cada respuesta. Si la retroalimentación está oculta, se pasa directamente a la siguiente pregunta. Una respuesta escrita no recibe una corrección automática.
4. Al terminar, consultar Resultados. La nota solo aparece después de su publicación.
5. Cambiar a Elena. En Por revisar, seleccionar el intento, corregir las respuestas pendientes y publicar la nota.
6. Volver a Camila para comprobar que su resultado está disponible. Los pendientes permanecen separados de cero y fuera del promedio.

El escenario inicial también contiene una participación de Mateo con dos respuestas escritas pendientes, útil para explorar la corrección sin responder primero todo el quiz.

## Sala guiada

Publicar una actividad con ritmo guiado. El estudiante se une a la sala y el docente inicia la sesión, cierra cada pregunta y abre la siguiente. La configuración guiada usa un intento y conserva una secuencia compartida. La demostración puede explorarse cambiando de perfil o mediante pestañas del mismo navegador que comparten los datos locales.

Esto comprueba estados e interacciones del prototipo; no demuestra sincronización entre dispositivos, concurrencia multiusuario ni tiempos de servidor.

## Tareas y resultados

El docente puede crear una tarea; el estudiante selecciona archivos y confirma una entrega. La muestra conserva el nombre, tamaño y tipo del archivo, junto con la nota del estudiante. No sube ni conserva los bytes del archivo y no ofrece una descarga remota ficticia. El docente registra una calificación y la publica.

Resultados permite filtrar por materia, curso y año. Los promedios pertenecen a una materia y un estudiante. Los gráficos tienen información equivalente en tablas. Las escalas originales se muestran junto con el resultado normalizado cuando corresponde.

## Límites técnicos

- Identidad, reloj y almacenamiento son locales y modificables por quien usa el navegador. La protección de datos requiere servidor y RLS reales.
- No hay envío de correo, cuentas registradas, Storage privado ni despliegue de producción.
- No están implementadas la eliminación programada, evaluación de carga, equipos ni todas las ampliaciones del producto. La [matriz de pantallas](../diseno/pantallas-y-estados.md) enumera su estado.
- Las pruebas de demostración no cierran los casos integrados de aceptación que exigen Supabase, participantes reales o medidas de capacidad.
- Emular una pantalla móvil no sustituye probar dispositivos y teclados virtuales reales. Los resultados automáticos de accesibilidad se complementan con inspección manual.

## Próxima integración

Comprobar Supabase en un entorno de prueba; derivar migraciones y RLS del modelo; verificar Auth y recuperación con correo; conectar materias, recursos, intentos, calificaciones y archivos por recorridos; sustituir reloj y mutaciones locales por operaciones de servidor verificadas. Mantener la demostración aislada de datos reales. Preparar CD y liberar producción después de los criterios de calidad de esa entrega.
