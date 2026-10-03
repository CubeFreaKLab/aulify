# Despliegue y operación

Actualización del 3 de octubre: la revisión `5a82990` dispone de una nueva Preview Ready, `dpl_2zbvXM7bt9brApyBK3y76eupHMv1`, en [el enlace protegido del candidato](https://aulify-e263w3fdo-jdanielchfhd-9543s-projects.vercel.app). El navegador autenticado recibió el inicio de Aulify y el build `1Vn8xy4qk9sXkSZdLIkE9` en su HTML. El mismo commit tiene [CI aprobado](../verificacion/ci-sincronizacion-lotes-20261003.json). Se mantuvieron el entorno Preview y el paso de compilación ignorada; no se asignó el dominio de producción.

La prueba automatizada de este candidato sigue pendiente de la configuración privada de la clave de servidor en Preview y del acceso temporal de automatización. Ready y la lectura del inicio no acreditan capacidad, recorrido autenticado completo ni recuperación por correo. El [ensayo de 204 sesiones](../verificacion/capacidad-200-20261003.md) pertenece al compilado local, no a este alojamiento. Los párrafos siguientes conservan las comprobaciones históricas de septiembre con sus propias revisiones.

Estado al 30 de septiembre: Aulify dispone de una [vista previa HTTPS verificada](../verificacion/vista-previa-https.md) en Vercel Hobby, protegida con Vercel Authentication. Se comprobó acceso de ambos roles y persistencia de un borrador con Supabase. Producción continúa pendiente. El dominio propio se resolverá por separado.

## Configuración realizada

El proyecto reserva `aulify-cubefreaklab.vercel.app` como dirección de producción. La dirección inicial del proveedor se conserva mediante una redirección. La vista previa tiene su propia URL y no se promovió a ese dominio. El despliegue actualizado `dpl_DKCdR82HDcKYXdnuMc8hgTF4VojS` corresponde a `f9a7013` y figura Ready; conservó el entorno Preview y el paso de compilación ignorada del proyecto. Su compilado es `cnVtGnuJSRSUOe6Bf9Kjp`, con el CI de esa revisión aprobado y los recorridos HTTPS descritos en la evidencia enlazada.

Se guardaron `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` como configuración de producción y vistas previas. `NEXT_PUBLIC_SITE_URL` corresponde al origen HTTPS previsto, únicamente en producción. `SUPABASE_SECRET_KEY` se guardó con tipo **Secret**, sólo en producción, sin un valor legible después de guardar. Los archivos temporales de importación contenían exclusivamente estas variables y se eliminaron tras la operación; no forman parte de Git.

La conexión con `CubeFreaKLab/aulify` está guardada. Se seleccionaron el preset Next.js, Node.js 24 y la máquina Basic del plan Hobby. El control de GitHub **Tipos, reglas y recorridos de demostración** quedó añadido con comportamiento **Blocking** para producción. Se identificó usando una revisión con CI aprobado, sin atribuir ese aprobado a revisiones posteriores.

Mientras se corrige el rendimiento, el paso de compilación ignorada permite **Only build pre-production**: compila vistas previas y omite producción. Las vistas previas conservan **Vercel Authentication / Standard Protection**. Antes de preparar la promoción debe volver a Automatic, conservando el control bloqueante. La comprobación en interfaz acredita configuración; aún falta observar una promoción detenida por un resultado pendiente/fallido y otra habilitada por el resultado correcto. No se activaron planes de pago ni SMTP.

## Región y servicios

La base utiliza Supabase en `sa-east-1`. [vercel.json](../../vercel.json) selecciona `gru1`, São Paulo, para las funciones de la aplicación. Ubicar ambos servicios en la misma región evita un trayecto interregional en cada consulta; su efecto debe medirse después de desplegar. Hobby admite una única región. [Configuración de funciones](https://vercel.com/docs/functions/configuring-functions/region), [regiones de Vercel](https://vercel.com/docs/regions).

El panel Resources del candidato `f9a7013` confirmó `GRU1` y Node.js 24.x en los endpoints observados. El [procedimiento de diagnóstico de Preview](../verificacion/carga-vista-previa.md) prepara una medición con acceso de automatización autorizado y metadatos del compilado servido. La clave de automatización todavía no se creó; su habilitación está pendiente de autorización. No se desactivó Vercel Authentication para facilitar la prueba.

Se mantienen los planes gratuitos y se supervisan sus cuotas. Una compilación local no mide los límites de CPU, duración o transferencia del alojamiento. El procedimiento no activa facturación ni presupone recursos ilimitados.

## Variables del entorno

Configurar los valores en el gestor protegido del proyecto de alojamiento, fuera del repositorio:

| Variable                               | Uso                                                                         |
| -------------------------------------- | --------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | URL del proyecto de datos.                                                  |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Clave publicable; las operaciones continúan sujetas a permisos.             |
| `NEXT_PUBLIC_SITE_URL`                 | Origen HTTPS definitivo utilizado por la aplicación.                        |
| `SUPABASE_SECRET_KEY`                  | Operaciones de servidor autorizadas; nunca utilizar prefijo `NEXT_PUBLIC_`. |

No importar una copia indiscriminada del entorno local. Separar vistas previas de producción y evitar credenciales productivas en código de contribuciones no confiables. Después de elegir el origen HTTPS, configurar las URLs de retorno de Auth y el proveedor SMTP, y probar confirmación y recuperación con cuentas ficticias.

## Control de publicación

1. Identificar la revisión exacta de Git y comprobar el resultado de `Calidad de Aulify`. Conservar los resultados autenticados, de permisos y de capacidad correspondientes.
2. En el proyecto de Vercel conectado al repositorio, configurar un control de despliegue de GitHub que requiera el trabajo `Tipos, reglas y recorridos de demostración`. Verificar su disponibilidad en el plan y que la revisión evaluada coincida con la desplegada.
3. Comprobar que un resultado pendiente o fallido impide la promoción. No utilizar una promoción forzada para eludir esa comprobación. La mera presencia del flujo YAML no demuestra que esta condición esté configurada.
4. Verificar el candidato por HTTPS: acceso, dos roles, incorporación, publicación, participación, revisión, notas y archivo privado. Registrar URL, revisión, entorno, fecha y resultado sin secretos.
5. Promover únicamente cuando se cumplan los criterios de liberación. Registrar la versión anterior utilizable para volver atrás.

Vercel permite condicionar la promoción a resultados de GitHub. El control está configurado, pero el ciclo completo todavía requiere comprobarse con un candidato real. Aulify mantiene CI ejecutado y CD pendiente de verificación operativa. Si la revisión candidata sólo cambia documentos y no dispara el flujo por sus filtros de rutas, ejecutar el flujo manualmente sobre esa revisión antes de promocionar. [Deployment Checks](https://vercel.com/docs/deployment-checks).

## Seguimiento y recuperación

El flujo de mantenimiento programa la conservación cada seis horas. Las ejecuciones `36571189662` y `36638509107` constan con evento `schedule` y pasos aprobados en el [registro de CI](../verificacion/ci-integracion.json). Se comprobó así su activación automática; un éxito observado no garantiza los horarios futuros del proveedor. Revisar sus ejecuciones y cuotas de base, archivos, transferencia y funciones.

Un retorno a una versión anterior del código no revierte automáticamente una migración ni restaura archivos. Antes de cambios incompatibles se necesita un respaldo operativo y una restauración comprobada de datos y objetos privados. La [restauración aislada](../verificacion/recuperacion-aislada.md) aporta una comprobación técnica, pero no sustituye la recuperación del servicio alojado.
