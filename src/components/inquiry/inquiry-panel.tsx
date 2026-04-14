"use client";

import { InquiryType } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const types: { value: InquiryType; label: string }[] = [
  { value: "GENERAL", label: "Ask about this car" },
  { value: "MORE_PHOTOS", label: "Request more photos" },
  { value: "VIDEO_CALL", label: "Request a video call" },
  { value: "SHIPPING_ESTIMATE", label: "Shipping estimate" },
  { value: "DUTY_ESTIMATE", label: "Duty estimate" },
  { value: "RESERVE", label: "Reserve this car" },
];

export function InquiryPanel({ carId, title, disabled }: { carId: string; title: string; disabled?: boolean }) {
  const router = useRouter();
  const [type, setType] = useState<InquiryType>("GENERAL");
  const [message, setMessage] = useState("");
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (disabled) return;
    setLoading(true);
    try {
      const res = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          carId,
          type,
          message: message || `Inquiry about: ${title}`,
          guestName: guestName || undefined,
          guestEmail: guestEmail || undefined,
          guestPhone: guestPhone || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Failed to send");
      toast.success("Inquiry sent. Opening your conversation…");
      setMessage("");
      if (data.threadId && typeof data.threadId === "string") {
        router.push(`/chat?threadId=${encodeURIComponent(data.threadId)}`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  if (disabled) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
        <h2 className="text-lg font-semibold text-white">Customer Inquiry</h2>
        <p className="mt-2 text-sm text-zinc-400">
          This vehicle has been sold. New inquiries are closed for this listing.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
      <h2 className="text-lg font-semibold text-white">Customer Inquiry</h2>
      <p className="mt-2 text-sm text-zinc-400">
        Choose a request type and share details. Guests should include contact information. You will continue in
        Customer Service Live Support Chat.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {types.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setType(t.value)}
            className={`rounded-xl border px-3 py-3 text-left text-sm transition ${
              type === t.value
                ? "border-[var(--brand)] bg-[var(--brand)]/10 text-white"
                : "border-white/10 text-zinc-300 hover:border-white/20"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-6 space-y-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label htmlFor="gname">Full name (guests)</Label>
            <Input id="gname" value={guestName} onChange={(e) => setGuestName(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="gemail">Email</Label>
            <Input
              id="gemail"
              type="email"
              value={guestEmail}
              onChange={(e) => setGuestEmail(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="gphone">Phone / WhatsApp</Label>
            <Input id="gphone" value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} className="mt-1" />
          </div>
        </div>
        <div>
          <Label htmlFor="msg">Message</Label>
          <Textarea
            id="msg"
            rows={5}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="mt-1"
            placeholder="Tell us what you need—budget, timeline, financing questions, etc."
          />
        </div>
        <Button type="button" onClick={submit} disabled={loading}>
          {loading ? "Sending…" : "Send inquiry"}
        </Button>
      </div>
    </div>
  );
}
