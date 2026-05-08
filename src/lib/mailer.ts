/**
 * Minimal email sender. Today: logs to stdout (works without any provider
 * configured). Wire a real provider by replacing the `send` body — the rest
 * of the codebase calls `sendPlanActivatedEmail()` etc and won't change.
 *
 * Suggested integration: Resend (https://resend.com). Add RESEND_API_KEY to
 * env and replace the body of `send()` with:
 *
 *   const { Resend } = await import("resend");
 *   const r = new Resend(process.env.RESEND_API_KEY);
 *   await r.emails.send({ from, to, subject, html });
 */

type SendArgs = {
  to: string;
  subject: string;
  html: string;
};

const FROM = process.env.MAIL_FROM ?? "Nichely <hello@nichely.app>";

async function send({ to, subject, html }: SendArgs): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim();

  if (!apiKey) {
    console.log("[mailer] (no RESEND_API_KEY — logging instead of sending)");
    console.log("[mailer] to:", to);
    console.log("[mailer] subject:", subject);
    console.log("[mailer] html (truncated):", html.slice(0, 200));
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM, to: [to], subject, html }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("[mailer] Resend send failed:", res.status, text);
  }
}

export async function sendPlanActivatedEmail(args: {
  to: string;
  fullName?: string | null;
  plan: string;
  credits: number;
}): Promise<void> {
  const greeting = args.fullName ? `Hi ${args.fullName.split(" ")[0]},` : "Hi,";
  const planLabel = args.plan.charAt(0).toUpperCase() + args.plan.slice(1);

  const html = `
    <div style="font-family:Inter,system-ui,Arial,sans-serif;max-width:540px;margin:0 auto;padding:24px;background:#fafaf9;color:#0c0a09">
      <h1 style="margin:0 0 16px;font-size:22px;color:#0c0a09">Your ${planLabel} plan is live 🎉</h1>
      <p style="margin:0 0 12px;color:#57534e">${greeting}</p>
      <p style="margin:0 0 12px;color:#57534e">
        Payment received — your <strong>${planLabel}</strong> plan is now active on your Nichely account.
      </p>
      <p style="margin:0 0 12px;color:#57534e">
        We've added <strong>${args.credits} credits</strong> to your balance. Generate as many leads as you need.
      </p>
      <a href="${process.env.NEXT_PUBLIC_APP_URL ?? "https://nichely.app"}/user"
         style="display:inline-block;margin:16px 0 0;padding:12px 20px;background:#4f46e5;color:#fff;text-decoration:none;border-radius:10px;font-weight:600">
        Open dashboard
      </a>
      <p style="margin:28px 0 0;font-size:12px;color:#a8a29e">
        Questions? Reply to this email and we'll help.
      </p>
    </div>
  `;

  await send({
    to: args.to,
    subject: `${planLabel} plan activated · Nichely`,
    html,
  });
}
