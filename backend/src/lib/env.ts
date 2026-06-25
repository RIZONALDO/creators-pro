import 'dotenv/config';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Variável de ambiente ausente: ${name}`);
  return value;
}

export const env = {
  databaseUrl: required('DATABASE_URL'),
  jwtSecret: required('JWT_SECRET'),
  jwtRefreshSecret: required('JWT_REFRESH_SECRET'),
  platformProvisionSecret: required('PLATFORM_PROVISION_SECRET'),
  port: Number(process.env.PORT ?? 3001),
  // Opcionais de propósito: sem VAPID configurado, o app roda normal — só não envia push
  // (server.ts decide se monta o PushSender real ou o noop com base nisso).
  vapidPublicKey: process.env.VAPID_PUBLIC_KEY,
  vapidPrivateKey: process.env.VAPID_PRIVATE_KEY,
  vapidSubject: process.env.VAPID_SUBJECT ?? 'mailto:suporte@creatorspro.app',
  // Storage de anexos é disco local (sem S3/terceiros, decisão explícita) — pasta relativa à raiz do backend.
  uploadsDir: process.env.UPLOADS_DIR ?? 'uploads',
  // Brute-force em /auth/login (Fase 9) — .env.test sobe isto bem alto, senão a própria suíte de
  // testes (que loga repetidas vezes por arquivo) trombaria no limite.
  loginRateLimitMax: Number(process.env.LOGIN_RATE_LIMIT_MAX ?? 10),
  loginRateLimitWindowMs: Number(process.env.LOGIN_RATE_LIMIT_WINDOW_MS ?? 15 * 60 * 1000),
  // Fase 9.1 (self-service signup + billing) — opcionais: sem isto, /signup e /billing/portal
  // recusam com BILLING_NOT_CONFIGURED, o resto do app roda normal (mesmo padrão de VAPID).
  stripeSecretKey: process.env.STRIPE_SECRET_KEY,
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
  stripePriceId: process.env.STRIPE_PRICE_ID,
  // Base do frontend — monta success_url/cancel_url do Checkout e o return_url do Customer Portal.
  // https por padrão porque o Vite dev server roda com certificado mkcert quando ele existe
  // (ver frontend/vite.config.ts) — só cai pra http se backend e frontend combinarem sem TLS.
  appUrl: process.env.APP_URL ?? 'https://localhost:5173',
  // Login com Google — opcional, mesmo padrão de VAPID/Stripe: sem isto, POST /auth/google recusa
  // com GOOGLE_NOT_CONFIGURED, o resto do app roda normal.
  googleClientId: process.env.GOOGLE_CLIENT_ID,
  // E-mail transacional (reset de senha) — opcional, mesmo padrão de VAPID/Stripe: sem
  // RESEND_API_KEY, o e-mail não sai de verdade (createNoopEmailSender), mas o fluxo de reset
  // continua funcionando (token gerado, só não chega o e-mail) — não quebra o resto do app.
  resendApiKey: process.env.RESEND_API_KEY,
  emailFrom: process.env.EMAIL_FROM ?? 'CreatorsPro <naoresponda@creatorspro.app>',
};
