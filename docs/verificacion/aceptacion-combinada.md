# Comprobación conjunta de reglas de participación

La ejecución del 2 de octubre utilizó sesiones independientes de cuatro cuentas ficticias en Supabase. Cada caso creó sus propias materias y las archivó al terminar. Los ensayos comprueban contratos remotos; no equivalen a interacción visual, correo ni capacidad sostenida.

| Caso | Resultado comprobado | Evidencia |
|---|---|---|
| AP-08 | Nueve comprobaciones: grupos dependientes consecutivos, opciones y explicación conservadas; nuevo acceso recupera el mismo intento, orden y plazo. | [Ejecución posterior a la corrección](aceptacion-remota-ap-08.json). |
| AP-20 | Ocho comprobaciones: composición del equipo bloqueada al comenzar, listas intactas y acceso limitado por rol. | [Ejecución conjunta](aceptacion-combinada-remota.json). |
| AP-25 | Cinco comprobaciones: nota manual individual, cero motivado y publicación; otro estudiante queda pendiente sin fabricar una entrega ni un intento. | [Ejecución conjunta](aceptacion-combinada-remota.json). |
| AP-29 | Catorce comprobaciones: retiro, evaluación o exclusión con motivo, omisiones y readmisión sin devolver intentos ni usos de pista/doble. | [Ejecución conjunta](aceptacion-combinada-remota.json). |
| AP-30 | Cinco comprobaciones: archivo con intento abierto, restauración con intento cerrado y plazos intactos. | [Ejecución conjunta](aceptacion-combinada-remota.json). La confirmación visual de archivo conserva su evidencia separada. |
| AP-37 | Catorce comprobaciones: diez códigos inválidos, rechazo de la siguiente comprobación, renovación y aprobación de una solicitud pendiente conservada. | [Caso con cuenta de comprobación independiente](aceptacion-remota-ap-08-ap-37.json). |

## Corrección del orden de los grupos

La primera ejecución detectó que dos preguntas del mismo grupo dependiente podían quedar separadas. La consulta generaba el valor aleatorio durante la unión de filas, en lugar de calcularlo una sola vez por grupo. La migración `20261002215000_aulify_stable_group_shuffle.sql` materializa primero el orden de grupos y mantiene dentro de cada uno el orden de preguntas. Conserva el orden ya guardado de intentos anteriores.

La migración está aplicada en Supabase. El helper continúa siendo privado, ejecutable por su propietario. La regresión aislada de juego aprobó nueve secuencias y 103 comprobaciones; el ensayo remoto posterior aprobó AP-08. La verificación aislada no se suma como una segunda prueba remota.

El registro inicial conserva el fallo real de AP-08. Una ejecución posterior se detuvo por el límite de comprobaciones de código ya utilizado; AP-37 se repitió con una cuenta ficticia nueva y AP-08 tras finalizar el intervalo. Se mantiene esa distinción para no presentar un fallo de preparación como una corrección del producto.

## Señales de visibilidad

La ejecución conjunta añade dos comprobaciones remotas con el registro desactivado: el comando no crea la señal y la proyección no contiene eventos. La frontera y conservación de resolución se verificaron anteriormente en [SQL aislado y una transacción remota reversible](conservacion-senales.md). Estos ensayos cubren partes complementarias de AP-28; la transacción remota utiliza rol SQL y no autentica un JWT por la red.

Los informes conservan la huella del script ejecutado antes de aplicar únicamente formato. Las cuentas, contraseñas y referencias de preparación permanecen en archivos privados excluidos de Git.
