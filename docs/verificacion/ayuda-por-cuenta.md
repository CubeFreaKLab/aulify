# Ayuda por cuenta, rol y versión

Verificación del 29 de septiembre de 2026 para RF-17, AY-01 a AY-04 y AP-34. Evidencia resumida y sin identidades en [ayuda-por-cuenta.json](ayuda-por-cuenta.json).

La interfaz anterior ignoraba la versión al decidir si ofrecer ayuda; una preferencia completada de versión 1 impedía invitar a una nueva guía. Tampoco permitía avanzar y retroceder entre los cinco momentos requeridos, y repetir desde Ayuda programaba otra apertura en Inicio. El escenario de nueva versión falló antes de la corrección por ausencia de invitación.

[HelpGuide](../../src/components/help-guide.tsx) ofrece la guía inicial, permite omitirla, recorrer cinco pasos del rol y repetirla directamente desde Ayuda. La [versión 2](../../src/domain/help.ts) conserva las preferencias anteriores: una versión nueva muestra una invitación discreta, sin diálogo automático. Cerrar una repetición ya completada conserva ese estado. El guardado de omisión/completado espera al registro de oferta para evitar que una escritura tardía lo sustituya.

Se conserva el contrato público `setHelpPreference` y la tabla `help_progress`, cuya clave contiene cuenta, guía y versión. La cuenta determina también el rol: el rol principal es inmutable en Aulify 1.0. No se añadió migración. Durante un intento activo, Inicio no abre la guía y Ayuda ofrece texto estático; el reproductor incluye ese mismo texto desplegable, sin superposición ni cambio del reloj.

| Criterio         | Evidencia ejecutada                                                                                                                                                                                                           | Resultado                                                            |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| AC-31 / AY-01–02 | Docente y estudiante sin materias, recursos ni intentos: invitación y cinco pasos propios.                                                                                                                                    | Aprobado en escritorio y móvil emulado.                              |
| AC-32 / AY-04    | Omitir, recargar, repetir desde Ayuda, cerrar y seguir usando Biblioteca. En Supabase: omitir, cerrar sesión, acceder en otro contexto, completar y recuperar la preferencia.                                                 | Aprobado local y remoto.                                             |
| AC-33 / AY-03    | Teclado, retroceso, foco en cada paso, restauración al inicio o al botón de repetición, movimiento reducido, botones visibles y ausencia de desbordamiento. Axe sin infracciones detectadas en el último paso de ambos roles. | Aprobado automatizado; lector de pantalla manual pendiente.          |
| AC-34 / AY-03    | Recorrer sin datos conserva íntegro el dominio, salvo preferencia y revisión. Durante un intento temporizado: ayuda estática, ninguna guía superpuesta, reloj que continúa y respuestas/intentos intactos.                    | Aprobado en escritorio y móvil emulado.                              |
| AP-34            | Preferencia versión 1 completada → invitación discreta versión 2 → ofrecida → omitida → recarga sin invitación; intento en curso sin guía; preferencia real recuperada entre sesiones independientes.                         | Secuencia funcional cubierta por evidencia local y remota combinada. |

[ayuda.spec.ts](../../tests/e2e/ayuda.spec.ts) ejecutó cinco escenarios en Chromium de escritorio (1440 × 900) y móvil emulado (390 × 844): **10 aprobados**. Compara el estado completo de negocio, no solo el número de intentos. El recorrido con cuenta vacía comprueba también que el siguiente acceso útil permanece disponible.

[ayuda-integrada.spec.ts](../../tests/e2e/ayuda-integrada.spec.ts) ejecutó **1 escenario aprobado** contra Next.js de desarrollo y Supabase real. Usó una cuenta docente ficticia existente, dos contextos independientes y tres accesos autenticados. Comprobó `skipped` en la primera sesión, ausencia de apertura automática en la segunda, `completed` tras los cinco pasos y recuperación del mismo estado al acceder otra vez. Las preferencias proyectadas pertenecían exclusivamente a esa cuenta; los demás datos permanecieron iguales. Quedó guardada la preferencia completada de versión 2. No se crearon cuentas ni se enviaron correos. Los últimos ajustes de foco y orden de guardado se comprobaron en la ejecución local final.

Para reproducir con el servidor de desarrollo iniciado:

```powershell
$env:PLAYWRIGHT_BASE_URL='http://127.0.0.1:3002'
npx --no-install playwright test tests/e2e/ayuda.spec.ts --workers=1
```

La prueba remota requiere las credenciales ficticias existentes en el almacén privado de pruebas, configuración Supabase del servidor y activación explícita:

```powershell
$env:AULIFY_REMOTE_E2E='1'
npx --no-install playwright test tests/e2e/ayuda-integrada.spec.ts --project=chromium-escritorio --workers=1
Remove-Item Env:AULIFY_REMOTE_E2E
```

El ejecutor remoto desactiva trazas, vídeo y capturas para no guardar sesión o identidad. Ejecutar las dos suites por separado o con directorios de salida distintos: una ejecución intermedia simultánea compartió artefactos y terminó con `ENOENT`; la repetición aislada fue satisfactoria. También se comprobaron TypeScript, ESLint de los archivos afectados y formato del diff. Esta evidencia no corresponde al servidor de producción, a CI, a dispositivos físicos ni a una evaluación manual con lector de pantalla; AC-33 conserva esa última comprobación pendiente. La primera entrada real de ambos perfiles confirmados no se recreó mediante registros nuevos.
