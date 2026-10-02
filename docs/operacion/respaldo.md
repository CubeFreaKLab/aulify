# Respaldo y recuperación

La recuperación completa comprende PostgreSQL, las cuentas de Auth y los bytes de Storage. Un ensayo de SQL aislado o una copia de archivos no acredita restaurar el servicio completo. Los respaldos de base de datos de Supabase no incluyen los bytes de Storage. [Documentación de Supabase](https://supabase.com/docs/guides/platform/backups).

## Copiar archivos localmente

Ejecutar en la raíz del proyecto, con las variables privadas existentes y fuera de Git:

```powershell
node --env-file=.env.local tools/datos/storage-backup.mjs --create
```

El ejecutor acepta únicamente el proyecto de Aulify y el bucket privado `aulify-files`. Limita la copia a 256 MiB y 5.000 objetos, no sobrescribe copias anteriores y comprueba tamaño y SHA-256 de cada archivo. Los bytes y el inventario quedan en `.local-private/backups`; el resumen público no contiene rutas de archivos ni claves. La ubicación vigente se registra en `.local-private/latest-storage-backup.json`.

Para volver a comprobar la copia, proporcionar su carpeta privada:

```powershell
node tools/datos/storage-backup.mjs --verify RUTA_PRIVADA
```

Un cambio concurrente de archivos puede hacer fallar la copia. Para respaldar conjuntamente base y archivos se necesita una ventana sin escrituras y registrar el mismo corte. No restaurar sobre el proyecto actual para realizar un ensayo.

## Completar la recuperación operativa

1. Obtener la conexión de PostgreSQL del Session pooler y su contraseña de base de datos. La clave API de servidor no sustituye esta contraseña.
2. Guardar la conexión únicamente en un archivo local excluido de Git, sin mostrarla en capturas o registros.
3. Preparar un destino separado. Seguir el procedimiento oficial de exportación e importación de roles, esquema y datos, incluidas las tablas administradas que corresponda conservar. Las migraciones por sí solas no respaldan cuentas ni contenido.
4. Copiar los objetos del inventario al bucket del destino, conservando sus rutas, y comprobar hashes, referencias y permisos.
5. Verificar acceso de ambos roles, pertenencia, versiones de recursos, intentos, evaluaciones y descarga autorizada. Registrar resultados y limitaciones antes de aprobar AP-36.

El procedimiento oficial distingue esquemas administrados y datos del proyecto; una importación indiscriminada puede producir conflictos de permisos. [Migración mediante respaldo y restauración](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore).

El ensayo integral permanece pendiente mientras no haya conexión de PostgreSQL y destino aislado disponibles. No se ha cambiado la contraseña de la base ni habilitado facturación.
