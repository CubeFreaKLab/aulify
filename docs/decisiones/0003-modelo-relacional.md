# Modelo relacional con versiones y publicación separadas

Fecha: 26 de septiembre de 2026.

Estado: modelo conceptual y lógico definido. Esquema físico, migraciones y permisos ejecutables pendientes de validación.

## Problema

Aulify debe conservar recursos editables, actividades ya respondidas, correcciones manuales y notas publicadas sin que un cambio silencioso altere el historial. También debe admitir retiro y reingreso sin reiniciar intentos o potenciadores y permitir eliminar una materia sin perder la biblioteca del docente.

## Decisión

Adoptar el [modelo 1.0](../modelado/README.md), organizado en identidad, autoría, actividades, participación, evaluación y operación. Usar identidades estables, claves candidatas de pertenencia y claves compuestas para preguntas y elementos de una versión.

Separar recurso, borrador y versión publicada; actividad y participante; intento, respuesta y revisión de puntos; evaluación propuesta y publicación. El resultado publicado enlaza las correcciones concretas que lo sustentaron. Las soluciones y guías se conservan fuera del contenido público.

Los puntos parciales se representan mediante numerador y denominador enteros para no redondear antes de obtener la nota final. El promedio y la clasificación se derivan de sus fuentes, con proyecciones de lectura autorizadas.

El borrador, formato de bloques, orden presentado y payload de respuesta usan agregados JSONB tipados. Mantener relacionales las identidades, versiones, pertenencias, elementos y evaluaciones; documentar expresamente excepciones a normalización estricta y sus invariantes.

## Alternativas consideradas

- **Una fila mutable con nota actual:** simplifica lectura, pero pierde qué corrección sustentó una publicación anterior.
- **Un documento único con todos los datos:** mezcla permisos, soluciones y pertenencias; dificulta integridad relacional y consultas de seguimiento.
- **Normalizar cada marca tipográfica del editor:** añade relaciones de presentación sin una necesidad de consulta del producto. Mantener un agregado validado resulta más adecuado para autoría.
- **Guardar todos los puntos con dos decimales:** introduce redondeo intermedio en relaciones y secuencias; la especificación exige redondear solo al final.

## Consecuencias

El esquema completo tiene 44 relaciones propias, implementables por entregas. La complejidad se concentra en versiones, permisos y operaciones atómicas, con diagramas divididos por área. Las FK no sustituyen la verificación de pertenencia entre rutas ni la congelación de reglas; [restricciones](../modelado/restricciones.md) distingue los mecanismos pendientes.

Los archivos tienen un ciclo coordinado entre Storage y PostgreSQL. No declarar purga completa por borrar filas. Tampoco exportar el DBML como si fuera una migración lista: faltan CHECK, índices parciales, funciones, GRANT y RLS comprobados.

## Verificación

La [verificación del modelo](../modelado/verificacion.md) registra comprobaciones documentales y de estructura. Las pruebas de concurrencia, autorización, cálculo y recuperación contra PostgreSQL siguen pendientes. Esta decisión no configura servicios externos ni acredita una plataforma funcionando.
