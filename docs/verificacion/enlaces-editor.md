# AP-33: validación de enlaces anidados del editor

29 de septiembre de 2026. Esta comprobación distingue tres capas: aceptación del documento local, contrato PostgreSQL y representación en editor/lector. No se observó ejecución del marcador JavaScript ni navegación externa.

## Hallazgo reproducido

El dominio local validaba JSON, profundidad y algunas claves privadas, pero no los destinos `href`. La [reproducción anterior en navegador](enlaces-editor-antes.json), con datos ficticios en dev3002, conservó un enlace `javascript:` en el documento de demostración. Al abrirlo, BlockNote generó un enlace con `href` vacío; el lector mostró su texto sin crear enlace. Los marcadores globales del enlace y del ejemplo de código permanecieron ausentes. No se pulsó el enlace ni se interpretó esa observación como una vulnerabilidad de ejecución confirmada.

La hipótesis inicial de que PostgreSQL también aceptaba ese enlace era incorrecta. Aunque `publish_resource` copia `editorDocument`, la [migración de conservación](../../supabase/migrations/20260928064819_aulify_retention_hardening.sql) ya incorporaba `app.assert_editor` y el trigger `validate_draft`. La primera preparación del ensayo SQL recibió `INVALID_EDITOR_URL` al intentar guardar `javascript:`. La prueba final conserva una aserción explícita de ese rechazo antes de aplicar la nueva migración.

Las brechas comprobadas en el contrato anterior eran más precisas: aceptaba un `href` nulo y un destino HTTPS con tabulación interna, porque comprobaba únicamente prefijo y solo si el valor era una cadena. También rechazaba el esquema HTTPS en mayúsculas. Estos comportamientos no eran coherentes con el editor local. El caso reproduce un borrador y una versión con el destino HTTPS que contiene tabulación antes de aplicar la corrección.

## Cambio

- [Política compartida](../../src/domain/editor-links.ts): enlaces estructurales HTTPS, esquema sin distinción de mayúsculas, autoridad no vacía, tipo cadena y límite de 8192 caracteres. Rechaza espacios y controles, incluidos los caracteres que un navegador puede normalizar.
- [Validación del documento](../../src/domain/rules.ts) y [creación de enlaces en el editor](../../src/components/rich-editor.tsx): aplican esa misma política a `href`, incluso anidado. Se mantiene la política de destinos web HTTPS del servidor; no se habilita HTTP por haber estado permitido en el editor de demostración.
- [Error orientador](../../src/lib/command-errors.ts): pide editar o eliminar el destino, utilizar HTTPS y respetar longitud/espacios. Aclara que el texto y los ejemplos de código se pueden conservar.
- La [migración nueva](../../supabase/migrations/20260929231531_aulify_editor_link_validation.sql) actualiza `app.assert_editor`, que ya utiliza el trigger de borradores; no añade un segundo trigger para ese mismo guardado. Añade validación antes de insertar una versión publicada, de modo que un borrador antiguo no omita la regla al republicarse. Las comprobaciones anteriores de claves privadas y de `url`/`src` se conservan, incluidos `/api/files/` y `#` en esos campos.

La validación recorre la estructura JSON y examina destinos, no substrings del contenido. Por eso `<script>`, `javascript:`, `data:`, `vbscript:` y un ejemplo textual `<a href="javascript:…">` siguen siendo texto válido dentro de una explicación o un bloque de código. Las claves privadas, como `hint` o `explanation`, siguen rechazándose cuando son propiedades estructurales reservadas; mencionarlas en un texto no equivale a introducir esas propiedades.

La migración se creó con `supabase migration new aulify_editor_link_validation`. No añade tablas, columnas ni índices: el modelo conserva 47 tablas propias y 295 campos. Los helpers nuevos son privados; no conceden ejecución a `anon` ni `authenticated`. No modifica los documentos de borradores o versiones existentes. Un destino anterior que no cumpla la regla debe corregirse antes de volver a guardar o publicar. El lector mantiene su tratamiento seguro de contenido legado.

## Evidencia local

| Comprobación | Resultado | Alcance |
|---|---|---|
| [Pruebas de enlaces](../../tests/unit/editor-links.test.ts) | 26 aprobadas; 2,92 s | 25 pruebas de dominio y una prueba de integración PostgreSQL/PGlite, aunque compartan el directorio `tests/unit`. No son 26 escenarios AP distintos. |
| Matriz de destinos | Aprobada | HTTPS válido y mayúsculas; JavaScript, data y VBScript rechazados; tipo nulo/número, espacios, controles, Unicode y límites de 8192/8193. Se conserva el código literal. |
| Contrato PostgreSQL | Aprobado en PGlite 0.5.8 | Reproduce el rechazo previo de JavaScript y la aceptación previa de tabulación/tipo incorrecto; verifica rechazo nuevo al guardar y publicar, persistencia del borrador válido anterior, versión publicada histórica intacta y helper sin ejecución de cliente. |
| [Regresión SQL](enlaces-editor-regresion.json) | 84 comprobaciones aprobadas | Diecisiete migraciones en base nueva aislada; permisos, ocho tipos, publicación, guiado, archivos y conservación. No implica aplicación remota. |
| [Editor y lectura](../../tests/e2e/editor-enlaces.spec.ts) | Dos ejecuciones aprobadas; 18,1 s | Mismo escenario en Chromium escritorio 1440 × 900 y móvil emulado 390 × 844; Next.js webpack en desarrollo, `127.0.0.1:3002`, adaptador de demostración. |
| TypeScript, ESLint y formato | Aprobados | Archivos modificados y tipos de la aplicación; sin construir ni consultar producción3001. |

Los recorridos de navegador guardan, recargan y leen el enlace permitido y los ejemplos literales. Comprueban ausencia de elementos `script`, de los marcadores globales y de solicitudes externas; no activan enlaces. El análisis visual de [escritorio](capturas/ap33-2026-09-29/lectura-escritorio.png) y [móvil](capturas/ap33-2026-09-29/lectura-movil.png) conserva el ejemplo como código y el enlace HTTPS como enlace. No evalúa toda la accesibilidad del editor.

## Evidencia remota

La migración se aplicó a Supabase con versión `20260929231531`. El ensayo posterior se ejecutó entre las 23:21:38 y las 23:21:44 UTC con el [script reproducible](../../tools/datos/editor-links-remote.mjs): una docente ficticia ya existente, clave publicable y JWT de inicio de sesión, sin credenciales administrativas. El [registro anonimizado](enlaces-editor-remoto.json) contiene 18 comprobaciones aprobadas dentro de un único recorrido y 11 llamadas RPC; no se suman como 18 escenarios de aceptación.

El recorrido crea un recurso con HTTPS en mayúsculas y un ejemplo literal de código, intenta guardar tres variantes anidadas inválidas (`javascript:`, tipo nulo y HTTPS con tabulación interna), verifica `INVALID_EDITOR_LINK` y compara el borrador completo tras cada rechazo. Contenido, revisión y fecha permanecen iguales; no aparecen versiones por los intentos rechazados. Finalmente publica el borrador válido y confirma que una única versión conserva exactamente su documento. La revisión del borrador sigue siendo 1. Se conserva únicamente ese recurso ficticio en la biblioteca de prueba; no se crearon cuentas, materias ni actividades.

Este ensayo comprueba el contrato remoto con datos ficticios; no recorre la interfaz autenticada, no activa enlaces ni mide carga. El script impone un máximo de 15 RPC, comprueba proyecto y hash de migración antes de conectarse, no imprime identidades o secretos y sin `--run` realiza únicamente preparación local.

## Reproducción y versión

```powershell
npx vitest run tests/unit/editor-links.test.ts --reporter=verbose
node tools/datos/check.mjs --report docs/verificacion/enlaces-editor-regresion.json
$env:PLAYWRIGHT_BASE_URL='http://127.0.0.1:3002'
npx playwright test tests/e2e/editor-enlaces.spec.ts --workers=1 --output .local-private/ap33-browser-tests --reporter=list
node tools/datos/editor-links-remote.mjs
# Solo después de aplicar y verificar la migración, en una ventana sin carga:
node tools/datos/editor-links-remote.mjs --run
```

Windows, Node.js 24.14.1, Vitest 5.0.2. La prueba focalizada final comenzó a las 19:12:49 de America/La_Paz (23:12:49 UTC); la regresión SQL terminó con registro a las 23:13:56 UTC. Los cambios estaban sin commit y se identifican por sus SHA-256:

El informe histórico de regresión SQL conserva el nombre local utilizado al ejecutarse, `20260929230609_aulify_editor_link_validation.sql`. Tras la aplicación remota, el archivo se alineó a `20260929231531_aulify_editor_link_validation.sql` sin modificar su contenido; el SHA-256 es el mismo en ambos casos.

| Fuente | SHA-256 |
|---|---|
| `src/domain/editor-links.ts` | `6173bd6e7083bcd53e7b02f5f9519d28a1dbd793956fcf2c5f70173559e117a2` |
| Migración `aulify_editor_link_validation` | `c414dacd0c2d27335aefb9a3a981ac805f48997a3acb9e0fd5a390f876255132` |
| `tests/unit/editor-links.test.ts` | `180b4b2be6b9963444a0da1cad0dab676a9fda0737324726bb1319f3e606d281` |
| `tests/e2e/editor-enlaces.spec.ts` | `67b14a3a33b6526c767b611d2386a5782d2b373a84abee1e11f272d95694adfb` |

Esta evidencia cierra la comprobación de destinos anidados de AP-33 y la conservación de ejemplos educativos en dominio, PostgreSQL aislado, contrato remoto y navegador de demostración. Cada entorno conserva su evidencia propia; no se atribuye la prueba del contrato remoto a la interfaz autenticada. La validación de imágenes/alternativas ya existente no se amplió en esta unidad.
