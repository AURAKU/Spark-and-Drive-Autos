"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { sendPrivateUserMessage } from "@/actions/admin-messaging";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type UserRow = {
  id: string;
  email: string;
  name: string | null;
};

export function PrivateUserMessageCard({ users }: { users: UserRow[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [userId, setUserId] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return users.slice(0, 80);
    return users
      .filter((u) => `${u.name ?? ""} ${u.email}`.toLowerCase().includes(needle))
      .slice(0, 80);
  }, [users, q]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await sendPrivateUserMessage(userId, title, body);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const tid = "threadId" in res ? res.threadId : undefined;
      toast.success(
        tid ? (
          <span>
            Thread created.{" "}
            <a href={`/admin/comms?thread=${tid}&view=chats`} className="underline">
              Open in Live Support Chat
            </a>
          </span>
        ) : (
          "Message sent"
        ),
      );
      setTitle("");
      setBody("");
      router.refresh();
    } catch {
      toast.error("Could not send message.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
      <h2 className="text-lg font-semibold text-white">Private message (starts a thread)</h2>
      <p className="mt-2 text-sm text-zinc-400">
        Creates a Live Support Chat thread and notifies the customer. They can reply in Customer Service Live Support
        Chat (<span className="text-zinc-300">/chat</span>).
      </p>
      <form className="mt-5 space-y-4" onSubmit={onSubmit}>
        <div>
          <Label htmlFor="msg-user-search">Find user</Label>
          <Input
            id="msg-user-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name or email"
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="msg-user-id">Recipient</Label>
          <select
            id="msg-user-id"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            required
            className="mt-1 h-10 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white outline-none"
          >
            <option value="">Select user</option>
            {filtered.map((u) => (
              <option key={u.id} value={u.id}>
                {(u.name ? `${u.name} · ` : "") + u.email}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="msg-title">Title</Label>
          <Input
            id="msg-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Update on your inquiry"
            required
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="msg-body">Message</Label>
          <Textarea
            id="msg-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            placeholder="Write the private message"
            required
            className="mt-1"
          />
        </div>
        <Button type="submit" disabled={loading}>
          {loading ? "Sending…" : "Send private message"}
        </Button>
      </form>
    </div>
  );
}
