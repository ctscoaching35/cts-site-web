'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { finaliserAchat } from '@/lib/app/actionsAchat';

// Le retour du paiement, avec les comptes : le plan se construit, se range dans le compte, et
// l'app s'ouvre (bienvenue d'abord). Un seul appel, même si React rejoue l'effet en développement.
export default function FinalisationAchat({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const lance = useRef(false);
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    if (lance.current) return;
    lance.current = true;
    if (!sessionId) {
      setErreur('Ce lien de paiement n’est pas reconnu.');
      return;
    }
    finaliserAchat(sessionId)
      .then((r) => {
        if ('erreur' in r) {
          setErreur(r.erreur);
          return;
        }
        try {
          localStorage.removeItem('cts-plan-brouillon');
        } catch {
          /* sans conséquence */
        }
        router.replace(r.destination);
      })
      .catch(() => setErreur('Le service de génération ne répond pas. Vérifie ta connexion et recharge cette page.'));
  }, [router, sessionId]);

  if (erreur) {
    return (
      <div className="bg-white border-l-4 border-red-400 p-8">
        <h1 className="text-2xl text-indigo mb-3">Un souci est survenu</h1>
        <p className="text-indigo/80 leading-relaxed">{erreur}</p>
      </div>
    );
  }
  return (
    <div className="bg-white border border-indigo/10 p-10 text-center">
      <div className="mx-auto w-10 h-10 border-4 border-teal/20 border-t-teal rounded-full animate-spin mb-6" />
      <h1 className="text-2xl text-indigo mb-2">Ton plan se construit</h1>
      <p className="text-indigo/60">Quelques secondes : chaque semaine est calculée sur ta course.</p>
    </div>
  );
}
