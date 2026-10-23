import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

// Generated HTML stays dependency-free for pasting into Supabase Auth.
const root = process.cwd();
const destination = path.resolve(root, 'supabase/templates');
const images = path.resolve(root, 'public/brand/email');
await fs.mkdir(destination, { recursive: true });
await fs.mkdir(images, { recursive: true });
const assets = [
  ['brand/aulify-logo.svg', 'aulify-logo.png', 432],
  ['illustrations/aulify/classroom-team.svg', 'bienvenida.png', 720],
  ['illustrations/aulify/student-recovery.svg', 'recuperar.png', 600],
];
for (const [source, filename, width] of assets) {
  await sharp(path.join(root, 'public', source))
    .resize({ width })
    .flatten({ background: '#ffffff' })
    .png()
    .toFile(path.join(images, filename));
}

const messages = [
  {
    file: 'confirmar-correo',
    subject: 'Confirma tu correo · Aulify',
    title: 'Tu lugar en el aula<br>está por comenzar.',
    intro:
      'Gracias por registrarte en Aulify. Confirma tu correo para entrar a tu cuenta y empezar a compartir, aprender y crear.',
    button: 'Confirmar mi correo',
    link: '{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&amp;type=email',
    image: 'bienvenida.png',
    hint: 'Este enlace es personal y se puede usar una sola vez. Si no creaste esta cuenta, puedes ignorar este mensaje.',
    section: 'Confirm sign up',
  },
  {
    file: 'recuperar-contrasena',
    subject: 'Recupera tu acceso · Aulify',
    title: 'Una nueva contraseña.<br>Tu misma cuenta.',
    intro:
      'Recibimos una solicitud para recuperar tu acceso. Usa el botón para elegir una nueva contraseña y volver a tu aula.',
    button: 'Elegir nueva contraseña',
    link: '{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&amp;type=recovery',
    image: 'recuperar.png',
    hint: 'Si no pediste este cambio, ignora el mensaje. Tu contraseña seguirá siendo la misma. El enlace es personal y de un solo uso.',
    section: 'Reset password',
  },
  {
    file: 'bienvenida',
    subject: 'Gracias por sumarte a Aulify',
    title: 'Una buena idea<br>puede empezar aquí.',
    intro:
      'Gracias por formar parte de Aulify. Tu aula reúne los recursos, las actividades y los avances de tu clase en un mismo lugar.',
    button: 'Ir a mi aula',
    link: '{{ .SiteURL }}/aula',
    image: 'bienvenida.png',
    hint: 'Puedes elegir tu avatar y la apariencia de tu espacio en Preferencias. El siguiente paso lo das a tu ritmo.',
    section:
      'Plantilla independiente; Supabase no tiene un evento de bienvenida posterior a la confirmación.',
  },
];

const template = (m) => `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>${m.subject}</title>
  <style>
    body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
    table,td{mso-table-lspace:0;mso-table-rspace:0}
    img{border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic}
    a:focus-visible{outline:3px solid #426b36;outline-offset:4px}
    @media(max-width:620px){.outer{padding:16px 12px!important}.content{padding:28px 24px!important}.title{font-size:30px!important;line-height:35px!important}.art{width:230px!important;max-width:100%!important}}
  </style>
</head>
<body style="margin:0;padding:0;width:100%;background-color:#f6f6f2;color:#202020;font-family:Arial,Helvetica,sans-serif;">
  <div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${m.intro}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f6f6f2;">
    <tr><td class="outer" align="center" style="padding:40px 16px;">
      <!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0"><tr><td><![endif]-->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;background-color:#ffffff;border:1px solid #deded7;border-radius:20px;overflow:hidden;">
        <tr><td class="content" style="padding:36px 44px 24px;border-bottom:1px solid #e7e7df;">
          <a href="{{ .SiteURL }}" style="text-decoration:none;"><img src="{{ .SiteURL }}/brand/email/aulify-logo.png" width="144" height="48" alt="Aulify" style="display:block;width:144px;height:48px;background-color:#ffffff;"></a>
        </td></tr>
        <tr><td class="content" style="padding:32px 44px 20px;">
          <h1 class="title" style="margin:0 0 22px;font-size:37px;line-height:41px;letter-spacing:-1.2px;font-weight:bold;text-align:center;color:#202020;">${m.title}</h1>
          <p style="margin:0;font-size:16px;line-height:25px;color:#51514b;">${m.intro}</p>
        </td></tr>
        <tr><td align="center" style="padding:4px 24px 22px;">
          <img class="art" src="{{ .SiteURL }}/brand/email/${m.image}" alt="" width="280" style="display:block;width:280px;max-width:100%;height:auto;background-color:#ffffff;">
        </td></tr>
        <tr><td class="content" style="padding:0 44px 32px;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"><tr><td align="center" bgcolor="#202020" style="border-radius:9px;mso-padding-alt:17px 20px;">
            <a href="${m.link}" style="display:block;padding:17px 20px;color:#ffffff;background-color:#202020;border-radius:9px;font-size:16px;line-height:22px;font-weight:bold;text-decoration:none;">${m.button}</a>
          </td></tr></table>
          <p style="margin:22px 0 0;font-size:13px;line-height:20px;color:#68685f;">${m.hint}</p>
        </td></tr>
        <tr><td class="content" style="padding:24px 44px;background-color:#f1f3ed;border-top:1px solid #e1e5db;">
          <p style="margin:0 0 8px;font-size:12px;line-height:19px;color:#5c6056;">Si el botón no abre, copia este enlace en tu navegador:</p>
          <p style="margin:0;font-size:11px;line-height:18px;word-break:break-all;overflow-wrap:anywhere;"><a href="${m.link}" style="color:#365d2b;text-decoration:underline;word-break:break-all;">${m.link}</a></p>
        </td></tr>
      </table>
      <!--[if mso]></td></tr></table><![endif]-->
      <p style="margin:24px 0 0;font-size:12px;line-height:19px;color:#77776d;">Aulify · Un espacio para aprender y compartir.</p>
    </td></tr>
  </table>
</body>
</html>
`;

for (const message of messages) {
  await fs.writeFile(path.join(destination, `${message.file}.html`), template(message));
}
await fs.writeFile(
  path.join(destination, 'asuntos.json'),
  JSON.stringify(
    messages.map(({ file, subject, section }) => ({ file: `${file}.html`, subject, section })),
    null,
    2,
  ) + '\n',
);
console.log('Tres plantillas y tres imágenes de correo generadas.');

// Optional private review package: no tokens, recipient addresses or credentials.
if (process.argv[2]) {
  const bundle = path.resolve(process.argv[2]);
  await fs.mkdir(path.join(bundle, 'vista-previa'), { recursive: true });
  await fs.cp(images, path.join(bundle, 'assets'), { recursive: true });
  await fs.cp(destination, path.join(bundle, 'plantillas-supabase'), { recursive: true });
  for (const message of messages) {
    const preview = template(message)
      .replaceAll('{{ .SiteURL }}/brand/email/', '../assets/')
      .replaceAll(/href="[^"]*"/g, 'href="#vista-previa"')
      .replaceAll('{{ .SiteURL }}', 'https://aulify-cubefreaklab.vercel.app')
      .replaceAll('{{ .TokenHash }}', 'ENLACE-PERSONAL-DE-EJEMPLO');
    await fs.writeFile(path.join(bundle, 'vista-previa', `${message.file}.html`), preview);
  }
  console.log('Paquete de revisión guardado en ' + bundle);
}
