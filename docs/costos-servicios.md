# Planes y costos de servicios

**Moneda: USD. Supabase y GitHub Actions revisados el 22 de septiembre de 2026; las demás referencias conservan la consulta del 8 de septiembre de 2026.**

El inicio de Aulify se plantea con planes gratuitos, dentro de sus condiciones y cuotas. La columna de pago permite comparar el primer nivel de ampliación; no representa un gasto contratado. Los servicios alternativos no se suman entre sí.

| Recurso | Plan gratuito o licencia inicial | Costo inicial de referencia | Primera opción de pago | Condición principal y fuente oficial |
|---|---|---|---|---|
| Visual Studio Code | Editor gratuito | 0 por licencia | No requiere suscripción al editor | Uso privado y comercial gratuito. [FAQ](https://code.visualstudio.com/docs/supporting/faq). |
| Git / GitHub | Git / GitHub Free | 0 por licencia / 0 al mes | GitHub Team: 4 por usuario al mes durante los primeros 12 meses, según la oferta publicada | Git es la herramienta local; GitHub aloja los repositorios. Revisar el precio de renovación al contratar. [Git](https://git-scm.com/), [GitHub Pricing](https://github.com/pricing). |
| Next.js / React | Licencias MIT | 0 por licencia | No aplica suscripción | El alojamiento se presupuesta por separado. [Next.js](https://github.com/vercel/next.js/blob/canary/license.md), [React](https://github.com/facebook/react/blob/main/LICENSE). |
| TypeScript / Node.js | Herramientas de código abierto | 0 por licencia | No aplica suscripción | El cómputo del servidor es otro concepto. [TypeScript](https://github.com/microsoft/TypeScript/blob/main/LICENSE.txt), [Node.js](https://nodejs.org/en). |
| Supabase: PostgreSQL, Auth y Storage | Free | 0 al mes dentro de cuotas | Pro: desde 25 al mes para la organización; primer proyecto incluido, sujeto a condiciones y consumo | El plan se cuenta una sola vez para estos servicios. Incluye 500 MB de base de datos, 50.000 usuarios activos mensuales y 1 GB de archivos. [Supabase Pricing](https://supabase.com/pricing). |
| Correo de autenticación y recuperación | Proveedor SMTP por seleccionar | Pendiente de cotización; requisito de inicio gratuito | Pendiente del proveedor elegido | El correo predeterminado de Supabase restringe destinatarios y no cubre el uso general previsto. Verificar también requisitos del dominio remitente. [Supabase SMTP](https://supabase.com/docs/guides/auth/auth-smtp). |
| Vercel | Hobby | 0 al mes | Pro: 20 por asiento de desarrollador al mes, más consumo adicional | Hobby requiere uso personal no comercial. Comprobar elegibilidad del despliegue. [Vercel Pricing](https://vercel.com/pricing). |
| Render, alternativa de alojamiento | Web Service Free | 0 al mes | Instancia de pago mínima: 7 al mes | La instancia se distingue del plan del espacio de trabajo. Free se suspende por inactividad. [Precios](https://render.com/pricing), [límites](https://render.com/docs/free). |
| GitHub Actions | Cuota de GitHub Free | 0 dentro de cuota | Excedente Linux de un núcleo: 0,002 por minuto; Linux x64 de dos núcleos: 0,006 por minuto | En repositorios privados: 2.000 minutos al mes y 500 MB de artefactos. La tarifa depende del ejecutor; el más barato no garantiza recursos suficientes para navegador y base de datos. [Facturación](https://docs.github.com/en/billing/concepts/product-billing/github-actions). |
| Dominio propio, opcional | Subdominio del alojamiento al inicio | 0 por dominio propio al no contratarlo | Referencia .com en Porkbun: 11,08 el primer año y 11,08 al año al renovar | Ejemplo para nombres disponibles no prémium, con tasas ICANN incluidas. No se ha elegido nombre ni proveedor. [Tarifas](https://porkbun.com/products/domains). |

## Cuotas relevantes para la propuesta

- **Supabase Free:** 500 MB de base de datos, 1 GB de archivos, 5 GB de transferencia saliente y otros 5 GB de transferencia en caché; dos proyectos activos y pausa por una semana de inactividad. No incluye copias automáticas. [Fuente](https://supabase.com/pricing).
- **Supabase Realtime Free:** 200 conexiones concurrentes y 100 mensajes por segundo. Cuatro grupos de 50 estudiantes más sus docentes excederían el límite si cada cuenta mantiene una conexión. Resolver el transporte antes de comprobar la carga objetivo. [Fuente](https://supabase.com/docs/guides/realtime/limits).
- **Correo predeterminado de Supabase:** limitado a direcciones autorizadas del equipo; requiere sustituirse por SMTP para el uso previsto. El costo de ese proveedor todavía no está cerrado. [Fuente](https://supabase.com/docs/guides/auth/auth-smtp).
- **Render Free:** suspensión tras 15 minutos sin tráfico, disco efímero y 750 horas gratuitas compartidas al mes por espacio de trabajo. [Fuente](https://render.com/docs/free).

Las cuotas pueden agotarse antes que la capacidad técnica. Deben medirse lecturas, escrituras, transferencia y reintentos durante la prueba de carga. El objetivo de 200 estudiantes concurrentes todavía no está validado ni presupone que ese uso quepa en las cuotas gratuitas.

## Tratamiento en la arquitectura

La selección vigente utiliza PostgreSQL, Auth y Storage de Supabase. La [decisión de arquitectura](decisiones/0001-supabase.md) registra su alcance. Las políticas de acceso, el correo, la sincronización, el respaldo y la eliminación de archivos requieren comprobación técnica.

Vercel y Render se presentan como alternativas de alojamiento. El presupuesto de suscripciones completo no está cerrado hasta resolver el proveedor SMTP y sus requisitos. Las decisiones y pruebas se describen en [plan.md](../plan.md).

Estos importes no incluyen equipos, conexión a Internet, trabajo de desarrollo ni soporte. Tampoco constituyen una garantía de gratuidad permanente. Revisar tarifas y elegibilidad antes de contratar o cambiar de plan.
