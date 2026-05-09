/* =========================================================
   BASTION — Admin Start Guard
   ========================================================= */

(function () {
  const statusBox = document.getElementById("adminStartStatus");

  function setStatus(text, state) {
    if (!statusBox) return;
    statusBox.textContent = text;
    statusBox.classList.remove("is-ok", "is-warn");
    if (state) statusBox.classList.add(state);
  }

  async function init() {
    try {
      if (!window.BastionAuth?.supabaseClient) {
        setStatus("Помилка: Supabase client не ініціалізовано.", "is-warn");
        return;
      }

      const client = window.BastionAuth.supabaseClient;
      const { data: sessionData } = await client.auth.getSession();
      const session = sessionData?.session;

      if (!session) {
        setStatus("Сесія відсутня. Спочатку увійдіть на стартовій сторінці.", "is-warn");
        return;
      }

      const { data, error } = await client.rpc("get_my_access_profile");
      if (error) throw error;

      const profile = Array.isArray(data) ? data[0] : data;
      if (!profile) {
        setStatus(`${session.user?.email || "Користувач"}: профіль доступу не знайдено.`, "is-warn");
        return;
      }

      if (profile.role === "admin") {
        setStatus(`${profile.email} · admin доступ підтверджено`, "is-ok");
      } else {
        setStatus(`${profile.email} · роль ${profile.role}. Потрібна роль admin.`, "is-warn");
      }
    } catch (error) {
      console.error(error);
      setStatus(`Помилка перевірки: ${error.message || error}`, "is-warn");
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
