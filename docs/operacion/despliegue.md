# Despliegue y operación

Estado: preparación versionada; no existe todavía una publicación verificada de la integración. Los resultados locales y de CI se conservan en [verificación web](../verificacion/integracion-web.md). El dominio propio se resolverá por separado.

## Región y servicios

La base utiliza Supabase en `sa-east-1`. [vercel.json](../../vercel.json) selecciona `gru1`, São Paulo, para las funciones de la aplicación. Ubicar ambos servicios en la misma región evita un trayecto interregional en cada consulta; su efecto debe medirse después de desplegar. Hobby admite una única región. [Configuración de funciones](https://vercel.com/docs/functions/configuring-functions/region), [regiones de Vercel](https://vercel.com/docs/regions).

Se mantienen los planes gratuitos y se supervisan sus cuotas. Una compilación local no mide los límites de CPU, duración o transferencia del alojamiento. El procedimiento no activa facturación ni presupone recursos ilimitados.

## Variables del entorno

Configurar los valores en el gestor protegido del proyecto de alojamiento, fuera del repositorio:

| Variable | Uso |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto de datos. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Clave publicable; las operaciones continúan sujetas a permisos. |
| `NEXT_PUBLIC_SITE_URL` | Origen HTTPS definitivo utilizado por la aplicación. |
| `SUPABASE_SECRET_KEY` | Operaciones de servidor autorizadas; nunca utilizar prefijo `NEXT_PUBLIC_`. |

No importar una copia indiscriminada del entorno local. Separar vistas previas de producción y evitar credenciales productivas en código de contribuciones no confiables. Después de elegir el origen HTTPS, configurar las URLs de retorno de Auth y el proveedor SMTP, y probar confirmación y recuperación con cuentas ficticias.

## Control de publicación

1. Identificar la revisión exacta de Git y comprobar el resultado de `Calidad de Aulify`. Conservar los resultados autenticados, de permisos y de capacidad correspondientes.
2. En el proyecto de Vercel conectado al repositorio, configurar un control de despliegue de GitHub que requiera el trabajo `Tipos, reglas y recorridos de demostración`. Verificar su disponibilidad en el plan y que la revisión evaluada coincida con la desplegada.
3. Comprobar que un resultado pendiente o fallido impide la promoción. No utilizar una promoción forzada para eludir esa comprobación. La mera presencia del flujo YAML no demuestra que esta condición esté configurada.
4. Verificar el candidato por HTTPS: acceso, dos roles, incorporación, publicación, participación, revisión, notas y archivo privado. Registrar URL, revisión, entorno, fecha y resultado sin secretos.
5. Promover únicamente cuando se cumplan los criterios de liberación. Registrar la versión anterior utilizable para volver atrás.

Vercel permite condicionar la promoción a resultados de GitHub; esta configuración debe comprobarse en el servicio. Hasta entonces, Aulify tiene CI ejecutado y CD pendiente de puesta en operación. [Deployment Checks](https://vercel.com/docs/deployment-checks).

## Seguimiento y recuperación

El flujo de mantenimiento programa la conservación cada seis horas. Revisar sus ejecuciones y cuotas de base, archivos, transferencia y funciones. Un disparo manual correcto no demuestra un plazo de limpieza garantizado.

Un retorno a una versión anterior del código no revierte automáticamente una migración ni restaura archivos. Antes de cambios incompatibles se necesita un respaldo operativo y una restauración comprobada de datos y objetos privados. La [restauración aislada](../verificacion/recuperacion-aislada.md) aporta una comprobación técnica, pero no sustituye la recuperación del servicio alojado.
