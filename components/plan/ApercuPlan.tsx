'use client';

import BanniereSemaine from '@/components/app/BanniereSemaine';
import { JoursEcrits, NoteDeLaSemaine } from '@/components/app/SemaineEcrite';
import { Carte, Surtitre } from '@/components/app/Ui';
import { type Apercu, dateEnLettres, PHRASE_TRACE_IGNOREE } from '@/lib/apercu';

// L'APERÇU DU PLAN AVANT PAIEMENT (décision du coach du 16/11/2026, « A » : questionnaire, aperçu, paiement) : les blocs
// du plan et sa première semaine, tels que le moteur les calcule (POST /v1/apercu, 8.470), avec le même rendu que chez
// l'acheteur. Aucun nom de séance n'est écrit ici : ils viennent du moteur ; le « but » de chaque bloc est le texte déjà
// validé du plan. Aucun texte n'invite à échanger avec le coach.
// TEXTES NOUVEAUX, à valider par le coach (CTS_TEXTES_A_VALIDER.md) : « Ton aperçu du … », « Les blocs de ton plan »,
// « Ta première semaine », « Le résumé », « Revenir au récapitulatif », la phrase de la trace non lue, le chapeau.
const boutonCls = 'inline-flex items-center justify-center min-h-12 px-6 rounded-xl bg-teal text-white text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed';
const boutonSecondaireCls = 'inline-flex items-center justify-center min-h-11 px-4 rounded-xl border border-indigo/20 text-indigo text-sm font-bold';

export default function ApercuPlan({ apercu, formule, essaiSansPaiement, envoi, avis, onPayer, onRetour }: {
  apercu: Apercu; formule: string; essaiSansPaiement: boolean; envoi: boolean; avis: string; onPayer: () => void; onRetour: () => void;
}) {
  const { resume, blocs, semaine_1: s1 } = apercu;
  const lignes: [string, string][] = [
    ['Course', `${resume.course}, le ${dateEnLettres(resume.date_course)}`],
    ['Début du plan', dateEnLettres(resume.date_debut_plan)],
    ['Formule', formule],
    ['Prix', `${resume.prix_eur} €`],
  ];
  return (
    <div className="space-y-5" data-apercu>
      <header className="space-y-1.5">
        <Surtitre as="div">Avant de payer</Surtitre>
        <h2 className="text-2xl font-extrabold text-indigo">Ton aperçu du {dateEnLettres(apercu.calcule_le)}</h2>
        <p className="text-[0.875rem] text-[#4A4866] leading-relaxed">Voici les blocs de ton plan et ta première semaine, tels qu’ils sont calculés aujourd’hui.</p>
      </header>

      {resume.trace_ignoree && (
        <p role="status" className="bg-sand rounded-r-xl border-l-4 border-teal px-4 py-3 text-[0.8125rem] text-indigo leading-relaxed">{PHRASE_TRACE_IGNOREE}</p>
      )}
      {avis && (
        <p role="status" className="bg-sand rounded-r-xl border-l-4 border-teal px-4 py-3 text-[0.8125rem] text-indigo leading-relaxed">{avis}</p>
      )}

      <Carte className="space-y-3">
        <Surtitre>Les blocs de ton plan</Surtitre>
        <ol className="divide-y divide-indigo/10">
          {blocs.map((b) => (
            <li key={`${b.bloc}-${b.du}`} className="py-3 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span className="font-extrabold text-indigo">{b.bloc}</span>
                <span className="text-xs text-[#5E5C78]">{b.semaines} semaine{b.semaines > 1 ? 's' : ''}</span>
              </div>
              <div className="text-xs text-[#5E5C78] mt-0.5">du {dateEnLettres(b.du)} au {dateEnLettres(b.au)}</div>
              <p className="mt-1.5 text-[0.875rem] leading-relaxed text-[#3B3957]">{b.but}</p>
            </li>
          ))}
        </ol>
      </Carte>

      <section className="space-y-2">
        <Surtitre>Ta première semaine</Surtitre>
        <BanniereSemaine semaine={s1.semaine} />
        <JoursEcrits semaine={s1.semaine} />
        <NoteDeLaSemaine titre="La note « Ta semaine »" textes={s1.notes.map((n) => n.texte)} />
      </section>

      <Carte>
        <Surtitre>Le résumé</Surtitre>
        <dl className="mt-2 divide-y divide-indigo/10 text-[0.875rem]">
          {lignes.map(([k, v]) => (
            <div key={k} className="flex gap-3 py-2 first:pt-0 last:pb-0">
              <dt className="w-28 shrink-0 text-[#5E5C78]">{k}</dt>
              <dd className="min-w-0 font-semibold text-indigo">{v}</dd>
            </div>
          ))}
        </dl>
      </Carte>

      <section className="bg-indigo text-white rounded-[18px] p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
        <div>
          <div className="eyebrow text-teal-light mb-2">{formule}</div>
          <div className="text-4xl font-black">{resume.prix_eur} €</div>
          <div className="mt-1 text-xs text-white/70">Prix final, TVA non applicable (art. 293 B du CGI)</div>
        </div>
        <button type="button" onClick={onPayer} disabled={envoi} className={boutonCls}>
          {envoi ? 'Vérification…' : essaiSansPaiement ? 'Générer mon plan (test, sans paiement) →' : `Payer ${resume.prix_eur} € →`}
        </button>
      </section>
      <button type="button" onClick={onRetour} disabled={envoi} className={boutonSecondaireCls}>← Revenir au récapitulatif</button>
    </div>
  );
}
