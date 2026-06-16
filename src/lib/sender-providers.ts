// Preset configurations for the common mail providers. The keys are also
// used as the provider column value on outreach_senders so the UI can show
// a friendly label later.
//
// 'custom' lets the user enter any SMTP/IMAP host manually — useful for
// custom domain relays, business email hosts, or self-run servers.

export type SenderPresetKey =
  | "gmail"
  | "outlook"
  | "titan"
  | "zoho"
  | "yahoo"
  | "custom";

export type SenderPreset = {
  key: SenderPresetKey;
  label: string;
  description: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean; // true = implicit TLS (465); false = STARTTLS (587)
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  passwordHint: string;
  passwordLengthHint: string;
  helpUrl: string;
  // When true, the password is expected to be a specific format (e.g.
  // Gmail's 16-char app password). Custom providers skip this validation.
  enforceAppPasswordFormat?: boolean;
};

export const SENDER_PRESETS: Record<SenderPresetKey, SenderPreset> = {
  gmail: {
    key: "gmail",
    label: "Gmail",
    description: "Personal Gmail or Workspace account",
    smtpHost: "smtp.gmail.com",
    smtpPort: 465,
    smtpSecure: true,
    imapHost: "imap.gmail.com",
    imapPort: 993,
    imapSecure: true,
    passwordHint:
      "Generate at myaccount.google.com/apppasswords. 16 characters, spaces ignored.",
    passwordLengthHint: "16-char app password",
    helpUrl: "https://myaccount.google.com/apppasswords",
    enforceAppPasswordFormat: true,
  },
  outlook: {
    key: "outlook",
    label: "Outlook / Microsoft 365",
    description: "outlook.com, hotmail.com, or Microsoft 365 mailbox",
    smtpHost: "smtp.office365.com",
    smtpPort: 587,
    smtpSecure: false, // STARTTLS
    imapHost: "outlook.office365.com",
    imapPort: 993,
    imapSecure: true,
    passwordHint:
      "Use an app password from Microsoft account security settings (works only with 2-step verification). For Microsoft 365 admins may need to enable SMTP AUTH for the mailbox.",
    passwordLengthHint: "Account or app password",
    helpUrl: "https://account.microsoft.com/security",
  },
  titan: {
    key: "titan",
    label: "Titan Email",
    description: "titan.email custom-domain mailbox",
    smtpHost: "smtp.titan.email",
    smtpPort: 465,
    smtpSecure: true,
    imapHost: "imap.titan.email",
    imapPort: 993,
    imapSecure: true,
    passwordHint: "Your Titan mailbox password.",
    passwordLengthHint: "Mailbox password",
    helpUrl: "https://flockmail.com",
  },
  zoho: {
    key: "zoho",
    label: "Zoho Mail",
    description: "Zoho Mail free or paid mailbox",
    smtpHost: "smtp.zoho.com",
    smtpPort: 465,
    smtpSecure: true,
    imapHost: "imap.zoho.com",
    imapPort: 993,
    imapSecure: true,
    passwordHint:
      "Enable IMAP in Zoho Mail Settings, then create an app password under Security → App Passwords.",
    passwordLengthHint: "App password",
    helpUrl: "https://accounts.zoho.com",
  },
  yahoo: {
    key: "yahoo",
    label: "Yahoo Mail",
    description: "Yahoo or AOL mailbox",
    smtpHost: "smtp.mail.yahoo.com",
    smtpPort: 465,
    smtpSecure: true,
    imapHost: "imap.mail.yahoo.com",
    imapPort: 993,
    imapSecure: true,
    passwordHint:
      "Generate an app password at login.yahoo.com → Account security → Manage app passwords.",
    passwordLengthHint: "App password",
    helpUrl: "https://login.yahoo.com/account/security",
  },
  custom: {
    key: "custom",
    label: "Custom SMTP / IMAP",
    description: "Any other provider — enter SMTP + IMAP details manually",
    smtpHost: "",
    smtpPort: 587,
    smtpSecure: false,
    imapHost: "",
    imapPort: 993,
    imapSecure: true,
    passwordHint: "Your mailbox password or relay credentials.",
    passwordLengthHint: "Mailbox password",
    helpUrl: "",
  },
};

export function presetForKey(k: string | null | undefined): SenderPreset {
  if (!k) return SENDER_PRESETS.custom;
  return SENDER_PRESETS[k as SenderPresetKey] ?? SENDER_PRESETS.custom;
}

export function allPresets(): SenderPreset[] {
  return Object.values(SENDER_PRESETS);
}
