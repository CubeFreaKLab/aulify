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

## Respaldo lógico de PostgreSQL

La contraseña del Session pooler se guarda en `.local-private/postgres-backup.env`. El ejecutor valida el proyecto, utiliza el puerto 5432 con TLS y transmite la contraseña mediante el entorno del proceso, sin incorporarla a argumentos, registros ni informes.

```powershell
node tools/datos/postgres-backup.mjs --create
```

Necesita las herramientas nativas de PostgreSQL 17. En Windows utiliza `C:/Program Files/PostgreSQL/17/bin`; `AULIFY_PG_BIN` permite indicar otra instalación. Exporta `app`, `public`, `auth`, `storage` y `supabase_migrations` en formato custom. Una transacción de solo lectura mantiene la instantánea compartida por `pg_dump`, los recuentos y las huellas de tablas. No exporta contraseñas de roles PostgreSQL ni modifica la base original.

El archivo y su inventario permanecen en `.local-private/backups`. Incluyen datos privados y contraseñas cifradas de cuentas de Auth; no deben publicarse. El puntero `.local-private/latest-postgres-backup.json` identifica la copia y el [resumen público](../verificacion/respaldo-postgres.json) contiene únicamente alcance y comprobaciones agregadas. Realtime, Vault, claves de servicios y SMTP quedan fuera de este respaldo.

## Ensayo nativo de recuperación

```powershell
$backupLocation = (Get-Content .local-private/latest-postgres-backup.json -Raw | ConvertFrom-Json).folder
node tools/datos/postgres-backup.mjs --restore-test $backupLocation
```

El ejecutor crea otro clúster, con contraseña aleatoria y escucha exclusiva en `127.0.0.1`. No acepta una conexión de destino remoto. Importa en una transacción, coteja las huellas de todas las tablas, las políticas y el estado de RLS, y verifica las 25 migraciones. Reproduce los archivos en otra carpeta privada y comprueba ruta, identificador, fecha de modificación, tamaño y SHA-256 contra los metadatos respaldados. Al terminar detiene el clúster y retira su archivo temporal de contraseña.

El [ensayo registrado](../verificacion/restauracion-postgres-nativa.md) restauró 83 tablas, incluidas las 47 de Aulify, y comprobó 42 archivos con 22.024.706 bytes. Las huellas y políticas coincidieron. Para comparar fechas entre sistemas utiliza UTC; esto no cambia las horas guardadas. El origen permaneció intacto.

Esta prueba acredita la recuperación lógica y los bytes en un entorno local separado. No recrea las APIs de Supabase Auth, PostgREST y Storage ni demuestra un acceso HTTP del usuario al destino recuperado. Tampoco convierte las copias de base y archivos en una instantánea atómica: el cotejo detecta diferencias, pero todavía se necesita una ventana sin escrituras para un corte conjunto.

## Completar la recuperación del servicio

1. Preparar un destino Supabase separado y sus credenciales, sin utilizar la base actual para el ensayo.
2. Conservar la exportación lógica y los archivos en rutas privadas. Las migraciones por sí solas no respaldan cuentas ni contenido.
3. Seguir el procedimiento oficial de exportación e importación de roles, esquema y datos, incluidas las tablas administradas. Un servicio administrado ya contiene estructura propia; el ensayo nativo no se puede importar indiscriminadamente sobre ella.
4. Copiar los objetos del inventario al bucket del destino, conservando sus rutas, y comprobar hashes, referencias y permisos.
5. Verificar acceso de ambos roles, pertenencia, versiones de recursos, intentos, evaluaciones y descarga autorizada. Registrar resultados y limitaciones antes de aprobar AP-36.

El procedimiento oficial distingue esquemas administrados y datos del proyecto; una importación indiscriminada puede producir conflictos de permisos. [Migración mediante respaldo y restauración](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore).

La conexión de PostgreSQL, el respaldo remoto y la restauración lógica aislada están comprobados. La recuperación integral del servicio HTTP permanece pendiente de un destino Supabase independiente. No se habilitó facturación.
