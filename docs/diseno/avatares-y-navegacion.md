# Avatares y cabecera de presentación

Actualización del 23 de octubre de 2026.

## Comportamiento

- Preferencias ofrece 30 retratos circulares originales: 15 masculinos y 15 femeninos. Cualquier usuario puede elegir cualquiera de ellos.
- Los retratos tienen fondo verde uniforme y opaco dentro del círculo; solo el exterior es transparente. Son SVG con trazados, sin mapas de bits incrustados.
- En la demostración, la elección se conserva por perfil en este navegador. En una cuenta autenticada, se guarda como `avatar_id` en los metadatos de apariencia de Supabase Auth y se recupera al entrar.
- El avatar aparece en la barra lateral y en el selector de perfiles. La revisión usa retratos en lugar de iniciales. Las cuentas ajenas muestran un retrato predeterminado; esta entrega no expone los metadatos privados de otra cuenta.
- Los retratos no cambian el nombre, el rol ni los permisos. El servidor admite únicamente identificadores del catálogo y actualiza la cuenta de la sesión verificada; rechaza identidades y campos adicionales enviados por el cliente.
- Un fallo de guardado muestra un mensaje y conserva la elección anterior.

## Marca y adaptación

La barra contraída usa un símbolo independiente con margen propio. Las ilustraciones incorporan `viewBox` para escalar sin recortes; las de bienvenida y explicación tienen mayor espacio. En modo oscuro se conserva el verde de los dibujos. El cambio de tema mantiene el efecto circular y su área pulsable, sin borde circular visible.

La cabecera sigue la interacción de [Hero Morph Navbar, de RewampUI](https://www.rewampui.com/components/hero-morph-navbar): amplia al inicio y compacta, flotante, al desplazar la página. Los accesos siguen disponibles; en móvil se despliegan con el botón de menú. Escape cierra ese menú y devuelve el foco. La transición respeta la preferencia de movimiento reducido.

## Aceptación y comprobación local

| Comportamiento esperado | Resultado |
|---|---|
| Mostrar los 30 retratos completos en escritorio y móvil | Catálogo y capturas revisados. |
| Conservar el avatar al recargar la demostración | Comprobado en navegador. |
| Rechazar cambios sin sesión, desde otro origen o fuera del catálogo | Pruebas del endpoint aprobadas. |
| Conservar logo e ilustraciones completos, con color en ambos temas | Capturas de escritorio y móvil revisadas. |
| Mantener la cabecera visible al desplazar y permitir abrir su menú móvil | Comprobado en navegador. |
| Permitir reflujo a 320 píxeles y mantener accesibilidad de la portada | Comprobaciones existentes aprobadas. |

La compilación, el análisis estático y los tipos pasaron localmente. Las pruebas del endpoint utilizan un proveedor controlado; no acreditan por sí mismas un cambio de perfil en Supabase alojado. La publicación de cada revisión y su integración continua se registran por separado.
