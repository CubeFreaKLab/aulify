# Diagnóstico de una vista previa protegida

Los ejecutores de sesenta segundos y del escenario completo admiten el compilado local y una vista previa identificada del proyecto Aulify. Esta preparación no significa que se haya ejecutado o aprobado la carga remota. El escenario completo conserva cinco minutos de calentamiento y quince de medición en cada modalidad, con sus criterios anteriores.

## Identificar el destino

Antes de enviar datos ficticios, comprobar en Vercel proyecto, entorno Preview, revisión y estado Ready. Guardar localmente un manifiesto con `baseUrl`, `buildId`, `projectId`, `sourceCommit`, `environment: "preview"` y `ready: true`. El identificador de compilado debe corresponder al sitio publicado, no al directorio `.next` local.

El acceso de automatización requiere una clave creada expresamente por el propietario. Guardarla en un archivo privado excluido de Git y revocarla al terminar la verificación. El código no crea claves ni modifica protecciones. Este mecanismo supera la protección del alojamiento; cada cuenta sigue necesitando su sesión y permisos de Aulify. [Documentación de Vercel](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation).

Para `tools/datos/load-protocol.mjs`, proporcionar:

- `AULIFY_LOAD_BASE_URL`: el origen exacto de la vista previa.
- `AULIFY_EXPECTED_BUILD_ID`: su identificador de compilado.
- `AULIFY_LOAD_PREVIEW_MANIFEST`: ruta al manifiesto local.
- `AULIFY_LOAD_PREVIEW_SECRET_FILE`: ruta al archivo privado con la clave temporal.

Para `tools/datos/load-run.mjs`, usar `AULIFY_LOAD_URL` en lugar de `AULIFY_LOAD_BASE_URL`; las otras tres variables son las mismas. Siete pruebas locales de destino y criterios aprobaron tras adaptar el ejecutor completo. El informe identifica el destino real y ya no exige un directorio `.next` local para medir una Preview. La carga remota sigue pendiente de acceso autorizado; no se aprueban Q-06 ni Q-09 por preparar el ejecutor.

El ejecutor limita el destino al proyecto y equipo conocidos, exige manifiesto concordante y comprueba el compilado servido antes de preparar actividades. Adjunta la clave en una cabecera, sin escribirla en URLs ni resultados. No sigue redirecciones: así evita trasladar cookies o credenciales a un destino diferente. Producción y otros proyectos son rechazados. El modo local conserva el cotejo de `.next/BUILD_ID` y no recibe la clave de Vercel.

## Verificación disponible

Cuatro pruebas locales de `load-target.test.mjs` aprobaron rechazo de destinos distintos o producción, tratamiento de redirecciones, ausencia de secretos en metadatos y comprobación del compilado servido. También aprobaron las tres pruebas existentes de espera del servicio. La comprobación de sintaxis y ESLint aprobó. GitHub Actions incorpora las cuatro pruebas de destino; su resultado remoto debe consultarse en la ejecución correspondiente, sin atribuirle el resultado local.

La ejecución [36684781440](https://github.com/CubeFreaKLab/aulify/actions/runs/36684781440), revisión `42c56d7`, completó con éxito ese paso: cuatro pruebas aprobadas y cero fallos. Los registros descargados también confirmaron 159 pruebas unitarias, 88 recorridos de navegador y 26 ejecuciones autenticadas omitidas. Las huellas y pasos están en [ci-integracion.json](ci-integracion.json). Este CI verifica el ejecutor y la aplicación; no ejecuta una carga contra Supabase o Vercel.

Los resultados identifican por separado el commit del ejecutor, la revisión de la aplicación desplegada y su compilado. Conservan presupuesto, corte ante fallos, auditoría de persistencia y separación entre diagnóstico y aceptación. No trasladar un resultado local a Vercel ni aprobar Q-06/Q-09 con este diagnóstico abreviado.
