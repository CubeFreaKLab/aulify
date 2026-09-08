# Contexto de Aulify

## Identidad y propósito

**Aulify** es una plataforma web para la creación de recursos de clase interactivos en educación secundaria.

Título del proyecto: **Desarrollo de la plataforma web Aulify para la creación de recursos de clase interactivos en educación secundaria**.

El recorrido central es preparar un recurso con explicaciones y preguntas, compartirlo con una materia, participar y revisar respuestas y resultados. La facilidad de uso, la comprensión y la accesibilidad son prioridades para ambos roles, en celular y computadora.

## Usuarios

- **Docente:** organiza materias, crea y publica recursos, configura actividades, revisa entregas y respuestas, publica calificaciones y consulta gráficos.
- **Estudiante:** utiliza una cuenta, solicita incorporarse a una materia, participa en actividades, entrega tareas y consulta sus calificaciones publicadas.

## Alcance

- Cuentas con correo y contraseña, recuperación por correo y elección del perfil durante el registro.
- Materias con detalles configurables de curso y año; ingreso de estudiantes mediante código y aprobación del docente.
- Archivado de materias recuperables durante 30 días y eliminación al vencer el plazo, con conservación de los recursos independientes de la biblioteca.
- Editor de recursos por bloques, guardado automático de borradores, vista previa, publicación explícita y conservación de versiones utilizadas.
- Biblioteca personal con quizzes independientes o integrados en recursos, y reutilización entre materias mediante copias editables por separado.
- Quizzes de práctica y examen con avance guiado, avance individual y disponibilidad autónoma por fechas.
- Tipos de pregunta cerrados y escritos, con corrección automática o manual según su naturaleza y configuración.
- Clasificación, equipos, rachas y bonificaciones configurables.
- Configuración básica de actividades con opciones avanzadas desplegables y resumen de reglas antes de iniciar.
- Tareas con archivos y actividades de calificación manual.
- Publicación de notas individuales y promedios ponderados sobre 100.
- Gráficos de evolución, distribución de notas y estado de entregas, acompañados de tablas y filtros.
- Reportes de posibles irregularidades para evaluación del docente dentro de la plataforma.

Las reglas detalladas y sus pendientes se mantienen en [specification.md](specification.md). Los principios de diseño y desarrollo se encuentran en [constitution.md](constitution.md).

## Referencias de diseño

La identidad visual de Aulify orienta la presentación. Wayground es una referencia de interacción para el quiz; el alcance funcional se determina mediante la especificación.

## Desarrollo

Método: Spec Driven Development (SDD).

Estado: planificación; sin aplicación implementada.

Opciones tecnológicas por evaluar: React, Next.js, TypeScript, Node.js y Firebase. El [plan técnico](plan.md) presenta una propuesta modular y la alternativa de almacenamiento de archivos por comprobar. El alcance no exige microservicios.

El inicio utilizará planes gratuitos. Los [costos de referencia](docs/costos-servicios.md) distinguen licencias, planes, cuotas y alternativas de pago. La carga objetivo es de 50 estudiantes por actividad y cuatro actividades simultáneas; se trata de una meta de prueba y no de una capacidad ya validada.

## Vocabulario

| Término | Significado |
|---|---|
| Materia | Espacio del docente que reúne estudiantes, recursos, actividades y resultados para un grupo, con curso y año configurables. |
| Curso | Detalle de organización de una materia utilizado en filtros y análisis. |
| Recurso | Contenido de clase compuesto por bloques. |
| Bloque | Unidad de contenido, como título, texto, imagen, video enlazado o pregunta. |
| Quiz | Actividad interactiva de preguntas que puede utilizarse como práctica o examen. |
| Intento | Participación de un estudiante en un quiz, con respuestas y estado propios. |
| Tarea | Actividad que recibe archivos y requiere calificación manual. |
| Puntos del juego | Puntuación asociada al desempeño y a las mecánicas de la actividad. |
| Calificación | Resultado académico de una actividad, con un máximo y un peso configurables. |
| Clasificación provisional | Orden de participantes cuyos resultados aún pueden cambiar por corrección pendiente. |
