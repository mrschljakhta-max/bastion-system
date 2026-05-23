/* BASTION — app auth/session guard v1 */
(function () {
  async function getClient() {
    if (window.supabaseClient) return window.supabaseClient;
    if (window.BastionSupabase) return window.BastionSupabase;
    if (window.sb) return window.sb;
    return null;
  }

  async function guard() {
    const client = await getClient();
    if (!client?.auth?.getSession) {
      console.warn("[BASTION AUTH GUARD] Supabase client не знайдено.");
      window.location.replace("../index.html");
      return;
    }

    const { data, error } = await client.auth.getSession();
    if (error || !data?.session) {
      console.warn("[BASTION AUTH GUARD] Немає активної Supabase-сесії.", error);
      window.location.replace("../index.html");
    }
  }

  guard();
})();
