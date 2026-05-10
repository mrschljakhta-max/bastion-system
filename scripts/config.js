/* BASTION config v41
   ВАЖЛИВО:
   - тут має бути тільки publishable/anon key, не service_role.
   - якщо у тебе вже був config.js — цей файл робить сумісні alias:
     window.BASTION_CONFIG, window.SUPABASE_URL, window.SUPABASE_ANON_KEY.
*/

window.BASTION_CONFIG = window.BASTION_CONFIG || {
  SUPABASE_URL: "https://iczselzwtfbarjcspmpp.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImljenNlbHp3dGZiYXJqY3NwbXBwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyODY2OTgsImV4cCI6MjA5Mzg2MjY5OH0.-L4F0dbxnDLNdrJ95mt4YOJg7x32nKAjzx7tTYpuj_k"
};

window.SUPABASE_URL = window.BASTION_CONFIG.SUPABASE_URL;
window.SUPABASE_ANON_KEY = window.BASTION_CONFIG.SUPABASE_ANON_KEY;
