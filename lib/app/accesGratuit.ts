/**
 * Les pages de l'app gratuite qui n'existent pas dans l'app d'avant (Courses, Me connecter) : introuvables en mode
 * « coupe » et pour qui l'app gratuite n'est pas ouverte, comme avant ; un compte de l'app des acheteurs est renvoyé à
 * son accueil.
 */
import { notFound, redirect } from 'next/navigation';
import { lireAcces, type Acces } from './acces';

export async function pageGratuite(options: { visiteurSeulement?: boolean } = {}): Promise<Acces> {
  const acces = await lireAcces();
  if (acces.mode === 'coupe') notFound();
  if (acces.cas === 'visiteur') return acces;
  if (acces.cas === 'gratuit') {
    if (options.visiteurSeulement) redirect('/app');
    return acces;
  }
  if (acces.cas === 'normal') redirect('/app');
  notFound();
}
