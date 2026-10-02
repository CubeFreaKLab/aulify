# Racha interrumpida por una respuesta escrita

La secuencia de AP-17 se comprobó el 2 de octubre de 2026 sobre el compilado local `DbIsroXTuSqh8Ui1zOamx`, procedente de `4fa2c2d`. Se utilizó el adaptador de demostración con datos ficticios, sin modificar las reglas de puntuación ni el audio de la aplicación.

La [prueba](../../tests/e2e/racha-revision-manual.spec.ts) ejecuta dos respuestas correctas, una respuesta escrita pendiente de revisión y otra correcta. La racha aparece al segundo acierto, desaparece al enviar la respuesta escrita y no vuelve a mostrarse con un solo acierto. Las tres respuestas automáticas conservan dos puntos cada una, aunque la última se responde después de una pausa. La escrita no recibe una corrección automática.

Se observaron cero llamadas de reproducción con el sonido desactivado, movimiento reducido activo y cero usos de potenciadores. Los dos recorridos aprobaron: Chromium de escritorio y celular emulado. El registro de ejecución indicó `2 passed (6.3s)`.

Este resultado verifica la secuencia de interacción de AP-17 en demostración. No acredita reproducción en un dispositivo físico, lector de pantalla, Supabase ni aceptación estética. La [regresión de silenciamiento durante el envío](preferencia-sonido.md) conserva por separado el caso de cambiar la preferencia antes de confirmar.
