# Verificación del modelo 1.3

29 de septiembre de 2026. El modelo conserva 44 relaciones del dominio y tres técnicas: comprobaciones de código y revisiones de sincronización por actividad/participante. Son 47 tablas propias, una identidad externa, 295 campos y 78 claves foráneas. El [informe estructural](verificacion-estructural.json) identifica la fuente validada y el [manifiesto](diagramas/manifest.json) sus exportaciones. La versión 1.3 añade un contador docente por participante; su migración está aplicada y tiene pruebas aisladas y una regresión remota acotada, sin acreditar capacidad.

| Comprobación | Resultado y alcance |
|---|---|
| Estructura | Nombres, claves candidatas, nulabilidad, tipos compatibles y destinos de FK comprobados por el generador. |
| Reglas | Identificadores referenciados presentes en la especificación; no demuestra por sí solo su cumplimiento. |
| Derivados | DBML, diccionario y seis diagramas relacionales regenerados desde JSON; cuatro diagramas complementarios mantienen fuentes DOT. |
| SQL aislado | Dieciséis migraciones reconstruidas y 84 comprobaciones de regresión aprobadas; roles PostgreSQL `anon`, `authenticated` y `service_role`, Auth/Storage mínimos de prueba. [Evidencia actual](../verificacion/datos-regresion-revision-participante.json). |
| Servicios reales | 45 comprobaciones de Auth, RPC, archivos privados y concurrencia sobre las migraciones iniciales. [Evidencia](../verificacion/datos-remotos.md). No atribuir este resultado a cambios posteriores. |
| Carrera guiada | Tras corregir el orden de bloqueos, treinta carreras remotas respuesta/cierre sin error técnico. [Evidencia](../verificacion/datos-carrera-guiada.md). |
| Sincronización nueva | Aplicada y verificada aisladamente; 24 comprobaciones remotas de privacidad y fronteras temporales, con detalle en [su informe](../verificacion/datos-sincronizacion.md). |
| Revisión por participante | 31 comprobaciones aisladas de equivalencia, invalidación, privacidad, idempotencia, borrado y autorización; 103 comprobaciones adicionales de juego. Tras aplicarla, 33 comprobaciones remotas de privacidad y sincronización aprobaron con cuatro cuentas ficticias. No hubo ensayo de contención entre dos sesiones. [Informe](../verificacion/datos-revision-participante.md). |
| Capacidad | Los ensayos se interrumpieron durante calentamiento; requisito no aprobado. [Informe](../verificacion/datos-carga.md). |

La revisión documental inicial del 26 de septiembre no ejecutó SQL; estos resultados posteriores no se atribuyen a aquella fecha. Las imágenes muestran el modelo, no una aplicación en funcionamiento. El generador no se conecta a servicios.

```powershell
python tools/modelado/generar.py --check
node tools/datos/check.mjs --report docs/verificacion/datos-aislados.json
```

La cobertura funcional y sus límites se registran por caso en [cobertura integrada](../verificacion/cobertura-integrada.md). Los pendientes de capacidad, operación periódica y despliegue no quedan resueltos por una validación estructural. Las excepciones JSONB y los contadores derivados están justificadas en [normalización](normalizacion.md).
