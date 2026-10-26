"use client";
import { useEffect, useState } from "react";
import { Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BrowserDialRequest } from "@/lib/browser-phone-target";

export function CallCreatorButton({ id, name, phone, application = false }: { id: string; name: string; phone: string | null; application?: boolean }) {
  const [allowed, setAllowed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/azera/calls/africa-browser", { cache: "no-store", signal: controller.signal })
      .then(response => { if (!controller.signal.aborted) setAllowed(response.ok); })
      .catch(() => {});
    return () => controller.abort();
  }, []);
  return <Button type="button" size="sm" variant="outline" disabled={!allowed || !phone}
    title={!phone ? "Add a phone number to this creator first" : !allowed ? "Azera calling access is required" : "Open the browser phone; review the number before calling"}
    onClick={() => {
      const detail: BrowserDialRequest = { target: application ? { applicationId: id } : { creatorId: id }, name, phone: phone || "" };
      window.dispatchEvent(new CustomEvent("azera:dial", { detail }));
    }}><Phone className="mr-2 h-4 w-4" />Call creator</Button>;
}
