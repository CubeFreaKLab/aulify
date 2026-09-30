# Continuidad y cierre de una clase guiada

AP-09 y AP-10 se comprobaron en un recorrido con Supabase real, dos estudiantes en la sala, un tercero aprobado que intentó entrar tarde y el docente en otro contexto de navegador. Las ejecuciones finales de escritorio y móvil aprobaron sobre el compilado local `53g5fvMCLq04i5j55mrWy`. El [registro](guiada-continuidad.json) conserva horarios, identificadores ficticios, huellas del código, resultados y capturas.

## Recorrido comprobado

| Paso | Resultado observado |
|---|---|
| E1 y E2 entran a la sala desde la interfaz | Ningún intento consumido; cada uno conserva su oportunidad. |
| El docente comienza y se repite la orden de inicio | Un intento por estudiante, sin duplicados. |
| Se desactiva la red del contexto docente | `navigator.onLine` es falso y una consulta desde esa página falla. E1 sigue pudiendo responder desde su propio contexto. |
| E1 responde la primera pregunta; E2 la deja pendiente | E1 ve la espera del grupo. Tres observaciones separadas mantienen la primera pregunta abierta y el mismo plazo. |
| El tercer estudiante intenta ingresar | Se rechazan tanto la incorporación tardía a la sala como la creación de un intento. |
| El docente recupera red y recarga | Recupera la misma pregunta y los mismos intentos y plazos de E1 y E2. |
| Intenta cerrar con una respuesta pendiente | El servidor exige confirmación y la interfaz muestra el aviso. Tras confirmar, E2 no puede responder la pregunta ya cerrada. |
| Ambos contestan la última pregunta escrita y el docente cierra | La sesión termina normalmente; ambos intentos quedan cerrados con corrección escrita pendiente. La publicación incompleta se rechaza. |
| Se corrige la escritura y se publican las notas | E1 obtiene 20/20 y E2 12/20; se conserva el cero correspondiente a la omisión de E2. |

La primera pregunta valía dos puntos y la escrita tres. Antes de corregir la escritura se comprobaron dos puntos para E1 y cero para E2; después de asignar los tres puntos manuales, las notas corresponden a 5/5 y 3/5, normalizadas sobre veinte.

La interrupción docente medida fue de 13.450 ms en escritorio y 30.010 ms en móvil. Es el intervalo de esta ejecución, no una prueba de desconexión ilimitada ni de caducidad. El servidor y Supabase permanecieron conectados. El reloj de las actividades tenía una hora disponible; no se modificó para obtener el resultado.

## Corrección de avisos

La comprobación inicial falló al localizar el aviso de cierre. El selector comparaba texto exacto de un contenedor que también incluía un botón; se sustituyó por el aviso accesible con `role="alert"`. Además, una prueba unitaria independiente reprodujo un defecto del almacén: después de rechazar una operación, una lectura automática sustituía su mensaje por `null`.

El almacén ahora distingue el aviso de una operación de los fallos de lectura. Conserva el primero durante la sincronización y lo retira al cerrarlo o al completar una acción posterior. Una confirmación antigua no puede ocultar un error más reciente. Los errores de lectura siguen desapareciendo al recuperarse la conexión. Limpiar la sesión elimina también estos avisos.

Las once pruebas del almacén aprobaron, incluidas las tres regresiones nuevas y las de recuperación, permisos y respuestas confirmadas existentes. La batería completa aprobó 162 pruebas en dieciocho archivos. Compilación, TypeScript, ESLint y formato también aprobaron localmente. El [CI 36691946349](https://github.com/CubeFreaKLab/aulify/actions/runs/36691946349), sobre `f9a7013`, también aprobó: 162 pruebas unitarias y 88 recorridos de navegador, sin casos inestables. Omite 28 ejecuciones autenticadas; los dos recorridos remotos de este informe tienen la evidencia separada descrita arriba. Los logs descargados y sus huellas están en [el registro de CI](ci-integracion.json).

Se ajustaron los textos de la sesión finalizada: ahora indican revisar respuestas y publicar calificaciones; dejaron de indicar abrir una siguiente pregunta inexistente.

## Capturas verificadas

Las capturas pertenecen a las ejecuciones finales con datos ficticios. Se comprobó ausencia de desbordamiento horizontal. El enlace «Saltar al contenido» aparece enfocado en la captura docente móvil y se conserva como parte del estado real.

- [Docente, sesión finalizada en escritorio](../diseno/capturas/guiada-2026-09-30/chromium-escritorio-docente-finalizada.png).
- [Estudiante, espera del grupo en escritorio](../diseno/capturas/guiada-2026-09-30/chromium-escritorio-estudiante-espera.png).
- [Docente, sesión finalizada en móvil](../diseno/capturas/guiada-2026-09-30/chromium-movil-docente-finalizada.png).
- [Estudiante, espera del grupo en móvil](../diseno/capturas/guiada-2026-09-30/chromium-movil-estudiante-espera.png).

## Reproducción y alcance

El [recorrido automatizado](../../tests/e2e/guiada-continuidad.spec.ts) requiere una aplicación local compilada y las cuentas ficticias ya preparadas en archivos excluidos de Git. Sin habilitación expresa, se omite en el CI sin credenciales.

```powershell
$env:AULIFY_REMOTE_E2E='1'
$env:PLAYWRIGHT_BASE_URL='http://127.0.0.1:3001'
npx playwright test tests/e2e/guiada-continuidad.spec.ts --workers=1
```

La preparación de materia, contenido e inscripciones utiliza la API autenticada. El ingreso en sala, comienzo, respuestas, cierre con confirmación y finalización se operan visualmente. Las solicitudes inválidas, la repetición de inicio y el cálculo de notas se contrastan por API. Se reutilizan cuentas ficticias y se archiva únicamente la materia de cada ejecución; las sesiones creadas se cierran individualmente.

Se utilizó tema claro y movimiento reducido. Chromium emula el dispositivo docente móvil; los contextos estudiantiles usan los tamaños de escritorio y móvil correspondientes. No se presentan como teléfonos físicos, pruebas con personas, entrega de correo, capacidad sostenida ni producción. El primer ensayo fallido y la primera repetición aprobada, anterior al ajuste de textos, no se suman a los dos recorridos finales.
