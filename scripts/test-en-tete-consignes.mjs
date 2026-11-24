#!/usr/bin/env node
/**
 * L'EN-TÊTE DES DESCRIPTIONS DE SÉANCE (24/11/2026, lot « deux voix », décision 212) : le moteur écrit « Mes consignes : » à la place de « Consignes : » pour un coaché
 * (« Consignes : » reste celui de l'acheteur). Le site ne lit ni ne découpe ces descriptions : elles vont du moteur à Nolio (`POST /v1/semaine`, puis `/v1/nolio/seances`) telles
 * quelles. L'essai le prouve des deux côtés : aucun code du site ne dépend de l'en-tête, et les deux formes traversent la chaîne sans être touchées. Aucun réseau, aucune donnée.
 *
 *   node --test scripts/test-en-tete-consignes.mjs
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';
import test from 'node:test';

const RACINE = new URL('..', import.meta.url).pathname;
registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier.startsWith('@/') ? pathToFileURL(`${RACINE}${specifier.slice(2)}.ts`).href : specifier, context);
    } catch (e) {
      if (specifier.startsWith('.') && !specifier.endsWith('.ts')) return nextResolve(`${specifier}.ts`, context);
      throw e;
    }
  },
});
const moteur = await import(pathToFileURL(`${RACINE}lib/app/moteurV9.ts`).href);

const TEXTES = {
  acheteur: 'Consignes :\nPourquoi : une séance de seuil.\nComment : 3 × 8 min.\nAujourd’hui : échauffement 12 min.\nRepères : RPE 7.',
  coache: 'Mes consignes :\nPourquoi : une séance de seuil.\nComment : 3 × 8 min.\nAujourd’hui, je te propose : échauffement 12 min.\nRepères : RPE 7.',
};
const semaine = (texte) => ({ numero: 3, lundi: '2026-12-07', jours: [{ jour: 'mardi', date: '2026-12-08', seance: { id: 'S3-mardi', famille: 'seuil1', titre: 'Seuil 1', texte } }] });

test('aucun code du site ne lit ni ne découpe une description de séance sur son en-tête « Consignes : » ou « Mes consignes : »', () => {
  let trouves = '';
  try {
    trouves = execFileSync('grep', ['-rnE', '(Mes consignes|Consignes) ?:', 'app', 'components', 'lib'], { cwd: RACINE, encoding: 'utf8' });
  } catch (e) {
    if (e.status !== 1) throw e;
  }
  // Un commentaire de code qui cite l'en-tête ne le lit pas ; une chaîne ou une expression régulière du code, si (la clé d'objet `consigne:` d'un autre module n'est pas cet en-tête).
  const lus = trouves.split('\n').filter(Boolean).filter((l) => !/^[^:]+:\d+:\s*(\/\/|\*|\{\/\*)/.test(l));
  assert.deepEqual(lus, [], 'le site ne dépend pas de l’en-tête : les deux formes passent');
});

test('les deux formes traversent la chaîne du site sans être touchées : réponse du moteur, puis corps envoyé pour Nolio', () => {
  for (const [qui, texte] of Object.entries(TEXTES)) {
    const sortie = moteur.lireSortieV9({ semaine: semaine(texte), note: [], pourquoi: [], etat: { version: '9.0', semaines: [] }, branche: 1 });
    assert.ok(sortie, qui);
    assert.equal(sortie.semaine.jours[0].seance.texte, texte, `${qui} : la description gardée est celle du moteur`);
    const corps = moteur.corpsNolioSeances(sortie.semaine);
    assert.equal(corps.semaine.jours[0].seance.texte, texte, `${qui} : celle qui repart vers /v1/nolio/seances aussi`);
  }
});

test('les descriptions que le site garde de la fixture du moteur ne sont pas coupées non plus : il les range sans les lire', () => {
  const f = JSON.parse(readFileSync(`${RACINE}scripts/fixtures/moteur-v9/semaine-1.json`, 'utf8'));
  const sortie = moteur.lireSortieV9(f.reponse);
  assert.ok(sortie);
  const textes = sortie.semaine.jours.flatMap((j) => (j.seance?.texte ? [j.seance.texte] : []));
  assert.ok(textes.length >= 1);
  assert.deepEqual(textes, f.reponse.semaine.jours.flatMap((j) => (j.seance?.texte ? [j.seance.texte] : [])));
});
