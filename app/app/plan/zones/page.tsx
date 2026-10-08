import Link from 'next/link';
import { notFound } from 'next/navigation';
import EnTeteApp from '@/components/app/EnTeteApp';
import FormulaireZones from '@/components/app/FormulaireZones';
import { effacerZones } from '@/lib/app/actionsZones';
import { contexte, lien, type Recherche } from '@/lib/app/contexte';
import { dateLongue, type CleTest } from '@/lib/app/plan';
import { allure, kmh, remplir, testFait, testOuvert, valeursChange, type Profil } from '@/lib/app/zones';

// « Tes zones » (cadrage de l'app §7.1, textes validés par le coach le 08/10/2026) : trois tests de
// terrain, leur protocole, ce qu'ils changent au plan, leurs limites et leurs sources, et la saisie.
// Le RPE prime. Un plan d'avant le moteur v8.311 n'a pas la rubrique.

function valeurAffichee(cle: CleTest, p: Profil) {
  if (cle === 'parole' && p.fc_seuil1 !== null) return { valeur: `${p.fc_seuil1} bpm`, le: p.fc_seuil1_le };
  if (cle === 'vitesse_critique' && p.vc_ms !== null)
    return {
      valeur: `${kmh(p.vc_ms)} km/h (${allure(p.vc_ms)}/km)${p.d_prime_m !== null ? ` · D′ ${Math.round(p.d_prime_m)} m` : ''}`,
      le: p.vc_le,
    };
  if (cle === 'fc_seuil2' && p.fc_seuil2 !== null) return { valeur: `${p.fc_seuil2} bpm`, le: p.fc_seuil2_le };
  return null;
}

export default async function TesZones({ searchParams }: { searchParams: Recherche }) {
  const ctx = await contexte(searchParams);
  const { plan, profil } = ctx;
  const zones = plan.zones;
  if (!zones) notFound();
  const valeurs = valeursChange(profil) ?? {};
  const consentementDonne = (['parole', 'vitesse_critique', 'fc_seuil2'] as const).some((c) => testFait(c, profil));
  const tests = zones.tests.filter((t) => zones.tests_disponibles.includes(t.cle));
  return (
    <>
      <EnTeteApp ctx={ctx} />
      <main className="mx-auto max-w-2xl px-4 py-5 space-y-5">
        <Link href={lien('/app/plan', ctx)} className="text-teal font-semibold text-sm">‹ Mon plan</Link>
        <h1 className="text-2xl text-indigo">{zones.titre}</h1>
        {zones.intro.map((p) => (
          <p key={p} className="text-indigo/80 leading-relaxed">{p}</p>
        ))}
        <p className="bg-white border-l-4 border-teal shadow-sm p-4 text-indigo leading-relaxed font-semibold">{zones.rpe_decide}</p>

        {tests.map((t) => {
          const fait = valeurAffichee(t.cle, profil);
          const ouvert = testOuvert(t.cle, zones, profil);
          const change = t.change.map((m) => remplir(m, valeurs));
          return (
            <section key={t.cle} id={t.cle} className="bg-white shadow-sm p-4 space-y-3 scroll-mt-20">
              <h2 className="text-lg text-indigo leading-snug">{t.titre}</h2>
              {fait && (
                <p className="text-sm font-semibold text-teal">
                  Ta valeur : {fait.valeur}{fait.le ? ` · le ${dateLongue(fait.le, true)}` : ''}
                </p>
              )}
              <div className="text-sm text-indigo/80 leading-relaxed space-y-2">
                <p><strong className="text-indigo">Ce qu’il mesure.</strong> {t.mesure}</p>
                <p><strong className="text-indigo">Pour qui.</strong> {t.pour_qui}</p>
                <p><strong className="text-indigo">Quand.</strong> {t.quand}</p>
                {t.materiel.length > 0 && (
                  <div>
                    <strong className="text-indigo">Ce qu’il te faut.</strong>
                    <ul className="list-disc pl-5 mt-1 space-y-0.5">{t.materiel.map((m) => <li key={m}>{m}</li>)}</ul>
                  </div>
                )}
                <div>
                  <strong className="text-indigo">{t.cle === 'fc_seuil2' ? 'Comment.' : 'Le test.'}</strong>
                  <ol className="list-decimal pl-5 mt-1 space-y-1">{t.etapes.map((e) => <li key={e}>{e}</li>)}</ol>
                </div>
                {t.duree && <p>{t.duree}</p>}
                <div>
                  <strong className="text-indigo">Ce que ça change dans ton plan.</strong>
                  <ul className="list-disc pl-5 mt-1 space-y-0.5">
                    {t.change.map((m, i) => <li key={m}>{change[i] ?? t.change_general[i]}</li>)}
                  </ul>
                </div>
                {t.limites && <p><strong className="text-indigo">Ses limites.</strong> {t.limites}</p>}
                <p className="text-xs text-indigo/55 italic">Sources : {t.sources}</p>
              </div>
              {ouvert ? (
                <FormulaireZones
                  cle={t.cle}
                  planId={ctx.cle}
                  consentement={zones.consentement}
                  consentementDonne={consentementDonne}
                  valeurActuelle={t.cle === 'parole' ? (profil.fc_seuil1?.toString() ?? null)
                    : t.cle === 'fc_seuil2' ? (profil.fc_seuil2?.toString() ?? null) : (profil.vc_ms !== null ? 'fait' : null)}
                  demonstration={ctx.demonstration}
                />
              ) : (
                <p className="text-sm text-indigo/60">Ce test s’ouvre une fois ta vitesse critique enregistrée.</p>
              )}
            </section>
          );
        })}

        {consentementDonne && !ctx.demonstration && (
          <form action={effacerZones.bind(null, ctx.cle)}>
            <button type="submit" className="text-sm font-semibold text-red-700 underline underline-offset-2">{zones.effacer}</button>
          </form>
        )}
      </main>
    </>
  );
}
