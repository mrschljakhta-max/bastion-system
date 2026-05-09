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

    const safeEmail = escapeHtml(email);
    const safeRole = escapeHtml(role || "user");
    const safeUrl = escapeHtml(setup_url);

    const stamp = new Date().toLocaleString("uk-UA", {
      timeZone: "Europe/Kyiv",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

    const html = `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width">
    <title>BASTION — доступ до системи</title>
  </head>

  <body style="margin:0;padding:0;background:#050507;color:#ffffff;font-family:Arial,Helvetica,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;color:transparent;opacity:0;">
      Вам надано доступ до системи BASTION. Активуйте персональне посилання та завершіть налаштування.
    </div>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#050507;">
      <tr>
        <td align="center" style="padding:42px 16px;">

          <table role="presentation" width="760" cellspacing="0" cellpadding="0" border="0" style="width:760px;max-width:100%;border-collapse:separate;border-spacing:0;background:#09090d;border:1px solid rgba(255,55,85,.38);border-radius:28px;overflow:hidden;box-shadow:0 0 76px rgba(255,0,60,.20);">

            <tr>
              <td style="padding:0;background:#0b0b10;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:radial-gradient(circle at 72% 35%, rgba(255,40,60,.22), transparent 32%),radial-gradient(circle at 50% 100%, rgba(255,65,25,.28), transparent 40%),linear-gradient(135deg,#17040a 0%,#090910 50%,#170a04 100%);">
                  <tr>
                    <td style="padding:34px 40px 18px;">
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                        <tr>
                          <td align="left" style="color:#ff4d6d;font-size:11px;letter-spacing:4px;font-weight:800;text-transform:uppercase;">
                            Захищений канал
                          </td>
                          <td align="right" style="color:#ffffff;font-size:11px;letter-spacing:4px;font-weight:800;text-transform:uppercase;">
                            Статус: активно
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>

                  <tr>
                    <td align="center" style="padding:28px 40px 58px;">
                      <div style="font-size:58px;line-height:1;font-weight:900;color:#ffbf18;text-shadow:0 0 28px rgba(255,191,24,.42);">S</div>

                      <div style="margin-top:24px;font-size:42px;letter-spacing:12px;font-weight:300;color:#ffffff;">
                        BASTION
                      </div>

                      <div style="margin-top:16px;font-size:12px;letter-spacing:5px;font-weight:800;color:#ff4d6d;">
                        ЛИШЕ ДЛЯ АВТОРИЗОВАНИХ КОРИСТУВАЧІВ
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td style="padding:44px 44px 12px;background:#0b0b10;">
                <div style="font-size:11px;letter-spacing:4px;color:#8f8f9b;text-transform:uppercase;">
                  Вузол доступу
                </div>

                <h1 style="margin:14px 0 10px;font-size:34px;line-height:1.18;color:#ffffff;letter-spacing:1px;">
                  Вам надано доступ
                </h1>

                <p style="margin:0;color:#d6d6de;font-size:17px;line-height:1.75;">
                  Адміністратор створив для вас персональне посилання для входу до системи <b style="color:#fff;">BASTION</b>.
                  Перейдіть за посиланням, створіть пароль і завершіть перше налаштування доступу.
                </p>
              </td>
            </tr>

            <tr>
              <td style="padding:20px 44px 18px;background:#0b0b10;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border:1px solid rgba(255,255,255,.12);border-radius:20px;background:#09090d;">
                  <tr>
                    <td style="padding:22px 24px;border-bottom:1px solid rgba(255,255,255,.08);">
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                        <tr>
                          <td width="50%" style="padding:8px 10px;color:#9c9ca8;font-size:11px;letter-spacing:3px;text-transform:uppercase;">
                            Електронна пошта
                          </td>
                          <td width="50%" style="padding:8px 10px;color:#9c9ca8;font-size:11px;letter-spacing:3px;text-transform:uppercase;">
                            Роль доступу
                          </td>
                        </tr>
                        <tr>
                          <td style="padding:2px 10px 12px;color:#ffffff;font-size:16px;">
                            ${safeEmail}
                          </td>
                          <td style="padding:2px 10px 12px;color:#ffbf18;font-size:16px;font-weight:800;">
                            ${safeRole}
                          </td>
                        </tr>
                        <tr>
                          <td style="padding:8px 10px;color:#9c9ca8;font-size:11px;letter-spacing:3px;text-transform:uppercase;">
                            Створено
                          </td>
                          <td style="padding:8px 10px;color:#9c9ca8;font-size:11px;letter-spacing:3px;text-transform:uppercase;">
                            Захист
                          </td>
                        </tr>
                        <tr>
                          <td style="padding:2px 10px;color:#ffffff;font-size:16px;">
                            ${escapeHtml(stamp)} за Києвом
                          </td>
                          <td style="padding:2px 10px;color:#ffffff;font-size:16px;">
                            Персональне посилання
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td align="center" style="padding:30px 44px 34px;background:#0b0b10;">
                <a href="${safeUrl}" style="display:inline-block;min-width:280px;padding:19px 42px;border-radius:16px;background:linear-gradient(135deg,#ff174d,#ff6a22);color:#ffffff;text-decoration:none;font-size:14px;font-weight:900;letter-spacing:3px;border:1px solid rgba(255,255,255,.18);box-shadow:0 18px 42px rgba(255,40,80,.30);">
                  АКТИВУВАТИ ДОСТУП
                </a>
              </td>
            </tr>

            <tr>
              <td style="padding:0 44px 28px;background:#0b0b10;">
                <div style="padding:20px 22px;border-radius:18px;background:#09090d;border-left:4px solid #ff3158;border-top:1px solid rgba(255,255,255,.08);border-right:1px solid rgba(255,255,255,.08);border-bottom:1px solid rgba(255,255,255,.08);">
                  <div style="font-size:11px;letter-spacing:3px;color:#ff4d6d;text-transform:uppercase;margin-bottom:10px;">
                    Повідомлення безпеки
                  </div>
                  <div style="font-size:14px;line-height:1.7;color:#cfcfd8;">
                    Це персональне посилання. Не передавайте його іншим особам.
                    Усі дії в системі можуть логуватися для контролю доступу.
                  </div>
                </div>
              </td>
            </tr>

            <tr>
              <td style="padding:0 44px 46px;background:#0b0b10;">
                <div style="padding:18px 20px;border-radius:18px;background:#07070a;border:1px solid rgba(255,255,255,.10);">
                  <div style="font-size:11px;letter-spacing:3px;color:#777781;text-transform:uppercase;margin-bottom:10px;">
                    Резервне посилання
                  </div>
                  <div style="font-size:13px;line-height:1.65;color:#c6c6ce;word-break:break-all;">
                    ${safeUrl}
                  </div>
                </div>
              </td>
            </tr>

            <tr>
              <td align="center" style="padding:24px 34px;background:#07070a;border-top:1px solid rgba(255,255,255,.08);color:#666671;font-size:11px;letter-spacing:3px;text-transform:uppercase;">
                BASTION · Вузол керування доступом
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
      JSON.stringify({
        success: true,
        resend: data,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  }
});
