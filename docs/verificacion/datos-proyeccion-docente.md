# Verificación del agregado de intentos docentes

Fecha: 28 de septiembre de 2026. Migración preparada: `20260928130653_aulify_teacher_attempt_projection.sql`. La aplicación remota está pendiente de revisión.

La migración reúne los intentos de una actividad mediante agregados sobre preguntas, respuestas, revisiones y ampliaciones de plazo. Solo utiliza esa consulta en la rama del docente propietario. Conserva la autorización actual, los campos devueltos, los datos permitidos al estudiante y los serializadores de las confirmaciones. No modifica tablas, contadores de revisión, puntuación, bloqueos ni claves idempotentes.

`app.activity_attempts_json(uuid, boolean, uuid)` es un helper privado: no tienen permiso de ejecución los roles `anon`, `authenticated` ni `PUBLIC`. El wrapper público existente sigue siendo `SECURITY INVOKER`; su contrato no cambia. El modelo conserva 44 relaciones de dominio y tres relaciones técnicas.

## Comprobaciones aisladas

```sh
node tools/datos/check.mjs --report docs/verificacion/datos-aislados-migracion14.json
node tools/datos/teacher-projection-check.mjs
```

Las **84 regresiones generales** aprobaron con las catorce migraciones: [evidencia](datos-aislados-migracion14.json). La serie anterior de doce migraciones permanece conservada en su informe original.

Las **26 comprobaciones específicas** también aprobaron: [evidencia diferencial](datos-proyeccion-docente-aislada.json). El programa conserva una copia aislada de la función anterior y compara su respuesta con la nueva. Solo excluye el reloj de transporte `state.revision` y normaliza el orden no contractual de la colección de intentos; mantiene los órdenes de preguntas, opciones, respuestas y revisiones.

La comparación cubre actividad sin intentos, órdenes de opciones mezcladas, varios intentos y estudiantes, respuestas automáticas y escritas, relaciones con puntuación parcial, doble y pista, historial manual con actor y motivo, publicación de notas, datos ocultos, equipos e incidencias. Incluye ampliaciones globales y personales, vencimiento con omisiones, retiro, resolución administrativa y archivo. Las pruebas negativas ejecutan los roles reales `authenticated` y `anon`: no basta con cambiar `auth.uid()` mientras se conserva el rol administrador.

## Alcance de los resultados

La base se ejecutó en memoria mediante PGlite 0.5.8 con esquemas mínimos de Auth y Storage. Estas comprobaciones verifican la transformación y sus permisos en ese entorno; no prueban concurrencia ni capacidad remota.

El [diagnóstico previo](datos-perfil-sql-aislado.md) midió una reducción local del p95 docente de 36,75 a 23,26 ms con cincuenta participantes. Es una medición del prototipo equivalente, no una nueva prueba de capacidad ni un resultado del proyecto remoto. Q-06 continúa sin aprobarse hasta que se ejecute y satisfaga el protocolo completo con sus umbrales vigentes.
