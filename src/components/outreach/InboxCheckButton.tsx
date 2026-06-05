"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

export function InboxCheckButton() {
  const router = useRouter();
  const toast = useToast();
  const [running, setRunning] = useState(false);

  async function onClick() {
    setRunning(true);
    const res = await fetch("/api/outreach/inbox-check", { method: "POST" });
    const json = (await res.json().catch(() => ({}))) as {
      senders?: number;
      fetched?: number;
      matched?: number;
      errors?: number;
      error?: string;
    };
    setRunning(false);
    if (!res.ok) {
      toast.error("Inbox check failed", json.error);
      return;
    }
    const fetched = json.fetched ?? 0;
    const matched = json.matched ?? 0;
    if (matched > 0) {
      toast.success(
        `${matched} new ${matched === 1 ? "reply" : "replies"}`,
        `Polled ${json.senders} sender${json.senders === 1 ? "" : "s"}, fetched ${fetched} message${fetched === 1 ? "" : "s"}.`
      );
    } else {
      toast.info(
        "No new replies",
        `Polled ${json.senders} sender${json.senders === 1 ? "" : "s"}, fetched ${fetched} message${fetched === 1 ? "" : "s"}.`
      );
    }
    router.refresh();
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="secondary"
      onClick={onClick}
      loading={running}
      iconLeft={!running ? <RefreshCw className="h-3.5 w-3.5" /> : undefined}
    >
      {running ? "Checking…" : "Check now"}
    </Button>
  );
}
