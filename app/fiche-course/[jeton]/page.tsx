import type { Metadata } from 'next';
import Image from 'next/image';
import { Fragment } from 'react';
import { notFound } from 'next/navigation';
import ProfilCourse from '@/components/app/ProfilCourse';
import RepartitionPentes from '@/components/app/RepartitionPentes';
import StrategieCourse from '@/components/app/StrategieCourse';
import { Lignes, Partie, Puces, Tableau } from '@/components/app/Texte';
import { planDuJeton } from '@/lib/app/ficheCourse';
import { requeteCalculateurNutrition, type Plan } from '@/lib/app/plan';
import { clientService, supabaseConfigure } from '@/lib/app/supabase';

// Lue à chaque visite : le plan peut avoir été refait.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Ta fiche course — CTS Coaching', robots: { index: false, follow: false } };

// La fiche de course d'un athlète coaché (CTS_NOLIO_CADRAGE.md dans le dépôt du moteur, F2) : « Ta course » et « Ton
// jour J » de son plan, le même contenu que l'app et le PDF, par un lien privé, sans compte. Un lien faux : introuvable.
// ?course=AAAA-MM-JJ (PO3, PO4) : la fiche d'une de ses courses de préparation, sans plan à elle.
export default async function FicheCourse({ params, searchParams }: {
  params: Promise<{ jeton: string }>; searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!supabaseConfigure()) notFound();
  const planId = planDuJeton((await params).jeton);
  if (!planId) notFound();
  const course = (await searchParams).course;
  if (typeof course === 'string') {
    const { data: fp, error } = await clientService().from('plans').select('fiches_preparation, intake').eq('id', planId).maybeSingle();
    const fiche = !error ? ((fp as { fiches_preparation?: Record<string, FichePrep> } | null)?.fiches_preparation ?? {})[course] : undefined;
    if (!fiche) notFound();
    const niveau = String(((fp?.intake ?? {}) as Record<string, unknown>).niveau ?? '');
    return <FichePreparation fiche={fiche} calculateur={`/calculateur-nutrition?${requeteCalculateurNutrition(fiche.course.temps_cible, niveau)}`} />;
  }
  const { data } = await clientService().from('plans').select('donnees, intake').eq('id', planId).maybeSingle();
  const plan = data?.donnees as Plan | undefined;
  if (!plan) notFound();
  const { profil, terrain, determinants: d, jour_j: j } = plan;
  const calculateur = `/calculateur-nutrition?${requeteCalculateurNutrition(plan.course.temps_cible,
    String(((data?.intake ?? {}) as Record<string, unknown>).niveau ?? ''))}`;
  const t = profil.troncons;
  const fiche = (cle: string) => plan.pour_aller_plus_loin.fiches.find((f) => f.cle === cle);
  const lien = (cle: string, libelle: string) => {
    const f = fiche(cle);
    return f ? <a href={f.url} className="inline-block text-sm text-teal font-semibold">{libelle} ›</a> : null;
  };
  return (
    <div className="min-h-screen bg-sand">
      <header className="bg-indigo text-white">
        <div className="mx-auto max-w-2xl px-4 py-4 flex items-center gap-3">
          <Image src="/logo/cts-logo-rond-navy.png" alt="CTS Coaching" width={40} height={40} className="w-10 h-10 rounded-full bg-white" />
          <div>
            <div className="text-[0.7rem] font-semibold tracking-cts uppercase text-white/70">CTS Coaching</div>
            <div className="font-bold">Ta fiche course</div>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-5 space-y-5">
        <h1 className="text-2xl text-indigo leading-tight">{plan.ta_course.titre}</h1>
        <div className="bg-white shadow-sm px-4 py-1">
          <Lignes lignes={plan.ta_course.lignes} />
        </div>
        <Partie titre={profil.titre}>
          {profil.sans_trace ? (
            <p>{profil.sans_trace}</p>
          ) : (
            <>
              {profil.points && <ProfilCourse points={profil.points} />}
              {profil.pentes && <RepartitionPentes pentes={profil.pentes} />}
            </>
          )}
        </Partie>
        {terrain && (
          <Partie titre={terrain.titre}>
            <p>{terrain.texte}</p>
          </Partie>
        )}
        {t && (t.homogene || t.tableau) && (
          <Partie titre={t.titre}>
            {t.homogene ? <p>{t.homogene}</p> : t.tableau && <Tableau lignes={t.tableau} />}
          </Partie>
        )}
        <h2 className="text-xl text-indigo leading-tight pt-2">{d.titre}</h2>
        <Partie titre={d.physio.titre}>
          <Puces puces={d.physio.puces} />
        </Partie>
        {d.sans_trace && <p className="text-sm text-indigo/75 px-1">{d.sans_trace}</p>}
        {d.mecanique && (
          <Partie titre={d.mecanique.titre}>
            <Puces puces={d.mecanique.puces} />
          </Partie>
        )}
        {d.secteurs_cles && (
          <Partie titre={d.secteurs_cles.titre}>
            <Puces puces={d.secteurs_cles.puces} />
          </Partie>
        )}

        <h2 className="text-2xl text-indigo leading-tight pt-4">{j.titre}</h2>
        <Partie titre={j.nutrition.titre}>
          <StrategieCourse lignes={j.nutrition.lignes as [string, string][]} href={calculateur} externe />
          {lien(j.nutrition.fiche[0], j.nutrition.fiche[1])}
        </Partie>
        {j.parties.map((p) => (
          <Fragment key={p.titre}>
            {p.titre === 'Après' && j.fiche_ultra && <div className="px-1">{lien(j.fiche_ultra[0], j.fiche_ultra[1])}</div>}
            <Partie titre={p.titre}>
              <Puces puces={p.puces} />
            </Partie>
          </Fragment>
        ))}
        <p className="text-xs text-indigo/50 text-center pb-6">Ce lien est personnel : ne le partage pas.</p>
      </main>
    </div>
  );
}

// La fiche d'une course de préparation (PO3), rendue par le moteur (/v1/fiche-course) : les mêmes formes que les
// sections du plan, sans les déterminants physiologiques (ceux de la préparation).
type FichePrep = {
  course: { nom: string; date_lettres: string; temps_cible: string };
  ta_course: Plan['ta_course']; profil: Plan['profil'];
  determinants: { mecanique: { titre: string; puces: string[] } | null; sans_trace: string | null };
  jour_j: Plan['jour_j'];
};

function FichePreparation({ fiche, calculateur }: { fiche: FichePrep; calculateur: string }) {
  const { profil, determinants: d, jour_j: j } = fiche;
  const t = profil.troncons;
  const lien = (cle: string, libelle: string) => <a href={`/bibliotheque/${cle}`} className="inline-block text-sm text-teal font-semibold">{libelle} ›</a>;
  return (
    <div className="min-h-screen bg-sand">
      <header className="bg-indigo text-white">
        <div className="mx-auto max-w-2xl px-4 py-4 flex items-center gap-3">
          <Image src="/logo/cts-logo-rond-navy.png" alt="CTS Coaching" width={40} height={40} className="w-10 h-10 rounded-full bg-white" />
          <div>
            <div className="text-[0.7rem] font-semibold tracking-cts uppercase text-white/70">CTS Coaching · course de préparation</div>
            <div className="font-bold">Ta fiche course</div>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-5 space-y-5">
        <h1 className="text-2xl text-indigo leading-tight">{fiche.course.nom}</h1>
        <div className="bg-white shadow-sm px-4 py-1">
          <Lignes lignes={fiche.ta_course.lignes} />
        </div>
        <Partie titre={profil.titre}>
          {profil.sans_trace ? (
            <p>{profil.sans_trace}</p>
          ) : (
            <>
              {profil.points && <ProfilCourse points={profil.points} />}
              {profil.pentes && <RepartitionPentes pentes={profil.pentes} />}
            </>
          )}
        </Partie>
        {t && (t.homogene || t.tableau) && (
          <Partie titre={t.titre}>
            {t.homogene ? <p>{t.homogene}</p> : t.tableau && <Tableau lignes={t.tableau} />}
          </Partie>
        )}
        {d.mecanique && (
          <Partie titre={d.mecanique.titre}>
            <Puces puces={d.mecanique.puces} />
          </Partie>
        )}
        {d.sans_trace && <p className="text-sm text-indigo/75 px-1">{d.sans_trace}</p>}
        <h2 className="text-2xl text-indigo leading-tight pt-4">{j.titre}</h2>
        <Partie titre={j.nutrition.titre}>
          <StrategieCourse lignes={j.nutrition.lignes as [string, string][]} href={calculateur} externe />
          {lien(j.nutrition.fiche[0], j.nutrition.fiche[1])}
        </Partie>
        {j.parties.map((p) => (
          <Fragment key={p.titre}>
            {p.titre === 'Après' && j.fiche_ultra && <div className="px-1">{lien(j.fiche_ultra[0], j.fiche_ultra[1])}</div>}
            <Partie titre={p.titre}>
              <Puces puces={p.puces} />
            </Partie>
          </Fragment>
        ))}
        <p className="text-xs text-indigo/50 text-center pb-6">Ce lien est personnel : ne le partage pas.</p>
      </main>
    </div>
  );
}
