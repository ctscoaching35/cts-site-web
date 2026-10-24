import Link from 'next/link';
import clsx from 'clsx';
import { notFound } from 'next/navigation';
import CadreCoach from '@/components/app/CadreCoach';
import { Carte, Surtitre } from '@/components/app/Ui';
import TableauAthletes, { filtreDe } from '@/components/app/TableauAthletes';
import { equipeNolio, vueDuCoach } from '@/lib/app/espaceCoach';
import { creerFicheDepuisNolio } from '@/lib/app/actionsCoaching';
import { usrAcheteurs } from '@/lib/app/acheteurs';
import { dateLongue } from '@/lib/app/plan';
import { clientService, supabaseConfigure } from '@/lib/app/supabase';
import { exigerCoach, nolioConfigure } from '@/lib/app/nolio';

// Toujours calculée à la visite : la page lit la session du coach.
export const dynamic = 'force-dynamic';

// L'espace coach, « Tableau de bord » (CTS_NOLIO_CADRAGE.md, N2 ; maquette validée par le coach le 24/10/2026) : réservé
// aux comptes de CTS_COACHS. Quatre compteurs, puis tous ses athlètes d'un coup d'œil, filtrables : son mode, son
// objectif, sa semaine dans le plan, sa semaine passée (séances, charge tenue), son Hooper, son signal. Ce qui attend un
// geste du coach est sur « À regarder » ; en bas, ceux de Nolio qui n'ont pas encore de fiche.
export default async function Coach({ searchParams }: { searchParams: Promise<{ filtre?: string }> }) {
  if (!supabaseConfigure()) notFound();
  const coach = await exigerCoach();
  const { filtre: demande } = await searchParams;
  const filtre = filtreDe(demande);
  const { data: compte } = await clientService().from('comptes').select('nom').eq('id', coach.compteId).maybeSingle();
  const { nolio, erreur } = await equipeNolio();
  // L'équipe Nolio, pour dire qui l'a quittée ; sans réponse de Nolio, personne.
  const vue = await vueDuCoach(coach.compteId, nolio ? new Set(nolio.map((x) => x.id)) : null);
  // Les athlètes de Nolio qui n'ont pas encore de fiche (le coach lui-même, « (toi) », à part).
  const relies = new Set(vue.athletes.map((a) => a.usr).filter(Boolean));
  // Sans les acheteurs de plans (décision coach du 22/10/2026) : ils sont dans « Chiffres ».
  const acheteurs = await usrAcheteurs(coach.compteId).catch(() => new Set<string>());
  const sansFiche = (nolio ?? []).filter((x) => !relies.has(x.id) && !acheteurs.has(x.id) && !x.name.endsWith('(toi)'));
  const jour = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date());
  const coaches = vue.athletes.filter((a) => a.mode === 'coaching').length;
  const compteurs: { n: number; texte: string; ton: string; href?: string }[] = [
    { n: coaches, texte: `athlète${coaches > 1 ? 's' : ''} coaché${coaches > 1 ? 's' : ''}`, ton: 'text-indigo' },
    { n: vue.enRoute, texte: `objectif${vue.enRoute > 1 ? 's' : ''} en route dans Nolio`, ton: 'text-indigo' },
    { n: vue.aRegarder.length, texte: 'à regarder ›', ton: vue.aRegarder.length ? 'text-[#8A3326]' : 'text-indigo', href: '/app/coach/a-regarder' },
    { n: vue.demandes.length, texte: `objectif${vue.demandes.length > 1 ? 's' : ''} demandé${vue.demandes.length > 1 ? 's' : ''} ›`,
      ton: vue.demandes.length ? 'text-[#6E4A0C]' : 'text-indigo', href: '/app/coach/a-regarder' },
  ];
  return (
    <CadreCoach actif="tableau" aRegarder={vue.aRegarder.length} coach={String(compte?.nom ?? '')}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[1.75rem] font-extrabold tracking-tight">Tableau de bord</h1>
          <p className="mt-1.5 text-sm text-[#5E5C78] first-letter:uppercase">{dateLongue(jour)} · tous tes athlètes, d’un coup d’œil</p>
        </div>
        <Link href="/app/coach/nouveau" className="inline-flex items-center min-h-12 px-5 rounded-xl bg-teal text-white text-sm font-bold">
          + Ajouter un athlète
        </Link>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3">
        {compteurs.map((c) => {
          const contenu = (<><div className={clsx('text-[1.75rem] font-extrabold', c.ton)}>{c.n}</div><div className="text-[0.78rem] text-[#5E5C78]">{c.texte}</div></>);
          return c.href
            ? <Link key={c.texte} href={c.href} className="bg-white rounded-[14px] border border-indigo/[0.08] p-4 hover:border-teal/40">{contenu}</Link>
            : <div key={c.texte} className="bg-white rounded-[14px] border border-indigo/[0.08] p-4">{contenu}</div>;
        })}
      </div>

      <TableauAthletes athletes={vue.athletes} jour={jour} filtre={filtre} />

      <Carte className="!p-5 space-y-2">
        <Surtitre>Dans Nolio</Surtitre>
        {!nolioConfigure() ? (
          <p className="text-sm text-[#4A4866]">La clé de l’API Nolio manque dans Vercel (NOLIO_API_KEY).</p>
        ) : erreur ? (
          <p className="text-sm text-[#4A4866]">{erreur}</p>
        ) : (
          <details className="text-sm" open={sansFiche.length > 0}>
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
          </details>
        )}
      </Carte>
    </CadreCoach>
  );
}
