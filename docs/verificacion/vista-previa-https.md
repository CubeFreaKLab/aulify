# Vista previa HTTPS

El 30 de septiembre de 2026 se desplegó Aulify en Vercel **Preview**, conservando Vercel Authentication y el plan Hobby. Producción no fue promovida.

- Revisión: `27e4df6d3ce94a82fc2840462f84da41e4a3a163`.
- Despliegue: `dpl_4KGmpDfwJEdA91hYu1fDWxjB7LSz`, estado **Ready** a las 06:00:52 UTC.
- [Dirección de la vista previa](https://aulify-4gaarf1mp-jdanielchfhd-9543s-projects.vercel.app).
- [CI correspondiente](https://github.com/CubeFreaKLab/aulify/actions/runs/36675862768): aprobado, 157 pruebas en dieciocho archivos, 85 comprobaciones SQL generales, 26 de proyección docente, 32 del resumen y 88 recorridos de navegador. Las 24 ejecuciones autenticadas omitidas no se cuentan como aprobadas. Los registros descargados sustentan los recuentos y hashes de `ci-integracion.json`.

## Comprobaciones en Chrome

Se utilizaron dos cuentas ficticias existentes en Supabase, una docente y una estudiante. El recorrido docente inició sesión, creó un recurso, editó título y contenido y esperó la confirmación de guardado. Después de recargar la página, ambos valores seguían presentes. Al cerrar sesión, volver a la dirección del editor redirigió al formulario de acceso.

La cuenta estudiante inició sesión, abrió resultados y filtró por una materia. La tabla y el gráfico mostraron el mismo promedio, 66,67, calculado sobre cuatro notas publicadas de sus datos de prueba. Intentar abrir el editor docente mostró que ese espacio no estaba disponible. Al terminar se cerró la sesión.

En la vista previa anterior, revisión `71d9b48`, se comprobaron también la portada, el editor de demostración y una respuesta del quiz seguida de su retroalimentación y avance a la siguiente pregunta. No se trasladan automáticamente todas las comprobaciones a otra revisión.

## Alcance

Estas observaciones prueban acceso y persistencia básicos entre Vercel y Supabase por HTTPS. No incluyen envío de correo, carga de archivos, toda la batería de permisos, medición sostenida desde Vercel ni promoción de producción. El control bloqueante de despliegue sigue configurado, pero falta comprobar su ciclo de rechazo y aprobación en producción. Las capturas se conservaron con datos ficticios; no contienen contraseñas ni claves.
