# Capacidad de Aulify: resultado del 17 de octubre

La capacidad objetivo de cuatro docentes y 200 estudiantes **todavía no está aprobada**. Se aplicaron mejoras y se probó una nueva versión en la Preview protegida de Vercel, con Supabase Free. El ensayo tuvo que detenerse al aumentar las demoras y los errores.

| Comprobación | Resultado |
|---|---|
| Acceso y retiro de estudiantes | Comprobados con dos cuentas ficticias; retirar una no afecta a la otra. |
| Avisos de actividad | 200 estudiantes conectados; sus conexiones se renovaron sin interrupciones inesperadas. |
| Respuestas confirmadas | Las 1.180 confirmaciones recibidas coinciden con lo guardado, sin pérdidas ni duplicados. Había 1.200 respuestas persistidas. |
| Tiempo de confirmación | El percentil 95 fue de 8,81 s entre las confirmaciones observadas; la meta es 1,5 s. No se cumplió. |
| Errores | 95 en 3.537 solicitudes del calentamiento: 2,69 %. La meta es menos del 1 %. |
| Escenario completo | No se completó el calentamiento; no se ejecutaron los quince minutos individuales, el modo guiado ni la ráfaga prevista. |
| Cuotas | Los paneles no mostraron una cuota activa excedida. Los contadores de Realtime tienen retraso; no se acredita el consumo de un escenario incompleto. |
| Integración continua | Aprobada para aplicación y ejecutor con 35 migraciones. No equivale a una aprobación de capacidad. |

El cambio principal fue sustituir las consultas repetidas del estudiante por avisos del servidor. El estudiante mantiene una comprobación periódica y vuelve a consultar con mayor frecuencia si pierde el canal. Las respuestas siguen guardándose mediante operaciones autorizadas de PostgreSQL. Los avisos no contienen respuestas, soluciones ni notas.

El transporte de avisos funcionó durante el ensayo. Las demoras se concentraron en las operaciones de datos. Un [perfil aislado posterior](perfil-respuesta-aislada-20261017.json) registró aproximadamente 0,19 s dentro de PostgreSQL, sin HTTP ni concurrencia; ese dato no identifica la causa de la demora bajo carga. El siguiente trabajo debe perfilar consultas, conexiones y recursos durante el problema antes de otra ejecución completa. No se atribuye el fallo a una causa única ni se supone que pagar un plan lo resolverá.

El acceso temporal de automatización fue revocado. Se comprobó que el valor anterior recibe HTTP 302 y se eliminó su copia local. La protección general de Vercel permanece activa. No hay una carga ejecutándose ni se ha liberado producción como parte de esta comprobación. AUL-23 continúa en curso.

Evidencia: [informe del ensayo](capacidad-200-20261017.md), [datos originales](datos-carga-20261017204913.json), [recorrido de acceso](avisos-actividad-preview-20261017.json), [CI](ci-capacidad-sse-20261017.json), [cuotas](cuotas-capacidad-20261017-despues.json) y [revocación](acceso-capacidad-revocado-20261017.json). Los [diagnósticos anteriores](capacidad-diagnostico-20261017.md) conservan sus resultados propios.
