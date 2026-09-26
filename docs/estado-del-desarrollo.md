# Estado del desarrollo

Actualizado: 26 de septiembre de 2026.

## Documentación disponible

- [Especificación funcional 1.0](../specification.md): 17 requisitos funcionales, 6 no funcionales y reglas de cuentas, recursos, participación, evaluación, juego, tareas, conservación y ayuda.
- [Decisión funcional](decisiones/0002-reglas-funcionales.md) y decisiones D-01 a D-07 definidas para construir. T-02 y E1-T01 completadas únicamente como trabajo documental.
- [Entrega 001](../specs/001-recurso-interactivo/spec.md) con recorrido, alcance incremental, permisos, estados, plan y tareas.
- [38 casos de 001](../specs/001-recurso-interactivo/aceptacion.md) y [38 casos del alcance completo](../specs/aceptacion-producto.md): 76 escenarios definidos; todos no ejecutados.
- [Plan de calidad](calidad/plan-de-calidad.md) y [matriz de trazabilidad](calidad/trazabilidad.md) con criterios fijados antes de medir y evidencias previstas por requisito.
- Supabase con PostgreSQL, Auth y Storage seleccionado; decisión en [ADR 0001](decisiones/0001-supabase.md). Playwright y GitHub Actions seleccionados para recorridos e integración continua.
- Procedimiento de cambios y commits en [CONTRIBUTING.md](../CONTRIBUTING.md); implementación organizada en [tareas](../tasks.md).

## Pendiente de construcción y validación

No hay aplicación, migraciones, proyecto Supabase configurado, biblioteca visual aprobada ni resultados de pruebas de Aulify en este repositorio. Las decisiones funcionales son la base de construcción; no acreditan validación con usuarios.

Next.js, React, TypeScript y bibliotecas de interfaz siguen sujetos al plan y a comprobación técnica. SMTP, transporte guiado, cuotas, respaldo, alojamiento y eliminación programada requieren pruebas y decisiones de implementación. No están configurados Jira, QMetry ni un flujo de Actions ejecutado.

## Siguiente entrega

Elaborar el modelo conceptual y relacional: entidades, cardinalidades, claves, restricciones, normalización, diccionario y matriz de permisos. Conservar diagramas editables y relacionarlos con requisitos. Después, concretar el esquema físico y sus migraciones junto con la comprobación técnica de Supabase.

Con esa base, trabajar fundamentos de marca conservando el logotipo y diseñar editor, participación y revisión en celular y computadora, incluidos estados vacíos, errores, ayuda y accesibilidad. Modelo y diseño deben acordar los mismos estados antes de construir el primer recorrido.

## Cómo actualizar este estado

Registrar archivos o cambios verificables, comandos/procedimientos, resultados y limitaciones. Vincular diagramas a sus fuentes editables y capturas a una versión ejecutada. Comprobar enlaces, conteos y ejemplos del spec solo acredita coherencia documental; no marcar casos funcionales como aprobados por esa revisión. Mantener abiertas las tareas hasta contar con la evidencia de sus criterios.
