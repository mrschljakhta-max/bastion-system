/* =========================================================
   BASTION — Supabase Config v28
   Project: BastionCore
   ========================================================= */

window.BASTION_CONFIG = {
  /* =========================
     SUPABASE
     ========================= */

  SUPABASE_URL:
    "https://iczselzwtfbarjcspmpp.supabase.co",

  SUPABASE_ANON_KEY:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImljenNlbHp3dGZiYXJqY3NwbXBwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyODY2OTgsImV4cCI6MjA5Mzg2MjY5OH0.-L4F0dbxnDLNdrJ95mt4YOJg7x32nKAjzx7tTYpuj_k",

  /* =========================
     APP
     ========================= */

  APP_NAME: "BASTION",
  APP_VERSION: "0.2.0",

  /* =========================
     ROUTES
     ========================= */

  ROUTES: {
    HOME: "/bastion-system/",
    APP: "/bastion-system/pages/app.html",
    ADMIN: "/bastion-system/admin/index.html",
    SETUP: "/bastion-system/setup-account.html"
  },

  /* =========================
     ROLES
     ========================= */

  ROLES: {
    DEMO: "demo",
    USER: "user",
    SUPERVISOR: "supervisor",
    ADMIN: "admin"
  }
};

/* =========================================================
   LEGACY GLOBALS
   ========================================================= */

window.SUPABASE_URL =
  window.BASTION_CONFIG.SUPABASE_URL;

window.SUPABASE_ANON_KEY =
  window.BASTION_CONFIG.SUPABASE_ANON_KEY;
