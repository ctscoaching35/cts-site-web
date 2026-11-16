'use client';

import { useState } from 'react';
import { accepterDemande, demandeSansSuite } from '@/lib/app/actionsDemandesCoaching';
import { BOUTON, BOUTON_DANGER, BOUTON_SECONDAIRE, Carte } from './Ui';

// « Accepter » et « Sans suite » d'une demande de coaching (app gratuite, lot A2), chacun derrière une confirmation qui dit ce
// qui va se passer. Textes en brouillon, à valider par le coach.
export default function ActionsDemande({ demandeId, nom }: { demandeId: string; nom: string }) {
  const [etape, setEtape] = useState<'vue' | 'accepter' | 'sans_suite'>('vue');
  const [message, setMessage] = useState('');
  const [enCours, setEnCours] = useState(false);

  async function lancer(geste: typeof accepterDemande) {
    setEnCours(true);
    setMessage('');
    // Un succès redirige (la page de l'athlète, ou la liste) ; seul un refus revient ici.
    const r = await geste(demandeId);
    if (r && !r.ok) {
      setMessage(r.message);
      setEnCours(false);
    }
  }

  if (etape === 'accepter') {
    return (
      <Carte className="space-y-3 border-teal/40">
        <p className="text-sm font-bold text-indigo">Accepter la demande de {nom} ?</p>
        <ul className="list-disc pl-5 space-y-1 text-[0.8125rem] text-[#4A4866] leading-relaxed">
          <li>Une fiche de coaché est créée à ce nom, avec sa vitesse critique du profil gratuit ; ses FC n’y sont reprises que si son consentement FC est donné.</li>
          <li>Son espace s’ouvre : la personne reçoit l’e-mail d’invitation à l’app, et s’y connecte avec le même e-mail.</li>
          <li>La demande passe en « acceptée » et reste lisible sur la fiche.</li>
          <li>Rien n’est écrit dans Nolio. Tu arrives sur sa page, où « Son entrée » montre la suite (Nolio, objectif).</li>
        </ul>
        {message && <p role="alert" className="text-sm text-[#9A3B2C]">{message}</p>}
        <div className="flex flex-wrap gap-2.5">
          <button type="button" disabled={enCours} onClick={() => lancer(accepterDemande)} className={BOUTON}>Oui, accepter</button>
          <button type="button" disabled={enCours} onClick={() => { setEtape('vue'); setMessage(''); }} className={BOUTON_SECONDAIRE}>Annuler</button>
        </div>
      </Carte>
    );
  }
  if (etape === 'sans_suite') {
    return (
      <Carte className="space-y-3 border-[#9A3B2C]/30">
        <p className="text-sm font-bold text-indigo">Classer la demande de {nom} sans suite ?</p>
        <p className="text-[0.8125rem] text-[#4A4866] leading-relaxed">
          La demande est effacée tout de suite, sans retour possible. Aucun e-mail ne part : tu l’as dit à la personne à l’appel.
        </p>
        {message && <p role="alert" className="text-sm text-[#9A3B2C]">{message}</p>}
        <div className="flex flex-wrap gap-2.5">
          <button type="button" disabled={enCours} onClick={() => lancer(demandeSansSuite)} className={BOUTON_DANGER}>Oui, effacer la demande</button>
          <button type="button" disabled={enCours} onClick={() => { setEtape('vue'); setMessage(''); }} className={BOUTON_SECONDAIRE}>Annuler</button>
        </div>
      </Carte>
    );
  }
  return (
    <div className="flex flex-wrap gap-2.5">
      <button type="button" onClick={() => setEtape('accepter')} className={BOUTON}>Accepter</button>
      <button type="button" onClick={() => setEtape('sans_suite')} className={BOUTON_SECONDAIRE}>Sans suite</button>
    </div>
  );
}
