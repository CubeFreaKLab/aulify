# 0006. Transporte PostgreSQL del servidor

Estado: implementado; capacidad sostenida pendiente de medición. 17 de octubre de 2026.

## Motivo

El ensayo con avisos SSE conservó las respuestas, pero siguió presentando demoras en las RPC. Una comparación acotada reprodujo picos de varios segundos al llamar directamente a la API de datos de Supabase. La ejecución SQL observada fue menor que esa espera. Esto identifica trabajo fuera de la consulta y justifica contrastar otro transporte; no establece una causa única dentro de la infraestructura del proveedor.

Cuatro conexiones SQL persistentes procesaron cuatro rondas con 200 identidades ficticias sin una degradación progresiva. Los envíos se revirtieron y esa comprobación no equivale a carga HTTP sostenida. La adaptación de planes del agregado docente se descartó: no mejoró el resultado en la comparación alternada.

## Decisión

Permitir al servidor utilizar el pooler transaccional gratuito de Supabase, en el puerto 6543, cuando se configura `AULIFY_DATABASE_URL`. Auth, Storage y los avisos privados siguen utilizando sus servicios de Supabase. Sin esa variable se conserva el transporte REST. Un error en PostgreSQL no dispara un segundo envío por REST.

Cada operación ejecuta las mismas RPC públicas dentro de una transacción. Los comandos y las proyecciones usan `SET LOCAL ROLE authenticated` y la identidad que el servidor acaba de verificar con `getClaims`. La cola interna de sincronización utiliza `service_role`, como antes. Las funciones originales siguen comprobando pertenencia, propiedad, versiones, plazos e idempotencia. La aplicación no escribe directamente las tablas.

Las identidades y los roles duran solo hasta el cierre de esa transacción. Se entrega el resultado únicamente después de recibir el `COMMIT`; una conexión fallida se destruye y no vuelve al pool. Se conservan ocho segundos de límite SQL, doce segundos de transporte y la ausencia de reenvíos automáticos de escritura.

Hay dos pools por proceso: cuatro conexiones máximas para lecturas y ocho para comandos. Se comparten en el registro global del proceso. `attachDatabasePool`, del paquete oficial de Vercel, mantiene la limpieza de conexiones inactivas antes de que Fluid suspenda una instancia; el plazo inactivo es de cinco segundos. Supavisor limita las conexiones efectivas a PostgreSQL; sus valores observados son quince conexiones por combinación de usuario/base y doscientos clientes en Nano. Esta configuración no demuestra capacidad ni garantiza por sí sola el consumo conjunto de varias instancias de Vercel.

El primer calentamiento con el transporte nativo alcanzó el límite de doscientos clientes del pooler y se cortó. Los registros de Supavisor identificaron `EMAXCONN`, incluida la espera fallida para obtener conexiones. Se conserva [el resultado fallido](../verificacion/capacidad-postgres-inicial-20261017.md). La corrección de ciclo de vida y tamaño de los pools responde a ese fallo concreto; todavía requiere medición.

El siguiente ensayo terminó el calentamiento, pero volvió a fallar al enviar doscientas respuestas en ráfaga. Se detuvo anticipadamente: 122 de las primeras 200 confirmaciones superaron 1,5 segundos, lo que ya impedía cumplir el percentil sobre las 2.000 respuestas previstas. En esa ventana no se repitió `EMAXCONN`; los registros del servidor mostraron esperas de seis segundos y cancelaciones. Se amplía el pequeño pool de dos conexiones y se registran por separado la espera de conexión y la ejecución, mediante campos numéricos y categorías cerradas. No se registran consultas, respuestas, identidades ni excepciones originales. La comprobación acotada de la ráfaga debe preceder a otro ensayo completo.

Se utiliza el protocolo de consulta sin sentencias preparadas con nombre. Los nombres de las cuatro RPC y los roles son constantes del servidor. Cada valor se escapa con `pg.escapeLiteral`; no se interpolan valores del cliente sin ese escape. El certificado raíz público se obtuvo desde Database Settings y TLS verifica tanto la cadena como el servidor. La conexión privada no lleva prefijo `NEXT_PUBLIC_` y no se incluye en Git.

## Verificación y límites

- Comprobaciones unitarias de transacción, escape, confirmación posterior al cierre y selección de identidad en las rutas HTTP.
- [Comprobación remota de transporte](../verificacion/transporte-postgres-20261017.json): lectura autorizada, denegación de otra materia e intento, reintento idempotente, limpieza de contexto, sincronización independiente y cuarenta identidades. No aprueba Q-06.
- La medición completa debe conservar los cuatro docentes, doscientos estudiantes, ambos modos, duraciones, integridad y umbrales originales. Q-06, AP-35 y Q-09 siguen abiertos hasta tener ese resultado.
- No se modificaron tablas, permisos SQL ni versiones de actividades. El modelo conserva treinta y cinco migraciones.

## Referencias

[Supabase: conexiones y pooler](https://supabase.com/docs/guides/database/connecting-to-postgres/pooling-and-limits), [conexión verificada con certificado](https://supabase.com/docs/guides/database/psql), [transacciones en node-postgres](https://node-postgres.com/features/transactions), [TLS](https://node-postgres.com/features/ssl), [ciclo de vida de pools en Vercel Fluid](https://vercel.com/kb/guide/connection-pooling-with-functions).
