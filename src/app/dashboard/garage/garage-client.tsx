"use client";

import { useEffect, useState } from "react";

type UserVehicle = {
  id: string;
  vin: string | null;
  make: string;
  model: string;
  year: number;
  engine: string | null;
  trim: string | null;
  nickname: string | null;
  isDefault: boolean;
  nextServiceReminder: string | null;
};

export function GarageClient() {
  const [vehicles, setVehicles] = useState<UserVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nicknameDraft, setNicknameDraft] = useState("");

  async function load() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/garage", { method: "GET" });
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; vehicles?: UserVehicle[]; error?: string };
    if (!res.ok || data.ok === false) {
      setError(data.error ?? "Unable to load garage.");
      setLoading(false);
      return;
    }
    setVehicles(data.vehicles ?? []);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  async function removeVehicle(id: string) {
    const res = await fetch(`/api/garage/${encodeURIComponent(id)}`, { method: "DELETE" });
    if (res.ok) {
      setVehicles((prev) => prev.filter((v) => v.id !== id));
    }
  }

  async function setDefaultVehicle(id: string) {
    const res = await fetch("/api/garage/set-default", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (res.ok) {
      setVehicles((prev) =>
        prev.map((vehicle) => ({
          ...vehicle,
          isDefault: vehicle.id === id,
        })),
      );
    }
  }

  async function saveNickname(id: string) {
    const res = await fetch(`/api/garage/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nickname: nicknameDraft }),
    });
    if (res.ok) {
      setVehicles((prev) => prev.map((v) => (v.id === id ? { ...v, nickname: nicknameDraft || null } : v)));
      setEditingId(null);
      setNicknameDraft("");
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      {loading ? <p className="text-sm text-muted-foreground">Loading garage...</p> : null}
      {error ? <p className="text-sm text-red-500">{error}</p> : null}
      {!loading && !error && vehicles.length === 0 ? (
        <p className="text-sm text-muted-foreground">No vehicles saved yet. Decode a VIN in Parts Finder and save it here.</p>
      ) : null}
      <div className="space-y-3">
        {vehicles.map((vehicle) => (
          <div key={vehicle.id} className="rounded-lg border border-border bg-background p-3">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-semibold">
                {vehicle.nickname || `${vehicle.year} ${vehicle.make} ${vehicle.model}`}
              </p>
              {vehicle.isDefault ? (
                <span className="rounded-full border border-[var(--brand)]/30 bg-[var(--brand)]/10 px-2 py-0.5 text-[10px] font-semibold text-[var(--brand)]">
                  Default
                </span>
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground">
              {vehicle.year} {vehicle.make} {vehicle.model}
              {vehicle.engine ? ` · ${vehicle.engine}` : ""}
              {vehicle.trim ? ` · ${vehicle.trim}` : ""}
            </p>
            {vehicle.vin ? <p className="mt-1 text-xs text-muted-foreground">VIN: {vehicle.vin}</p> : null}
            {vehicle.nextServiceReminder ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Next service reminder: {new Date(vehicle.nextServiceReminder).toLocaleDateString()}
              </p>
            ) : null}
            {editingId === vehicle.id ? (
              <div className="mt-2 flex gap-2">
                <input
                  value={nicknameDraft}
                  onChange={(e) => setNicknameDraft(e.target.value)}
                  placeholder="Vehicle nickname"
                  className="h-8 rounded-md border border-border bg-background px-2 text-xs"
                />
                <button
                  type="button"
                  onClick={() => void saveNickname(vehicle.id)}
                  className="rounded-md border border-border px-2.5 py-1 text-xs hover:bg-muted/40"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(null);
                    setNicknameDraft("");
                  }}
                  className="rounded-md border border-border px-2.5 py-1 text-xs hover:bg-muted/40"
                >
                  Cancel
                </button>
              </div>
            ) : null}
            <div className="mt-2 flex gap-2">
              {!vehicle.isDefault ? (
                <button
                  type="button"
                  onClick={() => void setDefaultVehicle(vehicle.id)}
                  className="rounded-md border border-border px-2.5 py-1 text-xs hover:bg-muted/40"
                >
                  Set default
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  setEditingId(vehicle.id);
                  setNicknameDraft(vehicle.nickname ?? "");
                }}
                className="rounded-md border border-border px-2.5 py-1 text-xs hover:bg-muted/40"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => void removeVehicle(vehicle.id)}
                className="rounded-md border border-border px-2.5 py-1 text-xs hover:bg-muted/40"
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
