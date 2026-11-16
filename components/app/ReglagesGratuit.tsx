'use client';

import Link from 'next/link';
import { useState } from 'react';
import { changerListeEmail } from '@/lib/app/actionsGratuit';
import { effacerMaDemande } from '@/lib/app/actionsDemandesCoaching';
import { QUESTIONS_COACHING } from '@/lib/app/coachingRegles';
import { BOUTON_DANGER, BOUTON_SECONDAIRE, Carte, Surtitre } from './Ui';

// Ce que règle un compte gratuit dans « Compte » (lot A2) : les e-mails de City to Summit (la case : s'inscrire ou se
// désinscrire, la date de l'accord est gardée) et sa demande de coaching (la lire, la mettre à jour, l'effacer). Textes en
// brouillon, à valider par le coach.
export function ListeEmail({ inscrit: depart }: { inscrit: boolean }) {
  const [inscrit, setInscrit] = useState(depart);
  const [message, setMessage] = useState('');
  const [enCours, setEnCours] = useState(false);
  async function changer(voulu: boolean) {
    setEnCours(true);
    setMessage('');
    const r = await changerListeEmail(voulu);
    setInscrit(r.inscrit);
    setMessage(r.message);
    setEnCours(false);
  }
  return (
    <Carte className="space-y-2">
      <Surtitre>Les e-mails de City to Summit</Surtitre>
      <label className="flex gap-2.5 items-start text-sm text-[#4A4866] cursor-pointer">
        <input type="checkbox" className="mt-1 w-4 h-4 accent-teal" checked={inscrit} disabled={enCours} onChange={(e) => changer(e.target.checked)} />
        <span><strong className="text-indigo">Je veux les e-mails de City to Summit</strong> : la méthode, les nouvelles fiches, les ouvertures de places.</span>
      </label>
      <p className="text-xs text-[#5E5C78] leading-relaxed">Facultatif. Tu te désinscris ici, ou en un clic au bas de chaque e-mail.</p>
      {message && <p role="status" className="text-sm font-semibold text-teal-dark">{message}</p>}
    </Carte>
  );
}

export function MaDemande({ envoyeeLe }: { envoyeeLe: string }) {
  const [etat, setEtat] = useState<'vue' | 'confirmer' | 'effacee'>('vue');
  const [message, setMessage] = useState('');
  const [enCours, setEnCours] = useState(false);
  async function effacer() {
    setEnCours(true);
    const r = await effacerMaDemande();
    setEnCours(false);
    setMessage(r.message);
    if (r.ok) setEtat('effacee');
  }
  if (etat === 'effacee') return <Carte><p role="status" className="text-sm font-semibold text-teal-dark">{message}</p></Carte>;
  return (
    <Carte className="space-y-2.5">
      <Surtitre>{QUESTIONS_COACHING.compte.titre}</Surtitre>
      <p className="text-sm text-[#4A4866] leading-relaxed">{QUESTIONS_COACHING.compte.envoyeeLe(envoyeeLe)} Le coach t’appelle dans la semaine.</p>
      <p className="text-xs text-[#5E5C78] leading-relaxed">{QUESTIONS_COACHING.effacement}</p>
      {message && <p role="alert" className="text-sm text-[#9A3B2C]">{message}</p>}
      <div className="flex flex-wrap gap-2.5">
        <Link href="/app/coaching" className={BOUTON_SECONDAIRE}>Mettre à jour</Link>
        {etat === 'vue'
          ? <button type="button" onClick={() => setEtat('confirmer')} className={BOUTON_DANGER}>{QUESTIONS_COACHING.compte.effacer}</button>
          : <button type="button" onClick={effacer} disabled={enCours} className={BOUTON_DANGER}>Oui, effacer ma demande</button>}
      </div>
    </Carte>
  );
}
