# Cambios en Aulify

## Una entrega verificable

1. Identificar el requisito y sus criterios de aceptación.
2. Precisar el diseño técnico y visual que necesita esa entrega.
3. Mantener modelos, restricciones, permisos, diagramas y migraciones alineados cuando cambien los datos.
4. Implementar el cambio y ejecutar las comprobaciones pertinentes.
5. Registrar resultados reales y limitaciones; actualizar especificación y documentación.
6. Revisar el diff y crear un commit por unidad coherente. Seleccionar expresamente los archivos.

Una función está terminada cuando cumple sus criterios y tiene evidencia de comprobación. Las verificaciones previstas, locales y ejecutadas en integración continua se identifican por separado.

## Mensajes de commit

Se utiliza [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) con ámbito y una descripción concreta en español:

```text
tipo(ámbito): descripción
```

| Tipo | Uso |
|---|---|
| `feat` | Función implementada. |
| `fix` | Corrección de un defecto. |
| `docs` | Especificaciones, modelos, decisiones o manuales. |
| `test` | Pruebas y datos de prueba. |
| `ci` | Integración continua. |
| `refactor` | Organización interna sin cambiar el comportamiento esperado. |
| `build` | Dependencias o construcción del proyecto. |
| `chore` | Mantenimiento del repositorio. |
| `perf` | Mejoras de rendimiento comprobables. |
| `style` | Formato de código sin cambio funcional. |

Ejemplos de cambios distintos:

```text
docs(datos): definir relaciones de materias e integrantes
feat(materias): aprobar solicitudes de estudiantes
fix(quiz): evitar respuestas duplicadas al reconectar
test(notas): comprobar el promedio con correcciones pendientes
ci(pruebas): ejecutar los recorridos de Playwright
```

No dividir cambios artificialmente por archivo ni acumular toda la aplicación en un único commit. Un título debe permitir entender qué cambió sin depender del contexto de una conversación. Mantener las fechas reales de Git.

## Contenido compartido

Versionar especificaciones del producto, código, diagramas editables, migraciones, configuraciones de ejemplo sin secretos y evidencia técnica con datos ficticios. Mantener configuración personal, credenciales, sesiones y datos reales fuera del repositorio.

Antes de publicar, comprobar el estado, el diff y los archivos incluidos. Una regla de exclusión no retira contenido de commits anteriores.
