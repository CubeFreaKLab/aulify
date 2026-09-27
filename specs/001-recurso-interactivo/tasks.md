# Tareas de 001

Estado: especificación y modelo lógico 1.0 definidos; prototipo web 0.1.0 disponible. La integración con servicios sigue pendiente. Esta lista desglosa parte de [las tareas generales](../../tasks.md) sin cerrar las funciones posteriores.

| ID | Entrega | Dependencias | Criterio de cierre | Estado |
|---|---|---|---|---|
| E1-T01 | Definir D-01 a D-07 y ajustar casos | — | Decisiones, cálculos y permisos documentados; ayuda por rol incorporada. | Completada en documentación; no implementada. |
| E1-T02 | Modelo conceptual, relacional, normalización y permisos | E1-T01 en decisiones de datos | [Modelo](../../docs/modelado/README.md), claves, cardinalidades, diccionario, normalización y matriz de acceso; [verificación estructural](../../docs/modelado/verificacion.md). | Completada como modelado documental; políticas ejecutables y pruebas en E1-T04/E1-T05. |
| E1-T03 | Conceptos, fundamentos visuales y recorridos | Spec; E1-T01 en decisiones de interacción | Diseño revisado de editor, participación y resultados, con móvil, escritorio y estados de error. | Prototipo implementado y comprobado técnicamente; aprobación visual pendiente. |
| E1-T04 | Comprobar correo, alojamiento y base técnica | Selecciones del plan | Registro/recuperación y acceso restringido probados con datos ficticios; versiones y resultados registrados. | Pendiente. |
| E1-T05 | Base de aplicación, migraciones iniciales y CI | E1-T02, E1-T04 | Construcción reproducible, entorno aislado, primer informe real de Actions y esquema comprobado. | Pendiente. |
| E1-T06 | Acceso y recuperación | E1-T03, E1-T05 | AC-01 a AC-03; controles de autenticación accesibles y resultados documentados. | Pendiente. |
| E1-T07 | Materias, invitación y aprobación | E1-T06 | AC-04 a AC-06; dos materias separadas y operaciones no autorizadas rechazadas. | Pendiente. |
| E1-T08 | Biblioteca, bloques, borradores y versiones | E1-T03, E1-T07 | AC-07 a AC-11; diseño y datos conservan lo publicado y detectan conflicto. | Pendiente. |
| E1-T09 | Configuración, participación y reconexión | E1-T08 | AC-12 a AC-20; secuencia interactiva sin pérdidas, duplicados ni soluciones filtradas. | Pendiente. |
| E1-T10 | Corrección, publicación y promedio | E1-T09 | AC-21 a AC-26; cálculos exactos y versiones de notas coherentes. | Pendiente. |
| E1-T12 | Implementar ayuda por rol y estados vacíos | E1-T03, E1-T06 a E1-T10 | AC-31 a AC-34; preferencia persistente, accesibilidad y ausencia de efectos sobre datos. | Pendiente. |
| E1-T11 | Revisión integrada y evidencia | E1-T06 a E1-T10, E1-T12 | AC-27 a AC-38 y regresión de casos previos; barreras corregidas, pendientes explícitos y documentación alineada. | Pendiente. |

Las comprobaciones de diseño y accesibilidad también forman parte de cada función. E1-T11 reúne la evaluación integrada, no autoriza aplazar todas las comprobaciones hasta el final.

La [matriz del prototipo](../../docs/diseno/pantallas-y-estados.md) y su [informe de pruebas](../../docs/verificacion/pruebas-prototipo.md) registran avances parciales de E1-T05 a E1-T12. La persistencia de muestra y la selección de perfiles no cierran autenticación, permisos, concurrencia o persistencia remotos. Los casos AC conservan su estado integrado pendiente.

Al terminar una tarea, registrar cambios, casos ejecutados, resultado y evidencia reproducible en el estado de la entrega. No marcar como terminada por existir este documento o por haberse creado un commit.
