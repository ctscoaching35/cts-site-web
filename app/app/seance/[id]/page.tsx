import { redirect } from 'next/navigation';

// La fiche de séance a quitté l'app (CTS_NOLIO_CADRAGE.md, T1, 18/10/2026) : les séances vivent dans Nolio. Un ancien
// lien mène au tableau de bord.
export default function Seance() {
  redirect('/app');
}
