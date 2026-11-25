import Link from 'next/link';
import clsx from 'clsx';
import { Carte, CarteSombre, Surtitre } from './Ui';
import type { Zones } from '@/lib/app/plan';
import { conseilsV1, decalageSeuil1, profilCoureur, STYLE_SANS_TEST_V1, texteAllureLigne, texteFc, type PreparationV1, type Profil } from '@/lib/app/zones';

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

// LA LIGNE DU SEUIL 2 (décision 19 du coach du 10/11/2026 ; texte validé le 10/11/2026) : le Seuil 2 court se court au RPE,
// sa FC n'ayant pas le temps de monter ; le tableau promettait une FC à toutes ses fractions.
export const NOTE_SEUIL2 = 'En relief, ta FC guide les blocs longs, de 6 à 15 min. Sur les fractions courtes, elle n’a pas '
  + 'le temps de monter : cours-les au ressenti, RPE 7.';
export const estSeuil2 = (nom: string) => /seuil 2/i.test(nom);

// zones : celles du plan (Plan.zones) ; lignes : ses zones et leur RPE (Plan.mode_emploi.effort.zones, sans l'en-tête).
// plat : sous la 9.x (décision 220 du coach, 24/11/2026), « Ses zones » est un morceau de la carte du coach sur son athlète (components/app/CarteSavoir.tsx) : le même tableau, sans
// cadre à lui. Sans lui, la carte d'avant (l'app de l'athlète et la 8.x n'y changent rien).
export function TableauZones({ zones, lignes, profil, titre, saisie = null, plat = false }: {
  zones: Pick<Zones, 'tableau' | 'recoupement'>; lignes: string[][]; profil: Profil; titre: string; saisie?: string | null; plat?: boolean;
}) {
  const decalage = decalageSeuil1(profil, zones);
  // Q6-e (décision coach du 05/11/2026 au soir, « A ») : sans aucun repère, le tableau se réduit aux zones et à leur RPE.
  const aucunRepere = profil.fc_seuil1 === null && profil.vc_ms === null && profil.fc_seuil2 === null && profil.v_seuil1_ms === null;
  const Cadre = plat ? Plat : Carte;
  return (
    <Cadre className={plat ? '' : '!pb-2.5'}>
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
              {/* La ligne du Seuil 2 (décision 19 du coach du 10/11/2026) : Validé par le coach le 10/11/2026. */}
              {!aucunRepere && estSeuil2(nom) && (
                <span className="col-span-full pb-2 text-[0.72rem] text-[#5E5C78] leading-relaxed">{NOTE_SEUIL2}</span>
              )}
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
    </Cadre>
  );
}

// Le même contenu sans la carte (plat).
function Plat({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={className}>{children}</div>;
}

// Le style de coureur (la règle du calculateur « Ton profil de traileur », tirée du test de vitesse critique) et ce que la
// préparation en fait ; sans test complet, la phrase C38.
// plat : sous la 9.x, le style est un morceau de la carte du coach, sur fond clair et sans cadre à lui ; sans test complet, rien (la carte dit déjà que le test manque).
// Sans lui, les cartes d'avant (l'app de l'athlète et la 8.x n'y changent rien).
// v1 : sous la 9.x, ce que le moteur v1 fait de ce style (lib/app/zones.ts, conseilsV1) ; sans lui, les textes de la 8.x.
export function StyleCoureur({ profil, titre, plat = false, v1 = null }: { profil: Pick<Profil, 'vc_ms' | 'd_prime_m'>; titre: string; plat?: boolean; v1?: PreparationV1 | null }) {
  const coureur = profilCoureur(profil);
  // null : rien à dire d'une préparation que le moteur n'écrit pas.
  const conseils = !coureur || v1 === 'sans' ? null : v1 ? conseilsV1(coureur.coefficient < 0.9) : coureur;
  const loin = v1 ? 'Loin de ton objectif' : 'Loin de ton objectif · ton point faible';
  const pres = v1 ? 'Près de ton objectif' : 'Près de ton objectif · ton point fort';
  if (plat) {
    if (!coureur) return null;
    return (
      <div className="space-y-3">
        <Surtitre as="h3">{titre}</Surtitre>
        <p className="text-lg font-extrabold">{coureur.nom}</p>
        <div className="relative h-2.5 rounded-full bg-gradient-to-r from-[#8FD1C3] to-[#2BB39B]" aria-hidden>
          <span className="absolute top-[-3px] w-0.5 h-4 bg-indigo/40" style={{ left: '50%' }} />
          <span className="absolute top-[-5px] w-5 h-5 -ml-2.5 rounded-full bg-white border-[3px] border-indigo"
            style={{ left: `${Math.max(0, Math.min(100, ((coureur.coefficient - 0.8) / 0.2) * 100))}%` }} />
        </div>
        <div className="flex justify-between text-[0.6875rem] text-[#5E5C78]"><span>plutôt rapide</span><span>plutôt endurant</span></div>
        <p className="text-[0.8125rem] leading-relaxed text-[#4A4866]">{coureur.texte}</p>
        {conseils && (
          <>
            <Conseil titre={loin} texte={conseils.loin} ton="faible" />
            <Conseil titre={pres} texte={conseils.pres} ton="fort" />
            <p className="text-[0.72rem] text-[#5E5C78] leading-relaxed">{conseils.note}</p>
          </>
        )}
      </div>
    );
  }
  if (!coureur) {
    return (
      <Carte className="space-y-1.5">
        <Surtitre>{titre}</Surtitre>
        {/* C38 : Validé par le coach le 05/11/2026 (1A). */}
        <p className="text-[0.8125rem] text-[#4A4866] leading-relaxed">
          {v1 ? STYLE_SANS_TEST_V1[v1] : 'Il se tire de ton test de vitesse critique : plutôt rapide ou plutôt endurant. Ta préparation en tient compte : ton point faible loin de ton objectif, ton point fort près de lui.'}
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
      {conseils && (
        <Carte className="space-y-3.5">
          <Conseil titre={loin} texte={conseils.loin} ton="faible" />
          <div className="h-px bg-indigo/[0.08]" />
          <Conseil titre={pres} texte={conseils.pres} ton="fort" />
          <p className="text-[0.72rem] text-[#5E5C78] leading-relaxed">{conseils.note}</p>
        </Carte>
      )}
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
