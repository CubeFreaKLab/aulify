# Aulify

El aula digital, más simple e interactiva.

Aulify es una plataforma web para docentes y estudiantes de secundaria. Su recorrido principal une recursos de clase por bloques, preguntas interactivas y revisión de resultados, con una experiencia adaptable a celular y computadora.

## Funciones previstas

- Recursos con explicaciones, imágenes, enlaces y preguntas; borradores, vista previa y versiones publicadas.
- Quizzes de práctica y examen con modos de avance y reglas configurables.
- Materias con invitaciones y aprobación de estudiantes.
- Tareas, corrección manual, publicación de calificaciones y seguimiento con gráficos y tablas.
- Controles de accesibilidad, recuperación ante desconexiones y separación de permisos entre cuentas.

## Estado

En especificación y diseño. Todavía no hay una aplicación ejecutable ni pruebas de funcionamiento realizadas. Las funciones anteriores describen el alcance previsto.

Supabase con PostgreSQL, Auth y Storage, Playwright y GitHub Actions están seleccionados. La aplicación con Next.js, React y TypeScript sigue como propuesta técnica; el proveedor de correo y el transporte de sesiones requieren comprobación.

## Documentación del producto

| Documento | Contenido |
|---|---|
| [Producto y vocabulario](docs/producto.md) | Usuarios, alcance y conceptos. |
| [Principios](docs/principios.md) | Usabilidad, accesibilidad, control de las actividades y consistencia. |
| [Especificación general](specification.md) | Requisitos funcionales y reglas transversales. |
| [Plan técnico](plan.md) | Arquitectura propuesta, datos, permisos y pruebas. |
| [Tareas](tasks.md) | Dependencias y criterios de finalización. |
| [Ruta de desarrollo](docs/ruta-de-desarrollo.md) | Entregas y criterios de revisión. |
| [Estado del desarrollo](docs/estado-del-desarrollo.md) | Qué está definido, implementado y pendiente. |
| [Costos de servicios](docs/costos-servicios.md) | Planes, cuotas y referencias oficiales. |
| [Decisión sobre Supabase](docs/decisiones/0001-supabase.md) | Motivos y consecuencias de la selección. |

El desarrollo sigue especificaciones verificables: comportamiento esperado, solución técnica, tareas, implementación y comprobación. Las pautas para cambios y commits están en [CONTRIBUTING.md](CONTRIBUTING.md).
