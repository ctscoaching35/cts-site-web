import { notFound } from 'next/navigation';
import CadreCoach from '@/components/app/CadreCoach';
import { PasserEnCoaching } from '@/components/app/GestesMode';
import { chiffresParSemaine } from '@/lib/app/mesure';
import { acheteursDesPlans } from '@/lib/app/acheteurs';
import { exigerCoach } from '@/lib/app/nolio';
import { supabaseConfigure } from '@/lib/app/supabase';

// Toujours calculée à la visite : la page lit la session du coach.
export const dynamic = 'force-dynamic';

// Les chiffres de la vente des plans (CTS_LANCEMENT_CADRAGE.md dans le dépôt du moteur, L4) : le tunnel, semaine
// par semaine, sur 12 semaines. Les visites du site et leur provenance : Vercel › Analytics.
const COLONNES: [string, string][] = [
  ['offre', 'Page des plans'], ['questionnaire', 'Questionnaires'], ['recap', 'Récapitulatifs'],
  ['paiement', 'Paiements lancés'], ['achats', 'Achats'], ['euros', 'Encaissé'], ['rappels', 'Rappels demandés'],
];

const date = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
// Où en est son invitation dans l'équipe Nolio.
const STATUT_NOLIO: Record<string, string> = {
  a_inviter: 'Invitation en préparation', en_cours: 'Invitation en préparation', invite: 'Invité dans Nolio',
  actif: 'Dans l’équipe Nolio', refuse: 'Invitation sans suite', sorti: 'Sorti de Nolio',
  coaching: 'son plan ne s’écrit pas',
};

export default async function Chiffres() {
  if (!supabaseConfigure()) notFound();
  await exigerCoach();
  const semaines = await chiffresParSemaine();
  const acheteurs = await acheteursDesPlans().catch(() => []);
  const jour = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date());
  return (
    <>
      <CadreCoach actif="chiffres">
        <h1 className="text-2xl text-indigo">Les chiffres de la vente</h1>
        <p className="text-sm text-indigo/70 leading-relaxed">
          Combien de personnes passent chaque étape, semaine par semaine. Les étapes sont comptées sans aucune
          donnée personnelle, une fois par visite. Les visites du site et leur provenance (Instagram, recherche…)
          sont dans Vercel, onglet Analytics.
        </p>
        {semaines.length === 0 ? (
          <p className="text-sm text-indigo/70 bg-white rounded-2xl border border-indigo/[0.08] p-4">Rien encore : les chiffres arrivent avec les premières visites.</p>
        ) : (
          <div className="bg-white rounded-2xl border border-indigo/[0.08] overflow-x-auto">
            <table className="w-full text-sm text-indigo">
              <thead>
                <tr className="text-left text-xs uppercase tracking-cts text-indigo/60">
                  <th className="p-3 whitespace-nowrap">Semaine du</th>
                  {COLONNES.map(([, nom]) => <th key={nom} className="p-3 text-right whitespace-nowrap">{nom}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-indigo/10">
                {semaines.map((s) => (
                  <tr key={s.lundi}>
                    <td className="p-3 whitespace-nowrap font-semibold">{date(s.lundi)}</td>
                    {COLONNES.map(([cle]) => (
                      <td key={cle} className="p-3 text-right tabular-nums">
                        {cle === 'euros' ? `${s.euros.toLocaleString('fr-FR')} €` : s[cle as keyof typeof s]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Les acheteurs (décision coach du 22/10/2026) : à part du coaching, en lecture ; leur accord est le leur. */}
        <section className="bg-white rounded-2xl border border-indigo/[0.08] p-4 space-y-2">
          <h2 className="eyebrow text-indigo/60">Les acheteurs ({acheteurs.length})</h2>
          <p className="text-sm text-indigo/70">
            Leurs séances partent toutes seules dans Nolio. Leur accord de lecture, ils le donnent eux-mêmes dans l’app.
          </p>
          {acheteurs.length > 0 && (
            <ul className="divide-y divide-indigo/10">
              {acheteurs.map((a) => (
                <li key={a.id} className="flex flex-wrap justify-between gap-x-3 gap-y-1 py-2 text-sm">
                  <span className="text-indigo"><strong>{a.nom}</strong> · {a.course}{a.date ? `, le ${date(a.date)}` : ''}</span>
                  <span className="text-indigo/70">
                    {a.statut === 'coaching' ? 'Mode : Coaching' : 'Mode : Plan'}{' · '}
                    {STATUT_NOLIO[a.statut ?? ''] ?? 'Nolio'}{a.statut === 'actif' ? (a.demarre ? `, démarré le ${date(a.demarre)}` : ', pas encore démarré') : ''}
                    {' · '}{a.accord ? 'accord donné' : 'sans accord'}
                  </span>
                  {/* Passer en coaching (décision coach du 23/10/2026) : une fois dans l'équipe. */}
                  {a.usr && a.statut !== 'coaching' && a.date >= jour && (
                    <span className="basis-full"><PasserEnCoaching planId={a.id} nom={a.nom.split(' ')[0]} /></span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </CadreCoach>
    </>
  );
}
