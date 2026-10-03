# Cuotas observadas el 2 de octubre

Consulta del panel de uso de la organización de Aulify en la noche del 2 de octubre de 2026, después del diagnóstico de la Preview. Ciclo mostrado: 28 de septiembre a 28 de octubre. Plan Free, sin activar facturación ni complementos.

| Indicador                         | Consumo mostrado |  Incluido |
| --------------------------------- | ---------------: | --------: |
| Transferencia sin caché           |         1,013 GB |      5 GB |
| Tamaño de base, resumen del panel |         0,071 GB |    0,5 GB |
| Transferencia con caché           |         0,023 GB |      5 GB |
| Usuarios activos mensuales        |              211 |    50.000 |
| Storage, uso medio del ciclo      |         0,001 GB |      1 GB |
| Conexiones máximas Realtime       |                0 |       200 |
| Mensajes Realtime                 |                0 | 2.000.000 |
| Invocaciones Edge Functions       |                0 |   500.000 |

El panel indicaba que no se había superado una cuota vigente. El informe de tamaño actual mostraba 67,25 MB para la base. El indicador de Storage es un promedio del ciclo; no equivale a la suma instantánea de bytes del respaldo.

Logs aparecía como un límite próximo: ingestión 1,444/1 GB y consulta 7,224/100 GB. La interfaz señala que la aplicación de esas condiciones empieza en 2027; no se consideran restricciones vigentes ni se afirma que el proyecto deba pagar por ellas en esta lectura.

Supabase advierte que transferencia y varios indicadores pueden tardar una hora en actualizarse; usuarios activos pueden actualizarse en veinticuatro horas. La estimación conservadora de la prueba fue 56.898.020 bytes adicionales, separada del contador del proveedor. Esta lectura no mide cuotas de Vercel ni acredita Q-09 para ambos modos sostenidos.

El [registro anterior](cuotas-supabase-20260929.md) conserva sus cifras y fecha. El [diagnóstico de la Preview](capacidad-preview-20261002.md) explica por qué no se inició otra carga completa.
