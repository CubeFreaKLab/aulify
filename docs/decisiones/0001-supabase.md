# Selección de Supabase para datos identidad y archivos

Fecha: 22 de septiembre de 2026.

Estado: decisión aceptada. Implementación y comprobación de la configuración gratuita pendientes.

## Contexto

Aulify relaciona docentes, estudiantes, materias, membresías, versiones de recursos, actividades, intentos, respuestas, entregas y calificaciones. Requiere consultas combinadas, integridad de relaciones y operaciones coherentes de evaluación. El modelo debe poder describirse mediante entidades, cardinalidades, claves, dependencias funcionales y normalización.

## Decisión

Utilizar PostgreSQL de Supabase para la persistencia, Supabase Auth para correo y contraseña y Supabase Storage para archivos privados. El punto de partida será Free. La sincronización de sesiones y el proveedor de correo se definirán mediante pruebas específicas.

La selección sustituye la propuesta de Firebase Authentication y Firestore con almacenamiento externo. Como todavía no hay una aplicación implementada, no existe una migración de datos productivos que ejecutar.

## Motivos

El modelo relacional se ajusta a la pertenencia a materias, las referencias entre versiones y respuestas y las consultas de notas. PostgreSQL permite expresar claves y restricciones en el esquema y conservar sus cambios mediante migraciones SQL. Supabase reúne autenticación, base de datos y almacenamiento bajo un mismo servicio, reduciendo la integración entre proveedores.

Firestore permite modelar información y relaciones, pero requiere decisiones propias de una base documental. La selección de PostgreSQL responde al dominio y al mantenimiento del esquema; la elección del servicio no produce automáticamente un modelo normalizado.

## Consecuencias

- Diseñar modelo conceptual, esquema relacional, normalización y diccionario de datos antes de implementar la persistencia de cada entrega.
- Versionar migraciones y mantener los diagramas alineados con el esquema ejecutado.
- Definir RLS en tablas expuestas y políticas en Storage; verificar cuentas sin acceso, integrantes aprobados, estudiantes ajenos y docentes propietarios.
- Mantener claves administrativas fuera del cliente. Las operaciones privilegiadas del servidor deben comprobar la autorización.
- Evaluar JSONB únicamente para estructuras que lo justifiquen, como el contenido versionado de bloques, sin sustituir las relaciones académicas ni exponer soluciones.
- Configurar correo mediante SMTP y verificar recuperación con usuarios de prueba.
- Resolver el transporte para cuatro actividades de 50 estudiantes más sus docentes: el límite de 200 conexiones de Realtime Free no cubre 204 conexiones simultáneas.
- Comprobar cuotas, pausa por inactividad, exportación, respaldo y recuperación; la selección no acredita capacidad ni disponibilidad.

## Condición de comprobación

Registrar resultados de acceso, recuperación, pertenencia, archivo privado, restricciones, RLS, respuesta idempotente y sincronización. Ejecutar las pruebas pertinentes con datos ficticios y conservar la versión y el entorno. Si una restricción impide cumplir el alcance gratuito, documentar alternativas sin activar facturación ni alterar requisitos de manera implícita.

El [plan técnico](../../plan.md), las [tareas](../../tasks.md) y los [costos](../costos-servicios.md) desarrollan esta decisión.

## Fuentes

- [Base de datos PostgreSQL de Supabase](https://supabase.com/docs/guides/database/overview).
- [Tablas y relaciones](https://supabase.com/docs/guides/database/tables).
- [Seguridad por fila](https://supabase.com/docs/guides/database/postgres/row-level-security).
- [Correo SMTP](https://supabase.com/docs/guides/auth/auth-smtp).
- [Cuotas de Realtime](https://supabase.com/docs/guides/realtime/limits).
- [Planes y cuotas](https://supabase.com/pricing).
