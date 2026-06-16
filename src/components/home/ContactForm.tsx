"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Mail, MessageSquare, Clock, Send } from "lucide-react";

const SUPPORT_EMAIL = "hello@leadmachine.ai";

type Channel = {
  icon: typeof Mail;
  tone: "brand" | "amber" | "success";
  title: string;
  body: string;
  href?: string;
};

const channels: Channel[] = [
  {
    icon: Mail,
    tone: "brand",
    title: "Email us",
    body: SUPPORT_EMAIL,
    href: `mailto:${SUPPORT_EMAIL}`,
  },
  {
    icon: Clock,
    tone: "amber",
    title: "Response time",
    body: "Within one business day",
  },
  {
    icon: MessageSquare,
    tone: "success",
    title: "Sales & enterprise",
    body: "Custom volume? Mention it in your message.",
  },
];

const toneMap = {
  brand: "bg-[var(--brand-50)] text-[var(--brand-700)]",
  amber: "bg-[var(--accent-50)] text-[var(--accent-700)]",
  success: "bg-[var(--success-50)] text-[var(--success-700)]",
} as const;

const inputClass =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--surface-elev)] px-3.5 py-2.5 text-sm text-[var(--ink-strong)] outline-none transition placeholder:text-[var(--ink-subtle)] focus:border-[var(--brand-500)] focus:ring-2 focus:ring-[var(--brand-500)]/20";

export function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const subject = encodeURIComponent(
      `Lead Machine enquiry${name ? ` from ${name}` : ""}`
    );
    const body = encodeURIComponent(
      `${message}\n\n— ${name || "Anonymous"}${email ? ` (${email})` : ""}`
    );
    window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
  }

  return (
    <section className="relative pb-20">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <div className="grid gap-8 md:grid-cols-[1fr_1.3fr] md:gap-12">
          {/* Channels */}
          <div className="space-y-4">
            {channels.map((c, i) => {
              const Icon = c.icon;
              const inner = (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ delay: i * 0.05, duration: 0.32 }}
                  className="surface-card flex items-start gap-4 p-5 transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${toneMap[c.tone]}`}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <div>
                    <div className="text-sm font-semibold text-[var(--ink-strong)]">
                      {c.title}
                    </div>
                    <p className="mt-0.5 text-sm text-[var(--ink-muted)]">
                      {c.body}
                    </p>
                  </div>
                </motion.div>
              );
              return c.href ? (
                <a key={c.title} href={c.href} className="block">
                  {inner}
                </a>
              ) : (
                <div key={c.title}>{inner}</div>
              );
            })}
          </div>

          {/* Form */}
          <motion.form
            onSubmit={handleSubmit}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.36 }}
            className="surface-card p-6 md:p-8"
          >
            <h2 className="text-lg font-semibold text-[var(--ink-strong)]">
              Send us a message
            </h2>
            <p className="mt-1 text-sm text-[var(--ink-muted)]">
              Tell us what you&apos;re trying to do and we&apos;ll point you the
              right way.
            </p>

            <div className="mt-6 space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[var(--ink-strong)]">
                  Your name
                </label>
                <input
                  className={inputClass}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Jane Doe"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[var(--ink-strong)]">
                  Email
                </label>
                <input
                  type="email"
                  className={inputClass}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[var(--ink-strong)]">
                  Message
                </label>
                <textarea
                  className={`${inputClass} min-h-[120px] resize-y`}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="What can we help with?"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={!message.trim()}
              className="mt-6 inline-flex items-center justify-center gap-1.5 rounded-xl bg-[var(--brand-600)] px-5 py-3 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(79,70,229,0.25)] transition hover:bg-[var(--brand-700)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              Send message
            </button>
          </motion.form>
        </div>
      </div>
    </section>
  );
}
