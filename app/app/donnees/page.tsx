import EnTeteApp from '@/components/app/EnTeteApp';
import { GraphiqueCharge, GraphiqueHooper, GraphiqueVolume } from '@/components/app/TableauDeBord';
import { Carte } from '@/components/app/Ui';
import { contexte, type Recherche } from '@/lib/app/contexte';
import { barresDeVolume, pointsHooper } from '@/lib/app/tableau';
import { donneesTableau } from '@/lib/app/tableauDuPlan';

// Mes données (CTS_NOLIO_CADRAGE.md dans le dépôt du moteur, AP1, AP3, T10 ; maquette validée par le coach le
// 19/10/2026) : la charge faite seule (RPE de séance × durée) et sa moyenne sur 4 semaines, le volume en heures fait
// contre prévu, le Hooper du dimanche et sa zone habituelle. Tout vient de la base, rangé chaque dimanche soir.
export default async function MesDonnees({ searchParams }: { searchParams: Recherche }) {
  const ctx = await contexte(searchParams);
  const d = await donneesTableau(ctx);
  // Les 8 dernières semaines faites, la semaine en cours et les 3 qui viennent.
  const toutes = d.ecrit ? barresDeVolume(d.trame, d.realises, ctx.jour) : [];
  const futur = toutes.findIndex((b) => b.moment === 'avenir');
  const barres = futur < 0 ? toutes : toutes.slice(0, futur + 3);
  const points = d.accord ? pointsHooper(d.trame, d.realises, ctx.jour) : [];
  const rien = !d.realises.length;
  return (
    <>
      <EnTeteApp ctx={ctx} />
      <main className="mx-auto max-w-2xl px-4 pt-5 pb-6 space-y-4">
        <div>
          <h1 className="text-[1.625rem] font-extrabold text-indigo tracking-tight">Mes données</h1>
          <p className="mt-1.5 text-[0.8125rem] text-[#5E5C78] leading-relaxed">
            {d.accord ? 'Lues dans Nolio avec ton accord, mises à jour chaque dimanche soir.'
              : 'Tes séances faites ou manquées et leur durée, mises à jour chaque dimanche soir.'}
          </p>
        </div>
        {rien && (
          <Carte className="text-sm text-[#4A4866] leading-relaxed">
            <p>Tes premières données arrivent le dimanche soir qui suit ta première semaine : ta charge, ton volume et ton Hooper, semaine après semaine.</p>
          </Carte>
        )}
        {d.accord && <GraphiqueCharge realises={d.realises} />}
        <GraphiqueVolume barres={barres} />
        {d.accord && <GraphiqueHooper points={points} />}
        {!d.accord && !rien && (
          <Carte className="text-[0.8125rem] text-[#4A4866] leading-relaxed">
            <p>Ta charge et ton Hooper s’affichent avec ton accord de lecture : l’app lit alors dans Nolio ton effort ressenti et ton Hooper.</p>
          </Carte>
        )}
      </main>
    </>
  );
}
