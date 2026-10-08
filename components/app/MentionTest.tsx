import Link from 'next/link';
import { lien, type Contexte } from '@/lib/app/contexte';
import type { Jour } from '@/lib/app/plan';
import { prochaineSeanceTest, testFait, testOuvert, texteAllure } from '@/lib/app/zones';

// Sur la séance qui peut servir de test (Z1) : la prochaine seulement, tant que la valeur manque. Pour
// la FC au seuil 2, l'allure de la mesure, sur le plat (Z5 corrigée).
export default function MentionTest({ jour, ctx }: { jour: Jour; ctx: Contexte }) {
  const zones = ctx.plan.zones;
  const test = jour.reperes?.test;
  if (!zones || !test || !testOuvert(test.cle, zones, ctx.profil) || testFait(test.cle, ctx.profil)) return null;
  if (prochaineSeanceTest(ctx.plan, test.cle, ctx.jour) !== jour.id) return null;
  const allureMesure = test.allure_vc ? texteAllure(test.allure_vc, ctx.profil) : null;
  return (
    <Link href={lien('/app/plan/zones', ctx) + `#${test.cle}`} className="block bg-[#E3EFE9] px-4 py-3 text-sm text-teal font-semibold">
      {zones.mentions[test.cle]} ›
      {allureMesure && <span className="block font-normal text-indigo/75 mt-0.5">Allure des blocs : {allureMesure}</span>}
    </Link>
  );
}
