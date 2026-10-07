'use client';
/**
 * Supabase dans le navigateur : la connexion par code (D6). Les clés publiques seules.
 */
import { createBrowserClient } from '@supabase/ssr';

// L'adresse du projet sans chemin derrière (voir origineSupabase, lib/app/supabase.ts).
const URL_SUPABASE = (() => {
  try {
    return new URL((process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim()).origin;
  } catch {
    return '';
  }
})();

export const clientNavigateur = () => createBrowserClient(URL_SUPABASE, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '');
