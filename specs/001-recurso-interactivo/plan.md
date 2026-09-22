# Plan de 001

Estado: propuesta técnica para el [spec](spec.md). No hay aplicación, migraciones ni servicios configurados.

## Dependencias y decisiones

Se mantienen Supabase PostgreSQL/Auth/Storage, Playwright y GitHub Actions como selecciones. Next.js, React y TypeScript son candidatos; fijar versiones y bibliotecas al comprobar su compatibilidad. El correo SMTP requiere una prueba real antes de cerrar acceso y recuperación. El avance individual no necesita que el docente esté conectado; la selección para sesiones guiadas posteriores sigue abierta.

Las propuestas P-01 a P-07 deben revisarse antes de implementar el comportamiento afectado. Este plan no convierte por sí solo esas propuestas en requisitos aceptados.

## Datos que deben modelarse

| Concepto | Relación y restricción necesaria |
|---|---|
| Perfil | Identidad de autenticación y función principal; permisos no modificables mediante datos del cliente. |
| Materia | Un docente propietario y detalles de curso/año; separación por identificador, aunque comparta nombre. |
| Invitación y solicitud | Código vigente de materia; eventos de solicitud y decisión; como máximo una solicitud pendiente por estudiante/materia. |
| Membresía | Un estudiante aprobado por materia; unicidad de la pareja materia/estudiante. |
| Recurso y borrador | Propietario y revisión para control de conflictos. |
| Versión de recurso | Inmutable; contenido visible separado de claves de corrección reservadas. |
| Actividad | Materia, versión y configuración coherente; bloqueo de reglas tras primer intento. |
| Intento | Estudiante y actividad; un abierto por pareja; plazo y orden persistentes. |
| Respuesta | Intento y pregunta; idempotencia y un envío definitivo por pregunta según P-06. |
| Evaluación | Corrección por pregunta, resultado completo, revisión y publicación por estudiante. |
| Evento de cambio | Actor, momento, motivo y cambio mínimo de ampliación de plazo o republicación de nota. |

El siguiente trabajo de datos debe producir modelo conceptual, relacional, claves, cardinalidades, dependencias funcionales y normalización justificada. Después, diccionario, migraciones SQL y políticas RLS. Evaluar JSONB para bloques versionados, sin trasladar pertenencias o soluciones reservadas a documentos accesibles al estudiante.

No guardar una única tabla genérica de estados que confunda intento, corrección y publicación. Si una cifra se materializa por rendimiento, documentar cómo se calcula y mantiene consistente.

## Operaciones y consistencia

- Tratar aprobación, inicio de intento, confirmación de respuesta y publicación de evaluación como operaciones atómicas según corresponda. Definir restricciones de unicidad y transacciones al diseñar el esquema.
- Proteger la carrera entre cambiar configuración e iniciar el primer intento. La comprobación debe ejecutarse en el mismo límite transaccional que el cambio.
- Una respuesta lleva una clave de idempotencia: repetir misma clave y contenido devuelve el resultado original; reutilizarla con otro contenido se rechaza. Otra clave no permite sustituir una respuesta final.
- Verificar el plazo con hora de servidor al confirmar. No confiar en duración, nota, rol o pertenencia enviados por el cliente.
- Calcular con aritmética decimal exacta; aplicar el redondeo final de P-07. Las pruebas deben cubrir fracciones, cero y notas pendientes.
- Separar contratos de lectura docentes y estudiantiles. No enviar soluciones para luego esconderlas en la interfaz.
- Las operaciones privilegiadas comprueban autorización propia. Una clave administrativa no sustituye esa comprobación.

Los nombres de tablas, operaciones, códigos de error y contratos concretos se fijarán con el modelo. No crear rutas o archivos de aplicación que aparenten una arquitectura implementada antes de seleccionarla.

## Diseño antes de la interfaz

Preparar flujos de docente y estudiante y estados del spec. Conservar el logotipo y definir tipografía, paleta semántica, espacio, iconos, estados y movimiento. Comparar conceptos visuales para editor, participación y resultados en móvil y escritorio antes de fijar componentes.

Cada propuesta visual debe usar contenido de clase realista y mostrar una interacción distintiva y comprensible. Documentar decisiones reutilizables y comprobar contraste, foco y tamaño de controles. Las imágenes conceptuales no reemplazan un prototipo editable ni las pruebas sobre la interfaz implementada.

## Construcción por unidades revisables

Seguir las [tareas](tasks.md): modelo y decisiones, fundamentos visuales, base de aplicación/CI, acceso, materias, recursos, participación y evaluación. En cada unidad incluir pruebas y documentación pertinentes y un commit específico. El primer recorrido se completa antes de ampliar todos los tipos de pregunta y modos de juego.

## Verificación

Usar los casos de [aceptación](aceptacion.md) como contrato de resultado. Verificar permisos y transacciones contra PostgreSQL con datos ficticios; cálculos en pruebas de reglas; recorridos con Playwright; contraste, teclado y lector de pantalla mediante comprobaciones pertinentes. Mantener errores simulados y dos sesiones para concurrencia.

GitHub Actions ejecutará las comprobaciones existentes sobre un entorno aislado y conservará informes asociados al commit. No exponer credenciales ni sesiones en artefactos, y no restablecer datos de uso. La configuración se escribirá cuando existan comandos reales y dependencias fijadas.
