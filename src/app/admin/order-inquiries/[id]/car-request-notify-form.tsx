"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { notifyCarRequestCustomer } from "@/actions/car-request-notify";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function CarRequestNotifyForm({ carRequestId }: { carRequestId: string }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await notifyCarRequestCustomer(carRequestId, message);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Customer will see this in their notifications");
      setMessage("");
      router.refresh();
    } catch {
      toast.error("Failed to send");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="rounded-2xl border border-[var(--brand)]/25 bg-[var(--brand)]/[0.06] p-6">
      <h2 className="text-lg font-semibold text-white">Message customer</h2>
      <p className="mt-2 text-sm text-zinc-400">
        Delivers an in-app notification if the request is linked to a user account, or a registered account exists with
        the same email as this inquiry.
      </p>
      <div className="mt-4 space-y-2">
        <Label htmlFor="cust-msg">Message</Label>
        <Textarea
          id="cust-msg"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
          minLength={3}
          rows={5}
          className="mt-1"
          placeholder="Your sourcing update, quote notes, or next steps…"
        />
      </div>
      <Button type="submit" disabled={loading} className="mt-4 bg-[var(--brand)] text-black hover:opacity-90">
        {loading ? "Sending…" : "Send notification"}
      </Button>
    </form>
  );
}
