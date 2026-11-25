'use client';
import { useActionState, useState } from 'react';
import { creerCoache, type EtatCoach } from '@/lib/app/actionsCoaching';

// « NOUVEAU COACHÉ », UN SEUL ÉCRAN (décision 241 du coach, 25/11/2026, moment 1 ; sous la 9.x) : prénom, nom, e-mail (facultatif), son compte Nolio ; en bas, le message d'accord prêt à copier dans Nolio. Rien d'autre :
// sa côte, son objectif, sa trace se remplissent ensuite sur sa page ; « Accord reçu » viendra de « À faire ».
const champ = 'mt-1.5 w-full min-h-11 rounded-[10px] border border-indigo/20 px-3 text-sm font-normal text-indigo bg-white';

export default function NouveauCoache({ nolio, message }: { nolio: { id: string; nom: string }[]; message: string }) {
  const [etat, action, enCours] = useActionState<EtatCoach, FormData>(creerCoache, null);
  const [copie, setCopie] = useState(false);
  return (
    <div className="space-y-5">
      <form action={action} className="bg-white rounded-2xl border border-indigo/[0.08] p-5 space-y-3">
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="block text-xs font-semibold text-indigo">Prénom
            <input name="prenom" required autoComplete="off" className={champ} maxLength={40} />
          </label>
          <label className="block text-xs font-semibold text-indigo">Nom
            <input name="nom" required autoComplete="off" className={champ} maxLength={60} />
          </label>
        </div>
        <label className="block text-xs font-semibold text-indigo">Son compte Nolio
          <select name="nolio_id" defaultValue="" className={champ}>
            <option value="">{nolio.length ? 'Choisis son nom (ou plus tard)' : 'Personne à associer pour l’instant'}</option>
            {nolio.map((a) => <option key={a.id} value={a.id}>{a.nom}</option>)}
          </select>
        </label>
        <label className="block text-xs font-semibold text-indigo">Son e-mail
          <input name="email" type="email" autoComplete="off" className={champ} />
          <span className="mt-1 block font-normal text-[#5E5C78]">Facultatif. Si tu le remplis, l’app lui envoie maintenant le lien de son espace.</span>
        </label>
        <button type="submit" disabled={enCours} className="min-h-12 px-5 rounded-xl bg-teal text-white text-sm font-bold disabled:opacity-50">
          {enCours ? 'Création…' : 'Créer sa fiche'}
        </button>
        {etat && <p role="status" className={`text-sm ${etat.ok ? 'text-teal' : 'text-[#8A3326]'}`}>{etat.message}</p>}
      </form>
      <section className="bg-white rounded-2xl border border-indigo/[0.08] p-5 space-y-3">
        <h2 className="text-sm font-bold text-indigo">Le message d’accord, à envoyer dans Nolio</h2>
        <p className="text-[0.84rem] leading-relaxed text-[#4A4866] bg-[#FBFAF6] rounded-xl p-3.5 select-all">{message}</p>
        <button type="button" onClick={() => navigator.clipboard.writeText(message).then(() => setCopie(true), () => setCopie(false))}
          className="min-h-11 px-4 rounded-xl border border-teal text-teal text-[0.8125rem] font-bold">
          {copie ? 'Copié' : 'Copier le message'}
        </button>
      </section>
    </div>
  );
}
