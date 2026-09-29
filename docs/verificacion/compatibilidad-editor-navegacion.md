# Compatibilidad del editor y la navegación

29 de septiembre de 2026. Comprobación local sobre Next.js compilado, con datos ficticios de demostración. Se utilizaron Playwright 1.63.0, Firefox 155.0 y WebKit 26.6, además de los proyectos Chromium de escritorio y móvil.

## Hallazgos corregidos

- En WebKit, activar con el puntero el botón de navegación no le daba foco. Al cerrar el diálogo con Escape, el foco no regresaba al botón. La apertura ahora enfoca explícitamente el disparador antes de mostrar el diálogo.
- Firefox descartaba `clipboardData` al construir el evento sintético de la prueba. Se corrigió la preparación del evento para verificar el procesamiento del pegado con formato. Esto no constituye una comprobación del portapapeles nativo del sistema.
- El análisis de contraste se iniciaba antes de completarse la actualización del tema en WebKit. La prueba ahora espera tanto el atributo de tema como el color de texto esperado antes de ejecutar axe. No fue necesario añadir una regla de color a la aplicación para resolver este hallazgo.

## Resultados

El lote inicial de veinte ejecuciones en Firefox y WebKit obtuvo diecisiete aprobadas y tres fallidas. Los tres hallazgos anteriores corresponden a esas pruebas; el lote inicial no se declara íntegramente aprobado.

Después de los cambios, en la compilación `T_5qSEJ-EXz4mAThM-uhx`:

| Comprobación | Resultado |
|---|---|
| Editor y navegación, Chromium escritorio y móvil | Cuatro ejecuciones aprobadas; 11,9 s. |
| Navegación, Firefox y WebKit | Dos ejecuciones aprobadas en el lote focalizado. |
| Editor, WebKit | Aprobada en el mismo lote focalizado. |
| Editor, Firefox | Repetida por separado y aprobada; 8,2 s el lote. |

La primera repetición de Firefox llegó a completar sus aserciones, pero falló al cerrar el contexto porque otra ejecución eliminó su directorio de trazas. Los resultados de compatibilidad se separaron del directorio utilizado por la suite principal y se repitió el caso afectado. No se atribuye ese fallo de infraestructura a la aplicación.

La compilación y la comprobación de tipos terminaron correctamente. Los recorridos cubren menú de bloques, formato, controles por teclado, recuperación del borrador, tema oscuro y retorno de foco; no representan la totalidad de funcionalidades en todos los navegadores, Safari físico ni conformidad completa con WCAG.

## Reproducción

Con un servidor de producción local disponible, definir `PLAYWRIGHT_BASE_URL` y ejecutar:

```powershell
npx playwright install firefox webkit
npx playwright test --config=playwright.compatibility.config.ts tests/e2e/editor-bloques.spec.ts tests/e2e/navegacion.spec.ts --grep 'slash buscable|foco contenido'
```

Los informes y trazas se guardan localmente en `playwright-compatibility-report/` y `test-results-compatibility/`, excluidos de Git. Las pruebas de autenticación remota mantienen su ejecución y evidencia separadas.
