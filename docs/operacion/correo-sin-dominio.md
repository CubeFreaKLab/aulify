# Correo de Aulify sin comprar dominio

La web puede usar `https://aulify-cubefreaklab.vercel.app`. El correo saldrá de una cuenta Gmail elegida por el propietario, con el nombre visible **Aulify**. El subdominio de Vercel no proporciona un buzón ni permite enviar como `no-reply@aulify-cubefreaklab.vercel.app`.

## Archivos preparados

| Archivo                                        | Uso                                                             | Asunto                       |
| ---------------------------------------------- | --------------------------------------------------------------- | ---------------------------- |
| `supabase/templates/confirmar-correo.html`     | Confirm sign up: agradecimiento y confirmación en un solo envío | Confirma tu correo · Aulify  |
| `supabase/templates/recuperar-contrasena.html` | Reset password                                                  | Recupera tu acceso · Aulify  |
| `supabase/templates/bienvenida.html`           | Bienvenida independiente, para un envío posterior opcional      | Gracias por sumarte a Aulify |

Supabase Auth no ofrece una plantilla automática de bienvenida posterior a la confirmación. Por eso el agradecimiento ya está incluido en Confirm sign up. El HTML independiente está preparado, pero no se envía solo: requeriría otro envío desde un servicio. No pegarlo en Magic Link ni sustituir con él un correo de seguridad. Para un envío manual, sustituir `{{ .SiteURL }}` por la URL definitiva.

Los HTML de Supabase se pegan completos, conservando `{{ .SiteURL }}` y `{{ .TokenHash }}`. Las vistas previas del paquete usan enlaces ficticios y **no** sirven como plantillas de envío. Logo e ilustraciones PNG viven en `/brand/email/`; deben estar publicados y accesibles sin iniciar sesión.

## 1. Preparar el remitente en Google

Usar una cuenta Gmail personal cuya administración corresponda al propietario; una cuenta dedicada al proyecto facilita separar los mensajes. No hace falta contratar Google Workspace.

1. En [Seguridad de Google](https://myaccount.google.com/security), activar Verificación en dos pasos.
2. Abrir [Contraseñas de aplicaciones](https://myaccount.google.com/apppasswords) y crear una para **Aulify Supabase**.
3. Introducirla personalmente en Supabase cuando se solicite. No enviarla por chat, guardarla en Git ni añadirla a Vercel. No utilizar la contraseña habitual de Google.

Si Google no ofrece esta opción, puede deberse al tipo de cuenta, Protección Avanzada o configuración de verificación. No desactivar protecciones para hacerla aparecer. Elegir una cuenta compatible o detener esta configuración. Cambiar la contraseña de Google revoca sus contraseñas de aplicación. [Instrucciones oficiales](https://support.google.com/accounts/answer/185833?hl=es).

## 2. Configurar SMTP en Supabase

En el proyecto Aulify, abrir **Authentication → Email → SMTP Settings**; según la versión del panel, aparece como **Custom SMTP**. Activarlo y completar:

| Campo        | Valor                                                  |
| ------------ | ------------------------------------------------------ |
| Sender email | La dirección Gmail que se utilizará para enviar        |
| Sender name  | Aulify                                                 |
| Host         | smtp.gmail.com                                         |
| Port         | 587                                                    |
| Username     | La misma dirección Gmail completa                      |
| Password     | La contraseña de aplicación creada en el paso anterior |

Guardar y conservar la confirmación de correo activada. No hace falta habilitar POP ni IMAP para enviar. El puerto 587 usa TLS/STARTTLS y autenticación. [Configuración SMTP de Google](https://support.google.com/mail/answer/7104828?hl=es).

El correo integrado de Supabase solo admite destinatarios autorizados y tiene cuotas de prueba. Los proyectos Free nuevos desde el 3 de junio de 2026 necesitan SMTP propio para personalizar las plantillas. Configurar Gmail aporta ese SMTP, sujeto a que Google acepte la conexión; el envío queda por comprobar. [SMTP de Supabase](https://supabase.com/docs/guides/auth/auth-smtp), [cambio de plantillas Free](https://supabase.com/changelog/46599-changes-to-email-template-customisation-on-free-tier).

Mantener inicialmente el límite de Auth de 30 correos por hora que Supabase aplica al SMTP personalizado. Gmail puede bloquear el envío por cuota o actividad sospechosa; no es una garantía de capacidad para una clase completa. Usarlo para la comprobación acotada de esta entrega. [Límites de Gmail](https://support.google.com/mail/answer/22839?hl=es).

## 3. Fijar las URLs y pegar los HTML

En **Authentication → URL Configuration**:

- **Site URL:** `https://aulify-cubefreaklab.vercel.app` (sin barra al final).
- **Redirect URLs:** `https://aulify-cubefreaklab.vercel.app/auth/callback` y `https://aulify-cubefreaklab.vercel.app/auth/callback?next=/restablecer`.

En **Authentication → Email → Templates**, abrir Confirm sign up y Reset password, pegar el HTML correspondiente de `plantillas-supabase` y el asunto de la tabla. Guardar cada uno. Los enlaces propios usan `/auth/confirm`, que verifica el token y abre `/aula` o `/restablecer`; no dependen de conservar el navegador que inició la solicitud. [Variables oficiales de las plantillas](https://supabase.com/docs/guides/auth/auth-email-templates).

Para probar antes de producción, se puede usar una URL estable de Preview como Site URL y autorizar sus dos callbacks exactos. Esa Preview debe ser accesible para quien abre el correo; no desactivar su protección. Al pasar a producción, cambiar Site URL y volver a generar los correos: un correo ya enviado conserva su destino anterior.

## 4. Publicar el candidato con configuración de producción

No es necesario publicar para preparar los archivos ni guardar SMTP. Sí se necesita una dirección operativa para probar los botones y cargar las imágenes.

Antes de publicar, comprobar la revisión exacta aprobada por CI y las variables del entorno Production. `NEXT_PUBLIC_SITE_URL` debe ser el origen definitivo; las credenciales de Supabase permanecen en las variables privadas ya configuradas. No copiarlas a la guía. El SMTP se configura solo en Supabase.

Crear una compilación del candidato en **Production**. No promover directamente el artefacto de Preview: la demo se decide con el entorno de compilación. Con `VERCEL_ENV=production`, la aplicación oculta los enlaces de prueba y deshabilita `/demo` y el quiz de ejemplo; los quizzes invitados creados por docentes conservan su funcionamiento. Mantener el control bloqueante de CI.

La publicación pública no se considera validada hasta comprobar correo, acceso y salida. Si falta SMTP o no llega el mensaje, registrar el impedimento; no desactivar la confirmación para aparentar que el recorrido está completo.

## 5. Comprobación que realiza el propietario

1. Abrir el sitio definitivo sin sesión. Registro y acceso no deben mostrar «Explorar como…».
2. Registrarse con un correo propio de prueba. Abrir el mensaje recibido; comprobar remitente, logo, botón y destino. Usar Confirmar mi correo.
3. En el aula, pulsar el logo: debe volver a Mi inicio. No deben aparecer Demostración, Cambiar perfil ni Reiniciar datos.
4. Cerrar sesión: debe abrir la landing. Volver a `/aula` debe pedir acceso.
5. Solicitar Recuperar acceso, abrir el correo y escribir personalmente una contraseña nueva. Verificar acceso con ella. No compartirla ni capturarla.
6. Reabrir el enlace ya usado: debe mostrar el aviso de enlace inválido. Revisar también Spam si no llegó un mensaje.

Anotar entrega real, hora, destinatario de prueba en el registro privado y resultado, sin contraseñas ni tokens. Dos recepciones reales acreditan este recorrido, no una prueba de carga. Las vistas del HTML en navegador no sustituyen una recepción en Gmail u Outlook.

## Si algo falla

| Síntoma                | Revisar                                                                                              |
| ---------------------- | ---------------------------------------------------------------------------------------------------- |
| Error de envío         | SMTP guardado, dirección remitente igual al usuario, contraseña de aplicación vigente y logs de Auth |
| Demasiadas solicitudes | Esperar el límite de Auth; no solicitar correos en bucle                                             |
| Enlace incorrecto      | Site URL y callbacks exactos; generar un mensaje nuevo después de corregir                           |
| Logo ausente           | Abrir `/brand/email/aulify-logo.png` en el sitio definitivo sin sesión                               |
| Enlace usado o vencido | Solicitar uno nuevo; no reutilizar el token ni copiarlo al chat                                      |

Estado de esta guía: archivos y procedimiento preparados. Configuración privada de SMTP, recepción real y liberación definitiva deben registrarse tras ejecutarse; esta guía no afirma que estén terminadas.
