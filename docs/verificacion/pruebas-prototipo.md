# Verificación del prototipo web

Fecha de comprobación: 27 de septiembre de 2026.

El prototipo permite recorrer la creación de un recurso, su publicación, la participación del estudiante, la revisión docente y la publicación de la nota con datos ficticios. Las pruebas descritas aquí se ejecutaron contra el adaptador local de demostración. Todavía no comprueban autenticación, almacenamiento ni permisos de Supabase.

## Resultados observados

| Comprobación | Resultado | Entorno |
| --- | --- | --- |
| Reglas del dominio en Vitest | 24 pruebas aprobadas, incluida regresión de serialización del editor | Node.js local |
| Recorridos públicos y de plataforma | 32 ejecuciones aprobadas; sin fallos, omitidas ni reintentos recuperados | Chromium, escritorio y móvil emulado |
| Ocho tipos de pregunta y sesión guiada | 4 ejecuciones aprobadas; sin fallos, omitidas ni reintentos recuperados | Chromium, escritorio y móvil emulado |
| Recurso existente, formato y reordenamiento | 2 ejecuciones aprobadas | Chromium, escritorio y móvil emulado |
| Batería completa contra versión compilada | 38 ejecuciones aprobadas; ninguna fallida, omitida ni recuperada mediante reintento | Next.js compilado, Chromium en ambos tamaños |
| axe en landing, acceso, registro, recuperación e inicio de ambos perfiles | Sin infracciones detectadas por las reglas seleccionadas en los 12 análisis | Seis vistas por dos tamaños |
| TypeScript, ESLint, formato y construcción | Sin errores | Comprobación local y GitHub Actions |
| GitHub Actions | Ejecución 36343447881 completada correctamente sobre `56486c8` | Node.js 24 y Ubuntu |

El catálogo E2E final contiene 19 casos ejecutados en dos proyectos de navegador: 38 ejecuciones. La batería completa sobre la aplicación compilada comenzó el 27 de septiembre a las 19:08:51 UTC y duró 51,3 segundos. El código de aplicación compilado correspondía a `a5ef296`; incluía la corrección de guardado del editor y navegación. Los ajustes posteriores del título móvil y herramientas están en `8f4ec5b`; la ejecución remota verifica la revisión publicada que los incorpora. Los tiempos indicados corresponden a pruebas, no al tiempo de desarrollo.

Antes se ejecutaron tres lotes de desarrollo: 32 comprobaciones iniciales, 4 de participación y 2 de edición del recurso existente. Su evidencia identifica el árbol de trabajo correspondiente; no se suman como casos independientes al total final. La primera batería compilada obtuvo 33 aprobadas y 5 fallidas por una espera incorrecta al cerrar diálogos. Se conservó ese informe, se corrigió la espera y se repitieron los casos afectados antes de la batería completa aprobada.

## Entorno y alcance de los casos

Se utilizaron Windows, Node.js 24.14.1, Playwright 1.63.0 y Chromium 153.0.8010.12. El servidor de desarrollo se atendió en `127.0.0.1:3000`. Los proyectos de Playwright usan escritorio de 1440 × 900 y móvil emulado de 390 × 844 píxeles CSS, idioma español y zona horaria de Bolivia. Hay una comprobación adicional de reflujo a 320 píxeles en landing y acceso. La emulación móvil no equivale a probar un teléfono físico.

| Comportamiento que se debe conservar | Evidencia automatizada |
| --- | --- |
| La landing presenta la marca, carga sus imágenes y permite explorar la demostración | Enlaces de docente y estudiante, carga efectiva de imágenes, pregunta pública operativa y ausencia de desbordamiento horizontal |
| Las preferencias de movimiento no impiden comprender ni utilizar la interfaz | Escena de la landing estable con movimiento reducido; apertura y cierre de vista previa con movimiento normal y reducido |
| Los formularios de acceso comunican su estado real | Validación y foco del primer error, control de visibilidad de contraseña, ausencia de credenciales en almacenamiento y explicación de que la recuperación no envía correo |
| La ayuda inicial puede omitirse sin alterar actividades | Cierre y persistencia de la preferencia; no se consume un intento |
| La navegación corresponde al perfil y a la membresía | Herramientas docentes no disponibles para estudiantes; estudiante pendiente no accede a la actividad; cambio de perfil de demostración |
| Los diálogos mantienen un recorrido de teclado comprensible | Entrada y contención del foco, cierre mediante Escape y devolución al control que abrió el diálogo |
| Un problema de almacenamiento no destruye datos al leer | JSON corrupto conservado hasta que se solicita expresamente reiniciar la demostración |
| El recurso se puede guardar, recargar y publicar | Creación desde la interfaz, edición de contenido enriquecido, autoguardado, recarga y publicación de una versión |
| Participar no publica automáticamente una nota | Pregunta cerrada y escrita; corrección pendiente, revisión docente y publicación explícita; nota final de 75 sobre 100 en el caso de prueba |
| Ocultar corrección también oculta señales que revelen el resultado | Avance sin mensaje de acierto/error ni explicación, y sin estado intermedio de «respuesta guardada»; resultados sin desglose de respuestas cuando la configuración lo oculta |
| Editar el borrador no cambia la actividad ya publicada | El estudiante conserva el título y la nota de la versión que respondió |
| Se pueden responder los ocho tipos de pregunta | Selección única y múltiple, verdadero/falso, relaciones, secuencias, espacios con opciones, espacios escritos y respuesta abierta |
| Las ayudas respetan los límites configurados | Pista y doble se usan una vez, permanecen consumidos y las dos respuestas escritas quedan pendientes de revisión |
| El ritmo guiado permite completar una sesión | Publicación desde el editor con un intento y sin mezcla de preguntas; ingreso a sala, inicio docente, respuesta, espera, avance docente y cierre |

La prueba guiada utiliza dos pestañas del mismo contexto del navegador y los eventos de almacenamiento. Comprueba la coordinación de la demostración; queda pendiente comprobar un servicio de tiempo real entre cuentas y dispositivos independientes.

Las pruebas unitarias complementan estos recorridos con reglas de puntuación exacta y redondeo final, selección múltiple completa, puntos parciales, revisión manual, promedio con pendientes, publicación inmutable, reconexión al mismo intento, envíos idempotentes, conflictos de borrador, vencimientos y errores de persistencia. También verifican que una corrección privada posterior no sustituya una nota publicada hasta que el docente vuelva a publicarla.

## Accesibilidad y correcciones encontradas

Los análisis de axe seleccionan las etiquetas `wcag2a`, `wcag2aa`, `wcag21aa` y `wcag22aa`. Durante la comprobación se detectó que el control de cambio de perfil perdía su nombre accesible en móvil al ocultarse su texto. Se incorporó un nombre accesible al botón y las comprobaciones posteriores pasaron en ambos tamaños.

La inspección complementaria del editor detectó que su área editable carecía de nombre accesible; se añadió «Contenido del recurso». Los análisis puntuales de editor, pestaña de integrantes y primera pregunta del quiz terminaron sin infracciones detectadas. Se comprobó también la devolución del foco al título al navegar hacia delante y atrás, y el cambio de pestañas mediante flechas. A 320 píxeles se corrigió el desbordamiento interno de los controles de pregunta. Las [capturas seleccionadas](../diseno/capturas/README.md) conservan el resultado visual y su revisión fuente.

El editor de un recurso existente emitía propiedades opcionales `undefined` en bloques sin contenido. El adaptador de interfaz ahora convierte el documento de BlockNote a JSON antes de validarlo. Se comprobó guardado, recarga, negrita y ordenación con teclado; la validación de tipos, ciclos y soluciones privadas permanece activa. Esta regresión forma parte del catálogo E2E.

Las pruebas de diálogos esperan su desmontaje real antes de medir contraste o cambiar de recorrido. Esto evita medir textos durante el fundido de salida o confundir dos diálogos en transición. No se desactivan las animaciones ni las reglas de contraste para obtener el resultado aprobado.

El resultado de axe no certifica conformidad completa con WCAG. Sigue pendiente una revisión manual con lector de pantalla, ampliación y contraste en todos los estados; también la evaluación de comprensión y facilidad de uso con personas. Las comprobaciones de teclado, foco, movimiento reducido y reflujo registradas aquí cubren estados concretos, no toda interacción posible.

## Reproducción y evidencia

Desde la raíz del repositorio, con Node.js 24:

```sh
npm ci
npx playwright install chromium
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

La comprobación de tipos genera primero los tipos de rutas de Next.js. Esto permite ejecutarla en una copia nueva del repositorio sin depender de un directorio `.next` creado por una sesión anterior.

En ejecución local, Playwright reutiliza el servidor disponible o inicia `npm run dev`. En CI inicia `npm run start` sobre la compilación producida por el paso de construcción. `PLAYWRIGHT_BASE_URL` permite indicar la URL del servidor que se debe comprobar.

Los archivos de prueba están en `tests/e2e/publico.spec.ts`, `tests/e2e/plataforma.spec.ts` y `tests/e2e/participacion.spec.ts`. Para repetir únicamente la ampliación:

```sh
npx playwright test tests/e2e/participacion.spec.ts
```

Cada ejecución produce un informe HTML en `playwright-report/` y resultados JSON en `test-results/results.json`. Se adjuntan capturas de landing, quiz con corrección oculta, nota publicada, ocho tipos completados y cierre de sesión guiada, junto con los resultados de axe. Las trazas, capturas y vídeos adicionales se conservan ante fallos. Los informes generados están excluidos del código fuente.

Para esta verificación se preservaron los lotes en un paquete local de evidencias llamado `prototipo-2026-09-27`, con subcarpetas `e2e-base`, `e2e-participacion`, `e2e-editor-existente`, `e2e-produccion-inicial`, `e2e-produccion-dialogos` y `e2e-produccion-completa`. El lote inicial fallido conserva trazas y capturas. Los resultados posteriores mantienen su propio informe para no sustituir el anterior. Las capturas públicas de composición tienen un manifiesto con ruta, tamaño, navegador, revisión y hash.

## Integración continua y comprobaciones pendientes

El flujo `.github/workflows/web.yml` se activa con cambios de código y configuración en `main`, solicitudes de integración y ejecución manual. Instala las dependencias fijadas, ejecuta ESLint, comprueba tipos, ejecuta Vitest, construye la aplicación y comprueba los recorridos en Chromium con las dependencias de sistema necesarias. Conserva los informes como artefactos durante 14 días. Las acciones están fijadas por identificador de commit y el flujo tiene permisos de lectura del repositorio.

La [ejecución remota 36343447881](https://github.com/CubeFreaKLab/aulify/actions/runs/36343447881) terminó con resultado `success` sobre la revisión `56486c88ce39f1d59047983294e019ab93467645`. Se comprobaron el estado global y sus pasos mediante la API de GitHub: instalación, formato, análisis, tipos, reglas, compilación, preparación de Chromium, recorridos y conservación del informe. La configuración no despliega a producción.

El [resumen local estructurado](resultados-locales.json) conserva nombres y resultados de las 38 comprobaciones contra la versión compilada anterior al ajuste final de título móvil. La ejecución remota posterior incorpora ese ajuste. El [registro de CI](integracion-continua.json) identifica revisión, ejecución y pasos, sin incluir credenciales ni rutas de usuario.

Antes de conectar servicios reales habrá que verificar autenticación, recuperación de cuentas, políticas de acceso a datos, subidas de archivos, sincronización y fallos de red. El cambio de perfil y las restricciones del adaptador local sirven para explorar recorridos, pero no constituyen una frontera de seguridad. También quedan fuera de esta entrega las pruebas de carga, otros motores de navegador y dispositivos físicos.

## Referencias técnicas

- [Configuración de Playwright](https://playwright.dev/docs/test-configuration).
- [Playwright en integración continua](https://playwright.dev/docs/ci-intro).
- [CLI de Next.js y generación de tipos](https://nextjs.org/docs/app/api-reference/cli/next).
- [Configuración oficial de Node.js en GitHub Actions](https://github.com/actions/setup-node).
