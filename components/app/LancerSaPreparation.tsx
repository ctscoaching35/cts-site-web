import { Carte } from './Ui';
import { DemarrerNolio } from './GestesEcriture';
import { TEXTES_PAGE_ATHLETE, type EtatDuLancement } from '@/lib/app/pageAthleteSimple';
import { dateLongue } from '@/lib/app/plan';

// « LANCER SA PRÉPARATION », SOUS LA CARTE « CE QUE J’AI BESOIN DE SAVOIR », SOUS LA 9.x SEULEMENT (décision 241 du coach, 25/11/2026, moment 2) : un seul bouton, pour son objectif à venir pas encore démarré (le geste de
// « Démarrer dans Nolio », components/app/GestesEcriture.tsx). Actif quand sa carte est complète, son compte Nolio associé et son accord reçu ; sinon une ligne dit pourquoi (lib/app/pageAthleteSimple.ts, etatDuLancement).
// L'alerte du moteur sur cet objectif (entrée 234, lib/app/alerteCoach.ts) se dit juste au-dessus.
export default function LancerSaPreparation({ planId, etat, alertes, premier, dernier }: {
  planId: string; etat: EtatDuLancement | null; alertes: string[]; premier: string; dernier: string;
}) {
  if (!etat) return null;
  return (
    <Carte id="lancer-sa-preparation" className="!p-5 space-y-3 scroll-mt-6">
      {alertes.map((phrase) => <p key={phrase} className="rounded-xl bg-[#FFF6E5] p-3 text-[0.8125rem] leading-relaxed text-[#7A520D]">{phrase}</p>)}
      {'programme' in etat ? (
        <p className="text-[0.8125rem] font-semibold text-teal">Programmé : il démarre tout seul le {dateLongue(etat.programme, true)}.</p>
      ) : (
        <DemarrerNolio planId={planId} actif={etat.actif} pourquoi={etat.pourquoi ?? undefined} libelle={TEXTES_PAGE_ATHLETE.lancer}
          lundi="" premier={premier} dernier={dernier} programme={false} />
      )}
    </Carte>
  );
}
