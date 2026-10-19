import { redirect } from 'next/navigation';

// Le calendrier jour par jour a quitté l'app (CTS_NOLIO_CADRAGE.md, T1, 18/10/2026) : les séances vivent dans Nolio,
// la trame semaine par semaine est dans « Mon plan ». Un ancien lien y mène.
export default function Calendrier() {
  redirect('/app/plan');
}
