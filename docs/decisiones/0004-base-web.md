# ADR 0004: base web y editor del prototipo

Fecha: 27 de septiembre de 2026.

**Estado: base web y editor integrados en el prototipo con datos ficticios.** Hay comprobaciones locales registradas; la revisión final y el resultado remoto de integración continua se mantienen separados. La [evidencia de pruebas](../verificacion/pruebas-prototipo.md) describe qué se ejecutó y sus límites. El [plan técnico](../../plan.md) conserva la arquitectura modular y la integración posterior con Supabase. No se acredita conformidad WCAG completa ni seguridad de producción.

## Decisión

El prototipo usa Next.js 16.3.6, React y React DOM 19.3.0 y TypeScript 6.0.3. Separa presentación, reglas de dominio y acceso a datos mediante contratos tipados en `src/components` y `src/domain`. El adaptador inicial persiste únicamente datos ficticios en el navegador y se sustituirá por servicios autorizados; no representa autenticación segura ni permisos de servidor.

React Aria Components proporciona los botones y diálogos compartidos de `src/components/ui.tsx`, junto con controles HTML semánticos y estilos propios. BlockNote está integrado en la edición de contenido por bloques, con `@blocknote/ariakit` como interfaz del editor. Esta combinación conserva los tokens de Aulify sin incorporar el sistema visual completo de Mantine. Ariakit queda limitado a la integración interna del editor, para evitar dos implementaciones distintas de controles equivalentes en el resto de la plataforma. La [guía oficial de Ariakit para BlockNote](https://www.blocknotejs.org/docs/getting-started/ariakit) admite estilos propios o su hoja predeterminada.

Versiones instaladas y fijadas en `package.json` y `package-lock.json`:

| Paquete | Versión fijada | Licencia declarada |
|---|---|---|
| `react-aria-components` | 1.21.1 | Apache-2.0 |
| `@blocknote/core` | 0.55.0 | MPL-2.0 |
| `@blocknote/react` | 0.55.0 | MPL-2.0 |
| `@blocknote/ariakit` | 0.55.0 | MPL-2.0 |

Los paquetes publicados declaran compatibilidad con React 18 y 19. Aulify ya cuenta con instalación e interacción del editor comprobada en los recorridos locales descritos en el informe; ese resultado no se deduce únicamente del rango declarado. Las comprobaciones finales de construcción y tipos deben conservar su resultado asociado a la revisión ejecutada. Fuentes de metadatos: [React Aria Components](https://registry.npmjs.org/react-aria-components/1.21.1), [BlockNote Core](https://registry.npmjs.org/@blocknote%2fcore/0.55.0), [React](https://registry.npmjs.org/@blocknote%2freact/0.55.0) y [Ariakit](https://registry.npmjs.org/@blocknote%2fariakit/0.55.0).

Conservar avisos y licencias de las dependencias distribuidas. Los paquetes XL de BlockNote tienen condiciones distintas, GPL-3.0 o licencia comercial; no se incorporan. No se necesita XL para el editor de esta entrega. [Licencia de React Aria](https://github.com/adobe/react-spectrum/blob/main/LICENSE) y [condiciones de BlockNote](https://www.blocknotejs.org/pricing).

## Integración actual y pendientes

### Controles y renderizado

La instalación usa `react-aria-components`. Los componentes compartidos importan sus primitivas desde el paquete y aplican clases y atributos de estado con los tokens de Aulify. La documentación también ofrece imports por componente, por ejemplo `Button` desde `react-aria-components/Button`. [Instalación y composición](https://react-aria.adobe.com/getting-started).

La aplicación utiliza Next App Router, declara `lang="es"` en el documento y mantiene los controles con eventos y estado en componentes cliente. El editor se importa dinámicamente desde su pantalla. La configuración explícita de `I18nProvider` y la revisión de mensajes internos siguen pendientes; al completarlas, mantener el mismo idioma en servidor y cliente. [Integración con frameworks](https://react-aria.adobe.com/frameworks).

React Aria incluye gestión de teclado, foco e interacción táctil, pero Aulify sigue siendo responsable de etiquetas, contraste, tamaño de controles, orden de foco y movimiento reducido. Los recorridos locales comprobaron estados concretos de diálogos, foco y móvil emulado. Queda la evaluación manual más amplia y con dispositivos físicos descrita en el informe. [Criterios de calidad de React Aria](https://react-aria.adobe.com/quality).

### Editor

`src/components/rich-editor.tsx` usa `useCreateBlockNote` de `@blocknote/react`, el diccionario español y `BlockNoteView` de `@blocknote/ariakit`. `editor-screen.tsx` lo carga mediante `next/dynamic` y `ssr: false`, conforme a la [guía de Next.js](https://www.blocknotejs.org/docs/getting-started/nextjs). Inter Variable se carga desde `@fontsource-variable/inter` en el layout y se aplica mediante los tokens de la aplicación.

El contenido nativo `editor.document` se guarda como JSON en `editorDocument`, junto con una representación semántica de los bloques para el recorrido. El adaptador valida su estructura, conserva la revisión del borrador y publica una copia versionada. La prueba de plataforma comprueba edición enriquecida, autoguardado, recarga y publicación. HTML y Markdown no se usan como fuente de persistencia; sus conversiones pueden perder información. [Formatos y serialización](https://www.blocknotejs.org/docs/foundations/supported-formats).

El esquema incluye un bloque `quiz` que conduce a la edición de preguntas del recurso. Las preguntas, intentos y evaluaciones tienen estructuras propias. La publicación conserva una instantánea y el recorrido verifica que editar el borrador no cambia la actividad respondida. En el prototipo, el conjunto ficticio sigue disponible en almacenamiento local: la separación de vistas no protege soluciones frente a quien inspeccione el navegador. En la integración real, los contratos y permisos del [modelo](../modelado/README.md) deberán evitar que una lectura estudiantil reciba claves de corrección ocultas.

El bloque propio se define mediante `createReactBlockSpec` y su fábrica se instancia al crear `BlockNoteSchema`. El esquema habilita párrafos, títulos, listas, imagen, video y quiz. La cobertura observada del editor está delimitada en el informe; no se asume que probar un bloque compruebe todas sus variantes. [Bloques personalizados](https://www.blocknotejs.org/docs/features/custom-schemas/custom-blocks).

La biblioteca admite extensiones y atajos, pero no reemplazan acciones visibles. El editor ofrece «Ordenar bloques con botones», con acciones de subir y bajar. La autoría de preguntas y la respuesta de secuencias también tienen controles sin arrastre. La cobertura completa de esas acciones con teclado y tecnologías de asistencia sigue sujeta a revisión manual. [Extensiones](https://www.blocknotejs.org/docs/features/extensions).

BlockNote documenta una barra móvil sobre el teclado y diferencias de viewport en iOS. La integración debe comprobar desplazamiento, selección y visibilidad de acciones con teclado abierto; emular solo el ancho del teléfono no demuestra ese comportamiento. Revisar `interactive-widget=resizes-content` y el contenedor recomendado en función de la versión instalada. [Compatibilidad móvil](https://www.blocknotejs.org/docs/getting-started) y [barra de formato](https://www.blocknotejs.org/docs/react/components/formatting-toolbar).

## Evidencia y cierre de la integración

El [informe de verificación](../verificacion/pruebas-prototipo.md) registra 24 pruebas unitarias y una batería local de 38 ejecuciones E2E aprobadas sobre Chromium. Incluye la regresión de edición de recursos existentes: formato, bloque propio, guardado, recarga y ordenación con teclado. Las versiones y los lotes se identifican por separado; no se atribuyen automáticamente a revisiones posteriores.

El flujo [web.yml](../../.github/workflows/web.yml) configura instalación reproducible, formato, ESLint, tipos, Vitest, construcción y Playwright con artefactos. La [ejecución remota 36343447881](https://github.com/CubeFreaKLab/aulify/actions/runs/36343447881), sobre `56486c8`, terminó correctamente. La integración con Supabase y su prueba T-01 no están realizadas.

Para cualquier nueva revisión se conservan los siguientes criterios:

1. Construcción y comprobación de tipos sin errores de SSR ni hidratación; editor cargado únicamente donde se utiliza.
2. Editar explicación y un bloque propio, guardar, recargar y obtener contenido equivalente; conservar la versión respondida después de editar el borrador.
3. Completar el recorrido del editor con teclado; foco restituido al cerrar diálogos, sin pérdida del texto ni trampas de navegación.
4. Revisar móvil con controles táctiles y teclado virtual, contraste, zoom y movimiento reducido; registrar límites del entorno de prueba.
5. Medir el resultado real de la integración y registrar pruebas pendientes. Una biblioteca accesible no certifica la composición final.

Si BlockNote impide un criterio necesario, conservar el contrato de contenido y documentar la limitación antes de cambiar la implementación. La alternativa acotada sería un editor de bloques propios con campos semánticos y ordenación por botones; un reemplazo completo por otro motor necesita otra evaluación, no una afirmación de equivalencia automática.

Supabase, SMTP, permisos reales y archivos remotos no forman parte de esta decisión de interfaz. Su situación se registra en [viabilidad de servicios](../verificacion/viabilidad-servicios.md).
