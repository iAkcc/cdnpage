// Envío de magic links vía Resend o Postmark
import { requireEnv, env } from './env.js';

export async function sendMagicLink({ to, link }) {
  const provider = process.env.RESEND_API_KEY ? 'resend'
    : process.env.POSTMARK_SERVER_TOKEN ? 'postmark'
    : null;

  if (!provider) throw new Error('No hay proveedor de email configurado');

  const from = requireEnv('EMAIL_FROM');
  const subject = 'Tu enlace de acceso al panel de plugins';
  const html = renderMagicLinkEmail(link);

  if (provider === 'resend') {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to, subject, html }),
    });
    if (!res.ok) throw new Error(`Resend error: ${res.status} ${await res.text()}`);
    return await res.json();
  }

  // Postmark
  const res = await fetch('https://api.postmarkapp.com/email/withTemplate', {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'X-Postmark-Server-Token': process.env.POSTMARK_SERVER_TOKEN,
    },
    body: JSON.stringify({
      From: from,
      To: to,
      Subject: subject,
      HtmlBody: html,
      MessageStream: 'outbound',
    }),
  });
  if (!res.ok) throw new Error(`Postmark error: ${res.status} ${await res.text()}`);
  return await res.json();
}

function renderMagicLinkEmail(link) {
  return `<!doctype html><html lang="es"><body style="font-family:system-ui,Arial">
    <h2>Acceso al panel de plugins</h2>
    <p>Haz clic en el botón para iniciar sesión. El enlace expira en 15 minutos:</p>
    <p><a href="${link}" style="display:inline-block;padding:12px 24px;background:#111;color:#fff;border-radius:6px;text-decoration:none">Iniciar sesión</a></p>
    <p style="color:#555;font-size:13px">Si no pediste este enlace, ignora este correo.</p>
  </body></html>`;
}
