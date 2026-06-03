// Hardcoded outreach templates. Users pick one from the compose page,
// then customize subject + body before sending. Placeholders are filled
// in by `renderTemplate()` at send time.
//
// Supported placeholders:
//   {{name}}     — lead's business name (e.g. "Z Dental Studio")
//   {{category}} — Places API category (e.g. "Dental Clinic")
//   {{sender}}   — the user's full name / email

export type EmailTemplate = {
  id: string;
  name: string;
  description: string;
  subject: string;
  body: string;
};

export const EMAIL_TEMPLATES: EmailTemplate[] = [
  {
    id: "blank",
    name: "Blank",
    description: "Start from an empty draft.",
    subject: "",
    body: "",
  },
  {
    id: "cold-intro",
    name: "Cold intro",
    description: "Short, friendly first touch — asks for a quick call.",
    subject: "Quick question about {{name}}",
    body: `Hi {{name}} team,

I came across {{name}} while researching {{category}} businesses in the area and wanted to reach out directly.

We help businesses like yours get more qualified leads without spending hours on outreach. Would you be open to a quick 10-minute call this week to see if it's a fit?

Best,
{{sender}}`,
  },
  {
    id: "service-pitch",
    name: "Service pitch",
    description: "Leads with a clear offer + proof point.",
    subject: "Helping {{name}} grow with better leads",
    body: `Hello {{name}},

I noticed you run a {{category}} — and I think there's a way we can help you book more clients this month.

Our platform delivers ready-to-contact business leads in your area, fully verified with phone and email. No spreadsheets, no scraping — just leads.

Would you be open to a 15-minute walkthrough? I'd love to show you what we can pull for {{name}}.

Talk soon,
{{sender}}`,
  },
  {
    id: "follow-up",
    name: "Follow-up",
    description: "Light second-touch when there's been no reply.",
    subject: "Re: {{name}} — quick follow-up",
    body: `Hi {{name}},

Just bumping this in case it got buried. Wanted to know if you'd be open to a short call about helping {{name}} reach more clients in your area.

Even a quick "not now" or "interested but busy" reply is helpful — I'll work around your schedule.

Best,
{{sender}}`,
  },
  {
    id: "demo-request",
    name: "Demo request",
    description: "Direct ask for a demo slot.",
    subject: "5-minute demo for {{name}}?",
    body: `Hi {{name}} team,

I'd love to show you a quick 5-minute demo of how we can deliver verified {{category}} leads directly to your inbox each week.

Are you free Tuesday or Wednesday afternoon? Happy to work around your schedule.

Cheers,
{{sender}}`,
  },
];

export function getTemplate(id: string): EmailTemplate | undefined {
  return EMAIL_TEMPLATES.find((t) => t.id === id);
}

// Replace {{placeholder}} occurrences. Missing values fall back to the
// raw placeholder so the user sees what wasn't filled in (helps debugging).
export function renderTemplate(
  text: string,
  values: { name?: string; category?: string; sender?: string }
): string {
  return text
    .replace(/\{\{\s*name\s*\}\}/g, values.name ?? "{{name}}")
    .replace(/\{\{\s*category\s*\}\}/g, values.category ?? "{{category}}")
    .replace(/\{\{\s*sender\s*\}\}/g, values.sender ?? "{{sender}}");
}
