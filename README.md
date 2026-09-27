# Aulify

El aula digital, más simple e interactiva.

Aulify es una plataforma web para docentes y estudiantes de secundaria. Su recorrido principal une recursos de clase por bloques, preguntas interactivas y revisión de resultados, con una experiencia adaptable a celular y computadora.

## Funciones previstas

- Recursos con explicaciones, imágenes, enlaces y preguntas; borradores, vista previa y versiones publicadas.
- Quizzes de práctica y examen con modos de avance y reglas configurables.
- Materias con invitaciones y aprobación de estudiantes.
- Tareas, corrección manual, publicación de calificaciones y seguimiento con gráficos y tablas.
- Controles de accesibilidad, ayuda inicial por rol, recuperación ante desconexiones y separación de permisos entre cuentas.

## Prototipo web

La aplicación ejecutable incluye una portada ilustrada, un editor por bloques y un recorrido de demostración: preparar un recurso, publicarlo, responder como estudiante, revisar respuestas escritas y publicar notas. Incluye materias, solicitudes, tareas y resultados con datos ficticios. La [matriz de pantallas](docs/diseno/pantallas-y-estados.md) distingue las interacciones disponibles y los servicios pendientes.

La muestra conserva cambios en el almacenamiento de este navegador y permite cambiar entre perfiles ficticios. No ofrece autenticación real ni almacenamiento privado de archivos. Supabase Auth, PostgreSQL, Storage y correo se integrarán con pruebas de permisos y persistencia; el transporte de sesiones y sus cuotas siguen pendientes. Consulta el [estado verificable](docs/estado-del-desarrollo.md).

## Ejecutar

Requiere Node.js 24 y npm. No necesita credenciales externas para explorar el prototipo.

```sh
npm ci
npm run dev
```

Abre [Aulify local](http://127.0.0.1:3000). Entra con **Explorar una clase** o visita `/acceso` y elige el perfil de demostración. Puedes reiniciar los datos desde Preferencias. El [manual del prototipo](docs/prototipo/uso-y-limites.md) explica los recorridos y sus límites.

```sh
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

La construcción usa Next.js, React y TypeScript, React Aria para controles, BlockNote para edición e Inter para la interfaz. Versiones fijadas en `package-lock.json`. GitHub Actions ejecuta análisis, tipos, pruebas, construcción y recorridos; el resultado remoto de cada revisión se consulta en [Actions](https://github.com/CubeFreaKLab/aulify/actions). Producción y CD permanecen pendientes.

## Documentación del producto

| Documento | Contenido |
|---|---|
| [Producto y vocabulario](docs/producto.md) | Usuarios, alcance y conceptos. |
| [Principios](docs/principios.md) | Usabilidad, accesibilidad, control de las actividades y consistencia. |
| [Especificación general](specification.md) | Requisitos funcionales y reglas transversales. |
| [Primera entrega: recurso interactivo](specs/001-recurso-interactivo/spec.md) | Recorrido, permisos, estados y decisiones operativas. |
| [Aceptación de la primera entrega](specs/001-recurso-interactivo/aceptacion.md) | 38 casos con resultados esperados, pendientes de ejecución. |
| [Aceptación del producto](specs/aceptacion-producto.md) | 38 casos complementarios para las ampliaciones. |
| [Plan de calidad](docs/calidad/plan-de-calidad.md) | Métodos, umbrales, defectos y evidencia. |
| [Trazabilidad](docs/calidad/trazabilidad.md) | Requisitos, reglas, tareas y casos relacionados. |
| [Modelo de datos](docs/modelado/README.md) | Diagramas editables, diccionario, normalización, restricciones y permisos. |
| [Explicación del modelo](docs/modelado/casos-y-operaciones.md) | Casos de uso, operaciones y motivos de las separaciones. |
| [Plan técnico](plan.md) | Arquitectura propuesta, datos, permisos y pruebas. |
| [Tareas](tasks.md) | Dependencias y criterios de finalización. |
| [Ruta de desarrollo](docs/ruta-de-desarrollo.md) | Entregas y criterios de revisión. |
| [Estado del desarrollo](docs/estado-del-desarrollo.md) | Qué está definido, implementado y pendiente. |
| [Costos de servicios](docs/costos-servicios.md) | Planes, cuotas y referencias oficiales. |
| [Decisión sobre Supabase](docs/decisiones/0001-supabase.md) | Motivos y consecuencias de la selección. |
| [Decisión funcional 1.0](docs/decisiones/0002-reglas-funcionales.md) | Valores iniciales, versiones, evaluación y consecuencias para el modelado. |
| [Decisión del modelo relacional](docs/decisiones/0003-modelo-relacional.md) | Versiones, publicaciones y excepciones de normalización. |
| [Base web y editor](docs/decisiones/0004-base-web.md) | Bibliotecas, licencias, renderizado y criterios de integración. |
| [Dirección visual](docs/diseno/direccion-visual.md) | Marca, composición, tipografía y movimiento. |
| [Componentes y recursos](docs/diseno/recursos-y-componentes.md) | Assets, fuentes y preparación del diseño editable. |
| [Capturas del prototipo](docs/diseno/capturas/README.md) | Portada, editor, revisión, quiz, móvil y movimiento reducido. |
| [Verificación del prototipo](docs/verificacion/pruebas-prototipo.md) | Casos ejecutados, entorno y límites de la evidencia. |

El desarrollo sigue especificaciones verificables: comportamiento esperado, solución técnica, tareas, implementación y comprobación. Las pautas para cambios y commits están en [CONTRIBUTING.md](CONTRIBUTING.md).
