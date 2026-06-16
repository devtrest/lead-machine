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
    const matched = json.matched ?? 0;
    const errors = json.errors ?? 0;
    if (matched > 0) {
      toast.success(
        `${matched} new ${matched === 1 ? "reply" : "replies"}`,
        `From your outreach campaigns.`
      );
    } else if (errors > 0) {
      toast.error(
        "Inbox check finished with errors",
        `${errors} sender${errors === 1 ? "" : "s"} couldn't be reached. See the sender row for details.`
      );
    } else {
      toast.info(
        "No new replies",
        `We checked ${json.senders} connected inbox${json.senders === 1 ? "" : "es"} but nothing matched an outreach campaign yet.`
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
