/**
 * EmailService — envio de e-mails transacionais via Nodemailer (SMTP).
 *
 * Configuração via variáveis de ambiente:
 *   EMAIL_HOST        — ex: smtp.gmail.com | smtp.sendgrid.net
 *   EMAIL_PORT        — ex: 587 (TLS) | 465 (SSL)
 *   EMAIL_SECURE      — "true" para porta 465, "false" para STARTTLS (padrão: "false")
 *   EMAIL_USER        — usuário SMTP / API key (SendGrid usa "apikey")
 *   EMAIL_PASS        — senha SMTP / API key SendGrid
 *   EMAIL_FROM        — endereço remetente (ex: "ObraLink <noreply@obralink.com.br>")
 *   APP_NAME          — nome exibido nos templates (padrão: "ObraLink")
 *   APP_URL           — URL do frontend, usada nos links dos e-mails
 */
const nodemailer = require("nodemailer");
const logger = require("../utils/logger");

class EmailService {
  constructor() {
    this.enabled = !!(
      process.env.EMAIL_HOST &&
      process.env.EMAIL_USER &&
      process.env.EMAIL_PASS
    );

    if (this.enabled) {
      this.transporter = nodemailer.createTransport({
        host:   process.env.EMAIL_HOST,
        port:   parseInt(process.env.EMAIL_PORT  || "587"),
        secure: process.env.EMAIL_SECURE === "true",
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
        tls: { rejectUnauthorized: process.env.NODE_ENV === "production" },
      });

      logger.info(
        `✅ EmailService iniciado — host: ${process.env.EMAIL_HOST}:${process.env.EMAIL_PORT || 587}`,
      );
    } else {
      logger.warn(
        "⚠️  EmailService desabilitado — EMAIL_HOST, EMAIL_USER ou EMAIL_PASS não configurados. " +
        "Defina essas variáveis para habilitar o envio real de e-mails.",
      );
    }
  }

  get from() {
    return (
      process.env.EMAIL_FROM ||
      `"${process.env.APP_NAME || "ObraLink"}" <noreply@obralink.com.br>`
    );
  }

  /**
   * Verifica a conexão SMTP. Útil no health-check ou startup.
   */
  async verify() {
    if (!this.enabled) return false;
    try {
      await this.transporter.verify();
      return true;
    } catch (err) {
      logger.error("EmailService verify falhou:", err.message);
      return false;
    }
  }

  /**
   * Envia um e-mail genérico.
   * @param {object} options - { to, subject, html, text? }
   */
  async send({ to, subject, html, text }) {
    if (!this.enabled) {
      logger.warn(`[EMAIL] Envio simulado para ${to} | Assunto: ${subject}`);
      return { simulated: true };
    }

    try {
      const info = await this.transporter.sendMail({
        from: this.from,
        to,
        subject,
        text: text || html.replace(/<[^>]+>/g, ""),
        html,
      });
      logger.info(`[EMAIL] Mensagem enviada para ${to} — id: ${info.messageId}`);
      return info;
    } catch (err) {
      logger.error(`[EMAIL] Falha ao enviar para ${to}: ${err.message}`);
      throw err;
    }
  }

  /**
   * Envia o código de recuperação de senha.
   * @param {string} email - Endereço do destinatário
   * @param {string} codigo - Código numérico de 6 dígitos
   * @param {Date}   expiresAt - Momento de expiração
   */
  async sendPasswordResetCode(email, codigo, expiresAt) {
    const appName = process.env.APP_NAME || "ObraLink";
    const minutosRestantes = Math.ceil(
      (expiresAt.getTime() - Date.now()) / 60000,
    );

    const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Recuperação de senha — ${appName}</title>
</head>
<body style="font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:20px;">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:8px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,.1);">
    <h2 style="color:#1a1a2e;margin-top:0;">🔒 Redefinição de senha</h2>
    <p style="color:#444;font-size:15px;">
      Recebemos uma solicitação para redefinir a senha da sua conta no <strong>${appName}</strong>.
    </p>
    <p style="color:#444;font-size:15px;">Use o código abaixo para concluir a redefinição:</p>
    <div style="background:#f0f4ff;border:2px dashed #4a6cf7;border-radius:8px;padding:20px;text-align:center;margin:24px 0;">
      <span style="font-size:36px;font-weight:bold;letter-spacing:8px;color:#1a1a2e;">${codigo}</span>
    </div>
    <p style="color:#666;font-size:13px;">
      ⏳ Este código expira em <strong>${minutosRestantes} minuto(s)</strong>.
    </p>
    <p style="color:#666;font-size:13px;">
      Se você não solicitou a redefinição, ignore este e-mail. Sua senha permanece inalterada.
    </p>
    <hr style="border:none;border-top:1px solid #eee;margin:24px 0;" />
    <p style="color:#aaa;font-size:11px;text-align:center;">
      ${appName} — Sistema de Gestão de Obras
    </p>
  </div>
</body>
</html>`;

    return this.send({
      to: email,
      subject: `[${appName}] Código de recuperação de senha: ${codigo}`,
      html,
    });
  }

  /**
   * Notifica o encarregado que sua medição foi aprovada ou rejeitada.
   * @param {string} email
   * @param {object} medicao  - { id, tipoServico, status }
   * @param {string} motivoRejeicao - preenchido apenas quando rejeitada
   */
  async sendMedicaoStatusUpdate(email, medicao, motivoRejeicao = null) {
    const appName = process.env.APP_NAME || "ObraLink";
    const aprovada = medicao.status === "aprovada";
    const emoji   = aprovada ? "✅" : "❌";
    const label   = aprovada ? "aprovada" : "rejeitada";
    const cor     = aprovada ? "#22c55e" : "#ef4444";

    const motivoBlock = !aprovada && motivoRejeicao
      ? `<p style="color:#444;font-size:14px;"><strong>Motivo:</strong> ${motivoRejeicao}</p>`
      : "";

    const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8" /><title>Medição ${label} — ${appName}</title></head>
<body style="font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:20px;">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:8px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,.1);">
    <h2 style="color:${cor};margin-top:0;">${emoji} Medição ${label}</h2>
    <p style="color:#444;font-size:15px;">
      Sua medição <strong>#${medicao.id}</strong>
      ${medicao.tipoServico ? `(${medicao.tipoServico})` : ""} foi <strong>${label}</strong>.
    </p>
    ${motivoBlock}
    <p style="color:#666;font-size:13px;">Acesse o aplicativo para ver os detalhes.</p>
    <hr style="border:none;border-top:1px solid #eee;margin:24px 0;" />
    <p style="color:#aaa;font-size:11px;text-align:center;">${appName} — Sistema de Gestão de Obras</p>
  </div>
</body>
</html>`;

    return this.send({
      to: email,
      subject: `[${appName}] Medição #${medicao.id} ${label}`,
      html,
    });
  }
}

module.exports = new EmailService();
