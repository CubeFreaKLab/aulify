# Corrección de pruebas de restauración y foco

29 de septiembre de 2026. El [CI 36644805645](https://github.com/CubeFreaKLab/aulify/actions/runs/36644805645), sobre `26477d9`, terminó con dos fallos del lector, un caso intermitente de vista previa, 75 aprobados y 22 omitidos. Este informe conserva ese resultado y documenta la corrección focalizada posterior; no atribuye aprobación a una nueva ejecución de CI.

## Lector: dato de prueba incompatible con la restauración

El recorrido de [estructura del lector](../../tests/e2e/editor-bloques.spec.ts) escribía directamente un `href` JavaScript en el almacenamiento de la muestra. Tras AP-33, `decodeDemoState` rechaza ese documento durante la restauración. La aplicación muestra «No pudimos abrir la muestra.» y conserva el almacenamiento; no carga el lector ni reemplaza silenciosamente los datos con la muestra inicial. La repetición local anterior a la corrección reprodujo exactamente ese estado.

El recorrido ahora utiliza un destino HTTPS válido y comprueba `decodeDemoState` antes de navegar. Conserva las verificaciones de encabezados, lista, tabla, desplegable, teclado, reflujo y análisis axe. El ejemplo literal `<script>` sigue comprobándose dentro de `pre` y no genera un elemento `script`.

La defensa del lector ante documentos históricos se comprueba directamente en [resource-reader.test.ts](../../tests/unit/resource-reader.test.ts). Cuatro variantes —JavaScript, data, VBScript y valor nulo— son rechazadas por la restauración, pero el componente representa su etiqueta como texto cuando recibe el documento directamente. HTTPS sigue produciendo el único enlace, con `noopener noreferrer`, y el código literal se escapa. Es una prueba de representación HTML del componente con sustitutos de imagen/video y estilos; no simula un guardado aceptado ni navegación del navegador.

## Vista previa: foco inicial de navegación

El [artefacto del CI](https://github.com/CubeFreaKLab/aulify/actions/runs/36644805645/artifacts/11067514839) contiene evidencia concreta de una carrera de foco. En `trace.zip`, `call@465` termina con el botón «Vista previa» enfocado, en `t=64444`. Durante Enter (`call@467`, `t=64458`), el botón pierde `data-focused` y el título Biblioteca adquiere `tabindex=-1`. El componente [WorkspaceTransition](../../src/components/workspace-transition.tsx) programa precisamente ese foco inicial del título mediante `requestAnimationFrame` después de navegar.

La [prueba de vista previa](../../tests/e2e/plataforma.spec.ts) espera ahora a que el título Biblioteca reciba el foco inicial y después enfoca el botón, confirma su foco y pulsa Enter. Se mantienen el cierre, retorno de foco, reapertura, acceso al recurso completo y comprobación de que no se crean intentos. No se modificaron tiempos máximos, reintentos ni código del producto.

## Verificación posterior

| Comprobación | Resultado | Entorno |
|---|---|---|
| Lector de estructura | 2/2 aprobadas; 5,7 s | Chromium escritorio 1440 × 900 y móvil emulado 390 × 844 |
| Lector legado aislado | 4/4 aprobadas; 406 ms | Vitest 5.0.2, representación HTML de React |
| Vista previa y foco | 4/4 aprobadas; 7,3 s | Las dos dimensiones anteriores, movimiento normal y reducido |
| ESLint, Prettier y revisión de espacios | Aprobados | Los tres archivos de pruebas modificados |

Los recorridos de navegador utilizaron el servidor de producción local existente en `http://127.0.0.1:3001`, compilado `Uh-fjoiC7EsPHOpmME_0K`, sin reconstruir ni reiniciar. Los tiempos corresponden a lotes independientes y no son una medición de rendimiento del producto. No se repitieron suites completas ni se incluyen los 22 casos omitidos del CI como aprobados. El resultado focalizado no demuestra ausencia universal de intermitencias en CI; la siguiente ejecución integrada debe conservar su registro propio.

```powershell
npx vitest run tests/unit/resource-reader.test.ts --reporter=verbose
$env:PLAYWRIGHT_BASE_URL='http://127.0.0.1:3001'
npx playwright test tests/e2e/editor-bloques.spec.ts --grep 'lector: estructura' --workers=1 --output .local-private/ci-reader-fixed --reporter=list
npx playwright test tests/e2e/plataforma.spec.ts --grep 'vista previa conserva foco' --workers=1 --output .local-private/ci-preview-fixed --reporter=list
```
