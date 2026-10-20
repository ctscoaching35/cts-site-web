import EnTeteApp from '@/components/app/EnTeteApp';
import ToutesLesFiches from '@/components/app/ToutesLesFiches';
import { lireBibliotheque } from '@/lib/app/bibliotheque';
import { contexte, lien, type Recherche } from '@/lib/app/contexte';

// La bibliothèque (cadrage, 3.5 ; décisions coach des 07 et 11/10/2026 ; AP1 et maquette validée le 19/10/2026) :
// toutes les fiches par famille, avec une recherche. Plus de « Pour ta préparation » en tête ni de calculateurs
// (décisions coach du 20/10/2026 : des doublons ; la nutrition se construit depuis Ton jour J, le profil se lit dans
// l'onglet Profil, et les fiches les ouvrent toujours) ; la fiche du moment reste sur l'accueil.
export default async function Bibliotheque({ searchParams }: { searchParams: Recherche }) {
  const ctx = await contexte(searchParams, { sansObjectif: true });
  const familles = lireBibliotheque();
  const params = new URLSearchParams(lien('', ctx).split('?')[1] ?? '').toString();
  const suite = params ? `?${params}` : '';
  return (
    <>
      <EnTeteApp ctx={ctx} />
      <main className="mx-auto max-w-2xl px-4 pt-5 pb-6 space-y-4">
        <div>
          <h1 className="text-[1.625rem] font-extrabold text-indigo tracking-tight">Bibliothèque</h1>
          <p className="mt-1.5 text-[0.8125rem] text-[#5E5C78] leading-relaxed">Les fiches de tes coachs, kinés du sport, fondées sur la littérature.</p>
        </div>

        <ToutesLesFiches familles={familles} suite={suite} />
      </main>
    </>
  );
}
