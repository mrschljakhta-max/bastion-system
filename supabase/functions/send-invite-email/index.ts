import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { email, role, setup_url } = await req.json();

    if (!email || !setup_url) {
      throw new Error("email або setup_url відсутні");
    }

    const RESEND_API_KEY = Deno.env.get("resend_api_key");

    if (!RESEND_API_KEY) {
      throw new Error("resend_api_key не знайдено в Supabase Secrets");
    }

    const safeRole = escapeHtml(role || "user");
    const safeUrl = escapeHtml(setup_url);

    const html = `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width">
    <title>BASTION ACCESS</title>
  </head>
  <body style="margin:0;padding:0;background:#050507;color:#ffffff;font-family:Arial,Helvetica,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;color:transparent;opacity:0;">
      Вам надано доступ до BASTION. Активуйте персональне setup-посилання.
    </div>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#050507;">
      <tr>
        <td align="center" style="padding:42px 16px;">
          <table role="presentation" width="720" cellspacing="0" cellpadding="0" border="0" style="width:720px;max-width:100%;border-collapse:separate;border-spacing:0;background:#0b0b10;border:1px solid rgba(255,60,90,.35);border-radius:28px;overflow:hidden;box-shadow:0 0 70px rgba(255,0,60,.18);">
            <tr>
              <td align="center" style="padding:52px 34px 34px;background:linear-gradient(135deg,#220711 0%,#111016 52%,#231006 100%);border-bottom:1px solid rgba(255,255,255,.10);">
                <div style="font-size:58px;line-height:1;font-weight:900;color:#ffbf18;text-shadow:0 0 26px rgba(255,191,24,.38);">S</div>
                <div style="margin-top:22px;font-size:42px;letter-spacing:12px;font-weight:300;color:#ffffff;">BASTION</div>
                <div style="margin-top:14px;font-size:12px;letter-spacing:5px;font-weight:800;color:#ff486d;">AUTHORIZED ACCESS ONLY</div>
              </td>
            </tr>

            <tr>
              <td style="padding:44px 42px 18px;">
                <div style="font-size:11px;letter-spacing:4px;color:#888895;text-transform:uppercase;">Secure Access Node</div>
                <h1 style="margin:14px 0 18px;font-size:32px;line-height:1.18;color:#ffffff;letter-spacing:2px;">Вам надано доступ</h1>
                <p style="margin:0;color:#d6d6de;font-size:17px;line-height:1.75;">
                  Адміністратор створив для вас персональне setup-посилання до системи <b style="color:#fff;">BASTION</b>.
                  <br>
                  Роль доступу: <b style="color:#ffbf18;">${safeRole}</b>
                </p>
              </td>
            </tr>

            <tr>
              <td align="center" style="padding:28px 42px 36px;">
                <a href="${safeUrl}" style="display:inline-block;padding:18px 42px;border-radius:16px;background:linear-gradient(135deg,#ff174d,#ff6a22);color:#ffffff;text-decoration:none;font-size:14px;font-weight:900;letter-spacing:3px;border:1px solid rgba(255,255,255,.18);box-shadow:0 18px 42px rgba(255,40,80,.28);">
                  ACTIVATE ACCESS
                </a>
              </td>
            </tr>

            <tr>
              <td style="padding:0 42px 44px;">
                <div style="padding:18px 20px;border-radius:18px;background:#09090d;border:1px solid rgba(255,255,255,.10);">
                  <div style="font-size:11px;letter-spacing:3px;color:#777781;text-transform:uppercase;margin-bottom:10px;">Fallback link</div>
                  <div style="font-size:13px;line-height:1.65;color:#c6c6ce;word-break:break-all;">${safeUrl}</div>
                </div>
                <p style="margin:22px 0 0;color:#8c8c96;font-size:13px;line-height:1.65;">
                  Не передавайте це посилання іншим особам. Якщо ви не очікували цього листа — просто проігноруйте його.
                </p>
              </td>
            </tr>

            <tr>
              <td align="center" style="padding:22px 34px;background:#07070a;border-top:1px solid rgba(255,255,255,.08);color:#666671;font-size:11px;letter-spacing:3px;text-transform:uppercase;">
                BASTION SYSTEMS · ACCESS CONTROL NODE
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "BASTION Access <access@bastion-system.com>",
        to: email,
        subject: "BASTION — доступ до системи",
        html,
      }),
    });

    const data = await resendResponse.json();

    if (!resendResponse.ok) {
      throw new Error(JSON.stringify(data));
    }

    return new Response(
      JSON.stringify({ success: true, resend: data }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
