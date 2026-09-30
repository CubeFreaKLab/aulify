# Primera entrada con los dos perfiles

El 30 de septiembre de 2026, a las 06:37 UTC, un recorrido de navegador aprobó la primera entrada de docente y estudiante con Supabase real. Se utilizó el compilado local `ou5DbbEjvpmQk0PkLvYqG`, aplicación `27e4df6`, servido por HTTP. El [resultado](ayuda-primera-entrada.json) conserva duración, entorno y huellas; el [caso](../../tests/e2e/ayuda-primera-entrada.spec.ts) exige cuentas ficticias sin preferencias anteriores ni intentos abiertos.

El docente, en 1440 × 900, y el estudiante, en 390 × 844 con interacción táctil emulada, recibieron la invitación inicial y recorrieron sus cinco pasos. Se comprobaron foco en encabezados, botones dentro de la pantalla y ausencia de desplazamiento horizontal, con movimiento reducido. La preferencia quedó completada en la versión 2; los demás datos de negocio permanecieron idénticos, salvo la revisión técnica.

Después de cerrar sesión, la consulta del aula devolvió 401. En nuevas sesiones independientes, ambos recuperaron la preferencia y el diálogo no se abrió de nuevo. El ensayo terminó en **28,132 segundos**, sin reintentos. TypeScript y ESLint aprobaron. No hubo cambios de aplicación ni migraciones.

## Preparación y límites

Se reutilizó un docente ficticio confirmado sin ayuda previa y se creó un estudiante ficticio, confirmado administrativamente. El campo `newAccounts: 0` del adjunto se refiere al test; la preparación externa creó **una**. No se enviaron correos ni reiniciaron preferencias. Las cuentas se conservan para pruebas; sus sesiones de navegador se cerraron.

La ejecución inicial seleccionó un estudiante de carga con un intento abierto y falló esa precondición antes de abrir su guía. Se conservó su historial y se preparó otra cuenta. No se atribuye ese fallo de preparación al producto ni se cuenta como ejecución aprobada.

Esta evidencia complementa [ayuda por cuenta y versión](ayuda-por-cuenta.md). No demuestra registro o recuperación por correo, HTTPS, lector de pantalla manual, dispositivos físicos ni usabilidad con personas.

Para reproducir: preparar `.local-private/first-visit-accounts.json` con dos cuentas y activar `AULIFY_FIRST_VISIT_E2E=1` y `PLAYWRIGHT_BASE_URL`. Ejecutar `npx --no-install playwright test tests/e2e/ayuda-primera-entrada.spec.ts --project=chromium-escritorio --workers=1`. El caso se omite en CI; una omisión no es aprobación. Las credenciales permanecen fuera de Git.
