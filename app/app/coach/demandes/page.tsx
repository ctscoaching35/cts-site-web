import Link from 'next/link';
import { notFound } from 'next/navigation';
import CadreCoach from '@/components/app/CadreCoach';
import { Carte } from '@/components/app/Ui';
import { momentsEnClair, objectifEnClair } from '@/lib/app/coachingRegles';
import { coachDesDemandes, demandesOuvertes } from '@/lib/app/demandesCoaching';
import { modeAppGratuite } from '@/lib/app/gratuitRegles';
import { exigerCoach } from '@/lib/app/nolio';
import { dateAbregee } from '@/lib/app/plan';
import { montrerLInfra } from '@/lib/app/espaceCoachSimple';
import { moteurEstV9 } from '@/lib/app/moteurEnLigne';
import { MOTS_DU_COACH, motsDuCoach } from '@/lib/app/motsDuCoach';
import { espaceCoachOuvert } from '@/lib/app/supabase';

export const dynamic = 'force-dynamic';

// « DEMANDES » (app gratuite, lot A2, décisions du coach du 16/11/2026) : les demandes de coaching ouvertes, la plus ancienne en
// tête (date, prénom, ville, objectif, moments d'appel) ; chaque ligne ouvre la demande entière. Pour le premier coach de
// CTS_COACHS seulement ; introuvable tant que l'app gratuite est coupée.
// SOUS LA 9.x (décision 220 du coach, 24/11/2026 : plus de message d'infrastructure) : « la migration demandes_coaching est-elle passée dans Supabase ? » n'est plus dite au coach ; « Cette partie n'est
// pas disponible pour l'instant. », et la phrase d'avant au journal du serveur. Sous la 8.x, rien ne change.
export default async function Demandes() {
  if (!espaceCoachOuvert() || modeAppGratuite() === 'coupe') notFound();
  const coach = await exigerCoach();
  if (!coachDesDemandes(coach)) notFound();
  const demandes = await demandesOuvertes().catch((e) => {
    console.error('Demandes de coaching :', e instanceof Error ? e.message : e);
    return null;
  });
  const v9 = await moteurEstV9().catch(() => false);
  if (demandes === null) montrerLInfra(v9, MOTS_DU_COACH.ancien.demandes.illisibles);
  return (
    <CadreCoach actif="demandes">
      <div>
        <h1 className="text-[1.75rem] font-extrabold tracking-tight">Demandes de coaching</h1>
        <p className="mt-1.5 text-sm text-[#5E5C78]">De l’app gratuite, la plus ancienne en tête. Tu appelles, puis tu acceptes ou tu classes sans suite.</p>
      </div>
      {demandes === null ? (
        <Carte className="!p-5"><p className="text-sm text-[#9A3B2C]">{motsDuCoach(v9).demandes.illisibles}</p></Carte>
      ) : demandes.length === 0 ? (
        <Carte className="!p-5"><p className="text-sm text-teal font-semibold">Aucune demande ouverte.</p></Carte>
      ) : (
        <Carte className="!p-2">
          <ul>
            {demandes.map((d) => (
              <li key={d.id} className="border-t first:border-t-0 border-indigo/[0.07]">
                <Link href={`/app/coach/demandes/${d.id}`} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 px-3 py-3.5 min-h-12 hover:bg-sand/60 rounded-xl">
                  <span className="min-w-0 flex-[1_1_260px]">
                    <span className="block text-sm font-bold text-indigo">{String(d.reponses.nom ?? '').split(' ')[0] || 'Sans nom'}{d.reponses.ville ? ` · ${d.reponses.ville}` : ''}</span>
                    <span className="block text-[0.8125rem] text-[#4A4866]">{d.reponses.objectif ? motsDuCoach(v9).enMots(objectifEnClair(d.reponses.objectif)) : 'Objectif non précisé'}</span>
                    <span className="block text-xs text-[#5E5C78]">À appeler : {momentsEnClair(d.moments) || 'moments non précisés'}</span>
                  </span>
                  <span className="text-xs font-semibold text-[#5E5C78] whitespace-nowrap">Envoyée le {dateAbregee(d.envoyee_le.slice(0, 10))}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Carte>
      )}
    </CadreCoach>
  );
}
