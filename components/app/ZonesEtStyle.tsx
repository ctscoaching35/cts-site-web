import Link from 'next/link';
import clsx from 'clsx';
import { Carte, CarteSombre, Surtitre } from './Ui';
import type { Zones } from '@/lib/app/plan';
import { decalageSeuil1, profilCoureur, texteAllureLigne, texteFc, type Profil } from '@/lib/app/zones';

// « Tes zones » et « Ton style de coureur », de l'onglet Profil de l'app de l'athlète (app/app/profil/page.tsx ; revu après
// les audits du 05/11/2026 : Q1, Q3, Q6-e, C38, C39) ; repris tels quels sur la page de l'athlète, côté coach (décision du
// coach du 08/11/2026, « réutilisé tel quel » ; Q9 « A » : textes au « tu », sous « Ce qu'il lit dans son app »). Un seul
// texte pour les deux : le coach voit exactement ce que lit l'athlète. titre : « Tes zones » / « Ses zones » ; saisie : le
// lien vers « Tes tests » de l'app (côté athlète seulement).

// La couleur de chaque zone, de la récupération au sprint (maquette).
const TEINTES = ['#CDE8E1', '#9FD3C5', '#5FB8A6', '#2E9C87', '#0C6E5F', '#2F5E68', '#2F2D4E'];

// Q1 : « Endurance fondamentale (EF) » ; le reste tel que le moteur le nomme.
const nomDeZone = (nom: string) => {
  const n = nom.replace(/^Zone \d\+? — /, '');
  return /^endurance fondamentale$/i.test(n) ? 'Endurance fondamentale (EF)' : n;
};

// zones : celles du plan (Plan.zones) ; lignes : ses zones et leur RPE (Plan.mode_emploi.effort.zones, sans l'en-tête).
export function TableauZones({ zones, lignes, profil, titre, saisie = null }: {
  zones: Pick<Zones, 'tableau' | 'recoupement'>; lignes: string[][]; profil: Profil; titre: string; saisie?: string | null;
}) {
  const decalage = decalageSeuil1(profil, zones);
  // Q6-e (décision coach du 05/11/2026 au soir, « A ») : sans aucun repère, le tableau se réduit aux zones et à leur RPE.
  const aucunRepere = profil.fc_seuil1 === null && profil.vc_ms === null && profil.fc_seuil2 === null && profil.v_seuil1_ms === null;
  return (
    <Carte className="!pb-2.5">
      <Surtitre>{titre}</Surtitre>
      {/* C39 : des colonnes en proportions (en 768, elles collaient à droite) ; Q6-e : sans repère, la zone et son RPE. */}
      {!aucunRepere && (
        <div className="mt-2.5 grid grid-cols-[minmax(0,1.5fr)_minmax(0,0.8fr)_minmax(0,1fr)] gap-x-2 pb-2 text-[0.625rem] font-bold tracking-[0.08em] uppercase text-[#5E5C78]">
          <span>Zone</span><span>FC</span><span>Allure</span>
        </div>
      )}
      <ul className={aucunRepere ? 'mt-2' : ''}>
        {lignes.map(([rpe, nom], i) => {
          const fc = texteFc(zones.tableau.lignes[i]?.fc, profil)?.replace(/^FC /, '') ?? null;
          const al = texteAllureLigne(zones.tableau.lignes[i], profil, decalage);
          return (
            <li key={nom} className={clsx('grid gap-x-2 items-center min-h-[46px] border-t border-indigo/[0.06] text-[0.78rem] text-indigo',
              aucunRepere ? 'grid-cols-1' : 'grid-cols-[minmax(0,1.5fr)_minmax(0,0.8fr)_minmax(0,1fr)]')}>
              <span className="flex items-center gap-2 min-w-0">
                <span className="w-2 h-[26px] rounded shrink-0" style={{ backgroundColor: TEINTES[i] ?? '#2F2D4E' }} aria-hidden />
                <span className="min-w-0">
                  <span className="block font-bold leading-tight first-letter:uppercase">{nomDeZone(nom)}</span>
                  <span className="block text-[0.656rem] text-[#5E5C78]">RPE {rpe}</span>
                </span>
              </span>
              {!aucunRepere && <span className={fc ? '' : 'text-[#5E5C78]'}>{fc ?? 'RPE seul'}</span>}
              {!aucunRepere && <span className={al ? '' : 'text-[#5E5C78]'}>{al?.replace('Plus lent que ', '> ').replace('/km', '') ?? 'RPE seul'}</span>}
            </li>
          );
        })}
      </ul>
      {aucunRepere ? (
        // Q6-e : Validé par le coach le 05/11/2026 (1A ; le texte vient de la synthèse).
        <p className="pt-2.5 pb-1 text-[0.8125rem] text-[#4A4866] leading-relaxed">
          Tes FC et tes allures s’affichent après ton premier test.{' '}
          {saisie && <Link href={saisie} className="font-bold text-teal whitespace-nowrap">Tes tests ›</Link>}
        </p>
      ) : (
        <p className="pt-2.5 pb-1.5 text-[0.72rem] text-[#5E5C78] leading-relaxed">
          Les allures valent sur le plat ; en côte, la FC et le RPE ; en descente, le RPE seul. Le RPE prime toujours.
        </p>
      )}
    </Carte>
  );
}

// Le style de coureur (la règle du calculateur « Ton profil de traileur », tirée du test de vitesse critique) et ce que la
// préparation en fait ; sans test complet, la phrase C38.
export function StyleCoureur({ profil, titre }: { profil: Pick<Profil, 'vc_ms' | 'd_prime_m'>; titre: string }) {
  const coureur = profilCoureur(profil);
  if (!coureur) {
    return (
      <Carte className="space-y-1.5">
        <Surtitre>{titre}</Surtitre>
        {/* C38 : Validé par le coach le 05/11/2026 (1A). */}
        <p className="text-[0.8125rem] text-[#4A4866] leading-relaxed">
          Il se tire de ton test de vitesse critique : plutôt rapide ou plutôt endurant. Ta préparation en tient compte :
          ton point faible loin de ton objectif, ton point fort près de lui.
        </p>
      </Carte>
    );
  }
  return (
    <>
      {/* Q3 : « Ton style de coureur » (« profil » revenait quatre fois sur l'onglet). */}
      <CarteSombre className="space-y-3">
        <Surtitre ton="clair">{titre}</Surtitre>
        <p className="text-2xl font-extrabold">{coureur.nom}</p>
        <div className="relative h-2.5 rounded-full bg-gradient-to-r from-[#8FD1C3] to-[#2BB39B]" aria-hidden>
          <span className="absolute top-[-3px] w-0.5 h-4 bg-white/70" style={{ left: '50%' }} />
          <span className="absolute top-[-5px] w-5 h-5 -ml-2.5 rounded-full bg-white border-[3px] border-indigo"
            style={{ left: `${Math.max(0, Math.min(100, ((coureur.coefficient - 0.8) / 0.2) * 100))}%` }} />
        </div>
        {/* Q1 : sans le repère chiffré du coach au milieu. */}
        <div className="flex justify-between text-[0.6875rem] text-[#D6D5E6]"><span>plutôt rapide</span><span>plutôt endurant</span></div>
        <p className="text-[0.8125rem] leading-relaxed text-[#E8E7F2]">{coureur.texte}</p>
      </CarteSombre>
      <Carte className="space-y-3.5">
        <Conseil titre="Loin de ton objectif · ton point faible" texte={coureur.loin} ton="faible" />
        <div className="h-px bg-indigo/[0.08]" />
        <Conseil titre="Près de ton objectif · ton point fort" texte={coureur.pres} ton="fort" />
        <p className="text-[0.72rem] text-[#5E5C78] leading-relaxed">{coureur.note}</p>
      </Carte>
    </>
  );
}

function Conseil({ titre, texte, ton }: { titre: string; texte: string; ton: 'faible' | 'fort' }) {
  return (
    <div className="flex gap-3">
      <span className={clsx('w-9 h-9 shrink-0 rounded-[10px] flex items-center justify-center',
        ton === 'faible' ? 'bg-[#FFF1E0] text-[#9A4A06]' : 'bg-[#E1EFEA] text-teal-dark')}>
        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          {ton === 'faible' ? <path d="M13 3 5 14h6l-1 7 8-11h-6z" /> : <path d="M3 20 9 9l4 6 3-4 5 9z" />}
        </svg>
      </span>
      <div>
        <p className="text-[0.8125rem] font-bold text-indigo">{titre}</p>
        <p className="mt-1 text-[0.8125rem] text-[#4A4866] leading-relaxed">{texte}</p>
      </div>
    </div>
  );
}
