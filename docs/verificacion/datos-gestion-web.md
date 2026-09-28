# Gestión de aula en navegador

El 28 de septiembre de 2026 se ejecutaron los tres recorridos de `tests/e2e/gestion-integrada.spec.ts` con Chromium en escritorio (1440 × 900) y en emulación móvil (390 × 844), contra la aplicación local y Supabase remoto. Se utilizaron cuentas y escenarios ficticios separados de los datos de la demostración inicial.

| Recorrido | Escritorio | Móvil |
|---|---|---|
| Editar materia, renovar invitación, corregir/publicar nota manual, decidir cero por ausencia, archivar/restaurar y retirar inscripción | Aprobado | Aprobado |
| Repartir/ajustar equipos, ampliar plazo, revisar señal, cerrar sesión antes de tiempo, resolver intento y consultar clasificación | Aprobado | Aprobado |
| Subir archivo, publicar nota, habilitar reentrega, enviar segunda versión y conservar nota/versiones anteriores | Aprobado | Aprobado |

La primera ejecución sobre el servidor de desarrollo terminó con cinco recorridos aprobados y uno fallido: después de reemplazar la entrega móvil, la aplicación quedó mostrando «Preparando tu aula» y no apareció el historial dentro de los doce segundos de espera. Coincidió con modificaciones del servidor de desarrollo. La repetición exclusiva del caso, sin cambios en su lógica y con el servidor estable, pasó en 16,2 segundos. Esta observación no demuestra por sí sola la causa del primer fallo.

La comprobación posterior sobre el compilado de producción local aprobó las seis ejecuciones de gestión. El [registro de la batería integrada](integracion-web.md) identifica entorno, versión y alcance del conjunto. La salida de ejecución fue observada; el JSON completo de esa batería no se conservó antes de repetir otros dos casos de recuperación de la demostración. Estos resultados no se presentan como una segunda batería completa sin fallos ni como evidencia exportada que ya no está disponible.

Se realizaron ocho análisis automáticos axe en las vistas de configuración, calificación manual, gestión de sesión y entrega estudiantil: no se detectaron infracciones en las reglas WCAG A/AA seleccionadas. También se comprobó la ausencia de desplazamiento horizontal de la página. Esto no equivale a una evaluación completa con lector de pantalla, a una prueba con personas ni a una certificación de accesibilidad.

Las operaciones de interfaz se contrastaron con el estado real del servidor. La autorización de reentrega apareció en el snapshot del estudiante, desapareció al consumirse y conservó la nota anterior y dos versiones del archivo. El archivo subido fue una imagen PNG sintética y recorrió los endpoints de preparación y validación, la subida firmada y el registro en Storage.

Las sesiones se prepararon sin escribir contraseñas en la interfaz. Se desactivaron trazas y vídeo; los archivos de cuentas y las capturas quedaron en directorios locales excluidos de Git. No se enviaron correos. Los escenarios se conservaron para nuevas verificaciones.

Reproducción autorizada contra el entorno ficticio:

```powershell
$env:AULIFY_REMOTE_E2E='1'
$env:PLAYWRIGHT_BASE_URL='http://127.0.0.1:3002'
npx playwright test tests/e2e/gestion-integrada.spec.ts --workers=1 --reporter=list
```

El archivo nuevo de gestión y sus pruebas pasaron TypeScript y ESLint. La comprobación final utilizó una construcción de producción servida localmente; no describe un despliegue público ni una prueba en un teléfono físico.
