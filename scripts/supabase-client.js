/* BASTION Supabase client bootstrap v41
   Створює стабільний клієнт:
   - window.BastionSupabase
   - window.supabaseClient
   - window.sb
*/

(function () {
  function fail(message) {
    console.error("[BASTION Supabase]", message);
    window.BASTION_SUPABASE_ERROR = message;
  }

  if (!window.supabase || typeof window.supabase.createClient !== "function") {
    fail("Supabase CDN не завантажився. Перевір script @supabase/supabase-js.");
    return;
  }

  const cfg = window.BASTION_CONFIG || {};
  const url = cfg.SUPABASE_URL || window.SUPABASE_URL;
  const key = cfg.SUPABASE_ANON_KEY || window.SUPABASE_ANON_KEY;

  if (!url || !key || key === "PASTE_YOUR_SUPABASE_ANON_KEY_HERE") {
    fail("SUPABASE_URL або SUPABASE_ANON_KEY не задані у scripts/config.js.");
    return;
  }

  const client = window.supabase.createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });

  window.BastionSupabase = client;
  window.supabaseClient = client;
  window.sb = client;

  window.BastionAuth = window.BastionAuth || {};
  window.BastionAuth.client = client;

  console.info("[BASTION Supabase] client ready");
})();
