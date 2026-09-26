# Base funcional 1.0

Fecha: 26 de septiembre de 2026.

Estado: decisiones operativas definidas para modelado y desarrollo. Validación técnica y de uso pendientes.

## Contexto

El producto tenía funciones descritas, pero quedaban sin fijar valores iniciales, transiciones y reglas de evaluación. Implementar con esas ambigüedades podía producir comportamientos incompatibles entre participación, notas y clasificación.

## Decisión

Usar [specification.md](../../specification.md) versión 1.0 como referencia funcional. La [entrega 001](../../specs/001-recurso-interactivo/spec.md) detalla su primer recorrido y las decisiones D-01 a D-07. Las ampliaciones conservan criterios propios en la [aceptación del alcance completo](../../specs/aceptacion-producto.md).

- Confirmar correo y mantener un perfil principal; ingreso a materias por código y aprobación.
- Establecer tres intentos en práctica y uno en examen como valores configurables. La práctica queda fuera del promedio inicialmente.
- Publicar versiones inmutables y congelar reglas desde el primer intento; registrar ampliaciones de plazo y revisiones de evaluaciones.
- Confirmar una respuesta y avanzar sin una pantalla intermedia de guardado; recuperar envíos confirmados ante desconexión.
- Derivar notas de puntos con redondeo definido y promedio ponderado sobre 100. Pendiente y no participación no equivalen a cero automático.
- Separar puntos de juego, nota publicada y revisión de respuestas; restringir rachas y clasificación cuando revelen información reservada.
- Permitir recursos de lectura sin quiz. Definir tareas, equipos, potenciadores, filtros, conservación y ayuda opcional por rol con reglas comprobables.

## Motivos y alternativas

Los valores iniciales reducen decisiones repetitivas, conservando opciones avanzadas. No se eligieron intentos ilimitados ni calificación cero automática de quien no participa. Separar versiones y publicación permite corregir sin reemplazar silenciosamente lo que vio un estudiante. La guía acompaña el uso, pero completarla no es requisito de acceso.

Las reglas son decisiones de producto para construir; no representan hallazgos de una evaluación con usuarios. Los límites iniciales de contenido y archivos se comprobarán con las cuotas y la experiencia real. Si requieren cambios, se versionarán antes de modificar el comportamiento.

## Consecuencias

El modelo debe representar estados independientes de participación, corrección y publicación, así como versiones, consumo de potenciadores y permisos. El diseño debe mostrar opciones compatibles y estados pendientes sin inducir a error. Los [criterios de calidad](../calidad/plan-de-calidad.md) y la [trazabilidad](../calidad/trazabilidad.md) vinculan esas reglas con comprobaciones futuras.

Esta decisión cierra la definición funcional inicial. No selecciona bibliotecas, configura servicios ni acredita pruebas ejecutadas; esas decisiones requieren diseño, modelado y comprobación técnica.
