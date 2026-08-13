/* Shared Supabase client for the Finn app pages (build step 2).
   Expects the supabase-js v2 UMD bundle to be loaded first:
   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
   The publishable (anon) key is public by design — RLS is the boundary. */
(function () {
  const SUPABASE_URL = 'https://bednxobrkxibidufgsot.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_ca03yA_0nEOrscdicMu5yg_j8JbM-z0';
  window.finnSupabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
})();
