# Estado del desarrollo

Actualizado: 28 de septiembre de 2026. Integración con servicios reales en verificación.

Aulify dispone de dos entradas separadas: `/demo` conserva una clase ficticia en el navegador y `/aula` requiere una sesión de Supabase. La demostración permite explorar la interfaz; el aula utiliza operaciones autorizadas en PostgreSQL y archivos privados en Storage.

## Implementación disponible

- Landing ilustrada con movimiento reducido, tipografía Inter y temas claro, oscuro y del sistema. La plataforma adapta navegación y controles a escritorio y celular.
- Acceso con correo y contraseña, sesión protegida, cierre de sesión y limpieza de los datos de la cuenta anterior. Registro y recuperación tienen formularios y endpoints; el envío general de correo todavía depende de SMTP.
- Materias con curso y año, código renovable, solicitud y aprobación, retiro, archivo y restauración durante treinta días.
- Biblioteca y editor por bloques con borradores, conflicto de revisión, vista previa, lectura sin evaluación y publicación de versiones independientes. Imágenes privadas, encabezados, listas, tareas, desplegables, tablas, código, enlaces y preguntas.
- Ocho tipos de pregunta, práctica y examen, avance individual o guiado, intentos y plazos de servidor, respuestas definitivas e idempotencia. Pista y doble con consumo único, sonidos opcionales, rachas, equipos y clasificación según visibilidad.
- Tareas con archivos reales, validación de tipo y tamaño, reentrega autorizada y versiones conservadas. Notas manuales, revisión y publicación separadas; los pendientes no se convierten automáticamente en cero.
- Resultados propios, promedio ponderado, filtros y gráficos con tabla equivalente. Incidencias de visibilidad de pestaña para revisión docente, sin sanción automática.

## Verificaciones realizadas

| Capa | Resultado comprobado | Evidencia |
|---|---|---|
| Modelo y PostgreSQL aislado | Modelo 1.1, diez migraciones y 70 comprobaciones aprobadas en PGlite | [Informe aislado](verificacion/datos-aislados.md) |
| Supabase real | 45 comprobaciones de Auth, permisos, operaciones, concurrencia y Storage con cuatro cuentas ficticias | [Informe remoto](verificacion/datos-remotos.md) |
| Aplicación compilada | 36 pruebas unitarias; tipos, análisis estático y construcción satisfactorios | [Integración web](verificacion/integracion-web.md) |
| Navegador autenticado | Último lote: doce aprobados en escritorio y móvil, incluidos reintento de respuesta, reconexión y JWT alterado | [Confirmación y conexión](verificacion/integracion-resiliencia.json) |
| Gestión integrada | Seis de los casos de navegador ejercitan materias, equipos, evaluación y reentrega con cuentas reales de prueba | [Gestión web](verificacion/datos-gestion-web.md) |
| Cierre guiado concurrente | Treinta rondas y 150 operaciones remotas repetidas sin errores técnicos después de corregir el bloqueo | [Concurrencia](verificacion/datos-carrera-guiada.md) |
| Recuperación aislada | Nueve comprobaciones de una copia PGlite con datos ficticios; no es recuperación de Supabase | [Informe de recuperación](verificacion/recuperacion-aislada.md) |
| Diseño editable | Once composiciones nativas de Figma, fundamentos y componentes; móvil de 390 px | [Figma](diseno/figma-editable.md) |

Los conteos describen ejecuciones distintas. No equivalen a cerrar automáticamente los 76 escenarios AC/AP del producto. La evaluación técnica incluye estados de teclado, reflujo y análisis axe; no acredita por sí sola conformidad completa con WCAG ni una evaluación de usabilidad con personas.

## Trabajo pendiente de cierre

- Terminar la prueba de carga de cuatro grupos de cincuenta estudiantes y cuatro docentes, en modos individual y guiado, con sus umbrales y cuotas originales. No hay capacidad de producción demostrada todavía.
- El CI remoto `36392124813` aprobó todos sus pasos sobre `20e5afc`: 35 pruebas unitarias, SQL aislado y 52 casos públicos de navegador. El mantenimiento `36392156874` terminó correctamente mediante disparo manual, con cero archivos pendientes. Falta observar la activación programada y comprobar recuperación operativa; [registro](verificacion/ci-integracion.json).
- Completar despliegue, comprobaciones por HTTPS y entrega/recuperación por correo. El dominio propio está fuera de esta entrega.
- La protección de Auth contra contraseñas filtradas figura deshabilitada en el asesor y requiere plan Pro. Se conserva Free; [aviso y referencia oficial](verificacion/asesores-supabase.json). No representa una comprobación completa de seguridad.
- Consolidar correspondencia de AC/AP, recuperación operativa y revisión manual de accesibilidad. No se configuraron Jira ni QMetry; se conservan casos, incidencias y resultados reproducibles en el repositorio.

El [plan técnico](../plan.md), las [tareas](../tasks.md) y la [trazabilidad](calidad/trazabilidad.md) describen el cierre de cada requisito. Los informes del prototipo se conservan como antecedentes y no sustituyen las comprobaciones de esta integración.
