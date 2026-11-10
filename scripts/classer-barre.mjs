#!/usr/bin/env node
/**
 * LA LECTURE DU SITE, POUR LE MOTEUR (la barre en séances clés en main, moteur 8.461) : lit un JSON {barre, anciens, noms}
 * — des séances (nom, étapes, RPE) et des noms — et rend ce que le site en lit : le code de chaque nom
 * (lib/app/codeSeance.ts) et la famille et la dose de chaque séance (lib/app/classement.ts, classerSeanceNommee), pour un
 * profil fictif. tests_barre_cles_en_main.py (moteur) le compare à sa propre lecture. Sans réseau ni base.
 *
 *   node scripts/classer-barre.mjs <entrée.json>
 */
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (e) {
      if (specifier.startsWith('.') && !specifier.endsWith('.ts')) return nextResolve(`${specifier}.ts`, context);
      throw e;
    }
  },
});
const { lireCode } = await import('../lib/app/codeSeance.ts');
const { classerSeanceNommee } = await import('../lib/app/classement.ts');

const PROFIL = { vc_ms: 4, fc_seuil1: 150, fc_seuil2: 170 };
const entree = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const classer = (x) => classerSeanceNommee(x.name, x.workout, PROFIL, x.rpe ?? null, null);
process.stdout.write(JSON.stringify({
  codes: Object.fromEntries((entree.noms ?? []).map((n) => [n, lireCode(n)])),
  barre: (entree.barre ?? []).map(classer),
  anciens: (entree.anciens ?? []).map(classer),
}));
