import Link from 'next/link';
import { notFound } from 'next/navigation';
import AFaire from '@/components/app/AFaire';
import CadreCoach from '@/components/app/CadreCoach';
import { CarteDemandes } from '@/components/app/LienDemandes';
import { Carte, Surtitre } from '@/components/app/Ui';
import TableauAthletes, { filtreDe } from '@/components/app/TableauAthletes';
import { equipeNolio, synchroniserLEquipe } from '@/lib/app/espaceCoach';
import { espaceDuCoach } from '@/lib/app/mesAthletes';
import { moteurEstV9 } from '@/lib/app/moteurEnLigne';
import { etiquettesSansAFaire, lesSeriesAFaire, montrerLInfra, TEXTES_A_FAIRE } from '@/lib/app/espaceCoachSimple';
import { texteBilan } from '@/lib/app/espaceParAthlete';
import { creerFicheDepuisNolio } from '@/lib/app/actionsCoaching';
import { usrAcheteurs } from '@/lib/app/acheteurs';
import { dateAbregee, dateLongue } from '@/lib/app/plan';
import { clientService, espaceCoachOuvert } from '@/lib/app/supabase';
import ListeSimple from '@/components/app/ListeSimple';
import { lireLesMots } from '@/lib/app/motsDesCoaches';
import { exigerCoach, nolioConfigure } from '@/lib/app/nolio';

// Toujours calculée à la visite : la page lit la session du coach.
export const dynamic = 'force-dynamic';

// « MES ATHLÈTES », L'ACCUEIL DE L'ESPACE COACH (décision « 1A » du coach, 08/11/2026 : « je travaille la plupart du temps
// athlète après athlète » ; maquette validée le 08/11/2026, « tout A ») : une ligne par athlète, toute la ligne ouvre sa
// page — sa couleur de « Dimanche » toute la semaine (Q1), son objectif, sa semaine et « Partie / Pas partie », sa
// semaine passée, « Ce qui l'attend » en étiquettes (Q6, Q7) ; ceux qui t'attendent en tête (Q2, aussi l'ordre d'« Athlète
// suivant ») ; le bilan du dimanche en tête, du dimanche soir au lundi soir (Q10) ; les filtres et « Dans Nolio » comme
// avant. Remplace « Cette semaine » (l'urgent est dans « Urgent ») et « Dimanche ». Pour l'ordinateur d'abord (EC5).
// SOUS LA 9.x SEULEMENT (décision 220 du coach, 24/11/2026 : « l'espace coach doit être très simple » ; première simplification, « un seul endroit pour ce
// qui est à faire ») : « Urgent » est fondu ici, une section « À faire » avant la liste (mêmes points, mêmes gestes, un seul « Réglé », les séries du samedi
// à retirer comprises) ; un point n'est dit qu'une fois (le bandeau du dimanche ne dit plus que ce qui est parti, la colonne « Ce qui l'attend » ne redit pas
// « À faire ») ; plus de message pour le développeur (la clé de l'API Nolio, la migration de Supabase), il reste au journal du serveur. Sous la 8.x, rien ne change.
export default async function MesAthletes({ searchParams }: { searchParams: Promise<{ filtre?: string }> }) {
  if (!espaceCoachOuvert()) notFound();
  const coach = await exigerCoach();
  const v9 = await moteurEstV9().catch(() => false);
  const { filtre: demande } = await searchParams;
  const filtre = filtreDe(demande);
  const { nolio, erreur } = await equipeNolio();
  // L'équipe Nolio synchronisée (lot 2, décision A du coach du 12/11/2026) : avant la liste, les fiches des nouveaux de
  // l'équipe se créent et ceux qui l'ont quittée passent dans « Anciens athlètes » ; Nolio muet, rien ne bouge.
  const anciens = await synchroniserLEquipe(coach.compteId, nolio).catch((e) => {
    console.error('Équipe Nolio :', e instanceof Error ? e.message : e);
    return [];
  });
  // L'équipe Nolio, pour dire qui l'a quittée ; sans réponse de Nolio, personne.
  const membres = nolio ? new Set(nolio.map((x) => x.id)) : null;
  const espace = await espaceDuCoach(coach.compteId, membres);
  const { vue, bilan } = espace;
  // Les athlètes de Nolio qui n'ont pas encore de fiche (le coach lui-même, « (toi) », à part).
  const relies = new Set(vue.athletes.map((a) => a.usr).filter(Boolean));
  // Sans les acheteurs de plans (décision coach du 22/10/2026) : ils sont dans « Chiffres ».
  const acheteurs = await usrAcheteurs(coach.compteId).catch(() => new Set<string>());
  const sansFiche = (nolio ?? []).filter((x) => !relies.has(x.id) && !acheteurs.has(x.id) && !x.name.endsWith('(toi)'));
  // Le coach lui-même (décision coach du 24/10/2026) : sa fiche de test, pour vivre l'app d'un coaché sur son Nolio.
  const toi = (nolio ?? []).find((x) => x.name.endsWith('(toi)') && !relies.has(x.id));
  const jour = espace.jour;
  // Sous la 9.x : ce qui attend le coach est dans « À faire » ; la colonne « Ce qui l'attend » ne le redit pas.
  const series = await lesSeriesAFaire(coach.compteId, v9);
  const lignes = v9 ? espace.lignes.map((e) => ({ ...e, etiquettes: etiquettesSansAFaire(e.points, e.moteur) })) : espace.lignes;
  // Sous la 9.x (décision 241, moment 3) : un mot par coaché (lib/app/unMot.ts), sans nouvel appel à Nolio.
  const mots = v9 ? await lireLesMots(clientService(), coach.compteId, espace.lignes, jour) : [];
  // Sous la 9.x, la clé de l'API Nolio qui manque n'est plus dite au coach : pas de carte « Dans Nolio », une ligne au journal.
  const carteNolio = !(!nolioConfigure() && !montrerLInfra(v9, 'La clé de l’API Nolio manque dans Vercel (NOLIO_API_KEY).'));
  return (
    <CadreCoach actif="athletes" urgents={espace.urgents}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[1.75rem] font-extrabold tracking-tight">Mes athlètes</h1>
          {/* Maquette validée par le coach le 08/11/2026 */}
          <p className="mt-1.5 text-sm text-[#5E5C78] first-letter:uppercase">{dateLongue(jour)} · {v9 ? TEXTES_A_FAIRE.sousTitre : 'tes athlètes un par un, ceux qui t’attendent en tête'}</p>
        </div>
        <Link href="/app/coach/nouveau" className="inline-flex items-center min-h-12 px-5 rounded-xl bg-teal text-white text-sm font-bold">
          + Ajouter un athlète
        </Link>
      </div>

      {/* Lot A2 de l'app gratuite : une demande de coaching attend (rien tant que l'app gratuite est coupée). */}
      <CarteDemandes />

      {bilan && !v9 && (
        <Link href="/app/coach/urgent" className="flex items-center justify-between gap-3 bg-indigo text-white rounded-[14px] p-4">
          <span className="text-sm">
            <strong>Dimanche {dateAbregee(bilan.dimanche, false)}</strong> : {texteBilan(bilan.parties, bilan.pasParties, espace.urgents)}
          </span>
          <span className="text-xs text-[#D6D5E6] whitespace-nowrap">Urgent ›</span>
        </Link>
      )}

      {/* Sous la 9.x (décision 241, moment 3) : une ligne par coaché et un seul mot ; les séries du samedi à retirer (restes de la 8.x) restent dites tant qu'il y en a. */}
      {v9 && series > 0 && <AFaire lignes={[]} series={series} />}
      {v9 ? <ListeSimple lignes={mots} /> : <TableauAthletes lignes={lignes} jour={jour} passee={vue.semainePassee} filtre={filtre} v9={v9} />}
      {!espace.signaux && montrerLInfra(v9, 'Les signaux de la semaine ne sont pas gardés : la migration du 04/11/2026 est à passer dans Supabase.') && (
        <p className="text-xs text-[#5E5C78]">
          Les signaux de la semaine (commentaires, sensations, Hooper, rien de remonté) ne sont pas encore gardés : la migration
          du 04/11/2026 est à passer dans Supabase.
        </p>
      )}

      {/* Sous la 9.x, rien d'autre que la liste sur la page (décision 241) : les anciens athlètes et « Dans Nolio » sont repliés dans « Réglages ». */}
      {(() => {
        const reste = (
          <>
          {/* Les anciens athlètes (lot 2, décision A du coach du 12/11/2026) : sortis de l'équipe Nolio, hors de la liste ;
              leur fiche et leur historique restent, ils reviennent d'eux-mêmes dans la liste s'ils reviennent dans l'équipe. */}
          {anciens.length > 0 && (
            <Carte className="!p-5 space-y-2">
              <Surtitre>Anciens athlètes</Surtitre>
              <p className="text-sm text-[#4A4866]">
                Plus dans ton équipe Nolio : le moteur n’écrit plus rien pour eux, leur historique reste. S’ils reviennent dans
                l’équipe, ils reviennent dans ta liste.
              </p>
              <ul className="text-sm divide-y divide-indigo/[0.06]">
                {anciens.map((a) => (
                  <li key={a.id}>
                    <Link href={`/app/coach/athlete/${a.id}`} className="flex items-center justify-between gap-3 min-h-11 text-indigo">
                      <span className="font-semibold">{a.nom}</span>
                      <span className="text-xs text-[#5E5C78]">depuis le {dateAbregee(a.depuis, false)} ›</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Carte>
          )}

          {carteNolio && (
            <Carte className="!p-5 space-y-2">
              <Surtitre>Dans Nolio</Surtitre>
              {!nolioConfigure() ? (
                <p className="text-sm text-[#4A4866]">La clé de l’API Nolio manque dans Vercel (NOLIO_API_KEY).</p>
              ) : erreur ? (
                <p className="text-sm text-[#4A4866]">{v9 ? TEXTES_A_FAIRE.nolioMuet : erreur}</p>
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
          )}
          </>
        );
        return v9 ? (
          <details className="space-y-5">
            <summary className="cursor-pointer min-h-11 flex items-center text-[0.8125rem] font-bold text-teal">Réglages</summary>
            <div className="space-y-5 pt-2">{reste}</div>
          </details>
        ) : reste;
      })()}
    </CadreCoach>
  );
}
