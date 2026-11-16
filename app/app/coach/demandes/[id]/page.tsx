import Link from 'next/link';
import { notFound } from 'next/navigation';
import ActionsDemande from '@/components/app/ActionsDemande';
import CadreCoach from '@/components/app/CadreCoach';
import DemandeLue from '@/components/app/DemandeLue';
import { Carte } from '@/components/app/Ui';
import { coachDesDemandes, demandeParId, jointesDuCompte } from '@/lib/app/demandesCoaching';
import { modeAppGratuite } from '@/lib/app/gratuitRegles';
import { exigerCoach } from '@/lib/app/nolio';
import { dateLongue } from '@/lib/app/plan';
import { espaceCoachOuvert } from '@/lib/app/supabase';

export const dynamic = 'force-dynamic';

// UNE DEMANDE DE COACHING, ENTIÈRE (app gratuite, lot A2) : ses réponses, son profil gratuit et ses courses, sa santé si le
// consentement est donné, le téléphone en lien. « Accepter » (une fiche de coaché, son espace ouvert, rien dans Nolio) ou
// « Sans suite » (la demande s'efface), chacun après confirmation. Une demande acceptée reste lisible, sans les gestes.
export default async function Demande({ params }: { params: Promise<{ id: string }> }) {
  if (!espaceCoachOuvert() || modeAppGratuite() === 'coupe') notFound();
  const coach = await exigerCoach();
  if (!coachDesDemandes(coach)) notFound();
  const { id } = await params;
  const d = await demandeParId(id);
  if (!d) notFound();
  const jointes = await jointesDuCompte(d.compte_id);
  const nom = String(d.reponses.nom ?? '').trim() || 'cette personne';
  return (
    <CadreCoach actif="demandes">
      <div className="space-y-1.5">
        <Link href="/app/coach/demandes" className="inline-flex items-center min-h-11 text-[0.8125rem] font-bold text-teal">‹ Les demandes</Link>
        <h1 className="text-[1.75rem] font-extrabold tracking-tight">{nom}</h1>
        <p className="text-sm text-[#5E5C78]">
          {d.reponses.ville ? `${d.reponses.ville} · ` : ''}demande envoyée le {dateLongue(d.envoyee_le.slice(0, 10), true)}
          {d.statut === 'acceptee' && d.traitee_le ? ` · acceptée le ${dateLongue(d.traitee_le.slice(0, 10), true)}` : ''}
        </p>
      </div>

      {d.statut === 'acceptee' ? (
        <Carte className="!p-5 space-y-1.5">
          <p className="text-sm font-bold text-teal">Demande acceptée.</p>
          {d.athlete_id && <Link href={`/app/coach/athlete/${d.athlete_id}`} className="inline-flex items-center min-h-11 text-sm font-bold text-teal">Ouvrir sa fiche ›</Link>}
        </Carte>
      ) : (
        <ActionsDemande demandeId={d.id} nom={nom} />
      )}

      <DemandeLue d={d} jointes={jointes} />
    </CadreCoach>
  );
}
