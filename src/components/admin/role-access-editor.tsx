"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  resetRoleAccessOverride,
  saveRoleAccessOverride,
  type RoleAccessActionState,
} from "@/actions/role-access";
import { Button } from "@/components/ui/button";
import {
  ADMIN_PAGE_CATALOG,
  ADMIN_PAGE_GROUPS,
  type AdminPageKey,
  EDITABLE_STAFF_ROLES,
  type EditableStaffRole,
} from "@/lib/rbac/catalog";
import { ROLE_JOB_SUMMARY } from "@/lib/rbac/defaults";

type MatrixRow = {
  role: EditableStaffRole;
  label: string;
  pageKeys: AdminPageKey[];
  isOverride: boolean;
};

const ROLE_LABEL: Record<EditableStaffRole, string> = {
  SERVICE_ASSISTANT: "Service assistant",
  SALES_ADMIN: "Sales admin",
  SOURCING_MANAGER: "Sourcing manager",
  LOGISTICS_MANAGER: "Logistics manager",
  FINANCE_ADMIN: "Finance admin",
};

export function RoleAccessEditor({
  rows,
  defaultsByRole,
}: {
  rows: MatrixRow[];
  defaultsByRole: Record<EditableStaffRole, AdminPageKey[]>;
}) {
  const [activeRole, setActiveRole] = useState<EditableStaffRole>(rows[0]?.role ?? "SALES_ADMIN");
  const active = useMemo(() => rows.find((r) => r.role === activeRole) ?? rows[0], [rows, activeRole]);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(active?.pageKeys ?? []));

  useEffect(() => {
    setSelected(new Set(active?.pageKeys ?? []));
  }, [active?.role, active?.pageKeys]);

  const [saveState, saveAction, savePending] = useActionState(
    saveRoleAccessOverride,
    null as RoleAccessActionState,
  );
  const [resetState, resetAction, resetPending] = useActionState(
    resetRoleAccessOverride,
    null as RoleAccessActionState,
  );

  useEffect(() => {
    if (saveState?.ok) toast.success("Role access saved");
    if (saveState?.error) toast.error(saveState.error);
  }, [saveState]);

  useEffect(() => {
    if (resetState?.ok) toast.success("Restored job-title defaults");
    if (resetState?.error) toast.error(resetState.error);
  }, [resetState]);

  function toggle(key: string, locked: boolean) {
    if (locked) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {EDITABLE_STAFF_ROLES.map((role) => {
          const row = rows.find((r) => r.role === role);
          const on = role === activeRole;
          return (
            <button
              key={role}
              type="button"
              onClick={() => setActiveRole(role)}
              className={`rounded-lg border px-3 py-2 text-left text-sm transition ${
                on
                  ? "border-[var(--brand)]/50 bg-[var(--brand)]/10 text-white"
                  : "border-white/10 bg-white/[0.02] text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <span className="block font-medium">{ROLE_LABEL[role]}</span>
              <span className="mt-0.5 block text-[10px] text-zinc-500">
                {row?.isOverride ? "Custom grants" : "Job defaults"}
              </span>
            </button>
          );
        })}
      </div>

      {active ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-white">{ROLE_LABEL[active.role]}</h3>
              <p className="mt-1 max-w-2xl text-sm text-zinc-400">{ROLE_JOB_SUMMARY[active.role]}</p>
              <p className="mt-2 font-mono text-[10px] text-zinc-500">{active.role}</p>
            </div>
            <p className="text-xs text-zinc-500">
              {selected.size} page{selected.size === 1 ? "" : "s"} granted
              {active.isOverride ? " · override active" : ""}
            </p>
          </div>

          <form action={saveAction} className="mt-6 space-y-6">
            <input type="hidden" name="role" value={active.role} />
            {ADMIN_PAGE_GROUPS.map((group) => {
              const pages = ADMIN_PAGE_CATALOG.filter((p) => p.group === group.id);
              if (!pages.length) return null;
              return (
                <div key={group.id}>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{group.label}</p>
                  <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                    {pages.map((page) => {
                      const locked = Boolean(page.superAdminLocked);
                      const checked = selected.has(page.key);
                      return (
                        <li key={page.key}>
                          <label
                            className={`flex cursor-pointer gap-3 rounded-xl border px-3 py-2.5 transition ${
                              locked
                                ? "cursor-not-allowed border-white/5 bg-black/20 opacity-60"
                                : checked
                                  ? "border-emerald-500/30 bg-emerald-500/10"
                                  : "border-white/10 bg-black/20 hover:border-white/20"
                            }`}
                          >
                            <input
                              type="checkbox"
                              name="pageKeys"
                              value={page.key}
                              checked={checked}
                              disabled={locked}
                              onChange={() => toggle(page.key, locked)}
                              className="mt-1"
                            />
                            <span className="min-w-0">
                              <span className="block text-sm font-medium text-white">
                                {page.label}
                                {locked ? (
                                  <span className="ml-2 text-[10px] font-normal uppercase tracking-wide text-amber-200/80">
                                    Super Admin only
                                  </span>
                                ) : null}
                              </span>
                              <span className="mt-0.5 block text-[11px] text-zinc-500">{page.description}</span>
                              <span className="mt-1 block font-mono text-[10px] text-zinc-600">{page.href}</span>
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}

            <div className="flex flex-wrap gap-2 border-t border-white/10 pt-4">
              <Button type="submit" disabled={savePending || resetPending}>
                {savePending ? "Saving…" : "Save access for this role"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="border-white/15"
                disabled={savePending || resetPending}
                onClick={() => setSelected(new Set(defaultsByRole[active.role] ?? []))}
              >
                Preview job defaults
              </Button>
            </div>
          </form>

          <form action={resetAction} className="mt-3">
            <input type="hidden" name="role" value={active.role} />
            <Button
              type="submit"
              variant="ghost"
              className="text-zinc-400 hover:text-white"
              disabled={savePending || resetPending || !active.isOverride}
            >
              {resetPending ? "Resetting…" : "Reset to job-title defaults"}
            </Button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
