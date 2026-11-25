#!/usr/bin/env node
/**
 * LE PARCOURS A, MOMENT 1 (décision 241 du coach, 25/11/2026) : « Nouveau coaché » est un seul écran sous la 9.x : prénom, nom, compte Nolio, e-mail facultatif, et en bas le message d'accord validé le 19/10/2026, prêt
 * à copier. Des cas fictifs, sans réseau.
 *
 *   node --test scripts/test-parcours-moment1.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import test from 'node:test';

const RACINE = new URL('..', import.meta.url).pathname;
const { MESSAGE_ACCORD, messageDAccord, lireNouveauCoache } = await import(pathToFileURL(`${RACINE}lib/app/messageAccord.ts`).href);
const source = (f) => readFileSync(`${RACINE}${f}`, 'utf8');
const formulaire = (champs) => { const f = new FormData(); for (const [k, v] of Object.entries(champs)) f.append(k, v); return f; };

test('le message d’accord : mot pour mot celui du 19/10/2026 ; la signature suit le coach connecté, « Romain » à défaut', () => {
  const cadrage = ['Salut, Je mets en place un tableau de bord dans l’app CTS pour suivre plus finement chacun de mes athlètes.',
    'lire dans Nolio tes séances prévues et réalisées', 'Elles servent aussi à ajuster automatiquement tes séances chaque dimanche', 'effacé si tu retires ton accord',
    'Personne d’autre que toi et moi ne les voit.', 'ni analysé par une intelligence artificielle', 'Réponds simplement oui ou non.', 'effacera tes repères et ces résumés.'];
  for (const phrase of cadrage) assert.ok(MESSAGE_ACCORD.includes(phrase), phrase);
  assert.ok(!/\w'\w/.test(MESSAGE_ACCORD), 'apostrophes typographiques');
  assert.equal(messageDAccord('Juliette'), `${MESSAGE_ACCORD} Juliette`);
  for (const rien of [null, undefined, '', '  ']) assert.equal(messageDAccord(rien), `${MESSAGE_ACCORD} Romain`);
});

test('le formulaire : le prénom et le nom obligatoires, l’e-mail et le compte Nolio facultatifs ; la phrase dit quoi faire', () => {
  assert.deepEqual(lireNouveauCoache(formulaire({ prenom: '  Camille ', nom: 'Martin   Durand', email: ' Camille@Exemple.FR ', nolio_id: 'usr_abc123' })).coache,
    { prenom: 'Camille', nom: 'Martin Durand', email: 'camille@exemple.fr', nolioId: 'usr_abc123' });
  assert.deepEqual(lireNouveauCoache(formulaire({ prenom: 'A', nom: 'B' })).coache, { prenom: 'A', nom: 'B', email: '', nolioId: '' });
  assert.equal(lireNouveauCoache(formulaire({ nom: 'B' })).erreur, 'Écris son prénom et son nom.');
  assert.equal(lireNouveauCoache(formulaire({ prenom: 'A', nom: '   ' })).erreur, 'Écris son prénom et son nom.');
  assert.equal(lireNouveauCoache(formulaire({ prenom: 'A', nom: 'B', email: 'camille@' })).erreur, 'Écris son adresse e-mail en entier, par exemple prenom.nom@exemple.fr.');
  assert.equal(lireNouveauCoache(formulaire({ prenom: 'A', nom: 'B', nolio_id: '123' })).erreur, 'Choisis son nom dans la liste Nolio.');
  assert.equal(lireNouveauCoache(formulaire({ prenom: 'x'.repeat(200), nom: 'B' })).coache.prenom.length, 40);
});

test('le geste : une fiche déjà créée depuis l’équipe est reprise ; un acheteur refusé ; son e-mail est gardé, rien ne lui est envoyé ; puis sa page', () => {
  const a = source('lib/app/actionsCoaching.ts');
  const g = a.slice(a.indexOf('export async function creerCoache'), a.indexOf('export async function associerNolio'));
  assert.match(g, /const lu = lireNouveauCoache\(form\);\n\s+if \('erreur' in lu\) return/);
  assert.match(g, /usrAcheteurs\(coach\.compteId\)\)\.has\(nolioId\)\) return \{ ok: false/);
  assert.match(g, /\.eq\('nolio_athlete_id', nolioId\)\.maybeSingle\(\)/, 'jamais deux fiches pour un même compte Nolio');
  assert.match(g, /if \(email\) \{\n\s+const \{ error \} = await service\.from\('athletes_coaches'\)\.update\(\{ email_app: email \}\)/, 'gardé avec sa fiche');
  assert.ok(!/ouvrirEspace|envoyerLien\(|auth\.admin/.test(g), 'aucun lien, aucun compte, aucun envoi (le lien partira par « Inviter dans l’app »)');
  assert.ok(g.indexOf('redirect(`/app/coach/athlete/${id}`)') > g.indexOf('email_app'));
  assert.ok(!/appelNolio/.test(g), 'rien d’écrit dans Nolio');
  // Gardé, il se reprend à l'invitation ; la migration qui ajoute sa colonne est écrite.
  assert.ok(source('components/app/InvitationApp.tsx').includes("defaultValue={adresse ?? gardee ?? ''}"));
  assert.ok(source('app/app/coach/athlete/[id]/page.tsx').includes('<InvitationApp athleteId={a.id} adresse={adresse} gardee={a.email_app} />'));
  assert.match(source('supabase/migrations/20261125100000_email_app_du_coache.sql'), /add column if not exists email_app text;/);
  assert.ok(source('components/app/NouveauCoache.tsx').includes('Il est gardé, rien ne lui est envoyé'));
});

test('l’écran : un seul formulaire et le message à copier ; sous la 8.x, « Ajouter un athlète » reste le questionnaire', () => {
  const p = source('app/app/coach/nouveau-coache/page.tsx');
  assert.match(p, /const coach = await exigerCoach\(\);\n\s+if \(!\(await moteurEstV9\(\)\.catch\(\(\) => false\)\)\) notFound\(\);/);
  assert.match(p, /<NouveauCoache nolio=\{choix\} message=\{messageDAccord\(prenom\)\} \/>/);
  const c = source('components/app/NouveauCoache.tsx');
  for (const champ of ['prenom', 'nom', 'nolio_id', 'email']) assert.ok(c.includes(`name="${champ}"`), champ);
  assert.equal((c.match(/<form/g) ?? []).length, 1);
  assert.match(c, /navigator\.clipboard\.writeText\(message\)/);
  assert.match(source('app/app/coach/page.tsx'), /href=\{v9 \? '\/app\/coach\/nouveau-coache' : '\/app\/coach\/nouveau'\}/);
});
