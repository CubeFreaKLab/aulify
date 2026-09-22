# Aulify

Plataforma web para crear recursos de clase interactivos en educación secundaria, con una experiencia comprensible y accesible para docentes y estudiantes.

El producto reúne un editor por bloques, quizzes configurables, materias, tareas, calificaciones y gráficos de seguimiento. Su diseño contempla celular y computadora.

## Documentación

| Documento | Contenido |
|---|---|
| [Producto y vocabulario](docs/producto.md) | Propósito, alcance, usuarios y vocabulario del producto. |
| [Principios](docs/principios.md) | Principios de diseño y desarrollo. |
| [specification.md](specification.md) | Requisitos funcionales, criterios de comprobación y reglas pendientes. |
| [plan.md](plan.md) | Propuesta de arquitectura, datos, pruebas y decisiones técnicas pendientes. |
| [tasks.md](tasks.md) | Secuencia de trabajo con dependencias y evidencia de finalización. |
| [docs/ruta-de-desarrollo.md](docs/ruta-de-desarrollo.md) | Entregas propuestas, evaluación de tecnologías, diseño y documentación verificable. |
| [docs/costos-servicios.md](docs/costos-servicios.md) | Planes gratuitos, opciones de pago y fuentes oficiales. |
| [docs/decisiones/0001-supabase.md](docs/decisiones/0001-supabase.md) | Selección de PostgreSQL, Auth y Storage de Supabase y comprobaciones pendientes. |
| [docs/estado-del-desarrollo.md](docs/estado-del-desarrollo.md) | Estado comprobado, pendientes y siguiente entrega. |

## Estado

Planificación. Existen borradores de principios, especificación, plan técnico y tareas. Se seleccionaron PostgreSQL, Auth y Storage de Supabase, Playwright y GitHub Actions. Los costos de servicios tienen fuentes oficiales y el proveedor de correo sigue pendiente. Todavía no hay una aplicación implementada, un flujo de integración continua ejecutado ni pruebas de capacidad realizadas.

## Método de desarrollo

El desarrollo se organiza mediante Spec Driven Development (SDD): definir el comportamiento esperado, diseñar una solución técnica, dividirla en tareas verificables e implementar contra la especificación.

Las reglas pendientes se resolverán antes de implementar las funciones afectadas. El primer paso de ejecución es comprobar la viabilidad del despliegue gratuito y del almacenamiento de archivos descritos en plan.md.
