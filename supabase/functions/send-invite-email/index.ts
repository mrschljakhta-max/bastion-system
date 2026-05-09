// =========================================================
// BASTION — send-invite-email Supabase Edge Function
// Requires env:
//   RESEND_API_KEY
//   BASTION_FROM_EMAIL, e.g. BASTION <noreply@your-domain.com>
// =========================================================

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const resendKey = Deno.env.get("RESEND_API_KEY")!;
    const from = Deno.env.get("BASTION_FROM_EMAIL") || "BASTION <onboarding@resend.dev>";

    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: profile, error: profileError } = await supabase.rpc("get_my_access_profile");
    if (profileError) throw profileError;

    const row = Array.isArray(profile) ? profile[0] : profile;
    if (!row || row.role !== "admin" || !row.is_active) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    const { email, role, setupUrl } = await req.json();
    if (!email || !setupUrl) {
      return new Response(JSON.stringify({ error: "email and setupUrl are required" }), {
        status: 400,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    const html = `
      <div style="font-family:Arial,sans-serif;background:#050508;color:#f7f7fb;padding:28px;border-radius:20px">
        <h1 style="margin:0 0 12px;color:#ff2e4d;letter-spacing:2px">BASTION ACCESS</h1>
        <p>Вам надано доступ до системи BASTION.</p>
        <p><b>Роль:</b> ${role}</p>
        <ol>
          <li>Перейдіть за персональним посиланням.</li>
          <li>Створіть пароль.</li>
          <li>Відскануйте QR-код у Google Authenticator.</li>
          <li>Підтвердіть 2FA.</li>
          <li>Після активації відкрийте стартову сторінку BASTION і натисніть “Вхід”.</li>
        </ol>
        <p><a href="${setupUrl}" style="display:inline-block;padding:14px 18px;background:#ff2e4d;color:#fff;text-decoration:none;border-radius:12px;font-weight:700">Налаштувати доступ</a></p>
        <p style="font-size:12px;color:#aaa">Не передавайте це посилання іншим особам.</p>
      </div>
    `;

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "authorization": `Bearer ${resendKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [email],
        subject: "BASTION — доступ до системи",
        html,
      }),
    });

    const payload = await response.json();
    if (!response.ok) {
      return new Response(JSON.stringify({ error: payload?.message || "Email provider error", payload }), {
        status: 502,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, payload }), {
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error?.message || String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }
});
