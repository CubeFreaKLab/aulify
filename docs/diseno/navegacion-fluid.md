# Navegación adaptable

La plataforma conserva sus destinos y añade dos formas de recorrerlos: una barra lateral que se puede contraer en computadora y accesos rápidos en la parte inferior del celular. La preferencia de escritorio se conserva en el navegador y se puede cambiar con el mismo botón.

## Comportamiento

- En escritorio, la barra abierta muestra nombres, materias y perfil. Al contraerla conserva los iconos principales, ayuda, preferencias y cambio de tema. Los enlaces mantienen nombres accesibles y muestran su nombre al situar el puntero.
- En móvil, el docente dispone de inicio, materias, biblioteca y revisión; el estudiante, de inicio, materias, tareas y resultados. Más opciones abre el menú completo con los demás destinos y ajustes.
- Una curva se desliza hacia el icono señalado. Pasar el puntero no cambia de página; el destino se abre al activar el enlace. La ubicación actual se comunica también mediante `aria-current`.
- El menú móvil conserva contención y devolución del foco, cierre con Escape y cierre al pasar al ancho de escritorio. La barra inferior contempla el área segura del dispositivo y espacio al final del contenido.
- La preferencia de movimiento reducido elimina el desplazamiento perceptible. La selección sigue siendo visible sin animación.

## Apariencia

Se conserva Inter y la ilustración propia de Aulify. Los fondos de uso general pasan a blanco y gris; el verde se reserva a la marca, ilustraciones y señales puntuales. En oscuro, las superficies utilizan carbón y gris. No cambia el contenido coloreado expresamente por el docente en un recurso.

El patrón de curva toma como referencia [Fluid Wave Navbar de RewampUI](https://www.rewampui.com/components/fluid-wave-navbar). La adaptación usa los enlaces, iconos Lucide, estilos y componentes accesibles existentes; no incorpora otro sistema visual ni una dependencia de animación. En escritorio la curva se orienta verticalmente. Es una adaptación para los recorridos de Aulify.

## Comprobación

`tests/e2e/navegacion-fluid.spec.ts` cubre contracción, conservación de preferencia, navegación sin cambio accidental al pasar el puntero, destinos por perfil, menú completo, ancho de 320 px y movimiento reducido. `tests/e2e/navegacion.spec.ts` conserva las comprobaciones del foco, Escape y cambio de ancho. Los análisis automáticos de estas barras no equivalen a una certificación integral de accesibilidad ni a una prueba con participantes.
