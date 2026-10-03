# Recuperación de los servicios de Aulify

El 3 de octubre de 2026 se recuperó una copia de PostgreSQL, Auth, PostgREST y Storage, y se compiló una segunda aplicación contra esa copia. El proyecto original no se utilizó como destino. El [registro agregado](recuperacion-servicios.json) conserva versiones, alcance y tiempos reales; los inventarios, contraseñas, sesiones y archivos permanecen fuera de Git.

## Procedimiento y resultados

1. Validar tamaño y SHA-256 del respaldo lógico remoto. Crear un proyecto Docker independiente con puertos publicados únicamente en `127.0.0.1`.
2. Importar las cinco estructuras respaldadas en PostgreSQL 17.6. Coincidieron los recuentos y las huellas de las **83 tablas**, sus políticas de RLS y las **25 migraciones**. Se comparó por nombre, sin depender de la colación que ordena los nombres de tablas.
3. Configurar contraseñas y claves JWT nuevas para el destino. No copiar claves API ni contraseñas de roles del alojamiento. Iniciar Auth, PostgREST y Storage, con las pertenencias de roles que necesitan sus servicios.
4. Recuperar **42 objetos, 22.024.706 bytes**, mediante la API de Storage. Descargar todos por HTTP y comprobar sus SHA-256 contra el inventario. Se conservaron las rutas referenciadas por la aplicación.
5. Iniciar sesión con cuatro cuentas ficticias recuperadas. Coincidieron sus identificadores con los del respaldo. Verificar las proyecciones de docente y estudiante, la lectura de una actividad, el aislamiento del estudiante y el rechazo de acceso anónimo a datos y archivos.
6. Compilar Aulify en una carpeta privada separada, contra las nuevas APIs. Ambos perfiles iniciaron sesión mediante `/api/auth`, accedieron a `/aula` y leyeron sus datos y actividades mediante `/api/workspace`. La descarga docente mediante `/api/files` coincidió con el hash respaldado. Una petición sin sesión no obtuvo el espacio de trabajo.
7. Detener la aplicación recuperada y los contenedores del ensayo, conservando sus volúmenes privados. No se cambió la configuración de la aplicación original.

La aplicación recuperada produjo el build `o3Y3JlhHax6Y3XoN0C9wN`. Las comprobaciones posteriores al despliegue local fueron solicitudes HTTP reales, no respuestas simuladas.

## Compatibilidad y límites

La imagen Storage `v1.74.0` indicada inicialmente por el [compose oficial](https://github.com/supabase/supabase/blob/master/docker/docker-compose.yml) no era compatible con los índices de versiones del respaldo administrado: la subida devolvió SQLSTATE `42P10`. Se utilizó la [versión oficial v1.79.31](https://github.com/supabase/storage/releases/tag/v1.79.31), sin cambiar los índices del respaldo para acomodar una imagen anterior. El ensayo posterior pasó. Auth usa `v2.196.0` y PostgREST `v14.17`.

AP-36 queda cubierto para reconstrucción y recuperación de los servicios usados por Aulify, con datos ficticios del proyecto alojado y verificación posterior en un despliegue local separado. Esto no libera producción ni demuestra migración a un segundo proyecto Supabase administrado. SMTP, dominio, Realtime y Vault no se comprobaron en esta recuperación. Las sesiones antiguas no se preservan porque el destino utiliza claves nuevas.

La subida por API puede actualizar metadatos técnicos de Storage. La igualdad de las 83 tablas se verificó **antes** de iniciar las APIs; después, el acceso genera sesiones y actualiza tiempos propios de Auth, y las lecturas pueden cerrar intentos vencidos en la copia. Los bytes descargados y sus rutas sí se cotejaron después de la recuperación. Este ensayo no equivale a una instantánea atómica entre PostgreSQL y Storage; se verificó que los dos inventarios respaldados correspondían al mismo conjunto de objetos.

La ejecución permite reproducir este resultado con `node tools/datos/service-recovery.mjs --create`. Necesita Docker en funcionamiento y herramientas nativas de PostgreSQL 17. `--resume` continúa el destino privado del ensayo interrumpido y `--stop` detiene exclusivamente ese proyecto. Los puertos, nombres y credenciales de la copia se generan localmente; no se ofrecen como configuración de producción.
