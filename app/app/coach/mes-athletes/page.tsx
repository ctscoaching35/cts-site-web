import Link from 'next/link';
import { notFound } from 'next/navigation';
import CadreCoach from '@/components/app/CadreCoach';
import { Carte, Surtitre } from '@/components/app/Ui';
import TableauAthletes, { filtreDe } from '@/components/app/TableauAthletes';
import { equipeNolio, vueDuCoach } from '@/lib/app/espaceCoach';
import { cetteSemaine } from '@/lib/app/cetteSemaine';
import { creerFicheDepuisNolio } from '@/lib/app/actionsCoaching';
import { usrAcheteurs } from '@/lib/app/acheteurs';
import { dateLongue } from '@/lib/app/plan';
import { espaceCoachOuvert } from '@/lib/app/supabase';
import { exigerCoach, nolioConfigure } from '@/lib/app/nolio';

// Toujours calculée à la visite : la page lit la session du coach.
export const dynamic = 'force-dynamic';

// « Mes athlètes » (l'ancien « Tableau de bord », CTS_NOLIO_CADRAGE.md, N2 ; maquette validée par le coach le 24/10/2026 ;
// renommé par la refonte par exception, EC1, décision coach du 04/11/2026) : réservé aux comptes de CTS_COACHS. Tous ses
// athlètes d'un coup d'œil, filtrables : son objectif, sa semaine dans le plan, sa semaine passée (séances, charge
// tenue), son Hooper, son signal, le même que sur « Cette semaine » (cetteSemaine.ts), qui a ce qui attend un geste du
// coach ; en bas, ceux de Nolio qui n'ont pas encore de fiche. Sans compteurs ni mode (décisions coach du 04/11/2026).
// Pour l'ordinateur d'abord (EC5).
export default async function MesAthletes({ searchParams }: { searchParams: Promise<{ filtre?: string }> }) {
  if (!espaceCoachOuvert()) notFound();
  const coach = await exigerCoach();
  const { filtre: demande } = await searchParams;
  const filtre = filtreDe(demande);
  const { nolio, erreur } = await equipeNolio();
  // L'équipe Nolio, pour dire qui l'a quittée ; sans réponse de Nolio, personne.
  const membres = nolio ? new Set(nolio.map((x) => x.id)) : null;
  const vue = await vueDuCoach(coach.compteId, membres);
  // Le signal de chacun et le nombre du menu : ceux de « Cette semaine ».
  const semaine = await cetteSemaine(coach.compteId, membres, vue);
  // Les athlètes de Nolio qui n'ont pas encore de fiche (le coach lui-même, « (toi) », à part).
  const relies = new Set(vue.athletes.map((a) => a.usr).filter(Boolean));
  // Sans les acheteurs de plans (décision coach du 22/10/2026) : ils sont dans « Chiffres ».
  const acheteurs = await usrAcheteurs(coach.compteId).catch(() => new Set<string>());
  const sansFiche = (nolio ?? []).filter((x) => !relies.has(x.id) && !acheteurs.has(x.id) && !x.name.endsWith('(toi)'));
  // Le coach lui-même (décision coach du 24/10/2026) : sa fiche de test, pour vivre l'app d'un coaché sur son Nolio.
  const toi = (nolio ?? []).find((x) => x.name.endsWith('(toi)') && !relies.has(x.id));
  const jour = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date());
  return (
    <CadreCoach actif="athletes" aRegarder={semaine.cartes.length}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[1.75rem] font-extrabold tracking-tight">Mes athlètes</h1>
          <p className="mt-1.5 text-sm text-[#5E5C78] first-letter:uppercase">{dateLongue(jour)} · tous tes athlètes, d’un coup d’œil</p>
        </div>
        <Link href="/app/coach/nouveau" className="inline-flex items-center min-h-12 px-5 rounded-xl bg-teal text-white text-sm font-bold">
          + Ajouter un athlète
        </Link>
      </div>

      <TableauAthletes athletes={vue.athletes} signalDe={semaine.signalDe} jour={jour} passee={vue.semainePassee} filtre={filtre} />

      <Carte className="!p-5 space-y-2">
        <Surtitre>Dans Nolio</Surtitre>
        {!nolioConfigure() ? (
          <p className="text-sm text-[#4A4866]">La clé de l’API Nolio manque dans Vercel (NOLIO_API_KEY).</p>
        ) : erreur ? (
          <p className="text-sm text-[#4A4866]">{erreur}</p>
        ) : (
          <details className="text-sm" open={sansFiche.length > 0 || Boolean(toi)}>
            <summary className="cursor-pointer min-h-11 flex items-center font-semibold text-indigo">
              {sansFiche.length ? `${sansFiche.length} athlète${sansFiche.length > 1 ? 's' : ''} de Nolio sans fiche ici` : 'Tous tes athlètes de Nolio ont leur fiche'}
            </summary>
            {/* « Créer sa fiche » (décision coach du 22/10/2026) : d'un clic, déjà reliée à Nolio. */}
            <ul className="pb-2 text-[#4A4866] divide-y divide-indigo/[0.06]">
              {sansFiche.map((x) => (
                <li key={x.id} className="flex items-center justify-between gap-3 py-1.5">
                  <span>{x.name}</span>
                  <form action={creerFicheDepuisNolio.bind(null, x.id)}>
                    <button type="submit" className="min-h-10 px-3 rounded-[10px] border border-teal text-teal text-[0.8125rem] font-bold">Créer sa fiche ›</button>
                  </form>
                </li>
              ))}
            </ul>
            {toi && (
              <div className="flex items-center justify-between gap-3 pt-2 pb-1 border-t border-indigo/[0.06] text-[#4A4866]">
                <span>Toi : vis l’app d’un coaché sur ton propre Nolio.</span>
                <form action={creerFicheDepuisNolio.bind(null, toi.id)}>
                  <button type="submit" className="min-h-10 px-3 rounded-[10px] border border-teal text-teal text-[0.8125rem] font-bold">Créer ta fiche de test ›</button>
                </form>
              </div>
            )}
          </details>
        )}
      </Carte>
    </CadreCoach>
  );
}
