# Sesiones HTTPS en vistas previas

El primer despliegue Preview del 30 de septiembre (`71d9b48`) permitió abrir la portada, el editor y la actividad de demostración por HTTPS. Al revisar la configuración de sesión se encontró que `Secure` dependía de `NEXT_PUBLIC_SITE_URL`, una variable configurada únicamente en producción. El proxy sí utilizaba el protocolo de la solicitud, pero el cliente SSR que emite la cookie de acceso no reconocía el alojamiento Preview.

El cliente SSR ahora reconoce `VERCEL=1`, además del origen HTTPS configurado, cuando la aplicación está compilada para producción. Mantiene `HttpOnly` y `SameSite=Lax`. El compilado local HTTP conserva su funcionamiento. La variable del proveedor se documenta como disponible en compilación y ejecución en la [referencia oficial de Vercel](https://vercel.com/docs/environment-variables/system-environment-variables).

Tres pruebas ejecutan el acceso con el SDK SSR real, transporte simulado y un almacén de cookies controlado. Comprueban las opciones de las cookies emitidas en Preview sin dominio configurado, alojamiento HTTPS propio y ejecución local HTTP. Junto con seis pruebas existentes de renovación, aprobaron nueve comprobaciones. ESLint y la construcción de Next.js también aprobaron. Esta evidencia no sustituye el acceso real en la versión desplegada después de la corrección.
