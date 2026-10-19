import EnTeteApp from '@/components/app/EnTeteApp';
import { Avertissement } from '@/components/app/Texte';
import { Deconnexion, Suppression } from '@/components/app/BoutonsCompte';
import Installation from '@/components/app/Installation';
import { RetirerAccord } from '@/components/app/GestesEcriture';
import { contexte, type Recherche } from '@/lib/app/contexte';
import { dateLongue } from '@/lib/app/plan';
import { clientServeur, clientService } from '@/lib/app/supabase';
import { coachConnecte } from '@/lib/app/nolio';
import Link from 'next/link';

// Le compte (cadrage, 3.6) : l'e-mail, les plans (un par course), la déconnexion, la
// suppression, les liens vers les pages légales (L5). Les exports (PDF, agenda) viennent ensuite (1e).
export default async function Compte({ searchParams }: { searchParams: Recherche }) {
  const ctx = await contexte(searchParams);
  if (ctx.demonstration) {
    return (
      <>
        <EnTeteApp ctx={ctx} />
        <main className="mx-auto max-w-2xl px-4 py-5 space-y-6">
          <h1 className="text-2xl text-indigo">Compte</h1>
          <p className="text-sm text-indigo/60">Démonstration : le compte n’existe qu’avec Supabase configuré.</p>
          <section className="bg-white shadow-sm p-4 space-y-2">
            <h2 className="eyebrow text-indigo/60">Ton plan sur ton écran d’accueil</h2>
            <Installation />
          </section>
          <Avertissement avertissement={ctx.plan.avertissement} />
        </main>
      </>
    );
  }
  const supabase = await clientServeur();
  const { data } = await supabase.auth.getClaims();
  // L'accord de lecture du plan affiché (T5), pour un plan écrit semaine par semaine.
  const { data: affiche } = await clientService().from('plans').select('parametres, accord_lecture_le').eq('id', ctx.cle).maybeSingle();
  return (
    <>
      <EnTeteApp ctx={ctx} />
      <main className="mx-auto max-w-2xl px-4 py-5 space-y-5">
        <h1 className="text-2xl text-indigo">Compte</h1>
        <section className="bg-white shadow-sm p-4 space-y-1">
          <h2 className="eyebrow text-indigo/60">Ton e-mail</h2>
          <p className="text-indigo">{String(data?.claims?.email ?? '')}</p>
        </section>
        {/* La page coach (CTS_NOLIO_CADRAGE.md, N2), pour les seuls comptes de CTS_COACHS. */}
        {(await coachConnecte()) && (
          <Link href="/app/coach" className="block bg-white shadow-sm p-4 text-teal font-semibold">Espace coach ›</Link>
        )}
        {/* « Tes plans » est devenu « Mes objectifs », en tête de Mon plan (OM2, décision coach du 19/10/2026). */}
        <section className="bg-white shadow-sm p-4 space-y-2">
          <h2 className="eyebrow text-indigo/60">Ton plan sur ton écran d’accueil</h2>
          <Installation />
        </section>
        {affiche?.parametres && affiche.accord_lecture_le && (
          <section className="bg-white shadow-sm p-4 space-y-2">
            <h2 className="eyebrow text-indigo/60">Ton accord de lecture</h2>
            <p className="text-sm text-indigo/75 leading-relaxed">
              Depuis le {dateLongue(String(affiche.accord_lecture_le).slice(0, 10), true)}, l’app lit dans Nolio tes séances
              faites, ton RPE, ton ressenti et ton Hooper, et la trace de tes séances test pour en tirer tes repères,
              seulement pour ajuster ton plan et afficher tes graphiques. Sans cet accord, ton plan suit sa trame, ton
              questionnaire du dimanche et tes séances faites ou manquées, et tu donnes toi-même tes repères.
            </p>
            <RetirerAccord planId={ctx.cle} />
          </section>
        )}
        <Deconnexion />
        <Suppression />
        <Avertissement avertissement={ctx.plan.avertissement} />
        <p className="text-xs text-indigo/60 flex flex-wrap gap-x-4 gap-y-1">
          <a href="/confidentialite" className="underline underline-offset-2">Confidentialité</a>
          <a href="/cgv" className="underline underline-offset-2">Conditions de vente</a>
          <a href="/mentions-legales" className="underline underline-offset-2">Mentions légales</a>
        </p>
      </main>
    </>
  );
}
