'use server';
/**
 * « Tes plans » (page Compte) : afficher un autre plan du compte. Le choix se retient sur l'appareil ;
 * contexte.ts ne le suit que s'il désigne un plan du compte connecté (les règles de la base ne lui
 * montrent que les siens).
 */
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { COOKIE_PLAN, DUREE_COOKIE_PLAN } from './planChoisi';

const UUID = /^[0-9a-f-]{36}$/;

export async function choisirPlan(id: string) {
  if (UUID.test(id)) {
    (await cookies()).set(COOKIE_PLAN, id, { path: '/', maxAge: DUREE_COOKIE_PLAN, sameSite: 'lax' });
  }
  redirect('/app');
}
