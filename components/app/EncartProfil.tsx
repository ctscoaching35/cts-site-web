import Link from 'next/link';
import { lien, type Contexte } from '@/lib/app/contexte';
import { allure, testFait } from '@/lib/app/zones';

// L'encart « Ton profil » sur Aujourd'hui (cadrage §7.1, Z8) : les tests de ce plan, faits ou non ;
// une ligne seulement une fois le profil complet. Rien pour un plan sans « Tes zones ».
export default function EncartProfil({ ctx }: { ctx: Contexte }) {
  const zones = ctx.plan.zones;
  if (!zones) return null;
  const { profil } = ctx;
  const tests = zones.tests_disponibles;
  const faits = tests.filter((c) => testFait(c, profil)).length;
  const href = lien('/app/plan/zones', ctx);
  if (faits === tests.length)
    return (
      <Link href={href} className="block bg-white shadow-sm px-4 py-3 text-sm text-indigo/75 border-l-4 border-teal">
        {zones.encart.complet} <span className="text-teal font-semibold">›</span>
      </Link>
    );
  const valeur = (c: (typeof tests)[number]) =>
    c === 'parole' ? `${profil.fc_seuil1}` : c === 'fc_seuil2' ? `${profil.fc_seuil2}` : `${allure(profil.vc_ms!)}/km`;
  return (
    <section className="bg-white shadow-sm border-l-4 border-teal px-4 py-3">
      <div className="text-[0.7rem] font-semibold tracking-cts uppercase text-teal">
        {zones.encart.titre} · {faits} sur {tests.length}
      </div>
      <div className="flex gap-1 mt-2 mb-3" aria-hidden>
        {tests.map((c) => (
          <span key={c} className="flex-1 h-1.5" style={{ backgroundColor: testFait(c, profil) ? '#0C6E5F' : '#E6E8EE' }} />
        ))}
      </div>
      <ul className="space-y-1 text-sm">
        {tests.map((c) => (
          <li key={c} className={testFait(c, profil) ? 'text-indigo' : 'text-indigo/55'}>
            <span aria-hidden className={testFait(c, profil) ? 'text-teal' : ''}>{testFait(c, profil) ? '✓' : '○'}</span>{' '}
            {zones.encart.libelles[c]}{testFait(c, profil) ? ` : ${valeur(c)}` : ''}
          </li>
        ))}
      </ul>
      <Link href={href} className="inline-block mt-2 text-sm font-semibold text-teal">{zones.encart.lien} ›</Link>
    </section>
  );
}
