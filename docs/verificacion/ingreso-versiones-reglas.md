# Ingreso a materias y reglas de actividades

Comprobaciones con cuatro cuentas ficticias y sesiones independientes en Supabase. Son pruebas de operaciones y datos; no sustituyen la revisión de la interfaz, el correo o las pruebas de carga.

| Caso | Resultado comprobado | Evidencia |
|---|---|---|
| AC-04 | Repetir solicitud y aprobación conserva una inscripción. Un pendiente no recibe ni abre actividades privadas; después de aprobar sí puede hacerlo. | [Secuencia final de ingreso](aceptacion-remota-ac-04.json). |
| AC-05 | El código anterior deja de funcionar; la renovación conserva acceso aprobado y solicitudes pendientes que después pueden aprobarse. | Mismo recorrido final. |
| AC-10 | Publicar V2 con otra solución y otro valor conserva V1, su intento y su nota 20/20. La actividad nueva usa V2 y obtiene 70/70. | [Lote original, caso AC-10](aceptacion-remota-ac-04-ac-10-ac-11-ac-36.json). |
| AC-11 | Una actualización y el primer inicio se enviaron en paralelo. Se observó actualización anterior al inicio; configuración, versión y nota resultaron coherentes. Una carrera no demuestra todas las intercalaciones. | Mismo lote, caso AC-11. |
| AC-36 | Tras iniciar se rechazan cambios de máximo, peso, intentos, retroalimentación, inclusión en promedio, propósito y mezcla. Configuración y versión originales intactas. | Mismo lote, caso AC-36. |

## Corrección encontrada

La primera aprobación devolvía el identificador de la inscripción, pero repetir la misma solicitud devolvía el identificador de la solicitud. La migración `20261018001349_aulify_membership_decision_receipt.sql` devuelve una inscripción consistente en ambos casos. No cambia tablas, relaciones ni privilegios. Tampoco agrega otra aprobación ni readmite automáticamente una inscripción retirada.

Diez comprobaciones [aisladas](aprobacion-repetida-aislada.json) verificaron el recibo repetido, ausencia de duplicados, permisos y retiro. La secuencia final de ingreso y renovación aprobó trece comprobaciones remotas después de aplicar esa migración. El [asesor de seguridad](seguridad-aprobacion-repetida.json) conserva el aviso previo de protección contra contraseñas filtradas; no se activó un plan de pago.

## Conservación de resultados anteriores

El lote original terminó fallido por AC-04; sus otros tres casos sí pasaron antes de la corrección y se identifican individualmente. Se conservan la [aserción inicial de acceso](aceptacion-remota-ac-04-contrato-inicial.json) y el [fallo real del recibo](aceptacion-remota-ac-04-antes-correccion.json). Las dos primeras revisiones del ejecutor distinguieron los metadatos de una solicitud pendiente del acceso al contenido y utilizaron el rechazo contractual `ACTIVITY_UNAVAILABLE`.

No se volvió a ejecutar todo el catálogo. Tras corregir el recibo se repitió únicamente AC-04/AC-05. Las materias ficticias de cada ejecución quedaron archivadas. Las credenciales no forman parte de estos informes.
