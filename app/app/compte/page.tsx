import type { Metadata } from 'next';
import Link from 'next/link';
import EnTeteApp from '@/components/app/EnTeteApp';
import { Avertissement } from '@/components/app/Texte';
import { Deconnexion, Suppression } from '@/components/app/BoutonsCompte';
import Installation from '@/components/app/Installation';
import { DonnerAccord, RetirerAccord } from '@/components/app/GestesEcriture';
import { Carte, CarteSombre, EcrisNous, Surtitre, TITRE } from '@/components/app/Ui';
import { contexte, initiales, type Recherche } from '@/lib/app/contexte';
import { ajouterJours, dateLongue } from '@/lib/app/plan';
import { clientServeur, clientService } from '@/lib/app/supabase';
import { coachConnecte } from '@/lib/app/nolio';
import { donneesTableau } from '@/lib/app/tableauDuPlan';
import { plansVisibles } from '@/lib/legal';
import { ECRIRE_A_CTS } from '@/lib/app/contact';

export const metadata: Metadata = { title: 'Compte' };

// L'adresse fictive de la démonstration : « clara@demonstration.test ».
const prenomDemo = (nom: string) => (nom.trim().split(/\s+/)[0] ?? 'athlete').toLowerCase().normalize('NFD').replace(/[^a-z]/g, '') || 'athlete';

// Les coachs de CTS, ce qui se dit d'eux (faits publiables, prénoms à l'écrit).
const COACHS: Record<string, string> = {
  Romain: 'Kiné du sport, à Rennes.',
  Juliette: 'Kiné du sport, à Annecy.',
};

// Le compte (cadrage, 3.6 ; AP1 et maquette validée par le coach le 19/10/2026) : qui il est, son coach (un coaché),
// Nolio et ses données (l'accord de lecture, T5), l'app sur l'écran d'accueil, les documents, la déconnexion, la
// suppression ; l'avertissement santé, pour un acheteur seulement (décision coach du 19/10/2026).
export default async function Compte({ searchParams }: { searchParams: Recherche }) {
  const ctx = await contexte(searchParams, { sansObjectif: true });
  const d = await donneesTableau(ctx);
  const supabase = ctx.demonstration ? null : await clientServeur();
  // La démonstration : une adresse fictive, et l'accord de l'état simulé (avant : « Sans accord de lecture » à côté
  // d'une pastille verte, audit du 05/11/2026).
  const claims = supabase ? (await supabase.auth.getClaims()).data?.claims
    : ctx.demonstration ? { email: `${prenomDemo(ctx.plan.athlete.nom)}@demonstration.test` } : null;
  const { data: affiche } = ctx.demonstration
    ? { data: { parametres: {}, accord_lecture_le: d.accord ? ajouterJours(ctx.sansObjectif ? ctx.jour : ctx.plan.course.date_debut_plan, -7) : null } }
    : await clientService().from('plans').select('parametres, accord_lecture_le').eq('id', ctx.cle).maybeSingle();
  // Le coach d'un coaché : son prénom (son compte) et ce qui se dit de lui.
  let coach: { prenom: string; texte: string } | null = null;
  // La démonstration n'a pas de base (B10, audit du 03/11/2026 : la page plantait) : un coach d'exemple.
  if (ctx.coache && ctx.demonstration) coach = { prenom: 'Romain', texte: COACHS.Romain ?? 'Kiné du sport.' };
  else if (ctx.coache) {
    const service = clientService();
    const { data: c } = ctx.fiche ? { data: { coach_id: ctx.fiche.coach_id } }
      : await service.from('coaching').select('coach_id').eq('plan_id', ctx.cle).maybeSingle();
    const { data: compte } = c ? await service.from('comptes').select('nom').eq('id', c.coach_id).maybeSingle() : { data: null };
    const prenom = String(compte?.nom ?? '').trim().split(/\s+/)[0] || 'Ton coach';
    coach = { prenom, texte: COACHS[prenom] ?? 'Kiné du sport.' };
  }
  const estCoach = !ctx.demonstration && Boolean(await coachConnecte());
  // Les CGV ne couvrent pas le coaching individualisé (« accord séparé », article 2) : jamais pour un coaché.
  const cgv = !ctx.coache && (await plansVisibles());
  const nom = ctx.plan.athlete.nom;
  return (
    <>
      <EnTeteApp ctx={ctx} />
      <main className="mx-auto max-w-2xl px-4 pt-5 pb-6 space-y-4">
        <h1 className={TITRE}>Compte</h1>

        <Carte className="flex items-center gap-3.5">
          <span className="w-[52px] h-[52px] rounded-full bg-[#E1EFEA] text-teal-dark flex items-center justify-center text-[1.0625rem] font-extrabold shrink-0">
            {initiales(nom)}
          </span>
          <div className="min-w-0">
            <p className="text-base font-bold text-indigo">{nom}</p>
            {claims?.email && <p className="text-[0.8rem] text-[#5E5C78] truncate">{String(claims.email)}</p>}
            <span className="mt-1.5 inline-block text-[0.656rem] font-bold tracking-[0.08em] text-teal-dark bg-[#E1EFEA] rounded-md px-2 py-0.5">
              {ctx.coache ? 'COACHING INDIVIDUALISÉ' : 'PRÉPARATION CTS'}
            </span>
          </div>
        </Carte>

        {coach && (
          <CarteSombre className="space-y-2.5">
            <Surtitre ton="clair">Ton coach</Surtitre>
            <p className="text-[1.0625rem] font-bold">{coach.prenom}</p>
            <p className="text-[0.8125rem] leading-relaxed text-[#D6D5E6]">
              {/* Le prénom du coach (§8, point 4, audit du 03/11/2026) : « Juliette relit… » pour ses coachés. */}
              {coach.texte} {ctx.aLaMain ? `${coach.prenom} écrit tes séances dans Nolio.` : `${coach.prenom} relit ta préparation et peut reprendre la main sur une semaine à tout moment.`}
            </p>
            {/* Q5 et Q18 (décisions coach du 05/11/2026 au soir, « A ») : plus de bouton vers le site de Nolio, qui n'ouvrait
                pas sa conversation ; ses mots restent dans Nolio, la carte le dit. Validé par le coach le 05/11/2026 (1A). */}
            <p className="text-[0.8125rem] leading-relaxed text-white font-semibold">
              Écris-lui dans ton appli Nolio. Ses mots sur ta semaine sont dans Nolio.
            </p>
          </CarteSombre>
        )}

        {estCoach && (
          <Link href="/app/coach" className="flex items-center justify-between min-h-[52px] px-[18px] bg-white rounded-2xl border border-indigo/[0.08] text-sm font-bold text-teal">
            <span>Espace coach</span><span aria-hidden>›</span>
          </Link>
        )}

        {/* C46 (audits du 05/11/2026) : un coaché sans objectif voit aussi Nolio et son accord. */}
        {(d.ecrit || ctx.sansObjectif) && (
          <Carte id="accord" className="!py-1 divide-y divide-indigo/[0.06] scroll-mt-20">
            <div className="flex gap-3 py-3.5">
              <span className="w-2.5 h-2.5 mt-1.5 rounded-full bg-teal shrink-0" aria-hidden />
              <div>
                <p className="text-sm font-bold text-indigo">Nolio</p>
                <p className="mt-0.5 text-[0.8rem] text-[#4A4866] leading-relaxed">
                  {ctx.aLaMain ? 'Ton coach y écrit tes séances.' : 'Tes séances s’y écrivent chaque dimanche soir, d’après ta semaine et ton questionnaire.'}
                  {/* Nolio ne relie une activité à sa séance que le même jour (décision coach du 04/11/2026 au soir) : la
                      phrase de l'acheteur et du coaché, ici et dans l'e-mail de bienvenue. */}
                  {' Tu cours une séance un autre jour ? Déplace-la d’abord dans ton calendrier Nolio.'}
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
                      : 'Sans ton accord, ta préparation suit son plan, ton questionnaire du samedi et tes séances faites ou manquées, et tes séances ne s’affichent pas ici. Pour les voir dans l’app, réponds « oui » au message de ton coach dans Nolio.')
                    // L'accord de lecture de l'acheteur (PL7, décision coach du 04/11/2026) : facultatif, recommandé, et juste
                    // sur ce qui est lu (les séances faites et leur durée, dans tous les cas).
                    : affiche?.accord_lecture_le
                      ? `Depuis le ${dateLongue(String(affiche.accord_lecture_le).slice(0, 10), true)}, l’app lit aussi dans Nolio ton RPE, ton ressenti, ton Hooper et la trace de tes séances test, pour ajuster ton plan à ta fatigue et en tirer tes repères. Tes séances faites ou manquées et leur durée sont lues dans tous les cas.`
                      : 'Sans accord de lecture, l’app lit seulement tes séances faites ou manquées et leur durée : ton plan suit sa trame et ton questionnaire du samedi, sans s’ajuster à ta fatigue, et tu donnes toi-même tes repères. L’accord est recommandé.'}
                </p>
                {!ctx.coache && affiche?.parametres && affiche.accord_lecture_le && <RetirerAccord planId={ctx.cle} />}
                {!ctx.coache && affiche?.parametres && !affiche.accord_lecture_le && <DonnerAccord planId={ctx.cle} demonstration={ctx.demonstration} />}
              </div>
            </div>
            {/* Une course reportée (PL6, décision coach du 04/11/2026) ; Q5 (décision coach du 05/11/2026 au soir, « A ») : il
                nous écrit, par le lien de Compte, plus « réponds à ton e-mail de bienvenue ». Validé par le coach le 05/11/2026 (1A). */}
            {!ctx.coache && (
              <div className="flex gap-3 py-3.5">
                <span className="w-2.5 h-2.5 mt-1.5 rounded-full bg-teal shrink-0" aria-hidden />
                <div>
                  <p className="text-sm font-bold text-indigo">Ta course change de date ?</p>
                  <p className="mt-0.5 text-[0.8rem] text-[#4A4866] leading-relaxed">
                    Écris-nous avec la nouvelle date : nous voyons avec toi comment ta préparation suit.
                  </p>
                  <EcrisNous />
                </div>
              </div>
            )}
          </Carte>
        )}

        {/* Q5 (décision coach du 05/11/2026 au soir, « A », et « pour les plans, pas d'interaction avec moi ») : un acheteur
            nous écrit pour son achat ou l'app, jamais pour son entraînement. Validé par le coach le 05/11/2026 (1A ; le texte de
            la décision). */}
        {!ctx.coache && (
          <a href={ECRIRE_A_CTS} className="flex items-center justify-between gap-3 min-h-[52px] px-[18px] py-3 bg-white rounded-2xl border border-indigo/[0.08] text-sm text-indigo">
            <span>Une question sur ton achat ou sur l’app ? <strong className="text-teal whitespace-nowrap">Écris-nous ›</strong></span>
          </a>
        )}

        <Carte className="space-y-2" id="installer">
          <Surtitre>Installer l’app</Surtitre>
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

        {/* En démonstration aussi : leurs actions n'y font rien (lib/app/actionsCompte.ts). */}
        <Deconnexion />
        <Suppression acheteur={!ctx.coache} />
        {/* C43 (audits du 05/11/2026) : l'avertissement santé dans une carte comme les autres, même titre, même texte. */}
        {!ctx.coache && <Avertissement avertissement={ctx.plan.avertissement} />}
      </main>
    </>
  );
}
