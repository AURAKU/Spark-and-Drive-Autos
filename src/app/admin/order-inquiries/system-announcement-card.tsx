"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { broadcastSystemAnnouncement } from "@/actions/system-announcement";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type RecentAnnouncement = {
  id: string;
  title: string;
  body: string | null;
  recipientCount: number;
  createdAt: string;
};

/** Broadcasts a SYSTEM notification to every registered user + records an audit row. */
export function SystemAnnouncementCard({ recent = [] }: { recent?: RecentAnnouncement[] }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await broadcastSystemAnnouncement(title, body);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Notified ${res.count} user accounts`);
      setTitle("");
      setBody("");
      router.refresh();
    } catch {
      toast.error("Could not send announcement");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.06] p-6">
      <h2 className="text-lg font-semibold text-white">Broadcast announcements</h2>
      <p className="mt-2 text-sm text-zinc-400">
        Sends one in-app notification to every registered account (bell + dashboard notifications). Each send is stored
        as an audit record below.
      </p>
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div>
          <Label htmlFor="ann-title">Title</Label>
          <Input
            id="ann-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="mt-1"
            placeholder="e.g. Holiday shipping schedule"
          />
        </div>
        <div>
          <Label htmlFor="ann-body">Message (optional)</Label>
          <Textarea
            id="ann-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            className="mt-1"
            placeholder="Short summary shown in the notification list…"
          />
        </div>
        <Button type="submit" disabled={loading} variant="outline" className="border-amber-500/40">
          {loading ? "Sending…" : "Send to all users"}
        </Button>
      </form>

      {recent.length > 0 ? (
        <div className="mt-10 border-t border-white/10 pt-6">
          <h3 className="text-sm font-semibold text-zinc-300">Recent broadcasts</h3>
          <ul className="mt-3 max-h-64 space-y-3 overflow-y-auto text-sm">
            {recent.map((a) => (
              <li
                key={a.id}
                className="rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-zinc-400"
              >
                <p className="font-medium text-zinc-200">{a.title}</p>
                {a.body ? <p className="mt-1 line-clamp-2 text-xs">{a.body}</p> : null}
                <p className="mt-2 text-[10px] text-zinc-600">
                  {new Date(a.createdAt).toLocaleString()} · {a.recipientCount} recipients
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
