# Verificación del modelo 1.0

Fecha: 26 de septiembre de 2026. Revisión documental y estructural; no se ejecutó una base PostgreSQL/Supabase ni pruebas de la aplicación.

El [informe estructural](verificacion-estructural.json) conserva conteos y huella de la fuente validada. El [manifiesto de figuras](diagramas/manifest.json) permite detectar cambios en fuentes o exportaciones que requieran regenerar.

## Comprobaciones realizadas

| Comprobación | Resultado | Alcance real |
|---|---|---|
| Integridad de fuente JSON | 44 relaciones propias, 1 externa, 280 campos y 74 FK. | Sin nombres repetidos, PK nulas ni FK a campos o claves candidatas inexistentes; tipos de referencias compatibles. |
| Relación con reglas | Identificadores del modelo encontrados en la especificación. | Detecta referencias rotas; no demuestra que la regla esté implementada. |
| Derivados reproducibles | DBML, diccionario y seis diagramas relacionales corresponden a JSON. | Comparación de texto con generador; las figuras complementarias se mantienen en DOT. |
| Sintaxis DBML | Conversión local a PostgreSQL completada con `@dbml/cli` 10.2.0. | Parseo y exportación; SQL obtenido solo para inspección temporal, no aplicado ni usado como migración de producción. |
| Figuras | Diez fuentes DOT y exportaciones SVG/PNG; revisión visual de legibilidad. | Diagramas del modelo propuesto, no capturas de ejecución. Graphviz 12.2.1. |
| Casos estructurales sensibles | Revisados pertenencia estable, consumo por actividad, separación de secretos y vínculo de correcciones publicadas. | Revisión del diseño y sus invariantes; falta probar operaciones concurrentes. |

Reproducción estructural desde la raíz:

```powershell
python tools/modelado/generar.py --check
```

Para regenerar figuras, ejecutar sin `--check` con Graphviz en PATH. La herramienta no contiene acceso a cuentas, red, SQL ni servicios externos. El parser DBML se utilizó localmente; no se cargó el modelo a una web externa.

## Casos razonados antes de construir

| Situación | Cómo se representa y qué falta ejecutar |
|---|---|
| Tres intentos y un doble | Los tres intentos referencian el mismo participante; PK de consumo por participante/tipo impide un segundo doble. Falta probar la transacción ante dos solicitudes simultáneas. |
| Retiro y reingreso | Se actualiza la misma membresía, se añaden eventos y se mantienen participantes/intentos existentes. La UK materia/estudiante impide otra identidad paralela. Falta ejecutar retiro con respuesta concurrente. |
| Publicada 12, corrección a 14 | Evaluación 1 y sus revisiones permanecen; evaluación 2 privada no cambia la consulta de última publicada. Falta probar publicación concurrente y acceso estudiantil. |
| Respuesta escrita idéntica a guía | Payload es texto; no tiene corrección automática porque el tipo exige manual. Falta validar contratos y consultas sin exponer la guía. |
| Pregunta no respondida al vencer | Existe pregunta asignada sin respuesta; al cierre se registra corrección por omisión, salvo resolución administrativa pendiente. Falta probar vencimiento simultáneo con envío. |
| Actividad borrada con imagen en biblioteca | Las referencias de bloques/borradores conservan el archivo aunque se eliminen las de entrega. Falta ejecutar limpieza de bytes y reintento de fallos. |

## Pruebas pendientes del esquema físico

1. Aplicar migraciones en entorno aislado y reconstruir desde cero; comprobar versiones reales de PostgreSQL, Auth y Storage.
2. Ejecutar cada invariante M-01 a M-21 con datos ficticios y casos negativos, incluyendo accesos directos y funciones privilegiadas.
3. Probar carreras: aprobación, configuración/inicio, respuesta/vencimiento, doble, publicación y restauración/purga.
4. Verificar cálculo racional y redondeo, consulta de nota publicada, fuentes y límites de visibilidad.
5. Medir consultas y consumo antes de cerrar índices y transporte. Revisar borrado/reconstrucción y permisos de archivos.

La tarea E1-T02 se completa como modelado documental. T-03 sigue parcialmente pendiente: el modelo lógico está disponible, pero las migraciones, RLS e invariantes aún deben implementarse y comprobarse. Los 76 casos AC/AP del producto siguen no ejecutados.
