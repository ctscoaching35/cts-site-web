/**
 * La signature du webhook de Nolio (documentation de l'API v2, Webhooks) : l'en-tête « Webhook-Signature: t=<horodatage>,
 * v1=<hex> » porte le HMAC-SHA256 de « <t>.<corps brut> » avec le secret du webhook (NOLIO_WEBHOOK_SECRET, saisi par le
 * coach dans Vercel). Comparée en temps constant ; un horodatage de plus de 5 minutes est refusé (rejeu).
 */
import crypto from 'node:crypto';

const TOLERANCE_S = 300;

export function signatureNolioValide(corps: string, entete: string | null, secret: string, maintenant = Date.now()) {
  if (!secret || !entete) return false;
  const parts = Object.fromEntries(entete.split(',').map((x) => x.trim().split('=') as [string, string]));
  const t = Number(parts.t);
  if (!parts.v1 || !Number.isFinite(t) || Math.abs(maintenant / 1000 - t) > TOLERANCE_S) return false;
  const attendue = crypto.createHmac('sha256', secret).update(`${parts.t}.${corps}`).digest('hex');
  const a = Buffer.from(attendue);
  const b = Buffer.from(parts.v1);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
