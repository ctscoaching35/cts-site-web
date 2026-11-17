import Link from 'next/link';
import type { ReactNode } from 'react';
import EnTeteCourse from '../EnTeteCourse';
import ProfilCourse from '../ProfilCourse';
import RepartitionPentes from '../RepartitionPentes';
import { Partie, Puces, Tableau } from '../Texte';
import { EffortDuJourJ, TypeDeLaCourse } from './BlocsCourse';
import { Carte, LIEN, Surtitre } from '../Ui';
import { nomDeLaCourse, pentesPourBarres, type Dossier } from '@/lib/app/courseLibre';
import { dateLongue } from '@/lib/app/plan';
import { lignesDeZones, lignesDesEtapes, nomDeZone, ORDRE_ZONES, texteAllure, texteFc } from '@/lib/app/dossierTexte';

// Le dossier d'une course sans plan (lot B, maquette « Course » validée le 16/11/2026) : ce que la course demande au corps, l'effort
// du jour J, les zones, une séance type par zone, la nutrition. Les phrases viennent du moteur (POST /v1/course-libre, textes AF
// du moteur 8.470), affichées telles qu'il les rend ; le site ne met que les titres de sections et les liens. Aucun texte ne
// parle de « ta préparation » ni de « ton plan ».
// Ce composant ne lit rien (ni session ni base) : le visiteur (dans son navigateur), le compte gratuit et l'acheteur (sur le
// serveur) l'affichent de la même façon. Les gestes (partager, supprimer, effacer la stratégie) arrivent en `partager`, `pied`
// et `effacerStrategie`, déjà bâtis par la page.
export type FicheDeCourse = { slug: string; titre: string; texte: string };

const titreDeSection = 'pt-3 text-[1.25rem] font-extrabold text-indigo tracking-tight scroll-mt-20';

export default function DossierCourse({ dossier, fiches, fiche, nutritionHref, profilHref, partager, effacerStrategie = null, avant = null, pied = null }: {
  dossier: Dossier; fiches: FicheDeCourse[]; fiche: (slug: string) => string; nutritionHref: string | null;
  // Où faire un test (le profil de l'app gratuite) ; null pour qui n'a plus l'app gratuite (un acheteur).
  profilHref: string | null;
  partager: ReactNode; effacerStrategie?: ReactNode; avant?: ReactNode; pied?: ReactNode;
}) {
  const { reponse: r, strategie } = dossier;
  const c = r.course;
  const e = r.effort_jour_j;
  const zones = lignesDeZones(r);
  const barres = pentesPourBarres(r);
  const t = r.profil.troncons;
  const nom = (z: string) => zones.find((l) => l.zone === z)?.libelle ?? nomDeZone(z);
  const lignesEntete: [string, string][] = [
    ['Date', dateLongue(c.date, true)],
    ['Distance', `${String(c.distance_km).replace('.', ',')} km`],
    ['Dénivelé', `${Math.round(c.dplus_m)} m D+`],
    ['Densité', `${Math.round(c.densite_mkm)} m D+/km`],
    ['Temps cible', c.temps_cible],
  ];
  return (
    <div className="space-y-5">
      <EnTeteCourse surtitre="Ton dossier de course" nom={nomDeLaCourse(r)} lignes={lignesEntete} />
      {avant}

      {/* Le type de la course : sa phrase est celle du moteur (AF.2), l'échelle les trois seuils. */}
      <Partie titre="Le type de ta course">
        <TypeDeLaCourse classe={c.classe} libelle={c.classe_libelle} />
      </Partie>

      {/* Le profil : fin, comme dans l'app des acheteurs ; sans trace, la phrase du moteur. */}
      <Partie titre="Profil de la course">
        {c.trace_ignoree && (
          <p className="font-semibold text-indigo">Ta trace GPX n’a pas pu être lue : le dossier part de la distance et du dénivelé que tu as donnés.</p>
        )}
        {r.profil.points && !c.trace_ignoree ? (
          <>
            <ProfilCourse points={r.profil.points} />
            {barres && <RepartitionPentes pentes={barres} />}
          </>
        ) : (
          r.profil.sans_trace && <p>{r.profil.sans_trace}</p>
        )}
      </Partie>
      {t && (t.homogene || t.tableau) && (
        <Partie titre={t.titre}>
          {t.homogene ? <p>{t.homogene}</p> : t.tableau && <Tableau lignes={t.tableau} />}
        </Partie>
      )}

      <h2 className={titreDeSection}>{r.determinants.titre}</h2>
      <Partie titre={r.determinants.physio.titre}>
        <Puces puces={r.determinants.physio.puces} />
      </Partie>
      {r.determinants.mecanique ? (
        <Partie titre={r.determinants.mecanique.titre}>
          <Puces puces={r.determinants.mecanique.puces} />
        </Partie>
      ) : r.determinants.sans_trace && (
        <Partie titre="La mécanique de la course"><p>{r.determinants.sans_trace}</p></Partie>
      )}

      {/* L'effort du jour J : la grille du moteur, et, avec des repères, leurs FC et allures. */}
      <h2 id="jour-j" className={titreDeSection}>Ton effort le jour J</h2>
      <Partie titre="Selon le terrain">
        <EffortDuJourJ effort={e} nom={nom} profilHref={profilHref} />
      </Partie>

      {/* Tes zones, avec les repères du profil. */}
      {zones.length > 0 ? (
        <Carte className="!pb-2.5">
          <Surtitre>Tes zones</Surtitre>
          <div className="mt-2.5 grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1.2fr)] gap-x-2 pb-2 text-[0.625rem] font-bold tracking-[0.08em] uppercase text-[#5E5C78]">
            <span>Zone</span><span>FC</span><span>Allure</span>
          </div>
          <ul>
            {zones.map((z) => (
              <li key={z.zone} className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1.2fr)] gap-x-2 items-center min-h-[46px] border-t border-indigo/[0.06] text-[0.78rem] text-indigo">
                <span className="font-bold leading-tight">{z.libelle}</span>
                <span className={texteFc(z.fc) ? '' : 'text-[#5E5C78]'}>{texteFc(z.fc)?.replace(/^FC /, '') ?? '—'}</span>
                <span className={texteAllure(z.allure) ? '' : 'text-[#5E5C78]'}>{texteAllure(z.allure)?.replace(' /km', '') ?? '—'}</span>
              </li>
            ))}
          </ul>
          {profilHref && (r.zones?.manque?.length ?? 0) > 0 && <Link href={profilHref} className={LIEN}>Compléter mes tests ›</Link>}
        </Carte>
      ) : profilHref && (
        <Carte className="space-y-1.5">
          <Surtitre>Tes zones</Surtitre>
          <p className="text-[0.8125rem] text-[#4A4866] leading-relaxed">Avec un test, tes zones s’affichent ici, avec tes FC et tes allures.</p>
          <Link href={profilHref} className={LIEN}>Faire un test ›</Link>
        </Carte>
      )}

      {/* Une séance type par zone : des exemples, jamais un programme (AF.7). */}
      {r.seances_types.length > 0 && (
        <Partie titre="Une séance type par zone">
          <p className="font-semibold text-indigo">Des exemples, pas un plan.</p>
          <div>
            {[...r.seances_types].sort((a, b) => ORDRE_ZONES.indexOf(a.zone) - ORDRE_ZONES.indexOf(b.zone)).map((s) => (
              <details key={s.code} className="border-t first:border-t-0 border-indigo/[0.06]">
                <summary className="cursor-pointer min-h-12 flex items-center justify-between gap-3 py-2">
                  <span className="min-w-0">
                    <span className="block text-sm font-bold text-indigo">{nom(s.zone)}</span>
                    <span className="block text-[0.75rem] text-[#5E5C78]">{s.code} · {s.duree_min} min</span>
                  </span>
                  <span aria-hidden className="text-[#5E5C78]">›</span>
                </summary>
                <div className="pb-3 space-y-2">
                  <ul className="space-y-1 text-[0.8125rem] text-indigo">
                    {lignesDesEtapes(s.etapes).map((l, i) => <li key={`${i}-${l}`}>{l}</li>)}
                  </ul>
                  <p className="text-[0.8125rem] leading-relaxed">{s.consigne}</p>
                </div>
              </details>
            ))}
          </div>
        </Partie>
      )}

      {/* La nutrition du jour J : le calculateur, au niveau de l'expérience du profil. */}
      <h2 className={titreDeSection}>Ta nutrition en course</h2>
      <Partie titre="Avec le calculateur City to Summit">
        {strategie ? (
          <div className="bg-sand rounded-xl px-4 py-3">
            {strategie.le && <p className="text-xs text-[#5E5C78]">Gardée le {dateLongue(strategie.le).replace(/^\S+ /, '')}</p>}
            <dl className="mt-1">
              {strategie.cartes.map((k) => (
                <div key={k.nom} className="grid grid-cols-[6.5rem_1fr] gap-3 py-2 border-b last:border-b-0 border-indigo/[0.08]">
                  <dt className="text-sm font-bold text-indigo">{k.nom}</dt>
                  <dd className="text-sm text-indigo">{k.valeur}{k.sous ? <span className="text-[#4A4866]"> {k.sous}</span> : null}</dd>
                </div>
              ))}
            </dl>
          </div>
        ) : (
          <p>
            Ta stratégie de course se construit avec le calculateur : il part de ta durée et de ton niveau, et tient compte de ton
            intestin, de la chaleur et de ta sueur. Glucides, boisson, sodium et caféine, heure par heure.
            {nutritionHref && ' Garde-la : elle s’inscrit ici, sans avoir à la refaire.'}
          </p>
        )}
        {nutritionHref && (
          <Link href={nutritionHref} className="inline-flex items-center justify-center min-h-12 px-5 rounded-xl bg-teal text-white text-sm font-bold text-center">
            {strategie ? 'Modifier ma stratégie' : 'Construis ta stratégie de course'}
          </Link>
        )}
        {strategie && effacerStrategie}
      </Partie>

      {fiches.length > 0 && (
        <div>
          <h3 className="text-[0.6875rem] font-bold tracking-[0.12em] uppercase text-[#5E5C78]">À lire avant ta course</h3>
          <ul className="mt-1 bg-white rounded-2xl border border-indigo/[0.08] px-[18px]">
            {fiches.map((f) => (
              <li key={f.slug} className="border-b last:border-b-0 border-indigo/[0.06]">
                <Link href={fiche(f.slug)} className="flex items-center justify-between gap-3 min-h-[52px] py-2">
                  <span className="min-w-0">
                    <span className="block text-sm font-bold text-indigo">{f.titre}</span>
                    <span className="block text-[0.75rem] text-[#5E5C78] mt-0.5 leading-snug">{f.texte}</span>
                  </span>
                  <span aria-hidden className="text-[#5E5C78]">›</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {partager}
      {pied}
    </div>
  );
}

