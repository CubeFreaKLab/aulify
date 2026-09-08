# Planes y costos de servicios

**Consulta: 8 de septiembre de 2026. Moneda: USD.**

El inicio de Aulify se plantea con planes gratuitos, dentro de sus condiciones y cuotas. La columna de pago permite comparar el primer nivel de ampliación; no representa un gasto contratado. Los servicios alternativos no se suman entre sí.

| Recurso | Plan gratuito o licencia inicial | Costo inicial de referencia | Primera opción de pago | Condición principal y fuente oficial |
|---|---|---|---|---|
| Visual Studio Code | Editor gratuito | 0 por licencia | No requiere suscripción al editor | Uso privado y comercial gratuito. [FAQ](https://code.visualstudio.com/docs/supporting/faq). |
| Git / GitHub | Git / GitHub Free | 0 por licencia / 0 al mes | GitHub Team: 4 por usuario al mes durante los primeros 12 meses, según la oferta publicada | Git es la herramienta local; GitHub aloja los repositorios. Revisar el precio de renovación al contratar. [Git](https://git-scm.com/), [GitHub Pricing](https://github.com/pricing). |
| Next.js / React | Licencias MIT | 0 por licencia | No aplica suscripción | El alojamiento se presupuesta por separado. [Next.js](https://github.com/vercel/next.js/blob/canary/license.md), [React](https://github.com/facebook/react/blob/main/LICENSE). |
| TypeScript / Node.js | Herramientas de código abierto | 0 por licencia | No aplica suscripción | El cómputo del servidor es otro concepto. [TypeScript](https://github.com/microsoft/TypeScript/blob/main/LICENSE.txt), [Node.js](https://nodejs.org/en). |
| Cloud Firestore | Firebase Spark | 0 al mes dentro de cuotas | Blaze: pago por consumo, sin mensualidad fija | Cuotas gratuitas de almacenamiento y operaciones. [Firebase Pricing](https://firebase.google.com/pricing). |
| Firebase Authentication | Correo y contraseña en Spark | 0 dentro de cuotas | Uso facturable en Blaze según función y consumo | No se prevé autenticación por SMS. [Precios](https://firebase.google.com/pricing), [límites](https://firebase.google.com/docs/auth/limits). |
| Vercel | Hobby | 0 al mes | Pro: 20 por asiento de desarrollador al mes, más consumo adicional | Hobby requiere uso personal no comercial. Comprobar elegibilidad del despliegue. [Vercel Pricing](https://vercel.com/pricing). |
| Render, alternativa de alojamiento | Web Service Free | 0 al mes | Instancia de pago mínima: 7 al mes | La instancia se distingue del plan del espacio de trabajo. Free se suspende por inactividad. [Precios](https://render.com/pricing), [límites](https://render.com/docs/free). |
| GitHub Actions | Cuota de GitHub Free | 0 dentro de cuota | Excedente Linux de un núcleo: desde 0,002 por minuto | En repositorios privados: 2.000 minutos al mes y 500 MB de artefactos. La tarifa depende del ejecutor. [Facturación](https://docs.github.com/en/billing/concepts/product-billing/github-actions). |
| Supabase Storage, candidato para archivos | Free | 0 al mes | Pro: desde 25 al mes | Free incluye 1 GB de archivos y admite hasta 50 MB por archivo. [Supabase Pricing](https://supabase.com/pricing). |
| Firebase Storage, alternativa con facturación | No disponible en Spark | No incluido en el inicio sin facturación | Blaze obligatorio, pago por consumo | Desde el 3 de febrero de 2026 requiere Blaze, incluso si parte del uso entra en cuotas sin costo. [Cambio oficial](https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024?hl=en). |
| Dominio propio, opcional | Subdominio del alojamiento al inicio | 0 por dominio propio al no contratarlo | Referencia .com en Porkbun: 11,08 el primer año y 11,08 al año al renovar | Ejemplo para nombres disponibles no prémium, con tasas ICANN incluidas. No se ha elegido nombre ni proveedor. [Tarifas](https://porkbun.com/products/domains). |

## Cuotas relevantes para la propuesta

- **Firestore Spark:** 1 GiB almacenado; 50.000 lecturas, 20.000 escrituras y 20.000 eliminaciones diarias; 10 GiB de transferencia saliente al mes. [Fuente](https://firebase.google.com/pricing).
- **Supabase Free:** 5 GB de transferencia saliente y otros 5 GB de transferencia en caché; dos proyectos activos y pausa por una semana de inactividad. [Fuente](https://supabase.com/pricing).
- **Render Free:** suspensión tras 15 minutos sin tráfico, disco efímero y 750 horas gratuitas compartidas al mes por espacio de trabajo. [Fuente](https://render.com/docs/free).

Las cuotas pueden agotarse antes que la capacidad técnica. Deben medirse lecturas, escrituras, transferencia y reintentos durante la prueba de carga. El objetivo de 200 estudiantes concurrentes todavía no está validado ni presupone que ese uso quepa en las cuotas gratuitas.

## Tratamiento en la arquitectura

La propuesta inicial contempla Firebase Authentication y Firestore en Spark. Para los archivos se evaluará Supabase Free, cuya [integración con Firebase Authentication](https://supabase.com/docs/guides/auth/third-party/firebase-auth) está documentada oficialmente. La integración, las políticas de acceso y la eliminación de archivos requieren una prueba técnica antes de seleccionar esta combinación.

Vercel y Render se presentan como alternativas de alojamiento. Firebase Storage queda como referencia para una eventual opción con facturación, no como dependencia del inicio gratuito. Las decisiones y pruebas se describen en [plan.md](../plan.md).

Estos importes no incluyen equipos, conexión a Internet, trabajo de desarrollo ni soporte. Tampoco constituyen una garantía de gratuidad permanente. Revisar tarifas y elegibilidad antes de contratar o cambiar de plan.
