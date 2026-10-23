# Revisión antes de producción

La aplicación dispone de una demostración y de prácticas por enlace. Su liberación de producción sigue condicionada a estas comprobaciones sobre el candidato y dominio definitivos.

| Recorrido | Comprobación pendiente |
| --- | --- |
| Registro de docente y estudiante | Recibir el correo con SMTP propio, confirmar una vez, manejar enlace vencido/reutilizado, regresar al origen correcto y comprobar permisos. |
| Recuperación y salida | Recibir recuperación, cambiar contraseña mediante el flujo de Auth, cerrar sesión y comprobar que páginas privadas no recuperan datos protegidos. |
| URL pública y QR | Abrir desde otro teléfono sin cuenta de Aulify, comprobar apertura/cierre y plazo, revocar, recargar sin perder puntos y verificar que no aparece una nota. La protección de Vercel Preview es independiente de la cuenta de Aulify y puede exigir acceso al entorno de prueba. |
| Quiz propio del docente | Crear un recurso con preguntas automáticas, publicarlo, programar enlace de invitado y comprobar sus fechas con una cuenta real. La demo usa un ejemplo fijo y no publica borradores locales arbitrarios. |
| Recorrido académico | Incorporación con aprobación, recurso/versiones, quiz, revisión de respuestas escritas, publicación de nota y archivos privados con cuentas ficticias de ambos roles. |
| Capacidad y cuotas | Repetir la medición aprobada para el alojamiento definitivo dentro del presupuesto acordado; los límites de 20 enlaces diarios y 300 partidas retenidas no acreditan concurrencia. Q-06/Q-09 conservan sus pendientes. |
| Conservación y recuperación | Incluir partidas invitadas en el mantenimiento periódico, comprobar respaldo/restauración de las dos tablas nuevas y validar controles de abuso antes de abrir acceso general. La limpieza actual de partidas vencidas hace más de 30 días ocurre al ingresar otro participante. |
| Liberación | CI aprobado para el SHA exacto, retorno a revisión anterior y control de promoción comprobados. Separar datos y configuración del sitio real y la muestra antes de publicar el sitio limpio. |

La muestra conserva por ahora «Explorar como docente/estudiante», el distintivo Demostración y Cambiar perfil. La separación en dos sitios es una etapa posterior; no se retiran controles por anticipado.

La configuración del correo y los orígenes se describe en [despliegue](despliegue.md). El servicio integrado de correo de Supabase tiene límites para pruebas y no sustituye un SMTP de producción: [documentación oficial de SMTP](https://supabase.com/docs/guides/auth/auth-smtp).
