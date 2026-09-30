# Diagnóstico con transporte de 128 conexiones

El [registro original](datos-carga-20260930054205.json) corresponde al compilado `Dzy7Hs2R-JSbzneQEdYCi`, revisión `71d9b4867993d2139a18404fa60eca73c30f19cf`, y veintitrés migraciones aplicadas. Usa Next.js compilado en una computadora local y Supabase Free remoto. No representa el rendimiento de Vercel.

La ventana individual duró 300,419 segundos, entre 05:45:42 y 05:50:43 UTC del 30 de septiembre. Cuatro docentes y doscientos estudiantes generaron 59.259 solicitudes, sin errores. Las 2.000 respuestas quedaron confirmadas y persistidas; la auditoría no encontró duplicaciones ni cambios o pérdidas de respuestas confirmadas.

La confirmación p95 fue **3.047,92 ms**, superior a la meta de 1.500 ms. El ajuste evitó los errores observados en el diagnóstico anterior, pero no resuelve la latencia objetivo. La comparación no es un experimento controlado: las ejecuciones ocurrieron en momentos diferentes y el historial ficticio se conserva.

La publicación de las doscientas notas, la lectura de los doscientos resultados y la preparación de otra actividad terminaron correctamente. Las lecturas posteriores tuvieron p95 de 1.668,46 ms. El ejecutor terminó a las 05:51:19 UTC, con 60.275 solicitudes en total. Su estimación conservadora de 299.166.198 bytes no equivale al contador facturable del proveedor.

Se trata de un diagnóstico de cinco minutos: no ejecutó las dos mediciones de quince minutos ni la modalidad guiada. Q-06/Q-09 permanecen abiertos. El campo heredado `expectedMigration` identifica la migración 21; el inventario real era 23 y ese campo no acredita por sí solo el esquema remoto. El reporte original se conserva sin modificarlo.
