// backend/lib/mailer.js
const nodemailer = require('nodemailer');

let cached; // { transporter, isTest, from }

/**
 * Normaliza 'to' en string con emails separados por coma.
 * Acepta string, array de strings u objetos { name, address }.
 */
function normalizeTo(to) {
  if (!to) return '';
  const arr = Array.isArray(to) ? to : [to];
  return arr
    .map((v) => {
      if (!v) return '';
      if (typeof v === 'string') return v.trim();
      if (typeof v === 'object' && v.address) {
        return v.name ? `${v.name} <${v.address}>` : v.address;
      }
      return String(v).trim();
    })
    .filter(Boolean)
    .join(', ');
}

/**
 * HTML simple a texto (fallback muy básico para cuando no nos pasan 'text').
 */
function htmlToText(html = '') {
  return String(html)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h\d|li|tr)>/gi, '\n')
    .replace(/<li>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Crea o reutiliza un transporter.
 * - Si existen SMTP_* en .env => usa SMTP real (pool, timeouts).
 * - Si no, crea cuenta de prueba en Ethereal automáticamente.
 */
async function getTransporter() {
  if (cached) return cached;

  const hasReal =
    process.env.SMTP_HOST &&
    process.env.SMTP_PORT &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS;

  if (hasReal) {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: Number(process.env.SMTP_PORT) === 465, // true para 465
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      pool: true,
      maxConnections: Number(process.env.SMTP_MAX_CONN || 5),
      maxMessages: Number(process.env.SMTP_MAX_MSG || 50),
      // timeouts prudentes
      connectionTimeout: Number(process.env.SMTP_CONN_TIMEOUT || 15000),
      greetingTimeout: Number(process.env.SMTP_GREET_TIMEOUT || 10000),
      socketTimeout: Number(process.env.SMTP_SOCKET_TIMEOUT || 20000),
      // TLS opcionalmente relajado en dev
      tls: {
        rejectUnauthorized: String(process.env.SMTP_TLS_REJECT_UNAUTHORIZED || 'true') !== 'false',
      },
    });
    cached = {
      transporter,
      isTest: false,
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
    };
    return cached;
  }

  // Modo prueba (Ethereal)
  const testAccount = await nodemailer.createTestAccount();
  const transporter = nodemailer.createTransport({
    host: testAccount.smtp.host,
    port: testAccount.smtp.port,
    secure: testAccount.smtp.secure,
    auth: { user: testAccount.user, pass: testAccount.pass },
  });
  cached = {
    transporter,
    isTest: true,
    from: process.env.SMTP_FROM || `Tienda <${testAccount.user}>`,
  };
  return cached;
}

/**
 * Envía un email.
 * @param {Object} opts
 * @param {string|string[]|Object[]} opts.to - Destinatario(s)
 * @param {string} opts.subject
 * @param {string} [opts.html]
 * @param {string} [opts.text] - si no viene, se genera a partir de html
 * @param {Array}  [opts.attachments] - adjuntos nodemailer
 * @param {string} [opts.replyTo] - dirección reply-to
 * @returns {Promise<{messageId: string, previewUrl?: string, isTest: boolean}>}
 */
async function sendMail({ to, subject, html, text, attachments, replyTo } = {}) {
  const { transporter, isTest, from } = await getTransporter();

  const toStr = normalizeTo(to);
  if (!toStr) {
    throw new Error('Parámetro "to" es requerido para enviar correo.');
  }
  const finalSubject = subject || 'Notificación';
  const finalText = text || htmlToText(html || '');

  const info = await transporter.sendMail({
    from,
    to: toStr,
    subject: finalSubject,
    html,
    text: finalText,
    attachments: Array.isArray(attachments) ? attachments : undefined,
    replyTo,
  });

  const previewUrl = isTest ? nodemailer.getTestMessageUrl(info) : undefined;
  return { messageId: info.messageId, previewUrl, isTest };
}

module.exports = { getTransporter, sendMail };
