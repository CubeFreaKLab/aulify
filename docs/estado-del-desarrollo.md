# Estado del desarrollo

Actualizado: 29 de septiembre de 2026. Integración con servicios reales y revisión visual en curso.

## Revisión visual más reciente

Se simplificó el editor para priorizar el documento, se corrigieron superficies y menús del tema oscuro y se ajustó la composición de las ilustraciones en móvil. La [primera revisión](diseno/revision-editor-apariencia-2026-09-29.md) conserva su evidencia. La [revisión de biblioteca y editor](diseno/revision-biblioteca-editor-2026-09-29.md) incorpora navegación móvil con gestión de foco, muestras reales del contenido, imágenes ajustables sin deformación, video con carga explícita y lectura que conserva formato y paleta.

La revisión local reúne 48 pruebas unitarias aprobadas, construcción/análisis/formato correctos y 68 recorridos públicos de navegador aprobados al combinar el lote inicial con la repetición de dos casos cuyo selector se corrigió. Los 22 recorridos autenticados se omitieron en ese lote. Las 18 capturas de escritorio y móvil en ambos temas identifican su compilación. Una [segunda unidad de pantallas](diseno/revision-pantallas-2026-09-29.md) añade seis casos de adaptación de materia, revisión, resultados y quiz; los seis se repitieron con éxito sobre el compilado de producción local `NM4iMNbRDIkrz8dBQyrB4`. Estas comprobaciones no acreditan aceptación estética, pruebas con personas ni un nuevo despliegue.

La [sincronización de Figma](diseno/revision-biblioteca-figma-2026-09-29.md) incorpora catorce composiciones y dos muestras de controles en ambos temas, con texto, vectores, componentes y variables editables. Son estados estáticos; no se declara un prototipo interactivo completo. La [verificación entre motores](verificacion/compatibilidad-editor-navegacion.md) añade Firefox y WebKit al editor y la navegación, y corrige el retorno del foco al cerrar el menú.

Aulify dispone de dos entradas separadas: `/demo` conserva una clase ficticia en el navegador y `/aula` requiere una sesión de Supabase. La demostración permite explorar la interfaz; el aula utiliza operaciones autorizadas en PostgreSQL y archivos privados en Storage.

## Implementación disponible

- Landing ilustrada con movimiento reducido, tipografía Inter y temas claro, oscuro y del sistema. La plataforma adapta navegación y controles a escritorio y celular.
- Acceso con correo y contraseña, sesión protegida, cierre de sesión y limpieza de los datos de la cuenta anterior. Registro y recuperación tienen formularios y endpoints; el envío general de correo todavía depende de SMTP.
- Materias con curso y año, código renovable, solicitud y aprobación, retiro, archivo y restauración durante treinta días.
- Biblioteca y editor por bloques con borradores, conflicto de revisión, vista previa, lectura sin evaluación y publicación de versiones independientes. Imágenes privadas, encabezados, listas, tareas, desplegables, tablas, código, enlaces y preguntas.
- Ocho tipos de pregunta, práctica y examen, avance individual o guiado, intentos y plazos de servidor, respuestas definitivas e idempotencia. Pista y doble con consumo único, sonidos opcionales, rachas, equipos y clasificación según visibilidad.
- Tareas con archivos reales, validación de tipo y tamaño, reentrega autorizada y versiones conservadas. Notas manuales, revisión y publicación separadas; los pendientes no se convierten automáticamente en cero.
- Resultados propios, promedio ponderado, filtros por materia, curso, año y fechas. Distribución docente por actividad en cinco intervalos, tabla equivalente y pendientes separados. Incidencias de visibilidad de pestaña para revisión docente, sin sanción automática.

## Verificaciones realizadas

| Capa | Resultado comprobado | Evidencia |
|---|---|---|
| Modelo y PostgreSQL aislado | Modelo 1.3, dieciséis migraciones y 84 comprobaciones de regresión aprobadas en PGlite | [Regresión actual](verificacion/datos-regresion-revision-participante.json) |
| Supabase real | 45 comprobaciones de Auth, permisos, operaciones, concurrencia y Storage con cuatro cuentas ficticias | [Informe remoto](verificacion/datos-remotos.md) |
| Aplicación compilada | 42 pruebas unitarias; tipos, análisis estático y construcción satisfactorios | [Integración web](verificacion/integracion-web.md) |
| Navegador autenticado | Último lote: doce aprobados en escritorio y móvil, incluidos reintento de respuesta, reconexión y JWT alterado | [Confirmación y conexión](verificacion/integracion-resiliencia.json) |
| Gestión integrada | Seis de los casos de navegador ejercitan materias, equipos, evaluación y reentrega con cuentas reales de prueba | [Gestión web](verificacion/datos-gestion-web.md) |
| Cierre guiado concurrente | Treinta rondas y 150 operaciones remotas repetidas sin errores técnicos después de corregir el bloqueo | [Concurrencia](verificacion/datos-carrera-guiada.md) |
| Sincronización por actividad | 24 comprobaciones remotas, contadores privados, lectura acotada y carrera guiada repetida sin errores técnicos | [Sincronización](verificacion/datos-sincronizacion.md) |
| Publicación de clasificación | Migración 15 aplicada y 33 comprobaciones remotas aprobadas: una corrección privada conserva clasificación y huella estudiantil hasta republicar | [Juego y publicación](verificacion/juego-aceptacion.md) |
| Revisión docente por participante | Migración 16 aplicada: 31 comprobaciones específicas locales y regresión remota de 33 comprobaciones / 53 RPC; no demuestra capacidad | [Revisión por participante](verificacion/datos-revision-participante.md) |
| Seguimiento y distribución | Cuatro ejecuciones de navegador: filtros, filas únicas, notas límite y pendientes; escritorio y móvil, con tablas equivalentes | [Distribución](verificacion/resultados-distribucion.md) |
| Recuperación aislada | Nueve comprobaciones de una copia PGlite con datos ficticios; no es recuperación de Supabase | [Informe de recuperación](verificacion/recuperacion-aislada.md) |
| Diseño editable | Once composiciones nativas de Figma, fundamentos y componentes; móvil de 390 px | [Figma](diseno/figma-editable.md) |

Los conteos describen ejecuciones distintas. No equivalen a cerrar automáticamente los 76 escenarios AC/AP del producto. La evaluación técnica incluye estados de teclado, reflujo y análisis axe; no acredita por sí sola conformidad completa con WCAG ni una evaluación de usabilidad con personas.

El historial vigente contiene diecisiete migraciones locales y remotas; la última es `20260929231531`, con [validación de enlaces](verificacion/enlaces-editor.md) comprobada localmente y mediante once RPC remotos. La [integración posterior](verificacion/integracion-editor-evaluacion.md) registra 98 pruebas locales, construcción correcta y cuatro ejecuciones de navegador en el compilado `Uh-fjoiC7EsPHOpmME_0K`. El CI [36642510552](https://github.com/CubeFreaKLab/aulify/actions/runs/36642510552) aprobó todos sus pasos sobre `927e910`, con dieciséis migraciones; el código posterior requiere su propia ejecución. El [registro de CI](verificacion/ci-integracion.json) conserva revisión, estado y pasos observados sin atribuir conteos a registros que no se descargaron.

La verificación posterior de [consultas acotadas](verificacion/integracion-acotada.json) cubre los doce recorridos de integración mediante un lote de diez aprobados y la repetición de dos tras corregir su preparación. Los recorridos de resultados se registran aparte. El CI conserva siempre su revisión exacta; no se atribuye a código posterior.

El CI posterior [36644805645](https://github.com/CubeFreaKLab/aulify/actions/runs/36644805645), sobre `26477d9`, aprobó formato, análisis, tipos, pruebas locales, comprobaciones PostgreSQL y construcción, pero falló en navegador. Su registro descargado indica 75 recorridos aprobados, 22 omitidos, uno aprobado tras reintento y dos fallidos del lector enriquecido. Se está corrigiendo su preparación; este resultado no se presenta como integración aprobada.

## Trabajo pendiente de cierre

- Resolver y verificar la capacidad de cuatro grupos de cincuenta estudiantes y cuatro docentes, en modos individual y guiado, con sus umbrales y cuotas originales. El [sondeo tras la migración 16](verificacion/datos-protocolo-60s-migracion16.md) no aprobó: 193/200 confirmaciones persistidas, p95 7.929,24 ms y 1,334 % de fallos. No se inició el protocolo sostenido ni se redujeron los umbrales. El informe conserva la comparación y el siguiente diagnóstico necesario.
- Los veintidós recorridos autenticados se omiten en CI y conservan su evidencia de ejecución separada. La limpieza programada ya se observó: `36571189662` y `36638509107` tienen evento `schedule` y todos sus pasos aprobados. Esto confirma activación automática, sin garantizar un plazo futuro ni sustituir una recuperación operativa; [registro](verificacion/ci-integracion.json).
- Completar despliegue, comprobaciones por HTTPS y entrega/recuperación por correo. El dominio propio está fuera de esta entrega.
- La protección de Auth contra contraseñas filtradas figura deshabilitada en el asesor y requiere plan Pro. Se conserva Free; [aviso y referencia oficial](verificacion/asesores-supabase.json). No representa una comprobación completa de seguridad.
- Consolidar correspondencia de AC/AP, recuperación operativa y revisión manual de accesibilidad. No se configuraron Jira ni QMetry; se conservan casos, incidencias y resultados reproducibles en el repositorio.

El [plan técnico](../plan.md), las [tareas](../tasks.md) y la [trazabilidad](calidad/trazabilidad.md) describen el cierre de cada requisito. Los informes del prototipo se conservan como antecedentes y no sustituyen las comprobaciones de esta integración.

La [renovación de sesiones](verificacion/renovacion-auth.md) conserva cookies ante límites temporales de Auth y detiene la solicitud con 503; tres casos con cliente SSR real y transporte simulado verifican límite, rechazo definitivo y renovación válida.
