'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { API_URL } from '@/lib/plan';

type Resume = {
  athlete: string;
  email: string;
  course: string;
  date_course: string;
  date_debut_plan: string;
  duree_mois: number;
  // Trace GPX inexploitable, mise de côté au checkout (décision coach du 26/09/2026).
  trace_ignoree?: boolean;
};

// « le 1er février », jamais « le 1 février » (audit du 27/09/2026, K2).
const dateFr = (iso: string) =>
  new Date(`${iso}T00:00:00`)
    .toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    .replace(/^1 /, '1er ');

export default function Merci() {
  const sessionId = useSearchParams().get('session_id') || '';
  const [etat, setEtat] = useState<'generation' | 'pret' | 'erreur'>('generation');
  const [message, setMessage] = useState('');
  const [pdfUrl, setPdfUrl] = useState('');
  const [resume, setResume] = useState<Resume | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setEtat('erreur');
      setMessage('Ce lien de paiement n’est pas reconnu.');
      return;
    }
    fetch(`${API_URL}/v1/plans`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ checkout_session_id: sessionId }),
    })
      .then(async (r) => {
        const corps = await r.json().catch(() => null);
        if (!r.ok) throw new Error(corps?.message || 'Ton plan n’a pas pu être généré.');
        setPdfUrl(`${API_URL}${corps.pdf_url}`);
        setResume(corps.resume);
        setEtat('pret');
        try {
          localStorage.removeItem('cts-plan-brouillon');
        } catch {
          /* sans conséquence */
        }
      })
      .catch((e: Error) => {
        // Une coupure réseau fait rejeter fetch avec un TypeError au message technique du
        // navigateur (« Failed to fetch », « Load failed ») : on ne montre que les messages
        // écrits par l'API (audit du 27/09/2026, C20).
        setMessage(
          e instanceof TypeError
            ? 'Le service de génération ne répond pas. Vérifie ta connexion et recharge cette page.'
            : e.message || 'Le service de génération ne répond pas.',
        );
        setEtat('erreur');
      });
  }, [sessionId]);

  if (etat === 'generation') {
    return (
      <div className="bg-white border border-indigo/10 p-10 text-center">
        <div className="mx-auto w-10 h-10 border-4 border-teal/20 border-t-teal rounded-full animate-spin mb-6" />
        <h1 className="text-2xl text-indigo mb-2">Ton plan se construit</h1>
        <p className="text-indigo/60">Quelques secondes : chaque semaine est calculée sur ta course.</p>
      </div>
    );
  }

  if (etat === 'erreur') {
    return (
      <div className="bg-white border-l-4 border-red-400 p-8">
        <h1 className="text-2xl text-indigo mb-3">Un souci est survenu</h1>
        <p className="text-indigo/80 leading-relaxed">{message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="bg-indigo text-white p-8 sm:p-10">
        <div className="eyebrow text-teal-light mb-3">Plan prêt</div>
        <h1 className="text-3xl sm:text-4xl mb-4">Ton plan est prêt{resume ? `, ${resume.athlete.split(' ')[0]}` : ''}.</h1>
        {resume && (
          <p className="text-white/80 leading-relaxed">
            {resume.course}, le {dateFr(resume.date_course)}. Ta préparation de {resume.duree_mois} mois{' '}
            {new Date(`${resume.date_debut_plan}T00:00:00`) < new Date(new Date().toDateString())
              ? 'a commencé'
              : 'commence'}{' '}
            le {dateFr(resume.date_debut_plan)}.
          </p>
        )}
        {resume?.trace_ignoree && (
          <p className="text-white/80 leading-relaxed mt-3">
            Ta trace GPX n’a pas pu être lue : ton plan est construit sur le dénivelé déclaré.
          </p>
        )}
        <a href={pdfUrl} className="btn btn-primary mt-8">Télécharger mon plan (PDF) →</a>
      </section>
      <section className="bg-white border border-indigo/10 p-6 sm:p-8 text-indigo/80 leading-relaxed space-y-3">
        <p>
          Commence par le mode d’emploi, au début du PDF : il explique le RPE, comment lire une semaine et
          comment adapter ton plan. Chaque semaine tient sur une page, chaque séance est détaillée pas à pas.
        </p>
        <p className="text-sm text-indigo/60">
          Aperçu de test : le plan n’est pas encore envoyé par e-mail, télécharge-le ici.
        </p>
      </section>
    </div>
  );
}
