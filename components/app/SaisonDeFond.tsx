import Link from 'next/link';
import clsx from 'clsx';
import { Carte, CarteSombre, Surtitre } from './Ui';
import type { LigneTrame } from '@/lib/app/ecriture';
import { dateLongue, joursEntre, type Plan } from '@/lib/app/plan';

// La saison de fond dans l'app (décisions coach du 24/10/2026, mesure 7 : « le bloc et le compte à rebours des tests »,
// jamais « semaine N sur M »). Ce que chaque thème travaille, dans les mots de l'app.
const TRAVAIL: Record<string, string> = {
  Vitesse: 'Tu travailles ta vitesse : VO2max, côtes courtes, accélérations. Ton seuil revient en rappel.',
  Seuil: 'Tu travailles ton seuil : blocs de seuil, montées longues. Ta vitesse revient en rappel.',
};
const dateCourte = (iso: string) => new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', timeZone: 'UTC' })
  .format(new Date(`${iso}T12:00:00Z`));
const enSemaines = (jours: number) => {
  const n = Math.max(0, Math.round(jours / 7));
  return n <= 0 ? 'cette semaine' : `dans ${n} semaine${n > 1 ? 's' : ''}`;
};

// L'accueil : à la place de « Ton prochain objectif majeur ».
export function CarteSaison({ plan, ligne, jour, href }: { plan: Plan; ligne: LigneTrame | null; jour: string; href: string }) {
  const fond = plan.fond as NonNullable<Plan['fond']>;
  const tests = Boolean(ligne?.tests);
  const theme = ligne?.theme ?? null;
  return (
    <CarteSombre className="space-y-3">
      <Surtitre ton="clair" as="div">Ta saison de fond</Surtitre>
      <div className="flex justify-between items-start gap-3">
        <div className="min-w-0">
          <h2 className="text-[1.625rem] font-extrabold leading-tight">
            {tests ? 'Semaine de tests' : ligne?.type === 'Assimilation' ? 'Semaine allégée' : theme ? `Bloc ${theme}` : `Saison ${fond.saison}`}
          </h2>
          <p className="mt-1.5 text-[0.8125rem] text-[#D6D5E6]">Du {dateCourte(fond.debut)} au {dateCourte(fond.fin)}</p>
        </div>
        {!tests && (
          <div className="shrink-0 text-center bg-white/10 rounded-xl px-3 py-2.5">
            <div className="text-[0.6875rem] text-[#D6D5E6]">Tes tests</div>
            <div className="text-base font-extrabold leading-tight">{enSemaines(joursEntre(jour, fond.tests_le))}</div>
          </div>
        )}
      </div>
      <p className="text-[0.875rem] leading-relaxed">
        {tests ? 'Vitesse critique et test de la parole : tes zones et ton profil à jour, et le thème de ta saison suivante.'
          : theme ? TRAVAIL[theme] ?? '' : 'Une saison pour progresser entre deux objectifs, un thème par bloc.'}
      </p>
      <Link href={href} className="inline-flex items-center min-h-11 px-4 rounded-full bg-white text-indigo text-[0.8125rem] font-bold">
        Voir ma saison
      </Link>
    </CarteSombre>
  );
}

// « Mon plan » : la saison bloc par bloc, l'entrée et les tests.
export function BlocsDeLaSaison({ trame, jour }: { trame: LigneTrame[]; jour: string }) {
  type Etape = { cle: string; titre: string; texte: string; du: string; au: string };
  const etapes: Etape[] = [];
  trame.forEach((l, i) => {
    const au = l.lundi ? new Date(Date.parse(`${l.lundi}T12:00:00Z`) + 6 * 86400_000).toISOString().slice(0, 10) : '';
    if (l.tests) {
      etapes.push({ cle: `tests-${i}`, titre: i === 0 ? 'Entrée · tests' : 'Semaine de tests',
        texte: i === 0 ? 'Tes repères refaits avant de commencer : vitesse critique et test de la parole.'
          : 'Vitesse critique et test de la parole : tes zones et ton profil à jour, et le thème de ta saison suivante.',
        du: l.lundi, au });
      return;
    }
    const derniere = etapes[etapes.length - 1];
    // Un bloc : ses trois semaines de charge et sa semaine allégée, sous le même thème.
    if (derniere && derniere.cle.startsWith('bloc') && derniere.titre === `Bloc ${l.theme}` && !(trame[i - 1]?.type === 'Assimilation')) {
      derniere.au = au;
      return;
    }
    etapes.push({ cle: `bloc-${i}`, titre: `Bloc ${l.theme ?? ''}`, texte: TRAVAIL[l.theme ?? ''] ?? '', du: l.lundi, au });
  });
  return (
    <Carte className="!pb-1.5">
      <Surtitre>Ta saison, bloc par bloc</Surtitre>
      <p className="mt-1 mb-1 text-xs text-[#5E5C78] leading-relaxed">
        Trois blocs de quatre semaines, la dernière allégée, ton terrain chaque semaine ; tes séances s’écrivent chaque
        dimanche dans Nolio.
      </p>
      <ol>
        {etapes.map((e) => {
          const moment = e.au < jour ? 'fait' : e.du <= jour ? 'encours' : 'avenir';
          return (
            <li key={e.cle} className={clsx('grid grid-cols-[22px_1fr] gap-x-2.5 py-3 border-t border-indigo/[0.06] first:border-t-0',
              moment === 'encours' && 'bg-[#E1EFEA] -mx-2.5 px-2.5 rounded-xl border-t-0')}>
              <span aria-hidden className={clsx('mt-0.5 w-[18px] h-[18px] rounded-full',
                moment === 'fait' ? 'bg-teal' : moment === 'encours' ? 'bg-teal-dark' : 'border-2 border-indigo/25')} />
              <span className="min-w-0">
                <span className="flex items-baseline justify-between gap-3">
                  <span className={clsx('text-sm text-indigo', moment === 'encours' ? 'font-extrabold' : 'font-bold')}>
                    {e.titre}{moment === 'encours' && <span className="ml-2 text-[0.6875rem] font-bold text-teal-dark">tu es ici</span>}
                  </span>
                  <span className="text-xs font-bold text-[#5E5C78] whitespace-nowrap">{dateLongue(e.du, true).replace(/^\S+ /, '')}</span>
                </span>
                {e.texte && <span className="block mt-1 text-[0.78rem] text-[#4A4866] leading-snug">{e.texte}</span>}
              </span>
            </li>
          );
        })}
      </ol>
    </Carte>
  );
}
