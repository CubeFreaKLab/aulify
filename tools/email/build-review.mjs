import fs from 'node:fs/promises';
import path from 'node:path';

const output = path.resolve(process.argv[2] || '../output/correos-aulify-20261023');
const guide = await fs.readFile('docs/operacion/correo-sin-dominio.md', 'utf8');
const escape = (value) =>
  value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const inline = (value) =>
  escape(value)
    .replace(
      /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
      '<a href="$2" target="_blank" rel="noreferrer">$1</a>',
    )
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
const lines = guide.split(/\r?\n/);
const html = [];
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (!line.trim()) continue;
  if (line.startsWith('# ')) continue;
  if (line.startsWith('## ')) {
    html.push(`<h2>${inline(line.slice(3))}</h2>`);
    continue;
  }
  if (line.startsWith('|')) {
    const rows = [];
    while (lines[i]?.startsWith('|')) {
      if (!/^\|[\s:|-]+\|$/.test(lines[i]))
        rows.push(
          lines[i]
            .slice(1, -1)
            .split('|')
            .map((c) => c.trim()),
        );
      i++;
    }
    i--;
    html.push(
      '<div class="table-wrap"><table><thead><tr>' +
        rows[0].map((c) => `<th>${inline(c)}</th>`).join('') +
        '</tr></thead><tbody>' +
        rows
          .slice(1)
          .map((row) => '<tr>' + row.map((c) => `<td>${inline(c)}</td>`).join('') + '</tr>')
          .join('') +
        '</tbody></table></div>',
    );
    continue;
  }
  if (/^(?:\d+\. |\- )/.test(line)) {
    const ordered = /^\d/.test(line),
      tag = ordered ? 'ol' : 'ul';
    const items = [];
    while (lines[i] && (ordered ? /^\d+\. / : /^- /).test(lines[i])) {
      items.push(`<li>${inline(lines[i].replace(/^(?:\d+\. |- )/, ''))}</li>`);
      i++;
    }
    i--;
    html.push(`<${tag}>${items.join('')}</${tag}>`);
    continue;
  }
  html.push(`<p>${inline(line)}</p>`);
}
await fs.copyFile('docs/operacion/correo-sin-dominio.md', path.join(output, 'GUIA.md'));
await fs.writeFile(
  path.join(output, 'ABRIR-CORREOS.html'),
  `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Correos de Aulify · Entrega y guía</title><style>
*{box-sizing:border-box}body{margin:0;background:#f7f7f3;color:#202020;font:16px/1.65 Arial,Helvetica,sans-serif}header,main,footer{max-width:1120px;margin:auto;padding:24px}header{display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #deded7}header img{width:132px;height:44px}a{color:#365d2b;text-underline-offset:4px}h1{font-size:clamp(32px,5vw,52px);line-height:1.08;letter-spacing:-1.5px;margin:18px 0}h2{line-height:1.25;font-size:25px;letter-spacing:-.5px;margin:46px 0 18px}p{max-width:80ch}.muted{color:#68685f}.eyebrow{font-size:12px;letter-spacing:2px;font-weight:bold;color:#426b36}.tag{background:#eeeeea;border:1px solid #deded7;border-radius:8px;padding:5px 10px;font-size:12px}.intro{max-width:770px;margin:44px 0 30px}.tabs{display:flex;gap:8px;flex-wrap:wrap;margin:20px 0}button,.download{font:inherit;font-weight:bold;border:1px solid #c8c8bf;padding:10px 17px;border-radius:8px;background:white;color:#202020;cursor:pointer;text-decoration:none}button[aria-selected=true]{background:#202020;color:white;border-color:#202020}button:focus-visible,a:focus-visible{outline:3px solid #83ba6a;outline-offset:4px}.preview-wrap{padding:20px;background:#eaeae4;border-radius:16px}iframe{display:block;width:100%;max-width:720px;height:950px;margin:auto;border:0;border-radius:10px;background:white}.files{display:flex;gap:10px;flex-wrap:wrap;margin:20px 0 48px}.guide{background:white;border:1px solid #deded7;border-radius:16px;padding:12px 32px 34px}li{padding:4px 0}code{font-size:13px;background:#f1f1ed;border-radius:4px;padding:3px 5px;overflow-wrap:anywhere}.table-wrap{overflow-x:auto}table{border-collapse:collapse;width:100%;font-size:14px}td,th{text-align:left;padding:12px;border-bottom:1px solid #deded7;vertical-align:top}th{background:#f1f3ed}footer{color:#77776d;font-size:13px}#subject{font-size:14px} @media(max-width:620px){header,main,footer{padding:18px}.guide{padding:8px 18px 24px}iframe{height:1080px}.preview-wrap{padding:5px}td,th{padding:9px}header .tag{max-width:140px;text-align:center}}@media print{.preview-wrap,.tabs,.files{display:none}body{background:white}.guide{border:0;padding:0}a{color:inherit}h2{break-after:avoid}tr{break-inside:avoid}}
</style></head><body><header><img src="assets/aulify-logo.png" alt="Aulify"><span class="tag">HTML listos · SMTP pendiente</span></header><main><section class="intro"><span class="eyebrow">CORREO CON IDENTIDAD</span><h1>La primera bienvenida<br>también es parte del aula.</h1><p class="muted">Tres correos con la marca de Aulify y una guía para configurarlos usando Gmail, Supabase y tu dirección gratuita de Vercel.</p><a href="#guia">Ir a la guía de configuración ↓</a></section><div class="tabs" role="tablist" aria-label="Vista de los correos"><button role="tab" aria-selected="true" data-file="confirmar-correo" data-subject="Confirma tu correo · Aulify">Confirmación</button><button role="tab" aria-selected="false" data-file="recuperar-contrasena" data-subject="Recupera tu acceso · Aulify">Recuperación</button><button role="tab" aria-selected="false" data-file="bienvenida" data-subject="Gracias por sumarte a Aulify">Bienvenida</button></div><p id="subject">Asunto: <strong>Confirma tu correo · Aulify</strong></p><div class="preview-wrap"><iframe title="Vista previa del correo" src="vista-previa/confirmar-correo.html"></iframe></div><p class="muted">Esta vista utiliza enlaces de ejemplo. Los HTML para Supabase están en la carpeta <code>plantillas-supabase</code>.</p><div class="files"><a class="download" download href="plantillas-supabase/confirmar-correo.html">HTML de confirmación ↓</a><a class="download" download href="plantillas-supabase/recuperar-contrasena.html">HTML de recuperación ↓</a><a class="download" download href="plantillas-supabase/bienvenida.html">HTML de bienvenida ↓</a></div><article class="guide" id="guia"><h2>Tu intervención, paso a paso</h2>${html.join('\n')}</article></main><footer>Revisión visual en navegador. La recepción y apariencia en el cliente de correo se comprueban al activar SMTP.</footer><script>
const frame=document.querySelector('iframe'), switcher=document.createElement('button');switcher.textContent='Vista en celular';switcher.setAttribute('aria-pressed','false');switcher.style.marginBottom='16px';document.querySelector('.preview-wrap').before(switcher);switcher.addEventListener('click',()=>{const mobile=switcher.getAttribute('aria-pressed')==='false';switcher.setAttribute('aria-pressed',String(mobile));frame.style.maxWidth=mobile?'375px':'720px';frame.style.height=mobile?'1180px':'1080px';switcher.textContent=mobile?'Volver a escritorio':'Vista en celular'});
const buttons=[...document.querySelectorAll('[role=tab]')];buttons.forEach((button,index)=>{button.addEventListener('click',()=>{buttons.forEach(other=>other.setAttribute('aria-selected',String(other===button)));document.querySelector('iframe').src='vista-previa/'+button.dataset.file+'.html';document.querySelector('#subject strong').textContent=button.dataset.subject});button.addEventListener('keydown',event=>{if(event.key==='ArrowRight'||event.key==='ArrowLeft'){event.preventDefault();const next=buttons[(index+(event.key==='ArrowRight'?1:buttons.length-1))%buttons.length];next.focus();next.click()}})});
</script></body></html>`,
);
console.log('Guía HTML y vistas listas: ' + output);
