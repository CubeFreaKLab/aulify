# Verificación de la integración web

## Entorno y versión

Ejecución del 28 de septiembre de 2026, Windows 11, Node.js 24.14.1, Next.js 16.3.6, Chromium de Playwright. Aplicación compilada con `next build` y servida en `http://127.0.0.1:3002`; Supabase Free remoto con PostgreSQL 17. Los cambios comprobados quedaron reunidos en `20e5afc`. El informe no describe un despliegue público.

Playwright utiliza dos proyectos: escritorio a 1440 × 900 y móvil emulado a 390 × 844. Algunos casos comprueban además reflujo a 320 píxeles CSS. Las cuentas, archivos y contenido utilizados son ficticios. Las credenciales se guardan fuera de Git.

## Resultados

| Comprobación | Resultado |
|---|---|
| TypeScript y generación de tipos de Next.js | Aprobada |
| ESLint | Aprobada |
| Construcción de producción | Aprobada |
| Vitest | 35 casos aprobados en cuatro archivos |
| Playwright, lote completo con integración real habilitada | 62 aprobados y dos fallos del mismo recorrido de recuperación local |
| Repetición de los dos casos después de corregir y recompilar | Dos aprobados, escritorio y móvil |

La anomalía estaba en el estado de error y reinicio de una demostración con almacenamiento dañado. Se recuperó el mensaje específico de la muestra y se reinicializaron el repositorio y la sesión local al confirmar el reinicio. La lectura inicial conserva el contenido dañado hasta que la persona decide restablecerlo. No se modificaron las expectativas del caso para ocultar el fallo.

El resultado agregado comprende los 64 casos; no se presenta la repetición parcial como una segunda ejecución completa. Doce ejecuciones corresponden a seis recorridos de servicios reales, repetidos en ambos tamaños; las demás comprueban interfaz pública y demostración.

## Recorridos con servicios reales

1. Acceso docente, navegación, cierre de sesión y acceso de otro perfil sin conservar datos de la cuenta anterior; una ruta de edición no concede herramientas docentes al estudiante.
2. Preparación de un recurso, guardado y publicación como lectura; consulta de su versión desde una cuenta estudiantil aprobada.
3. Creación de una tarea, subida de un PNG real, envío, descarga por estudiante y propietario y denegación al docente ajeno. Los bytes descargados coinciden con la carga.
4. Configuración de materia, calificación manual, publicación, asignación explícita de cero y conservación.
5. Equipos, ampliación de plazo, señal de visibilidad, cierre anticipado y resolución docente.
6. Reentrega habilitada únicamente para la cuenta correspondiente, con conservación de versiones anteriores.

La validación aislada de los archivos comprueba metadatos, firmas, extensiones engañosas y rechazo de macros o expansión desproporcionada de DOCX. La configuración de Storage mantiene el bucket privado; la descarga autorizada emite un enlace temporal.

## Confirmación de respuestas y recuperación de conexión

Una comprobación posterior desde la interfaz real detectó que la clave de idempotencia construida por el navegador no tenía el formato UUID exigido por PostgreSQL. Las pruebas directas de datos usaban UUID válidos, por lo que no cubrían esa diferencia. Se corrigió el navegador para conservar una clave UUID entre reintentos de la misma respuesta.

La confirmación utiliza ahora el intento devuelto por el servidor tras persistir la respuesta. El avance no espera una segunda consulta de toda el aula. Una lectura iniciada antes de esa confirmación se descarta para evitar que el progreso retroceda. El consumo del doble también procede de la respuesta confirmada; no se anticipa una calificación en el cliente.

Los reintentos de sincronización fallida se espacian a uno, dos, cuatro y ocho segundos sin añadir una consulta completa por cada fallo. Se distingue un servicio temporalmente indisponible de una sesión inválida o un permiso retirado. La identidad se valida mediante firma JWT con `getClaims`; las operaciones de datos siguen comprobando permisos en PostgreSQL.

El lote posterior de `integrado.spec.ts` aprobó doce ejecuciones: seis recorridos en escritorio y móvil. Incluye pérdida de confirmación después de persistir, reintento sin duplicación, lectura antigua, recarga, respuesta escrita pendiente, consumo único del doble, retroalimentación oculta y cookie con identidad alterada. Conserva además los recorridos de lectura, archivo y cambio de cuenta. La [evidencia resumida](integracion-resiliencia.json) identifica el compilado y sus límites. No se suma este lote al anterior como si fueran escenarios diferentes.

El análisis estático, los tipos y la construcción continuaron aprobados; Vitest pasó a treinta y seis casos por la comprobación de errores de autenticación. Los seis casos de gestión conservan su informe específico; el conjunto autenticado contiene ahora dieciocho ejecuciones, incluyendo las doce de este lote.

## Reproducción

Instalar las dependencias con `npm ci`, preparar Chromium con `npx playwright install chromium` y ejecutar `npm run lint`, `npm run typecheck`, `npm test` y `npm run build`.

Servir el compilado con `node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3002`. En otra terminal, con la conexión y las cuentas ficticias preparadas mediante el [procedimiento remoto](datos-remotos.md), definir `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3002` y `AULIFY_REMOTE_E2E=1`, y ejecutar `npx playwright test --workers=2`.

Sin `AULIFY_REMOTE_E2E=1`, los dieciocho casos que requieren cuentas privadas se omiten deliberadamente. El CI público no recibe estas cuentas ni el secreto de servicio para ejecutar pruebas de navegador. Las trazas y los vídeos de los recorridos autenticados están desactivados para evitar conservar valores de los formularios de acceso.

## Integración continua y mantenimiento

La [ejecución 36392124813](https://github.com/CubeFreaKLab/aulify/actions/runs/36392124813), sobre `20e5afc`, terminó correctamente en Ubuntu: 35 pruebas unitarias, SQL aislado y 52 casos de navegador aprobados. Los doce casos autenticados se omitieron según la configuración del CI público. También aprobó formato, análisis, tipos y construcción. El [registro seleccionado](ci-integracion.json) conserva revisión, pasos y líneas de resultado; los logs completos se preservaron aparte.

La [ejecución 36396177901](https://github.com/CubeFreaKLab/aulify/actions/runs/36396177901), sobre `1dc862b`, volvió a aprobar los controles: 36 pruebas unitarias, 70 comprobaciones aisladas de datos y 52 casos públicos de navegador. Los dieciocho casos autenticados se omitieron deliberadamente. Esta ejecución comprueba la revisión indicada; los cambios posteriores requieren su propia verificación.

La [ejecución manual 36392156874](https://github.com/CubeFreaKLab/aulify/actions/runs/36392156874) comprobó el flujo de conservación contra Supabase. Terminó correctamente y no encontró archivos para eliminar (`deletedFileRecords: 0`). El cron está configurado cada seis horas; todavía no se observó una activación por horario. Esta ejecución no demuestra por sí sola recuperación desde un respaldo ni un plazo garantizado de purga.

## Alcance de la evidencia restante

No se verificaron envío de correo, recuperación por SMTP, teléfonos físicos, lector de pantalla, aceptación con participantes ni capacidad para 204 sesiones en esta batería. Las pruebas de carga y el despliegue tienen informes y criterios propios. Un resultado de axe sin infracciones en las vistas recorridas no certifica toda la aplicación.
