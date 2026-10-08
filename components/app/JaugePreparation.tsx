import Link from 'next/link';
import { lien, type Contexte } from '@/lib/app/contexte';
import { jauge, type EtatSemaine } from '@/lib/app/journal';

// La jauge de préparation (J4, forme A, validée par le coach le 08/10/2026) : une case par semaine
// jusqu'à la course, puis les séances faites et les sorties longues faites sur celles déjà passées ;
// les séances sans retour à part. Jamais le mot « chance ».
const COULEUR: Record<EtatSemaine, string> = {
  pleine: '#0C6E5F', partielle: '#6BAA9C', manquee: '#E8D6C9', neutre: '#CDD2DA', encours: '#FFFFFF', avenir: '#E6E8EE',
};

export default function JaugePreparation({ ctx }: { ctx: Contexte }) {
  const j = jauge(ctx.plan, ctx.retours, ctx.jour);
  if (j.passees === 0 && j.semaine === null) return null;
  const premiere = j.sansRetour[0];
  return (
    <section className="bg-white shadow-sm border-l-4 border-teal px-4 py-3">
      <div className="text-[0.7rem] font-semibold tracking-cts uppercase text-teal">
        Ta préparation{j.semaine ? ` · semaine ${j.semaine} sur ${j.total}` : ''}
      </div>
      <div className="flex gap-[3px] mt-2.5" aria-hidden>
        {j.cases.map((etat, i) => (
          <span key={i} className="flex-1 h-5" style={{
            backgroundColor: COULEUR[etat],
            boxShadow: etat === 'encours' ? 'inset 0 0 0 2px #2F2D4E' : undefined,
          }} />
        ))}
      </div>
      <div className="flex justify-between text-[0.65rem] text-indigo/50 mt-1 mb-2"><span>S1</span><span>Course</span></div>
      <p className="text-sm text-indigo">Séances faites : <strong>{j.faites} sur {j.passees}</strong></p>
      <p className="text-sm text-indigo">Sorties longues : <strong>{j.slFaites} sur {j.slPassees}</strong></p>
      {premiere && (
        <Link href={lien(`/app/seance/${premiere.id}`, ctx, { retour: '1' }) + '#retour'} className="inline-block mt-1.5 text-sm font-semibold text-teal">
          {j.sansRetour.length} séance{j.sansRetour.length > 1 ? 's' : ''} sans retour ›
        </Link>
      )}
    </section>
  );
}
