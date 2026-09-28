# Recuperación de una base aislada

Se generó una copia comprimida de una base PGlite con las diez migraciones y datos ficticios. Tras cerrar esa instancia, se abrió otra desde el archivo guardado y se comprobaron estructura, pertenencia, versiones de resultados, autorización y continuidad de escritura. Las nueve comprobaciones aprobaron; el [registro JSON](recuperacion-aislada.json) conserva tiempo real, tamaño y huella del archivo.

El ejecutor es [recovery-check.mjs](../../tools/datos/recovery-check.mjs). Se reproduce con `node tools/datos/recovery-check.mjs` después de instalar las dependencias. La copia queda en una carpeta local excluida de Git, no en el repositorio público.

Este formato corresponde a `dumpDataDir` de [PGlite](https://pglite.dev/docs/api#dumpdatadir). No se puede presentar como una restauración de PostgreSQL alojado o de Supabase. El entorno simula Auth y metadatos mínimos de Storage; no incluye contraseñas, sesiones reales ni bytes de archivos remotos.

La recuperación operativa AP-36 exige todavía un respaldo remoto adecuado, sus objetos de Storage y una restauración en un entorno separado, seguida de comprobaciones de acceso y consistencia. El resultado aislado cubre una parte de ese trabajo y conserva expresamente ese límite.
