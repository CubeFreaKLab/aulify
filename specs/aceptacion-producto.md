# Aceptación del alcance completo

Versión 1.0. Todos los casos están **no ejecutados**. Complementan los [casos de 001](001-recurso-interactivo/aceptacion.md); no los reemplazan. Datos ficticios y resultados vinculados a una versión según el [plan de calidad](../docs/calidad/plan-de-calidad.md).

| Caso | Regla | Escenario | Resultado esperado |
|---|---|---|---|
| AP-01 | RE-01, RE-04 | Copiar recurso de una materia a otra y modificar copia. | Original/versión respondida intactos; sin copiar integrantes o respuestas. |
| AP-02 | RE-02 | Publicar recurso de lectura sin quiz y quiz independiente válido. | Lectura accesible sin nota; quiz utiliza su configuración e intentos. |
| AP-03 | PR-01, PR-02 | En selección múltiple, acertar conjunto exacto, omitir una correcta o añadir una incorrecta. | Valor completo solo en el conjunto exacto; cero en otros dos casos. |
| AP-04 | PR-01 | Relacionar tres de cuatro pares de pregunta de valor 8. | 6 puntos; no redondear por par. |
| AP-05 | PR-01 | Ordenar cuatro elementos y acertar dos posiciones de valor total 5. | 2,5 puntos. |
| AP-06 | PR-01, PR-02 | Completar tres espacios de valor total 6: dos opciones correctas; repetir escribiendo las mismas palabras. | Opciones: 4 puntos; escritura: pendiente manual, no automática. |
| AP-07 | PR-02 | Activar revisión manual de preguntas cerradas y escribir una nota fuera del intervalo. | Respuestas pendientes hasta revisar; nota inválida rechazada. |
| AP-08 | PR-03, PR-04 | Mezclar dos preguntas dependientes y dos independientes; reconectar. | Dependientes mantienen orden y explicación; mismo conjunto y orden persistido. |
| AP-09 | AC-08 | E1 y E2 se unen a sala, docente inicia dos veces y abre pregunta; E1 responde, E2 no; cerrar preguntas hasta la última. | Sala no consume intento; inicio crea uno por inscrito sin duplicados; E1 espera avance docente; confirmar cierre con pendientes asigna cero a E2 en la omitida; última pregunta finaliza normalmente, conservando correcciones manuales pendientes. |
| AP-10 | AC-09 | Desconectar al docente; luego reconectar; otro estudiante intenta ingreso tardío. | No avance automático; estado/plazos conservados; reconexión permitida, ingreso nuevo rechazado. |
| AP-11 | JU-04, JU-05 | Usar pista y doble, repetir intento, reenviar por pérdida de confirmación. | Un uso de cada tipo para la actividad; reintento no duplica consumo ni recupera usos. |
| AP-12 | JU-04 | Solicitar pista inexistente, o dos pestañas piden pistas de preguntas distintas simultáneamente. | Inexistente no consume; solo una operación nueva gana el uso; la otra no revela otra pista. |
| AP-13 | JU-05, EV-01 | Doble sobre respuesta correcta de 2, errada y manual con valor obtenido 3. | Adicional 2, 0 y 3 respectivamente; manual se determina al corregir. |
| AP-14 | EV-01, EV-03 | B=6, Q=10, D=2, M=20, con efecto en nota desactivado/activado; luego B+D>Q. | Juego 8; notas 12/16 según opción; nunca superar M. |
| AP-15 | JU-01, JU-02 | Ocultar aciertos y habilitar clasificación/rachas en configuración. | Incompatibilidad explicada; no enviar señales reservadas. Nota agregada explícitamente publicada sí visible. |
| AP-16 | JU-02 | Revisión diferida, actividad cerrada pero con evaluaciones sin publicar. | No liberar clasificación ni soluciones de esas evaluaciones. |
| AP-17 | JU-03 | Dos aciertos, respuesta manual y otro acierto, con movimiento/sonido desactivados. | Racha visible se interrumpe en manual; no puntaje por rapidez/racha; operación sin sonido/animación. |
| AP-18 | JU-06 | Puntos definitivos 10,10,8; otra clasificación tiene respuestas manuales pendientes. | Puestos 1,1,3; segundo caso identificado provisional hasta resolver. |
| AP-19 | JU-07 | Equipos de dos y tres integrantes con promedios de puntos 8; un integrante asignado no inicia. | Empate por promedio; sin intento aporta cero al equipo sin generar nota personal cero. |
| AP-20 | JU-07, JU-08 | Cambiar equipo iniciado, abrir clasificación ajena o consultar alias desde cuenta docente. | Cambio rechazado; ajeno sin acceso; docente identifica integrantes y estudiantes solo alias permitidos. |
| AP-21 | TA-01 | Subir archivo de 11 MiB, total de 21 MiB, sexto archivo o ejecutable renombrado a PDF. | Rechazo explicado; ninguna entrega válida reemplazada por carga incompleta. |
| AP-22 | TA-02 | Reemplazar entrega sin corregir antes del cierre; después intentar descargar con cuenta ajena. | Nueva versión con anterior conservada; descarga ajena denegada. |
| AP-23 | TA-02, TA-03 | Entrega después del plazo con tardías desactivadas/activadas y con ventana individual de reentrega. | Rechazo o recepción marcada tardía; autorización individual respeta su fecha explícita. |
| AP-24 | TA-03, EV-05 | Reentregar tarea evaluada, fallar una carga y luego publicar nueva evaluación. | Versión/nota anterior conservadas; nueva nota visible solo al republicar. |
| AP-25 | TA-04, EV-07 | Registrar actividad manual para dos estudiantes, evaluar solo uno; otro no entregó tarea. | Sin registros ficticios; pendientes sin cero implícito; cero requiere decisión y motivo. |
| AP-26 | SE-01, SE-02, SE-03 | Notas publicadas 0,20,80,100; una pendiente; filtrar por curso y fechas. | Intervalos correctos, 100 incluido, pendiente separada; misma tabla/gráfico y sin promedio entre materias. |
| AP-27 | IN-02, IN-03 | Registrar pestaña oculta con permiso de actividad; revisar incidencia. | Aviso previo, datos mínimos y límites explicados; comentario docente sin sanción ni nota automática. |
| AP-28 | IN-02, IN-06 | Actividad sin registro habilitado; luego vencer retención de señales en otra actividad. | Sin señales de visibilidad en primera; detalle eliminado al plazo en segunda, resolución mínima conservada si existe. |
| AP-29 | CU-05, IN-07 | Retirar estudiante con intento abierto, resolver por evaluación o exclusión y luego aprobar reingreso. | Acceso revocado; cierre pendiente hasta resolución con motivo; evaluación conserva lo confirmado y asigna cero a omisiones; exclusión no crea nota ni devuelve oportunidades/potenciadores; reingreso no reabre el intento. |
| AP-30 | IN-04 | Archivar materia con intentos abiertos, consultar como estudiante y restaurar antes de 30 días. | Confirmación, cierre administrativo y acceso revocado; restauración sin extender fechas ni reabrir intentos. |
| AP-31 | IN-05, IN-06 | Intentar restaurar exactamente al vencer 30 días mientras se procesa purga; simular fallo parcial. | Restauración rechazada; reintentos idempotentes sin borrar otras materias/cuentas o biblioteca; objetivo de 24 h medido. |
| AP-32 | IN-05 | Archivo referenciado por biblioteca y entrega de materia vencida. | No eliminar objeto compartido autorizado; referencias exclusivas de materia sí se eliminan. |
| AP-33 | RE-06 | Imagen sin alternativa requerida, enlace no seguro o contenido con script. | Validación y orientación; no ejecutar código; enlace no seguro rechazado. |
| AP-34 | RF-17 | Repetir ayuda desde otro dispositivo; versión nueva del tutorial; intento en curso. | Preferencia de cuenta coherente; nueva invitación discreta; sin guía superpuesta durante intento. |
| AP-35 | RNF-03, RNF-04 | Ejecutar escenario de carga individual y guiado del plan de calidad. | Medir Q-04, Q-06 y Q-09; no declarar capacidad si incumple tiempos, integridad o cuotas. |
| AP-36 | RNF-06 | Reconstruir entorno de prueba, restaurar respaldo ficticio y comprobar despliegue. | Misma estructura/versión, datos y permisos esperados; informe real de recuperación y prueba posterior. |
| AP-37 | CU-06 | Exceder diez solicitudes de código en diez minutos y renovar código mientras hay solicitudes pendientes. | Rechazo temporal sin filtrar datos; renovación no borra pendientes existentes. |
| AP-38 | RNF-01, RNF-02 | Ejecutar matriz de dispositivos, teclado, lector de pantalla y tareas de uso. | Registrar resultados Q-02, Q-03 y Q-07 por separado; emulación no presentada como dispositivo físico. |

Antes de ejecutar cada caso, convertirlo en pasos reproducibles y datos concretos según la interfaz/contratos reales. Conservar el resultado esperado; cualquier modificación del caso por cambio de requisito requiere registrar el cambio antes de medir. No reducir los casos por comodidad del mecanismo de prueba.
