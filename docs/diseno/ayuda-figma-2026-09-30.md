# Ayuda inicial y contextual en Figma

Corte: 30 de septiembre de 2026, UTC. Referencia: compilado `NJgfZnpvHJ7YBpHn4hEBZ`, `src/components/help-guide.tsx`, `src/domain/help.ts` y las [cinco capturas reales revisadas](capturas/ayuda-2026-09-30/manifest.json). Se verificaron la identidad conectada y el acceso al archivo antes de escribir.

No existía una composición de la guía inicial. Se añadieron cinco vistas nativas al archivo existente y una muestra compacta con los cinco pasos de cada rol. Las 22 composiciones anteriores de las páginas Plataforma y Móvil conservan identificadores, nombres y medidas; las pantallas y los tableros de la revisión anterior no se reemplazaron.

| Vista | Figma editable | Exportación nativa |
|---|---|---|
| Invitación docente, escritorio 1440 × 900 | [108:4318](https://www.figma.com/design/96LeZKgvvAvsYetQEbTrBC/Aulify?node-id=108-4318) | [PNG](capturas/ayuda-figma-2026-09-30/docente-ofrecimiento-escritorio.png) |
| Invitación estudiante, escritorio 1440 × 900 | [108:4757](https://www.figma.com/design/96LeZKgvvAvsYetQEbTrBC/Aulify?node-id=108-4757) | [PNG](capturas/ayuda-figma-2026-09-30/estudiante-ofrecimiento-escritorio.png) |
| Docente, paso 4, móvil 390 × 844 | [108:7630](https://www.figma.com/design/96LeZKgvvAvsYetQEbTrBC/Aulify?node-id=108-7630) | [PNG](capturas/ayuda-figma-2026-09-30/docente-paso4-movil.png) |
| Estudiante, paso 4, móvil 390 × 844 | [108:7980](https://www.figma.com/design/96LeZKgvvAvsYetQEbTrBC/Aulify?node-id=108-7980) | [PNG](capturas/ayuda-figma-2026-09-30/estudiante-paso4-movil.png) |
| Ayuda estática durante el intento, móvil 390 × 1160 | [110:3036](https://www.figma.com/design/96LeZKgvvAvsYetQEbTrBC/Aulify?node-id=110-3036) | [PNG](capturas/ayuda-figma-2026-09-30/estudiante-ayuda-estatica-quiz-movil.png) |
| Recorridos y estados, muestra de diseño | [110:3830](https://www.figma.com/design/96LeZKgvvAvsYetQEbTrBC/Aulify?node-id=110-3830) | [PNG](capturas/ayuda-figma-2026-09-30/recorridos-estados.png) |

## Componentes y estados

La familia [Guía inicial](https://www.figma.com/design/96LeZKgvvAvsYetQEbTrBC/Aulify?node-id=107-1366) combina invitación y paso con distribución de escritorio y móvil. El [paso reutilizable](https://www.figma.com/design/96LeZKgvvAvsYetQEbTrBC/Aulify?node-id=107-1280) expone número, título y explicación. Se añadieron también la [invitación en inicio](https://www.figma.com/design/96LeZKgvvAvsYetQEbTrBC/Aulify?node-id=107-1367) y la [ayuda durante la actividad](https://www.figma.com/design/96LeZKgvvAvsYetQEbTrBC/Aulify?node-id=107-1375).

Las composiciones representan Ahora no, cierre, Anterior, Siguiente y Terminar guía. La muestra de estados conserva Repetir la guía desde Ayuda y el aviso de nueva versión sin apertura automática. Incluye los diez textos del código, sin inventar funciones. La ayuda del intento se integra antes de la pregunta, con reloj y controles de respuesta visibles, sin capa modal.

Se reutilizaron los botones, la marca, la ilustración vectorial y la navegación del archivo. Los colores y las medidas disponibles se enlazan a variables existentes; se conservan sus modos. Los textos usan Inter y estilos compartidos. Los contenedores relacionados utilizan auto layout. No se insertó ninguna captura ni una pantalla aplanada como relleno.

| Composición | Textos | Instancias | Vectores | Nodos con imagen |
|---|---:|---:|---:|---:|
| Invitación docente | 40 | 11 | 314 | 0 |
| Invitación estudiante | 35 | 10 | 305 | 0 |
| Paso docente móvil | 28 | 10 | 273 | 0 |
| Paso estudiante móvil | 27 | 9 | 273 | 0 |
| Ayuda estática móvil | 21 | 7 | 22 | 0 |
| Muestra de recorridos | 46 | 17 | 0 | 0 |

## Verificación y límites

Se revisaron visualmente las seis exportaciones originales de Figma. Se corrigieron el recorte del contador «1 de 8», la etiqueta móvil de demostración y el reloj vectorial. Los títulos, explicaciones, cierre y acciones de la ayuda se ven completos. Los seis árboles revisados contienen exclusivamente Inter en sus textos y ningún nodo con relleno de imagen.

La referencia y la revisión visual cubren el tema claro. Los fondos del inicio se reconstruyeron con capas nativas para contextualizar el diálogo; presentan diferencias menores en ilustración, iconos y contenido secundario respecto a la captura. El ajuste tipográfico de Figma produce diferencias de pocos píxeles en la altura del diálogo móvil. La muestra de recorridos es documentación de diseño, no una pantalla adicional del producto.

Estas vistas son estados estáticos editables: no acreditan un prototipo interactivo completo, foco real, persistencia de preferencias ni comportamiento de los intentos. La evidencia funcional permanece en [ayuda por cuenta](../verificacion/ayuda-por-cuenta.md). En esta actualización de Figma no se ejecutaron servidores, pruebas, compilaciones ni cambios de código.
