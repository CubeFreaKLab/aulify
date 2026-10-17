import fs from "node:fs/promises";

const source = process.argv[2] || "docs/verificacion/datos-carga.json";
const output = process.argv[3] || "docs/verificacion/datos-carga.md";
const data = JSON.parse(await fs.readFile(source, "utf8"));
if (["preparing", "running", "running-diagnostic"].includes(data.status)) {
  throw new Error("La ejecución sigue activa; el informe final requiere su cierre.");
}

const number = (value, digits = 2) =>
  value === null || value === undefined
    ? "No medido"
    : Number(value).toLocaleString("es-BO", { maximumFractionDigits: digits });
const milliseconds = (value) =>
  value === null || value === undefined ? "No medido" : `${number(value)} ms`;
const percentage = (value) =>
  value === null || value === undefined ? "No medido" : `${number(value * 100, 3)} %`;
const phaseName = (phase) =>
  `${phase.mode === "guided" ? "Guiado" : "Individual"}: ${phase.stage === "warmup" ? "calentamiento" : "medición"}`;
const status = {
  "q06-passed-in-local-environment": "Los criterios instrumentados de Q-06 se cumplieron en este entorno local.",
  "q06-failed-in-local-environment": "Q-06 no se cumplió en este entorno local.",
  "q06-passed-in-vercel-preview": "Los criterios instrumentados de Q-06 se cumplieron en esta Preview de Vercel con Supabase Free.",
  "q06-failed-in-vercel-preview": "Q-06 no se cumplió en esta Preview de Vercel con Supabase Free.",
  "stopped-at-safety-limit": "La prueba se interrumpió al alcanzar un límite preventivo. Q-06 queda sin aprobar.",
  failed: "La ejecución terminó con un fallo. Q-06 queda sin aprobar.",
  "sessions-prepared": "Solo se prepararon las sesiones; no se ejecutó la carga.",
}[data.status] || `Estado de ejecución: ${data.status}.`;

const lines = [
  "# Capacidad: ensayo HTTP con datos ficticios",
  "",
  status,
  "",
  `Ejecución ${data.runId}. Inicio real: ${data.startedAt}; cierre: ${data.completedAt}. Build ID servido: \`${data.buildId ?? "no conservado"}\`. ${data.compiledCommit ? `Revisión compilada identificada: \`${data.compiledCommit}\`.` : "No se atribuye automáticamente el compilado al HEAD si había cambios locales."} HEAD al iniciar el generador: \`${data.commit}\`. [Mediciones JSON](${source.split(/[\\/]/).at(-1)}).`,
  "",
];
if (data.failure) lines.push(`Motivo registrado: ${data.failure.reason}`, "");
if (data.archivedRawSource) lines.push(`Se conserva la [salida original sin resumir](${data.archivedRawSource}). Los percentiles del resumen se calcularon a partir de sus muestras, sin agregar solicitudes.`, "");
if (data.previousReport) lines.push(`El [ensayo anterior](${data.previousReport}) se conserva por separado; las mejoras posteriores no modifican sus resultados.`, "");
lines.push(
  "## Entorno y escenario",
  "",
  `Se utilizó la aplicación Next.js compilada en ${data.environment.base}, conectada a ${data.environment.database}. El generador utilizó ${data.environment.generator.node}, ${data.environment.generator.os}, ${data.environment.generator.cpu}, ${data.environment.generator.logicalCpus} procesadores lógicos y ${number(data.environment.generator.totalMemoryBytes / 1024 ** 3)} GiB de memoria.`,
  "",
  "El escenario exige cuatro docentes y doscientos estudiantes, distribuidos en cuatro materias de cincuenta estudiantes, con diez preguntas por actividad. Cada modalidad tiene cinco minutos de calentamiento y quince de medición. Se prepara una actividad independiente por materia, modalidad y fase; los datos de calentamiento no se reutilizan como resultados medidos.",
  "",
  `Se prepararon ${data.authentication.preparedSessions} sesiones HTTP. La autenticación se espació para respetar los límites del servicio; hubo ${data.authentication.rateLimitWaits} esperas por respuestas temporales durante esta preparación. Las cuentas son ficticias, con confirmación administrativa y sin envío de correo. Sus credenciales y cookies permanecen en archivos locales excluidos de Git.`,
  "",
  `${data.environment.polling || 'Cada sesión consulta /api/sync cada segundo.'} Sólo se solicita la proyección de actividad cuando cambia la huella o se recupera la conexión. No se acumulan consultas simultáneas de sincronización de una misma sesión. Las respuestas se envían a /api/commands: atraviesan autorización, validación, RPC y persistencia. Los reintentos conservan la clave de idempotencia.`,
  ...(data.environment.fixtureHistory ? ["",data.environment.fixtureHistory] : []),
  "",
  "## Resultados por fase",
  "",
  "| Fase | Duración observada / requerida | Solicitudes | Fallos técnicos | p95 de confirmación | p95 de propagación |",
  "|---|---:|---:|---:|---:|---:|",
);
for (const mode of ["individual", "guided"]) {
  for (const stage of ["warmup", "measurement"]) {
    const phase = data.phases.find((entry) => entry.mode === mode && entry.stage === stage);
    if (!phase) {
      lines.push(`| ${phaseName({ mode, stage })} | No ejecutada / ${stage === "warmup" ? 300 : 900} s | — | — | — | — |`);
      continue;
    }
    lines.push(`| ${phaseName(phase)}${phase.interrupted ? " (interrumpida)" : ""} | ${number(phase.elapsedSeconds)} / ${phase.targetSeconds} s | ${number(phase.requestCount, 0)} | ${number(phase.failedRequests, 0)} (${percentage(phase.failureRate)}) | ${milliseconds(phase.confirmationP95Ms)} | ${mode === "guided" ? milliseconds(phase.propagationP95Ms) : "No aplica"} |`);
  }
}
lines.push(
  "",
  data.environment.confirmation ? `La confirmación reproduce el flujo del cliente: ${data.environment.confirmation} La propagación guiada se mide desde la apertura solicitada por el docente hasta recibir un estado que muestra la pregunta abierta; no incluye el dibujo de la pantalla.` : "La confirmación incluye la respuesta del comando y la lectura que permite observar la respuesta persistida en el estado del estudiante. La propagación guiada se mide desde el envío de la apertura por el docente hasta la recepción de un estado que muestra la pregunta abierta. No incluye el tiempo de dibujo de una pantalla.",
  "",
  "Los objetivos se mantienen: confirmación p95 ≤ 1,5 s, propagación guiada p95 ≤ 2 s, menos del 1 % de fallos técnicos en solicitudes válidas y ninguna pérdida o duplicación de respuestas confirmadas. Una fase incompleta no demuestra la capacidad del escenario, aunque sus operaciones aisladas hayan funcionado.",
  "",
  "## Persistencia, ráfaga y resultados",
  "",
  "| Fase | Confirmadas | Persistidas | Confirmadas ausentes o distintas | Duplicadas | Ráfaga de 200 en ≤ 2 s | p95 de consulta de notas |",
  "|---|---:|---:|---:|---:|---|---:|",
);
for (const phase of data.phases) {
  lines.push(`| ${phaseName(phase)} | ${number(phase.integrity?.confirmedAnswers, 0)} | ${number(phase.integrity?.persistedAnswers, 0)} | ${number(phase.integrity?.missingOrChangedConfirmed, 0)} | ${number(phase.integrity?.duplicateQuestions, 0)} | ${phase.burst ? `${phase.burst.dispatched} envíos en ${number(phase.burst.windowMs, 0)} ms` : "No ejecutada"} | ${milliseconds(phase.resultsReadP95Ms)} |`);
}
if (data.postStopRecoveryAudit) {
  const audit = data.postStopRecoveryAudit;
  lines.push("", `La auditoría HTTP posterior al corte también agotó su tiempo de espera. En una consulta de solo lectura posterior (registro: ${audit.recordedAt ?? audit.observedAt}) se encontraron ${audit.attempts} intentos y ${audit.persistedAnswers} respuestas, con ${audit.duplicateQuestionRows} preguntas duplicadas. ${audit.confirmedKeyCorrespondence==='verified' ? `Se contrastaron las ${audit.confirmedKeys} claves confirmadas conservadas en el checkpoint privado: ${audit.matchedConfirmedKeys} coincidieron y ${audit.missingOrChangedConfirmed} estaban ausentes o modificadas. Esta comprobación posterior acredita la persistencia de las confirmaciones observadas, pero no completa el escenario de carga interrumpido.` : 'El contraste exacto entre cada clave confirmada y la persistencia no quedó verificado: el conjunto en memoria no se había serializado. Por ello no se afirma que la prueba haya demostrado cero pérdida de respuestas confirmadas.'}`);
}
if (data.eventStreams?.length) {
  lines.push('', '## Avisos y recuperación del transporte', '',
    '| Fase | Estudiantes conectados simultáneamente | Conexiones HTTP abiertas | Renovaciones programadas | Interrupciones inesperadas |',
    '|---|---:|---:|---:|---:|');
  for (const stream of data.eventStreams)
    lines.push(`| ${stream.name} | ${stream.maximumActive} | ${stream.opened} | ${stream.rotations} | ${stream.unexpectedFailures} |`);
  lines.push('', 'Las conexiones SSE se preparan fuera de la medición y se renuevan antes del límite del alojamiento. Las renovaciones programadas no son fallos. Las interrupciones inesperadas durante la fase sí se registran; el estudiante utiliza sondeo de respaldo hasta recuperar los avisos. Estas conexiones HTTP no equivalen al número de sockets compartidos del servidor con Supabase.');
}
lines.push(
  "",
  "La auditoría de persistencia vuelve a consultar el estado del docente y contrasta identificadores de intento, pregunta y clave de idempotencia. El objetivo completo es de 2.000 respuestas por fase. La publicación y consulta final de notas se registran fuera de la ventana de carga y no se atribuyen a una fase cuando esta se interrumpe.",
  "",
  "## Consumo y límites",
  "",
  `Se observaron ${number(data.totalRequests, 0)} solicitudes y ${number(data.observedApplicationBodyBytes / 1e6)} MB de cuerpos de respuesta HTTP. La estimación preventiva fue de ${number(data.conservativeEstimatedBytes / 1e6)} MB, calculada como el doble de esos cuerpos más 1.024 bytes por solicitud. Es una aproximación conservadora del generador, no un contador de facturación.`,
  "",
  `El límite preventivo configurado para esta ejecución fue de ${number((data.environment.logicalBodyBudgetBytes ?? 1e9) / 1e9)} GB adicionales estimados. También se detiene si más del 10 % de solicitudes fallan en una ventana completa de un minuto, con al menos cien solicitudes. La estimación no equivale al tráfico facturado. No se activaron pagos ni se ampliaron cuotas para obtener un resultado.`,
  "",
  `Este generador no consulta los paneles de facturación. Q-09 requiere contrastar las cuotas y los consumos observados de Supabase y Vercel; los paneles pueden tener retraso. ${data.environment.events ? 'Los navegadores simulados utilizan SSE; el servidor comparte conexiones privadas a Realtime. Los contadores de conexiones, mensajes y transferencia se revisan por separado.' : 'Esta revisión utiliza sondeo HTTP sin conexiones Realtime.'} Un resultado favorable de Q-06 no acredita por sí solo Q-09.`,
  "",
  "## Alcance y límites de interpretación",
  "",
  ...data.limitations.map((limitation) => `- ${limitation}`),
  `- El retraso del bucle de eventos del generador fue de ${milliseconds(data.generatorEventLoop?.p95Ms)} en p95 y ${milliseconds(data.generatorEventLoop?.maxMs)} de máximo.`,
  "- Los percentiles corresponden a esta red, este generador, esta base y este compilado; no constituyen una promesa para cualquier conexión o alojamiento.",
  "- Las pruebas funcionales, de permisos y accesibilidad se documentan por separado. Un fallo de capacidad no invalida retrospectivamente una comprobación funcional, ni una comprobación funcional demuestra capacidad.",
  "",
  "## Reproducción",
  "",
  "Se requiere autorización para utilizar el proyecto de pruebas, sus cuotas gratuitas y las cuentas ficticias privadas. La preparación no se ejecuta en integración continua ni utiliza datos de estudiantes reales.",
  "",
  "```powershell",
  "$env:AULIFY_LOAD_URL='<origen autorizado>'",
  "$env:AULIFY_EXPECTED_BUILD_ID='<build verificado>'",
  ...(data.environment.events ? [
    "$env:AULIFY_LOAD_PREVIEW_MANIFEST='<manifiesto privado verificado>'",
    "$env:AULIFY_LOAD_PREVIEW_SECRET_FILE='<archivo privado del acceso temporal autorizado>'",
  ] : []),
  `$env:AULIFY_LOAD_BUDGET_BYTES='${data.environment.logicalBodyBudgetBytes ?? 1e9}'`,
  "$env:AULIFY_COMPILED_COMMIT='<commit compilado identificado>'",
  "node tools/datos/load-run.mjs",
  "node tools/datos/load-report.mjs",
  "```",
  "",
  "Se requieren el conjunto ficticio y sus sesiones privadas previamente preparados; no volver a crear las cuentas si ya existen. La Preview necesita un manifiesto y un acceso temporal autorizado vigente. El acceso de esta ejecución ya fue revocado. El servidor debe ser una construcción estable. Preparar una nueva ejecución completa si cambia el código, transporte o infraestructura; conservar los informes anteriores. No recortar fases ni relajar criterios para declarar un aprobado.",
  "",
  "Cuotas y tasa de autenticación: [transferencia de Supabase](https://supabase.com/docs/guides/platform/manage-your-usage/egress) y [límites de Auth](https://supabase.com/docs/guides/auth/rate-limits).",
  "",
);
await fs.writeFile(output, lines.join("\n"));
console.log(`Informe escrito en ${output}.`);
