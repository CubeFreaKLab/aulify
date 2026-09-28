# Capturas del refinamiento visual

Capturas reales de la web en desarrollo, con contenido y fuentes cargados. Tamaños, tema, desplazamiento, navegador y SHA-256 se registran en [manifest.json](manifest.json).

- [Escritorio, apertura](escritorio-apertura.png), [intermedia](escritorio-intermedia.png), [salida](escritorio-salida.png) y [página completa](escritorio-completa.png).
- [Móvil, apertura](movil-apertura.png), [intermedia](movil-intermedia.png), [salida](movil-salida.png) y [página completa](movil-completa.png).
- [Compacto con movimiento reducido](compacto-reducido-apertura.png) y [página completa](compacto-reducido-completa.png).
- [Tema oscuro, apertura](oscuro-apertura.png) y [página completa](oscuro-completa.png).

Se reproducen con `node tools/diseno/capturar-portada.mjs`; `CAPTURE_URL` establece el servidor, `CAPTURE_OUTPUT` el destino y `CAPTURE_ENV` el entorno. El script comprueba encabezado, fuentes e imágenes antes de guardar. No usar capturas de estados de carga como evidencia de la pantalla terminada.
