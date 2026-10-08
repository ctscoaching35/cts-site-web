import Link from 'next/link';
import { notFound } from 'next/navigation';
import CarteSeance from '@/components/app/CarteSeance';
import EnTeteApp from '@/components/app/EnTeteApp';
import MentionTest from '@/components/app/MentionTest';
import RetourSeance from '@/components/app/RetourSeance';
import TexteRiche from '@/components/app/TexteRiche';
import { contexte, lien, type Recherche } from '@/lib/app/contexte';
import { remettreSemaine } from '@/lib/app/actionsDeplacement';
import { TEXTES, mentionDeplacee, peutChanger, peutRemettre } from '@/lib/app/deplacement';
import { annulerAjustement } from '@/lib/app/actionsAdaptation';
import { BOUTONS, mentionAjustee, peutAnnuler, proposition } from '@/lib/app/adaptation';
import PropositionAjustement from '@/components/app/PropositionAjustement';
import { dateLongue, jourParId, tousLesJours } from '@/lib/app/plan';
import { texteReperes } from '@/lib/app/zones';

// La fiche d'une séance (cadrage, 3.3) : la carte en codes, ce qu'est la séance (le glossaire
// du mode d'emploi), comment lire la carte (sa légende), la séance d'avant et d'après.
export default async function FicheSeance({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Recherche;
}) {
  const ctx = await contexte(searchParams);
  const { plan } = ctx;
  const { id } = await params;
  const jour = jourParId(plan, decodeURIComponent(id));
  if (!jour) notFound();
  const seances = tousLesJours(plan).filter((j) => j.famille !== 'repos');
  const rang = seances.findIndex((j) => j.id === jour.id);
  const avant = seances[rang - 1];
  const apres = seances[rang + 1];
  // La définition propre à la séance du jour quand le moteur la donne (EF, sortie longue), sinon
  // celle du glossaire, qui vise déjà une seule séance (décision coach du 07/10/2026).
  const glossaire = plan.mode_emploi.seances.glossaire.find(([nom]) => nom === jour.definition);
  const definition = glossaire ? ([glossaire[0], jour.definition_du_jour ?? glossaire[1]] as const) : null;
  const lecture = plan.mode_emploi.lire_seance;
  const p = proposition(plan, ctx.retours, ctx.ajustements, ctx.jour);
  const ajustement = p && (p.regle === 'marche' ? p.source.id === jour.id : p.signaux.some((s) => s.jour.id === jour.id)) ? p : null;
  return (
    <>
      <EnTeteApp ctx={ctx} />
      <main className="mx-auto max-w-2xl px-4 py-5 space-y-5">
        <Link href={lien('/app/calendrier', ctx, { s: jour.semaine.numero })} className="text-teal font-semibold text-sm">
          ‹ {jour.semaine.numero} · {jour.semaine.type}
        </Link>
        <div>
          <div className="eyebrow text-teal mb-1">{jour.date_iso ? dateLongue(jour.date_iso) : jour.jour}</div>
          <h1 className="text-2xl text-indigo leading-tight">{jour.seance}</h1>
          {jour.prevu && <p className="text-sm text-indigo/60 mt-0.5">{mentionDeplacee(jour)}</p>}
          {jour.ajuste && <p className="text-sm text-indigo/60 mt-0.5">{mentionAjustee(plan, jour)}</p>}
        </div>
        <CarteSeance jour={jour} titre={false} repere={texteReperes(jour.reperes, ctx.profil)} />
        {jour.reperes?.derive_sl && texteReperes(jour.reperes, ctx.profil) && plan.zones && (
          <p className="text-sm text-indigo/70 -mt-2">{plan.zones.derive_sl}</p>
        )}
        <MentionTest jour={jour} ctx={ctx} />
        <RetourSeance jour={jour} ctx={ctx} ouvert={(await searchParams).retour === '1'} />
        {/* La proposition que ce retour a déclenchée (§7.2, étape 3, A6). */}
        {ajustement && <PropositionAjustement ctx={ctx} p={ajustement} />}
        {!ctx.demonstration && jour.ajuste && peutAnnuler(jour, ctx.retours, ctx.jour) && (
          <form action={annulerAjustement.bind(null, ctx.cle, jour.ajuste.regle, jour.id)}>
            {process.env.NODE_ENV !== 'production' && <input type="hidden" name="jour" value={ctx.jour} />}
            <button type="submit" className="text-sm text-indigo/70 underline underline-offset-2">{BOUTONS.annuler}</button>
          </form>
        )}
        {/* Déplacer la séance dans sa semaine (cadrage §7.2, E4, E5). */}
        {(peutChanger(jour, plan, ctx.retours, ctx.jour) || peutRemettre(jour.semaine, ctx.retours, ctx.jour)) && (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {peutChanger(jour, plan, ctx.retours, ctx.jour) && (
              <Link href={lien(`/app/seance/${jour.id}/changer`, ctx)} className="btn btn-outline-dark !py-2.5">
                {TEXTES.bouton}
              </Link>
            )}
            {!ctx.demonstration && peutRemettre(jour.semaine, ctx.retours, ctx.jour) && (
              <form action={remettreSemaine.bind(null, ctx.cle, jour.semaine.numero)}>
                {process.env.NODE_ENV !== 'production' && <input type="hidden" name="jour" value={ctx.jour} />}
                <button type="submit" className="text-sm text-indigo/70 underline underline-offset-2">{TEXTES.remettre}</button>
              </form>
            )}
          </div>
        )}

        {definition && (
          <section className="bg-white shadow-sm p-4 text-sm text-indigo/80 leading-relaxed">
            <h2 className="eyebrow text-indigo/60 mb-2">Cette séance</h2>
            <p className="font-bold text-indigo">{definition[0]}</p>
            {/* Une phrase sous son titre : la majuscule, que le glossaire n'a pas (il suit un tiret). */}
            <p className="mt-1">
              <TexteRiche texte={definition[1].charAt(0).toUpperCase() + definition[1].slice(1)} />
            </p>
          </section>
        )}

        <details className="bg-white shadow-sm p-4 text-sm text-indigo/80">
          <summary className="eyebrow text-indigo/60 cursor-pointer">{lecture.titre}</summary>
          <p className="mt-3 leading-relaxed">
            <TexteRiche texte={lecture.texte} />
          </p>
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
            {lecture.codes.map(([code, sens]) => (
              <div key={code} className="contents">
                <dt className="font-bold text-indigo whitespace-nowrap">{code}</dt>
                <dd>{sens}</dd>
              </div>
            ))}
          </dl>
        </details>

        <nav className="flex justify-between gap-4 text-sm font-semibold">
          {avant ? (
            <Link href={lien(`/app/seance/${avant.id}`, ctx)} className="text-teal">‹ {avant.date}</Link>
          ) : <span />}
          {apres ? (
            <Link href={lien(`/app/seance/${apres.id}`, ctx)} className="text-teal">{apres.date} ›</Link>
          ) : <span />}
        </nav>
      </main>
    </>
  );
}
