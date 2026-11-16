/**
 * Qui est là ? (app gratuite, lot A1) : visiteur, compte gratuit, ou tout ce qui existait (« normal »). Lu une fois par
 * requête. En mode « coupe », aucune lecture : le cas est « normal » et rien ne change.
 */
import { cache } from 'react';
import { plansDuCompte } from './contexte';
import { ficheDuCompte } from './demandes';
import { demonstrationOuverte } from './demonstrationPorte';
import { decider, modeAppGratuite, type CasDeVisite, type ModeAppGratuite } from './gratuitRegles';
import { gratuitOuvert } from './gratuit';
import { coachConnecte } from './nolio';
import { clientServeur, supabaseConfigure } from './supabase';

export type Acces = { cas: CasDeVisite; mode: ModeAppGratuite; compteId?: string; email?: string };

export const lireAcces = cache(async (): Promise<Acces> => {
  const mode = modeAppGratuite();
  if (mode === 'coupe') return { cas: 'normal', mode };
  const ouvertPourLui = await gratuitOuvert();
  // Sans Supabase (la démonstration, en développement seulement) : le visiteur, sans compte possible.
  if (!supabaseConfigure()) return { cas: ouvertPourLui && demonstrationOuverte() ? 'visiteur' : 'normal', mode };
  const { data } = await (await clientServeur()).auth.getClaims();
  const compteId = data?.claims?.sub ? String(data.claims.sub) : null;
  if (!compteId) return { cas: decider({ mode, ouvertPourLui, session: false, sansPlan: false }), mode };
  const email = String(data?.claims?.email ?? '');
  // Sans plan, ni coach, ni coaché : les mêmes lectures que contexte() pour décider qu'un compte n'a rien.
  const sansPlan = ouvertPourLui
    && (await plansDuCompte(compteId)).length === 0 && !(await ficheDuCompte(compteId)) && !(await coachConnecte());
  return { cas: decider({ mode, ouvertPourLui, session: true, sansPlan }), mode, compteId, email };
});

export const estGratuit = (a: Acces) => a.cas === 'visiteur' || a.cas === 'gratuit';
