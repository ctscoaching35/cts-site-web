import Link from 'next/link';
import clsx from 'clsx';
import { LIEN } from '../Ui';
import { CLASSES, type Classe, type ReponseCourseLibre } from '@/lib/app/courseLibre';
import { nomDeZone, texteAllure, texteFc } from '@/lib/app/dossierTexte';

// Les deux blocs du dossier de course que le dossier du gratuit (DossierCourse) et le dossier de l'objectif d'un acheteur ou d'un
// coaché (app/app/plan/course) partagent : le type de la course et l'effort du jour J. Leur texte est celui du moteur
// (POST /v1/course-libre) ; ils rendent le CONTENU d'une partie (la carte et son titre sont ceux de l'appelant).

// Les quatre classes et leurs seuils (doctrine du 18/11/2026 : roulant, vallonné, montagne, montagne raide).
const ECHELLE: Record<Classe, { titre: string; seuil: string }> = {
  roulant: { titre: 'Roulant', seuil: 'moins de 10 m/km' },
  vallonne: { titre: 'Vallonné', seuil: '10 à 30 m/km' },
  montagne: { titre: 'Montagne', seuil: '30 à 50 m/km' },
  montagne_raide: { titre: 'Montagne raide', seuil: '50 m/km et plus' },
};

// Le type de la course : sa phrase est celle du moteur (AF.2), l'échelle les quatre seuils.
export function TypeDeLaCourse({ classe, libelle }: { classe: Classe; libelle: string }) {
  return (
    <>
      <p className="font-bold text-indigo">{libelle}</p>
      <ol className="grid grid-cols-2 sm:grid-cols-4 gap-1.5" aria-label="Les quatre types de course">
        {CLASSES.map((k) => (
          <li key={k} aria-current={k === classe ? 'true' : undefined}
            className={clsx('rounded-xl px-2 py-2.5 text-center', k === classe ? 'bg-teal text-white' : 'bg-sand text-[#4A4866]')}>
            <span className="block text-[0.8125rem] font-extrabold">{ECHELLE[k].titre}</span>
            <span className="block text-[0.6875rem] leading-snug">{ECHELLE[k].seuil}</span>
          </li>
        ))}
      </ol>
    </>
  );
}

// L'effort du jour J : la grille du moteur, et, avec des repères, leurs FC et allures. nom : le nom d'une zone (celui de « Tes
// zones » quand le dossier en a). profilHref : où faire un test, pour qui n'a pas encore de repères (null : pas de lien).
export function EffortDuJourJ({ effort: e, nom = nomDeZone, profilHref = null }: {
  effort: ReponseCourseLibre['effort_jour_j']; nom?: (zone: string) => string; profilHref?: string | null;
}) {
  const chiffre = (liste: NonNullable<typeof e.chiffres>['plat'] | undefined, avecAllure: boolean) => (liste ?? []).map((x) => {
    const morceaux = [texteFc(x.fc), avecAllure ? texteAllure(x.allure) : null].filter(Boolean);
    return morceaux.length ? `${nom(x.zone)} : ${morceaux.join(' · ')}` : null;
  }).filter((x): x is string => Boolean(x));
  const chiffresPlat = chiffre(e.chiffres?.plat, true);
  const chiffresCote = chiffre(e.chiffres?.cote, false);
  return (
    <>
      <p className="font-semibold text-indigo">Pour {e.duree} d’effort :</p>
      <dl className="space-y-3">
        <div>
          <dt className="text-[0.75rem] font-bold text-[#5E5C78]">Sur le plat</dt>
          <dd className="font-bold text-indigo">{e.plat.libelle}</dd>
          {chiffresPlat.map((x) => <dd key={x} className="text-[0.8125rem]">{x}</dd>)}
        </div>
        <div>
          <dt className="text-[0.75rem] font-bold text-[#5E5C78]">Dans les côtes</dt>
          <dd className="font-bold text-indigo">{e.cote.libelle}</dd>
          {chiffresCote.map((x) => <dd key={x} className="text-[0.8125rem]">{x}</dd>)}
        </div>
        <div>
          <dt className="text-[0.75rem] font-bold text-[#5E5C78]">En descente</dt>
          <dd>{e.descente}</dd>
        </div>
      </dl>
      {e.note && <p className="text-[0.8125rem] font-semibold text-indigo">{e.note}</p>}
      {!e.chiffres && profilHref && (
        <Link href={profilHref} className={LIEN}>Fais ton test pour avoir tes FC et tes allures ›</Link>
      )}
    </>
  );
}
