# Proyección estudiantil aplicada en Supabase

La migración `20260930011205_aulify_student_activity_projection.sql` se aplicó el 30 de septiembre de 2026 UTC. El historial remoto contiene veinte migraciones. El archivo creado previamente por CLI se renombró para coincidir con el historial del servicio; conserva el SHA-256 `d3b41c91c645cf1ec69af3512fa9d638967037de0e108162c1cbabac33c80fb5`.

La primera solicitud de aplicación tuvo un error de conexión. Una consulta posterior al historial y a la definición de la función comprobó que todavía había diecinueve migraciones y que el cambio no estaba aplicado. Tras recuperarse el acceso, la segunda solicitud terminó correctamente. No se repitió la escritura sin comprobar antes el estado.

## Comparación y permisos

Se comparó `app.student_activity(uuid)` antes y después con la misma actividad y el mismo estudiante ficticio. Ambas proyecciones ocuparon **10.718 bytes** y produjeron el resumen MD5 `7b9716959ff5d96f08f4582f945d2a42`. La comparación se hizo por SQL administrativo con el identificador de la cuenta en el contexto de autorización, dentro de una transacción revertida. Comprueba equivalencia del contenido de ese caso; no representa una sesión JWT ni una prueba de navegador.

La consulta de permisos confirmó que `authenticated` y `anon` siguen sin poder ejecutar directamente el helper privado. Se conserva `SECURITY DEFINER` y el contexto de búsqueda vacío. Un intento directo desde `authenticated` también recibió el rechazo esperado de permisos.

El asesor de seguridad mantiene los **41 hallazgos informativos y un aviso** previos: tablas privadas con RLS sin políticas directas y protección de contraseñas filtradas deshabilitada. Esta última requiere el plan Pro según la revisión existente; se mantiene Free. [Referencia del proveedor](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## Alcance

La [comparación aislada](datos-proyeccion-actividad-estudiante-local.md) reúne 55 comprobaciones del contrato, permisos, preguntas, plazos y casos límite. La [regresión conjunta](datos-regresion-proyeccion-estudiante.json) identifica los archivos y el orden exactos que ejecutó. La optimización elimina una serialización duplicada de preguntas ordinarias; **no acredita una mejora de latencia ni cierra Q-06**. La siguiente medición debe identificar las veinte migraciones y la compilación que realmente utilice.
