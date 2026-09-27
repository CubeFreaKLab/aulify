# Estado del desarrollo

Actualizado: 27 de septiembre de 2026 · prototipo web 0.1.0.

## Disponible para explorar

Aulify dispone de una aplicación ejecutable con Next.js, React y TypeScript. La portada, el espacio docente y la participación estudiantil comparten marca e Inter, con composiciones distintas. El [manual de la demostración](prototipo/uso-y-limites.md) explica cómo ejecutarla y recorrerla.

- Portada ilustrada, demostración pública de preguntas y formularios de acceso con validación local.
- Materias, solicitud por código y aprobación; biblioteca con búsqueda, copias y vista previa.
- Editor por bloques con guardado automático, formato enriquecido, reordenamiento sin arrastre y versiones de publicación.
- Ocho tipos de pregunta; avance individual y sesión guiada entre pestañas del mismo navegador; pista y doble con límite de uso.
- Revisión manual, publicación de notas y resultados propios. Promedios separados por materia y estudiante, filtros y gráficos con tabla equivalente.
- Tareas con metadatos de archivo de muestra, revisión y publicación de nota. Ayuda inicial por rol que puede omitirse y reabrirse.

Los datos son ficticios, persisten en el navegador y pueden reiniciarse. La selección de perfil facilita revisar ambos recorridos; todavía no hay autenticación ni autorización de servidor. La [matriz de pantallas](diseno/pantallas-y-estados.md) distingue cada interacción operativa de sus dependencias pendientes.

## Evidencia y decisiones

Las [pruebas del prototipo](verificacion/pruebas-prototipo.md) registran las ejecuciones de Vitest y Playwright, axe, los fallos encontrados y su corrección. La comprobación local de tipos, análisis estático y construcción se completó sin errores. La configuración de [GitHub Actions](../.github/workflows/web.yml) ejecuta estas comprobaciones y los recorridos sobre la aplicación compilada; su resultado remoto se registra por ejecución en el informe.

La [dirección visual](diseno/direccion-visual.md), los [componentes y assets](diseno/recursos-y-componentes.md) y el [ADR 0004](decisiones/0004-base-web.md) documentan lo incorporado. Los conceptos generados son referencias visuales; las capturas del navegador muestran componentes y controles reales. La revisión técnica de estas pantallas no equivale a aprobación visual del producto ni a una evaluación de usabilidad con personas.

## Base funcional y modelado

- [Especificación 1.0](../specification.md): 17 requisitos funcionales y 6 no funcionales. [Reglas y decisiones](decisiones/0002-reglas-funcionales.md) D-01 a D-07.
- [Entrega 001](../specs/001-recurso-interactivo/spec.md), [38 casos AC](../specs/001-recurso-interactivo/aceptacion.md) y [38 casos AP](../specs/aceptacion-producto.md). Los 76 casos integrados del producto siguen pendientes; las pruebas de demostración no los cierran.
- [Modelo conceptual y relacional 1.0](modelado/README.md): 44 relaciones propias y una identidad externa, normalización, diccionario, invariantes, permisos y diez diagramas con fuentes editables. [Verificación documental](modelado/verificacion.md) disponible.
- [Plan de calidad](calidad/plan-de-calidad.md), [trazabilidad](calidad/trazabilidad.md) y [tareas](../tasks.md) conservan los criterios del producto completo.

## Siguiente integración

T-01 continúa pendiente. La [inspección de servicios](verificacion/viabilidad-servicios.md) encontró el motor Docker local inaccesible y ninguna conexión de prueba de Aulify configurada. No se ejecutaron migraciones, RLS, almacenamiento privado ni recuperación por correo.

El siguiente recorrido es una integración vertical con Supabase: identidad, materia, solicitud y aprobación; lectura y escritura autorizadas; archivo privado. Debe usar migraciones versionadas, cuentas ficticias de distintos roles y casos permitidos/denegados. Después se sustituirá el adaptador local conservando los contratos y se repetirán los recorridos con servicios reales.

Quedan además pendientes sincronización entre dispositivos, límites de red y servicio, conservación y eliminación programadas, juego por equipos y clasificación, pruebas de carga y operación. La entrega actual no despliega producción ni demuestra esos comportamientos.

Figma editable queda pendiente de conexión al archivo y cuenta correctos. Los SVG, tokens y pantallas existentes son materiales de partida. No hay capturas ni un archivo de Figma creado como parte de esta implementación. Jira y QMetry tampoco se han configurado.

## Criterio de actualización

Registrar versión, entorno, procedimiento, resultado y límites de cada comprobación. Mantener separadas la documentación del modelo, las pruebas locales del prototipo y las pruebas integradas del producto. Una captura, un commit o una biblioteca por sí solos no acreditan una función completa.
