#!/usr/bin/env node
/**
 * Rattache un plan d'exemple du corpus de lecture à un compte, pour essayer l'app connectée
 * avant le paiement (étape 1b ; au lancement, le plan se range au paiement).
 *
 *   npm run app:plan-exemple -- <e-mail> [L4|L1] [--remplacer]
 *
 * --remplacer : les plans déjà rangés dans ce compte sont d'abord supprimés. Un plan est figé à
 * sa génération (cadrage 5.5) : pour voir un texte corrigé du moteur, on remplace le plan d'essai.
 * Lit les clés de .env.local (sans les afficher). Crée le compte s'il n'existe pas, confirmé :
 * on s'y connecte ensuite par code, sur /app/connexion.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import nextEnv from '@next/env';
import { createClient } from '@supabase/supabase-js';

nextEnv.loadEnvConfig(process.cwd());
const remplacer = process.argv.includes('--remplacer');
const [email, cle = 'L4'] = process.argv.slice(2).filter((a) => a !== '--remplacer');
if (!email) {
  console.error('Usage : npm run app:plan-exemple -- <e-mail> [L4|L1] [--remplacer]');
  process.exit(1);
}
// L'adresse du projet sans chemin derrière (copiée depuis « Data API », elle finit souvent par /rest/v1/).
let url;
try {
  url = new URL((process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim()).origin;
} catch {
  url = '';
}
const cleService = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !cleService) {
  console.error('NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manque dans .env.local (supabase/README.md).');
  process.exit(1);
}
const plan = JSON.parse(readFileSync(path.join(process.cwd(), 'lib', 'app', 'exemples', `${cle}.json`), 'utf-8'));
const supabase = createClient(url, cleService, { auth: { persistSession: false, autoRefreshToken: false } });

// Le compte : retrouvé par son e-mail, créé sinon.
let utilisateur;
for (let page = 1; !utilisateur; page++) {
  const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
  if (error) throw error;
  utilisateur = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (data.users.length < 200) break;
}
if (!utilisateur) {
  const { data, error } = await supabase.auth.admin.createUser({ email, email_confirm: true });
  if (error) throw error;
  utilisateur = data.user;
}
const { error: erreurCompte } = await supabase.from('comptes').upsert({ id: utilisateur.id, nom: plan.athlete.nom });
if (erreurCompte) throw erreurCompte;
if (remplacer) {
  const { data: anciens, error: erreurSuppression } = await supabase
    .from('plans').delete().eq('compte_id', utilisateur.id).select('id');
  if (erreurSuppression) throw erreurSuppression;
  console.log(`${anciens.length} plan(s) d'essai supprimé(s) de ${email}`);
}
const { data: ligne, error: erreurPlan } = await supabase
  .from('plans')
  .insert({
    compte_id: utilisateur.id,
    course_nom: plan.course.nom,
    course_date: plan.course.date,
    debut_plan: plan.course.date_debut_plan,
    schema: plan.schema,
    version_moteur: plan.version_moteur,
    donnees: plan,
  })
  .select('id')
  .single();
if (erreurPlan) throw erreurPlan;
console.log(`Plan ${cle} (${plan.course.nom}) rattaché à ${email} — ${ligne.id}`);
