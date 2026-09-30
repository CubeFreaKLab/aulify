# Proyección local de la actividad del estudiante

La candidata `aulify_student_activity_projection` conserva el contrato de `app.student_activity(uuid)` y evita generar dos veces las preguntas de los bloques ordinarios. Se creó con Supabase CLI 2.118.0 mediante `migration new aulify_student_activity_projection`. Esta verificación no aplica cambios remotos.

## Cambio

La función conserva autorización, publicación, cierre por plazo, selección del último intento, consulta ordenada de `present_question`, intentos restantes y potenciadores. Proyecta directamente título, documento del editor y bloques, usando en cada bloque quiz las mismas preguntas `q` que devuelve en la raíz. Ya no llama a `version_json(false)` para producir campos descartados y preguntas que después se reemplazaban.

Se mantienen las combinaciones de propiedades y el orden de los bloques. Con cero bloques se conserva el resultado histórico: título, bloques y documento del editor son `null`, mientras las preguntas de la raíz siguen siendo un array. Los cuerpos quiz que son JSON `null`, arrays o escalares conservan una rama de compatibilidad: el operador de concatenación producía un array y la función anterior no sustituía sus preguntas. Sólo esa forma excepcional mantiene la serialización original. El publicador actual produce cuerpos objeto.

No se añade un helper ni se cambia `version_json`, `question_json`, `present_question`, ACL o una función pública. `CREATE OR REPLACE` conserva el OID, los permisos, la volatilidad, `SECURITY DEFINER` y `search_path` vacío.

## Evidencia local

Comando reproducible desde la raíz del repositorio:

```sh
node tools/datos/student-activity-projection-check.mjs
```

Resultado: **55 comprobaciones aprobadas**. El script reconoce la candidata por el sufijo `_aulify_student_activity_projection.sql`, incluso después de un renombrado de su timestamp. El control contiene exactamente las 18 migraciones hasta `20260930000631_aulify_teacher_review_projection.sql`; la migración independiente de sincronización queda excluida y se registra como tal en el JSON.

La matriz comprende:

- Las ocho variantes serializadas: selección simple y múltiple, verdadero/falso, relaciones, orden, espacios con opciones, espacios escritos y respuesta abierta; sin soluciones, guías, explicaciones o pistas privadas.
- Ausencia de participante, participante sin intento, intento activo, orden inverso de preguntas y opciones, orden ausente o vacío, varios intentos, respuesta y ambos potenciadores, límite agotado y sesión guiada.
- Vencimiento global e individual, omisiones generadas y ampliación personal. Control y candidata parten del mismo savepoint y usan el mismo `now()`; también se comparan los efectos en intentos, calificaciones y contadores.
- Varios bloques quiz y grupos; bloques de texto, encabezado, lista, vídeo e imagen; documento del editor; ausencia de quiz, de bloques, de preguntas o de versión; cuerpos JSON no objeto y valores nulos.
- Snapshot público y comando `readActivity`; materia archivada o en purga, membresía retirada o ausente, actividad ausente/no publicada, identificador nulo, docente ajeno, correo no confirmado, ausencia de UID, rol anónimo y prohibición de invocar el helper privado.

La proyección privada se compara completa, sin normalizar su contenido. En el snapshot público sólo se excluye `state.revision`, un reloj wall-clock ajeno al cambio; se conserva el orden de todos los arrays. Al comparar efectos internos se excluye únicamente el UUID aleatorio de las nuevas filas de calificación, que no forma parte del payload estudiantil comparado.

Un wrapper contador sobre `question_json`, instalado y revertido únicamente en la base de prueba, verifica **16 → 8 llamadas** para ocho preguntas y un bloque quiz ordinario. Es evidencia de eliminación de trabajo duplicado, sin atribuir una mejora de latencia.

El [resultado estructurado](datos-proyeccion-actividad-estudiante-local.json) contiene la lista de migraciones, SHA-256 de la candidata, cada comprobación y las limitaciones. PGlite usa Auth/Storage mínimos y datos ficticios: esta prueba no verifica JWT reales, concurrencia, latencia HTTP, ACK ni capacidad Q-06. No cambia los criterios de Q-06.
