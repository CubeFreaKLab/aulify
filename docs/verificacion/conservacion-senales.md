# Conservación de señales de visibilidad

La prueba AP-28 detectó que una sesión guiada cerrada antes de su vencimiento programado conservaba detalles más allá de treinta días desde el cierre real. El mantenimiento contaba siempre desde el vencimiento general. El [registro anterior](conservacion-senales-antes.json), sobre veinte migraciones, conserva el resultado adverso: exactamente al cumplirse treinta días seguía existiendo una señal que debía eliminarse.

La migración `20260930023242_aulify_visibility_effective_closure.sql` usa el instante más temprano entre el plazo general ampliado y el cierre de la sesión guiada. Un intento individual entregado no adelanta el cierre de toda la actividad. La modificación reemplaza una expresión de la función existente, comprueba que su definición sea la esperada y conserva sus permisos. No ejecuta ninguna limpieza al aplicar la migración ni cambia tablas o relaciones.

El [ensayo posterior](conservacion-senales-despues.json) aprobó **once comprobaciones** en cinco casos: mantenimiento inaccesible a usuarios, registro desactivado, un microsegundo antes y exactamente en la frontera del cierre guiado, conservación de resolución docente, repetición de limpieza, entrega individual y ampliación del plazo general. Se utilizó PGlite sin red y las operaciones de usuario pasaron por el rol `authenticated`. Los timestamps de los fixtures se ajustaron como propietario exclusivamente dentro de la base aislada; no se esperaron treinta días reales.

Las [32 comprobaciones de conservación de archivos compartidos](conservacion-archivos-compartidos.json) se repitieron con las veintiuna migraciones y aprobaron. La versión y hashes de cada SQL constan en los informes.

**Estado de integración:** verificado localmente; aplicación remota pendiente hasta concluir la carga sostenida sobre veinte migraciones. La frecuencia del mantenimiento, la purga remota y el objetivo operativo de veinticuatro horas conservan su verificación independiente.
