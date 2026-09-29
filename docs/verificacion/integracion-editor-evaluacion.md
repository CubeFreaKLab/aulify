# Integración de editor, evaluación y fallos del servicio

29 de septiembre de 2026. La compilación de producción local `Uh-fjoiC7EsPHOpmME_0K` incorpora la validación de enlaces y la clasificación de errores RPC, además de las correcciones de editor, biblioteca y navegación.

- `npm test`: doce archivos y 98 pruebas aprobadas, 5,07 s. Incluye reglas y rutas con transporte simulado, y dos secuencias de contrato PostgreSQL en PGlite; no son 98 casos de aceptación.
- `npm run format:check`, `npm run lint` y `npm run build`: aprobados. La construcción incluyó la comprobación de TypeScript.
- Playwright sobre producción local: cuatro ejecuciones aprobadas, 9,7 s. AC-22 y AP-33 se repitieron en Chromium de escritorio y móvil. Se verifican el pendiente visible, la publicación del mejor intento y la conservación de HTTPS y código educativo literal al editar, guardar y leer.

Los procedimientos y evidencia detallada están en [calificaciones](aceptacion-calificaciones.md), [enlaces](enlaces-editor.md) y [clasificación de fallos RPC](comandos-clasificacion-fallos-rpc.md). Las pruebas focalizadas no sustituyen los recorridos autenticados ni convierten los fallos de capacidad anteriores en aprobaciones. No se ejecutó otra carga después del [sondeo de migración 16](datos-protocolo-60s-migracion16.md).

La migración 17 se verificó aplicada en Supabase con identificador `20260929231531`; el helper nuevo conserva ejecución exclusiva del propietario y el trigger de versiones está presente. Los avisos del asesor conservan el mismo alcance: tablas privadas con RLS sin políticas directas y la protección de contraseñas filtradas no habilitada en Free. La comprobación de estructura no sustituye el ensayo funcional remoto de enlaces, que se registra por separado.

El servidor local se renovó con el compilado indicado. Esta comprobación no es un despliegue HTTPS ni acredita entrega de correos, restauración operativa o conformidad completa con WCAG.
