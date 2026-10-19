import { notFound } from 'next/navigation';
import CadreCoach from '@/components/app/CadreCoach';
import { chiffresParSemaine } from '@/lib/app/mesure';
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

export default async function Chiffres() {
  if (!supabaseConfigure()) notFound();
  await exigerCoach();
  const semaines = await chiffresParSemaine();
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
      </CadreCoach>
    </>
  );
}
