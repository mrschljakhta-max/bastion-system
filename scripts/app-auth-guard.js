/* BASTION — app auth/session guard v2
   Захищає внутрішні сторінки: потрібна Supabase session + MFA flag після входу.
*/
(function () {
  function getClient() {
    if (window.supabaseClient?.auth) return window.supabaseClient;
    if (window.BastionSupabase?.auth) return window.BastionSupabase;
    if (window.sb?.auth) return window.sb;
    if (window.BastionAuth?.supabaseClient?.auth) return window.BastionAuth.supabaseClient;
    return null;
  }

  async function guard() {
    const client = getClient();
    if (!client?.auth?.getSession) {
      console.warn("[BASTION AUTH GUARD] Supabase client не знайдено.");
      window.location.replace("../index.html");
      return;
    }

    const { data, error } = await client.auth.getSession();
    if (error || !data?.session) {
      console.warn("[BASTION AUTH GUARD] Немає активної Supabase-сесії.", error);
      window.location.replace("../index.html");
      return;
    }

    const mfaEnabled = localStorage.getItem("bastion_mfa_enabled") === "true";
    const mfaVerified = sessionStorage.getItem("bastion_mfa_verified");

    if (mfaEnabled && mfaVerified !== "true") {
      console.warn("[BASTION AUTH GUARD] MFA не підтверджено для поточної сесії.");
      await client.auth.signOut().catch(() => null);
      window.location.replace("../index.html");
    }
  }

  guard();
})();
