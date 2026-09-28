# Renovación de sesión bajo limitación temporal

Durante la preparación de las cuentas del sondeo se observaron respuestas 429 de Auth antes de comenzar la medición. El cliente SSR podía eliminar la cookie de una sesión vencida al rechazar su renovación. El proxy propagaba esa eliminación y la ruta siguiente devolvía 401. Los registros de preparación se conservan por separado: no representan una medición de capacidad de la aplicación.

La frontera HTTP distingue ahora la indisponibilidad temporal de una credencial inválida. Un fallo 429, de red o 5xx al verificar Auth detiene la solicitud protegida con 503 y `Retry-After: 30`; conserva las cookies para un intento posterior. Esto no autoriza una identidad sin verificar ni permite continuar una operación. El cliente de servidor también evita persistir cambios de cookies cuando su transporte detecta un fallo temporal de Auth. Una renovación efectivamente rechazada como inválida conserva el comportamiento de cierre de sesión.

Tres casos ejecutan el cliente real `@supabase/ssr` con respuestas HTTP simuladas y cookies ficticias vencidas:

| Caso | Resultado observado |
|---|---|
| Renovación limitada con 429 | 503, indicación de espera, sin borrar cookie ni continuar a la ruta |
| Refresh token inválido, 400 | Cookie eliminada |
| Renovación válida, 200 | Nueva cookie persistida y transmitida a la ruta |

Los tres aprobaron. El conjunto local consta de 42 pruebas unitarias en seis archivos; también aprobaron análisis estático, formato, tipos y construcción. Compilado utilizado para continuar los sondeos: `7sRhvomkfVIG0kD7-y2WS`. La prueba de transporte simulado no equivale a haber superado la carga objetivo ni a una prueba remota de recuperación de correo.

La preparación del ensayo respeta las cuotas y separa renovaciones para evitar otra ráfaga artificial. No se aumentaron límites ni se alteraron direcciones IP. Referencia: [límites oficiales de Supabase Auth](https://supabase.com/docs/guides/auth/rate-limits), consultada el 28 de septiembre de 2026.

Reproducción: `npx vitest run tests/unit/auth-renewal.test.ts tests/unit/http.test.ts`.
