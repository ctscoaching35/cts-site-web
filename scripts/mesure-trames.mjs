#!/usr/bin/env node
/**
 * La mesure avant le push du moteur (CTS_NOLIO_CADRAGE.md dans le dépôt du moteur, VM1, décision coach du 19/10/2026) :
 * la trame de chaque plan en cours, recalculée par le nouveau moteur (l'API lancée en local sur son code), comparée à
 * celle que le site a gardée et que l'athlète voit (type, volume, séances clés, week-end choc, semaine par semaine).
 *
 *   node scripts/mesure-trames.mjs [http://localhost:5070] [--mettre-a-jour]
 *
 * Ne dit que des numéros : le plan (son rang dans la liste) et les semaines qui changent, jamais un nom, une course
 * ou une réponse. --mettre-a-jour, après le push seulement : les trames gardées sont effacées, le site redemande
 * chacune au moteur en ligne à la prochaine ouverture. Lit les clés de .env.local (sans les afficher).
 */
import nextEnv from '@next/env';
import { createClient } from '@supabase/supabase-js';

nextEnv.loadEnvConfig(process.cwd());
const mettreAJour = process.argv.includes('--mettre-a-jour');
const api = (process.argv.slice(2).find((a) => a.startsWith('http')) ?? 'http://localhost:5070').replace(/\/$/, '');
let url;
try {
  url = new URL((process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim()).origin;
} catch {
  url = '';
}
const cle = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !cle) {
  console.error('Clés Supabase absentes de .env.local.');
  process.exit(1);
}
const service = createClient(url, cle, { auth: { persistSession: false } });
const aujourdhui = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date());
const { data: plans, error } = await service.from('plans').select('id, parametres, trame, donnees')
  .not('parametres', 'is', null).not('demarre_le', 'is', null).gte('course_date', aujourdhui);
if (error) {
  console.error('Lecture des plans :', error.message);
  process.exit(1);
}

const ligne = (s) => JSON.stringify([s.type, Math.round(s.volume_h * 60), s.seances_cles.map((c) => c.seance), s.week_end_choc]);
let changes = 0;
let sansTrame = 0;
for (const [i, p] of (plans ?? []).entries()) {
  if (!p.trame) {
    sansTrame += 1;
    continue;
  }
  const fiches = (p.donnees?.pour_aller_plus_loin?.fiches ?? []).map((f) => f.cle);
  const r = await fetch(`${api}/v1/trame`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ parametres: p.parametres, fiches_du_plan: fiches }),
  });
  if (!r.ok) {
    console.log(`Plan ${i + 1} : le moteur refuse ses paramètres (${r.status}).`);
    changes += 1;
    continue;
  }
  const neuve = await r.json();
  const avant = new Map(p.trame.semaines.map((s) => [s.numero, s]));
  const semaines = neuve.semaines.filter((s) => s.lundi >= aujourdhui.slice(0, 10) || s.numero === neuve.semaines.at(-1).numero)
    .filter((s) => !avant.has(s.numero) || ligne(avant.get(s.numero)) !== ligne(s)).map((s) => s.numero);
  if (neuve.semaines.length !== p.trame.semaines.length || semaines.length) {
    changes += 1;
    console.log(`Plan ${i + 1} : ${neuve.semaines.length !== p.trame.semaines.length ? `${p.trame.semaines.length} → ${neuve.semaines.length} semaines ; ` : ''}`
      + `${semaines.length ? `changent : ${semaines.join(', ')}` : ''}`);
  }
}
console.log(`\n${(plans ?? []).length} plans en cours : ${changes} changent, ${sansTrame} sans trame gardée (rien à comparer).`);
if (mettreAJour) {
  const ids = (plans ?? []).map((p) => p.id);
  if (ids.length) await service.from('plans').update({ trame: null }).in('id', ids);
  console.log('Trames gardées effacées : le site les redemande au moteur en ligne.');
}
