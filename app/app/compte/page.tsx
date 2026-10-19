import Link from 'next/link';
import EnTeteApp from '@/components/app/EnTeteApp';
import { Avertissement } from '@/components/app/Texte';
import { Deconnexion, Suppression } from '@/components/app/BoutonsCompte';
import Installation from '@/components/app/Installation';
import { RetirerAccord } from '@/components/app/GestesEcriture';
import { Carte, CarteSombre, Surtitre } from '@/components/app/Ui';
import { contexte, initiales, type Recherche } from '@/lib/app/contexte';
import { dateLongue } from '@/lib/app/plan';
import { clientServeur, clientService } from '@/lib/app/supabase';
import { coachConnecte } from '@/lib/app/nolio';
import { donneesTableau } from '@/lib/app/tableauDuPlan';
import { plansVisibles } from '@/lib/legal';

// Les coachs de CTS, ce qui se dit d'eux (faits publiables, prénoms à l'écrit).
const COACHS: Record<string, string> = {
  Romain: 'Kiné du sport, à Rennes.',
  Juliette: 'Kiné du sport, à Annecy.',
};

// Le compte (cadrage, 3.6 ; AP1 et maquette validée par le coach le 19/10/2026) : qui il est, son coach (un coaché),
// Nolio et ses données (l'accord de lecture, T5), l'app sur l'écran d'accueil, les documents, la déconnexion, la
// suppression ; l'avertissement santé.
export default async function Compte({ searchParams }: { searchParams: Recherche }) {
  const ctx = await contexte(searchParams);
  const d = await donneesTableau(ctx);
  const supabase = ctx.demonstration ? null : await clientServeur();
  const claims = supabase ? (await supabase.auth.getClaims()).data?.claims : null;
  const { data: affiche } = ctx.demonstration ? { data: null }
    : await clientService().from('plans').select('parametres, accord_lecture_le').eq('id', ctx.cle).maybeSingle();
  // Le coach d'un coaché : son prénom (son compte) et ce qui se dit de lui.
  let coach: { prenom: string; texte: string } | null = null;
  if (ctx.coache) {
    const service = clientService();
    const { data: c } = await service.from('coaching').select('coach_id').eq('plan_id', ctx.cle).maybeSingle();
    const { data: compte } = c ? await service.from('comptes').select('nom').eq('id', c.coach_id).maybeSingle() : { data: null };
    const prenom = String(compte?.nom ?? '').trim().split(/\s+/)[0] || 'Ton coach';
    coach = { prenom, texte: COACHS[prenom] ?? 'Kiné du sport.' };
  }
  const estCoach = !ctx.demonstration && Boolean(await coachConnecte());
  const cgv = await plansVisibles();
  const nom = ctx.plan.athlete.nom;
  return (
    <>
      <EnTeteApp ctx={ctx} />
      <main className="mx-auto max-w-2xl px-4 pt-5 pb-6 space-y-4">
        <h1 className="text-[1.625rem] font-extrabold text-indigo tracking-tight">Compte</h1>

        <Carte className="flex items-center gap-3.5">
          <span className="w-[52px] h-[52px] rounded-full bg-[#E1EFEA] text-teal-dark flex items-center justify-center text-[1.0625rem] font-extrabold shrink-0">
            {initiales(nom)}
          </span>
          <div className="min-w-0">
            <p className="text-base font-bold text-indigo">{nom}</p>
            {claims?.email && <p className="text-[0.8rem] text-[#5E5C78] truncate">{String(claims.email)}</p>}
            <span className="mt-1.5 inline-block text-[0.656rem] font-bold tracking-[0.08em] text-teal-dark bg-[#E1EFEA] rounded-md px-2 py-0.5">
              {ctx.coache ? 'COACHING INDIVIDUALISÉ' : 'PLAN CTS'}
            </span>
          </div>
        </Carte>

        {coach && (
          <CarteSombre className="space-y-2.5">
            <Surtitre ton="clair">Ton coach</Surtitre>
            <p className="text-[1.0625rem] font-bold">{coach.prenom}</p>
            <p className="text-[0.8125rem] leading-relaxed text-[#D6D5E6]">
              {coach.texte} Il relit ta préparation et peut reprendre la main sur une semaine à tout moment.
            </p>
            <a href="https://www.nolio.io/" target="_blank" rel="noopener" className="inline-flex items-center min-h-11 px-4 rounded-full bg-white text-indigo text-[0.8125rem] font-bold">
              Lui écrire dans Nolio
            </a>
          </CarteSombre>
        )}

        {estCoach && (
          <Link href="/app/coach" className="flex items-center justify-between min-h-[52px] px-[18px] bg-white rounded-2xl border border-indigo/[0.08] text-sm font-bold text-teal">
            <span>Espace coach</span><span aria-hidden>›</span>
          </Link>
        )}

        {d.ecrit && (
          <Carte className="!py-1 divide-y divide-indigo/[0.06]">
            <div className="flex gap-3 py-3.5">
              <span className="w-2.5 h-2.5 mt-1.5 rounded-full bg-teal shrink-0" aria-hidden />
              <div>
                <p className="text-sm font-bold text-indigo">Nolio</p>
                <p className="mt-0.5 text-[0.8rem] text-[#4A4866] leading-relaxed">
                  Tes séances s’y écrivent chaque dimanche soir, d’après ta semaine et ton questionnaire.
                </p>
              </div>
            </div>
            <div className="flex gap-3 py-3.5">
              <span className={`w-2.5 h-2.5 mt-1.5 rounded-full shrink-0 ${d.accord ? 'bg-teal' : 'bg-[#C9A25A]'}`} aria-hidden />
              <div className="space-y-1.5">
                <p className="text-sm font-bold text-indigo">Tes données</p>
                <p className="text-[0.8rem] text-[#4A4866] leading-relaxed">
                  {ctx.coache
                    ? (d.accord
                      ? 'Ton coach et l’app lisent dans Nolio tes séances faites, ton RPE, ton ressenti et ton Hooper, seulement pour ajuster ta préparation et afficher tes graphiques.'
                      : 'Sans ton accord dans Nolio, ta préparation suit sa trame, ton questionnaire et tes séances faites ou manquées.')
                    : affiche?.accord_lecture_le
                      ? `Depuis le ${dateLongue(String(affiche.accord_lecture_le).slice(0, 10), true)}, l’app lit dans Nolio tes séances faites, ton RPE, ton ressenti et ton Hooper, et la trace de tes séances test pour en tirer tes repères, seulement pour ajuster ton plan et afficher tes graphiques. Sans cet accord, ton plan suit sa trame, ton questionnaire du dimanche et tes séances faites ou manquées, et tu donnes toi-même tes repères.`
                      : 'Sans accord de lecture, ton plan suit sa trame, ton questionnaire du dimanche et tes séances faites ou manquées, et tu donnes toi-même tes repères.'}
                </p>
                {!ctx.coache && affiche?.parametres && affiche.accord_lecture_le && <RetirerAccord planId={ctx.cle} />}
              </div>
            </div>
          </Carte>
        )}

        <Carte className="space-y-2">
          <Surtitre>L’app sur ton téléphone</Surtitre>
          <Installation />
        </Carte>

        {/* Les documents s'ouvrent dans l'app (décision coach du 19/10/2026) ; les CGV, quand les plans sont en vente. */}
        <nav aria-label="Les documents" className="bg-white rounded-2xl border border-indigo/[0.08] px-[18px]">
          {[...(cgv ? [['cgv', 'Conditions générales']] : []), ['confidentialite', 'Confidentialité'], ['mentions-legales', 'Mentions légales']].map(([slug, titre]) => (
            <Link key={slug} href={`/app/document/${slug}`} className="flex items-center justify-between min-h-[52px] border-b last:border-b-0 border-indigo/[0.06] text-sm font-semibold text-indigo">
              <span>{titre}</span><span aria-hidden className="text-[#5E5C78]">›</span>
            </Link>
          ))}
        </nav>

        {ctx.demonstration ? (
          <p className="text-sm text-[#5E5C78]">Démonstration : le compte n’existe qu’avec Supabase configuré.</p>
        ) : (
          <>
            <Deconnexion />
            <Suppression />
          </>
        )}
        <Avertissement avertissement={ctx.plan.avertissement} />
      </main>
    </>
  );
}
