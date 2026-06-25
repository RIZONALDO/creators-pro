import { Resend } from 'resend';
import { env } from './env.js';

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
}

export interface EmailSender {
  send(message: EmailMessage): Promise<void>;
}

/** Sem RESEND_API_KEY configurada (.env) ou em testes — não envia nada, só loga (mesmo padrão de
 * createNoopPushSender em realtime/pushSender.ts). O fluxo de reset de senha continua funcionando
 * (token é gerado e salvo normalmente), só o e-mail de verdade não chega. */
export function createNoopEmailSender(): EmailSender {
  return {
    async send(message) {
      console.log(`[email noop] enviaria pra ${message.to}: "${message.subject}" (RESEND_API_KEY ausente)`);
    },
  };
}

/** Envio real via Resend. `from` precisa ser de um domínio verificado na conta Resend. */
export function createResendEmailSender(apiKey: string, from: string): EmailSender {
  const resend = new Resend(apiKey);
  return {
    async send(message) {
      const { error } = await resend.emails.send({ from, to: message.to, subject: message.subject, html: message.html });
      if (error) throw new Error(`Falha ao enviar e-mail: ${error.message}`);
    },
  };
}

export const emailSender: EmailSender = env.resendApiKey
  ? createResendEmailSender(env.resendApiKey, env.emailFrom)
  : createNoopEmailSender();
