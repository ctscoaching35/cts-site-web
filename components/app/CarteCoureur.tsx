import clsx from 'clsx';
import { Carte, Surtitre } from './Ui';
import { motDuGeste, ouEstLeGeste, TEXTES_PAGE_ATHLETE, type GesteDeLaCarte, type ManqueCoureur } from '@/lib/app/pageAthleteSimple';

// « SA CARTE DE COUREUR », SUR LA PAGE D'UN ATHLÈTE, SOUS LA 9.x SEULEMENT (décision 220 du coach, 24/11/2026 : ses repères, son profil de coureur, ses zones et son style
// deviennent une seule carte, comme la carte de coureur de l'app de l'athlète, app/app/profil/page.tsx). Ce qui manque saute aux yeux : un bandeau « Il manque : … » en tête,
// avec le geste qui le règle (« Remplir son profil », « Saisir son test de vitesse critique », « Modifier ses repères » : les boutons d'avant, un seul par chose, dans le bandeau quand
// la chose manque, sous elle sinon ; lib/app/pageAthleteSimple.ts, ouEstLeGeste). Les formulaires sont ceux de la page (ProfilAthlete, TestVcCoach, FormulaireValeurs), donnés en
// `formulaires` ; les lignes du profil sont celles de lignesDuProfil(profil, true), les repères ceux de la page d'avant. Ses zones et son style (ce qu'il lit dans son app) sont repliés
// dans la carte. Sous la 8.x, la page garde ses quatre blocs d'avant.
type Repere = [titre: string, valeur: string | null, source: string | null];

function GesteDeCarte({ cle, manque, ouvert = false, formulaires }: {
  cle: GesteDeLaCarte; manque: ManqueCoureur[]; ouvert?: boolean; formulaires: Record<GesteDeLaCarte, React.ReactNode>;
}) {
  return (
    <details open={ouvert}>
      <summary className="cursor-pointer inline-flex items-center min-h-11 px-4 rounded-xl border border-teal bg-white text-teal text-[0.8125rem] font-bold">{motDuGeste(cle, manque)}</summary>
      <div className="pt-3">{formulaires[cle]}</div>
    </details>
  );
}

export default function CarteCoureur({ lignesProfil, reperes, manque, profilVide, formulaires, zonesEtStyle = null }: {
  lignesProfil: [string, string][]; reperes: Repere[]; manque: ManqueCoureur[]; profilVide: boolean;
  formulaires: Record<GesteDeLaCarte, React.ReactNode>; zonesEtStyle?: React.ReactNode;
}) {
  const t = TEXTES_PAGE_ATHLETE;
  const ici = (cle: GesteDeLaCarte) => ouEstLeGeste(cle, manque) === 'carte';
  return (
    // « son-profil » : l'adresse que prennent « Son profil › » (« Mes athlètes », « À faire pour lui ») et la revue du dimanche.
    <Carte id="son-profil" className="!p-5 space-y-4 scroll-mt-6">
      <Surtitre>{t.carte}</Surtitre>

      {manque.length > 0 && (
        <div className="rounded-xl bg-[#FFF6E5] p-3.5 space-y-3">
          <p className="flex gap-2 items-start text-sm font-bold text-[#7A520D]">
            <span aria-hidden className="mt-px w-[18px] h-[18px] shrink-0 rounded-full bg-[#C8952E] text-white text-[0.6875rem] font-extrabold flex items-center justify-center">!</span>
            <span>{t.ilManque(manque.map((m) => m.texte))}</span>
          </p>
          <div className="flex flex-col items-start gap-2">
            {manque.map((m) => <GesteDeCarte key={m.cle} cle={m.cle} manque={manque} ouvert={m.cle === 'profil' && profilVide} formulaires={formulaires} />)}
          </div>
        </div>
      )}

      {lignesProfil.length > 0 && (
        <dl>
          {lignesProfil.map(([cle, valeur]) => (
            <div key={cle} className="grid grid-cols-[112px_1fr] gap-x-3 py-2.5 border-b last:border-b-0 border-indigo/[0.06] text-[0.84rem]">
              <dt className="font-semibold text-[#5E5C78]">{cle}</dt><dd>{valeur}</dd>
            </div>
          ))}
        </dl>
      )}
      {ici('profil') && <GesteDeCarte cle="profil" manque={manque} formulaires={formulaires} />}

      <div className="pt-3 border-t border-indigo/[0.07] space-y-1">
        <Surtitre as="h3" ton="gris">Ses repères</Surtitre>
        <ul className="pt-1">
          {reperes.map(([titre, valeur, d]) => (
            <li key={titre} className="flex justify-between items-center gap-3 min-h-12 border-b last:border-b-0 border-indigo/[0.06]">
              <span><span className="block text-sm font-bold">{titre}</span>
                <span className="block text-[0.72rem] text-[#5E5C78]">{valeur ? d ?? 'sur sa fiche' : 'le test s’écrira à la place d’une séance'}</span></span>
              <span className={clsx('font-extrabold', valeur ? 'text-[0.9375rem]' : 'text-[0.8125rem] text-[#8A5E10]')}>{valeur ?? 'à tester'}</span>
            </li>
          ))}
        </ul>
        {(ici('test_vc') || ici('reperes')) && (
          <div className="flex flex-col items-start gap-1 pt-2">
            {ici('test_vc') && <GesteDeCarte cle="test_vc" manque={manque} formulaires={formulaires} />}
            {ici('reperes') && <GesteDeCarte cle="reperes" manque={manque} formulaires={formulaires} />}
          </div>
        )}
      </div>

      {zonesEtStyle && (
        <details className="pt-3 border-t border-indigo/[0.07]">
          <summary className="cursor-pointer min-h-10 flex items-center text-[0.8125rem] font-bold text-teal">{t.ceQuIlLit}</summary>
          <div className="pt-3 space-y-5">{zonesEtStyle}</div>
        </details>
      )}
    </Carte>
  );
}
