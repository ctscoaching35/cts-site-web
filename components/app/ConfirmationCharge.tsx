'use client';

import { useActionState, useState } from 'react';
import { confirmerMaCharge, type EtatGeste } from '@/lib/app/actionsEcriture';
import { chargeEnClair, type Charge } from '@/lib/app/invitation';
import { textes } from '@/lib/plan';
import { BOUTON, BOUTON_SECONDAIRE, Carte, Surtitre } from './Ui';

// LA CONFIRMATION DE CHARGE (décision coach du 04/11/2026 au soir, « A » ; lib/app/confirmation.ts) : de son invitation à
// la veille de son départ, l'acheteur dont l'achat date de plus de 3 semaines relit ses réponses de l'achat sur la charge.
// « Oui », ou il corrige : les deux questions du questionnaire d'achat (lib/plan.ts, textes.charge ; S9, 05/11/2026 : sans
// note ni arrêt récent), relues par le moteur ; une plus longue sortie sous 45 min part du plancher (S10). Sans réponse,
// rien ne bloque. dimanche : le soir où sa première semaine s'écrit, déjà en lettres.
// demonstration : rien n'est enregistré.
export default function ConfirmationCharge({ planId, achat, reponse, dimanche, demonstration = false }: {
  planId: string; achat: Charge; reponse: { reponse: 'oui' | 'corrige'; charge: Charge } | null; dimanche: string;
  demonstration?: boolean;
}) {
  const [etat, action, enCours] = useActionState<EtatGeste, FormData>(confirmerMaCharge.bind(null, planId), null);
  const [corriger, setCorriger] = useState(false);
  const [demo, setDemo] = useState<string | null>(null);
  const parDemo = demonstration ? (e: React.FormEvent) => { e.preventDefault(); setDemo('Démonstration : rien n’est enregistré.'); } : undefined;
  const message = demo ?? etat?.message ?? null;
  const champ = 'mt-1.5 w-full min-h-11 rounded-[10px] border border-indigo/20 px-3 text-sm font-normal text-indigo bg-white';
  const etiquette = 'block text-xs font-semibold text-indigo';
  const valeurs = reponse?.charge ?? achat;
  const note = message && <p role="status" className={etat?.ok ? 'text-sm text-teal font-semibold' : 'text-sm text-indigo'}>{message}</p>;
  if (etat?.ok) {
    return <Carte className="space-y-2"><Surtitre>Avant ta première semaine</Surtitre>{note}</Carte>;
  }
  return (
    <Carte className="space-y-3">
      <Surtitre>Avant ta première semaine</Surtitre>
      {reponse && !corriger ? (
        <>
          <p className="text-[0.875rem] text-[#4A4866] leading-relaxed">
            C’est noté : ta première semaine s’écrira {dimanche} au soir sur {chargeEnClair(reponse.charge, true)}.
          </p>
          <button type="button" onClick={() => setCorriger(true)} className="inline-flex items-center min-h-11 text-[0.8125rem] font-bold text-teal">
            Corriger ›
          </button>
        </>
      ) : (
        <>
          <p className="text-[0.9375rem] font-bold text-indigo leading-snug">
            Tu nous disais {chargeEnClair(achat, true)}. C’est toujours vrai ?
          </p>
          {!corriger && (
            <form action={action} onSubmit={parDemo} className="flex flex-wrap gap-2">
              <input type="hidden" name="reponse" value="oui" />
              <button type="submit" disabled={enCours} className={BOUTON}>
                {enCours ? 'Envoi…' : 'Oui'}
              </button>
              <button type="button" onClick={() => setCorriger(true)} className={BOUTON_SECONDAIRE}>
                Non, je corrige
              </button>
            </form>
          )}
          {corriger && (
            <form action={action} onSubmit={parDemo} className="space-y-3">
              <div className="grid sm:grid-cols-2 gap-3">
                <label className={etiquette}>{textes.charge.volume}
                  <input name="volume_hebdo_actuel" required placeholder="ex. 4h ou 4h30" defaultValue={valeurs.volume_hebdo_actuel} className={champ} />
                </label>
                <label className={etiquette}>{textes.charge.sortieLongue}
                  <input name="sortie_longue_actuelle" required placeholder="ex. 1h30 ou 90min" defaultValue={valeurs.sortie_longue_actuelle} className={champ} />
                </label>
              </div>
              <button type="submit" disabled={enCours} className={BOUTON}>
                {enCours ? 'Vérification…' : 'Enregistrer'}
              </button>
            </form>
          )}
          {/* C23 (audits du 05/11/2026) : l'heure limite, comme l'e-mail de rappel. Validé par le coach le 05/11/2026 (1A). */}
          <p className="text-xs text-[#5E5C78] leading-relaxed">
            Réponds d’ici {dimanche}, 18 h : ta première semaine s’écrit le soir même sur ta réponse ; sans réponse, sur
            celles de ton achat.
          </p>
        </>
      )}
      {note}
    </Carte>
  );
}
