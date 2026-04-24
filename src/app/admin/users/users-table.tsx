"use client";

import { UserRole } from "@prisma/client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useActionState, useEffect, useMemo } from "react";

import {
  adjustUserWalletAdmin,
  createUserAdmin,
  deleteUserAdmin,
  setUserPartsFinderMembership,
  setUserAccountBlocked,
  updateUserRole,
  type AdminUserActionState,
  type UpdateUserRoleState,
} from "@/actions/users";
import { Button } from "@/components/ui/button";

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: "CUSTOMER", label: "Customer" },
  { value: "SERVICE_ASSISTANT", label: "Service assistant" },
  { value: "SUPER_ADMIN", label: "Super admin" },
  { value: "SALES_ADMIN", label: "Sales admin" },
  { value: "SOURCING_MANAGER", label: "Sourcing manager" },
  { value: "LOGISTICS_MANAGER", label: "Logistics manager" },
  { value: "FINANCE_ADMIN", label: "Finance admin" },
];

export type UserRow = {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  role: UserRole;
  walletBalance: number;
  createdAt: string;
  messagingBlocked: boolean;
  accountBlocked: boolean;
  partsFinderMembershipStatus: "ACTIVE" | "EXPIRED" | "SUSPENDED" | null;
  partsFinderMembershipEndsAt: string | null;
};

function userRowMatchesQuery(u: UserRow, q: string): boolean {
  if (!q) return true;
  const hay = [u.email, u.name, u.phone, u.id].filter(Boolean).join(" ").toLowerCase();
  return hay.includes(q);
}

export function UsersTable({
  users,
  canManagePrivileged,
}: {
  users: UserRow[];
  canManagePrivileged: boolean;
}) {
  const searchParams = useSearchParams();
  const qRaw = searchParams.get("q")?.trim().toLowerCase() ?? "";
  const visibleUsers = useMemo(() => users.filter((u) => userRowMatchesQuery(u, qRaw)), [users, qRaw]);

  const [roleState, roleAction] = useActionState(updateUserRole, null as UpdateUserRoleState);
  const [createState, createAction] = useActionState(createUserAdmin, null as AdminUserActionState);
  const [deleteState, deleteAction] = useActionState(deleteUserAdmin, null as AdminUserActionState);
  const [walletState, walletAction] = useActionState(adjustUserWalletAdmin, null as AdminUserActionState);
  const [blockState, blockAction] = useActionState(setUserAccountBlocked, null as AdminUserActionState);
  const [partsFinderState, partsFinderAction] = useActionState(setUserPartsFinderMembership, null as AdminUserActionState);
  const router = useRouter();

  useEffect(() => {
    if (roleState?.ok || blockState?.ok || createState?.ok || deleteState?.ok || walletState?.ok || partsFinderState?.ok) {
      router.refresh();
    }
  }, [roleState, blockState, createState, deleteState, walletState, partsFinderState, router]);

  return (
    <div className="mt-8 space-y-4">
      {roleState?.error ? <p className="text-sm text-red-400">{roleState.error}</p> : null}
      {roleState?.ok ? (
        <p className="text-sm text-emerald-400/90">
          Role saved. The table below matches the database. The affected user&apos;s session picks up the new role within
          about a minute, or immediately on next sign-in.
        </p>
      ) : null}
      {blockState?.error ? <p className="text-sm text-red-400">{blockState.error}</p> : null}
      {blockState?.ok ? <p className="text-sm text-emerald-400/90">Account suspension updated.</p> : null}
      {createState?.error ? <p className="text-sm text-red-400">{createState.error}</p> : null}
      {createState?.ok ? <p className="text-sm text-emerald-400/90">User created successfully.</p> : null}
      {deleteState?.error ? <p className="text-sm text-red-400">{deleteState.error}</p> : null}
      {deleteState?.ok ? <p className="text-sm text-emerald-400/90">User deleted successfully.</p> : null}
      {walletState?.error ? <p className="text-sm text-red-400">{walletState.error}</p> : null}
      {walletState?.ok ? <p className="text-sm text-emerald-400/90">Wallet adjusted successfully.</p> : null}
      {partsFinderState?.error ? <p className="text-sm text-red-400">{partsFinderState.error}</p> : null}
      {partsFinderState?.ok ? <p className="text-sm text-emerald-400/90">Parts Finder membership updated.</p> : null}

      {qRaw ? (
        <p className="text-sm text-zinc-400">
          Filtered by <span className="font-mono text-zinc-200">{searchParams.get("q")}</span> — showing{" "}
          {visibleUsers.length} of {users.length}.{" "}
          <Link href="/admin/users" className="text-[var(--brand)] hover:underline">
            Clear filter
          </Link>
        </p>
      ) : null}

      {canManagePrivileged ? (
        <form action={createAction} className="grid gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:grid-cols-5">
          <input
            name="email"
            required
            type="email"
            placeholder="Email"
            className="h-10 rounded-lg border border-white/10 bg-black/40 px-3 text-sm text-white"
          />
          <input
            name="name"
            required
            placeholder="Full name"
            className="h-10 rounded-lg border border-white/10 bg-black/40 px-3 text-sm text-white"
          />
          <input
            name="password"
            required
            type="password"
            placeholder="Temporary password"
            className="h-10 rounded-lg border border-white/10 bg-black/40 px-3 text-sm text-white"
          />
          <select name="role" defaultValue="CUSTOMER" className="h-10 rounded-lg border border-white/10 bg-black/40 px-3 text-sm text-white">
            {ROLE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <Button type="submit" size="sm" className="h-10">
            Add user
          </Button>
        </form>
      ) : null}
      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full min-w-[1240px] text-left text-sm">
          <thead className="border-b border-white/10 bg-white/[0.03] text-xs tracking-wide text-zinc-500 uppercase">
            <tr>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Live Support Chat</th>
              <th className="px-4 py-3">Account</th>
              <th className="px-4 py-3">Parts Finder</th>
              <th className="px-4 py-3">Wallet (GHS)</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Joined</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-zinc-500">
                  No users found.
                </td>
              </tr>
            ) : visibleUsers.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-zinc-500">
                  No users match this search.{" "}
                  <Link href="/admin/users" className="text-[var(--brand)] hover:underline">
                    Clear filter
                  </Link>
                </td>
              </tr>
            ) : (
              visibleUsers.map((u) => (
                <tr key={u.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                  <td className="px-4 py-3">
                    <p className="font-medium text-white">{u.email}</p>
                    <p className="text-xs text-zinc-500">{u.name ?? "—"}</p>
                    <p className="font-mono text-[10px] text-zinc-600">{u.id}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-md border border-white/10 bg-black/30 px-2 py-0.5 text-xs text-zinc-300">
                      {u.role.replaceAll("_", " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-400">
                    <span
                      className={
                        u.messagingBlocked
                          ? "rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-amber-200"
                          : "rounded-md border border-emerald-500/20 bg-emerald-500/5 px-2 py-0.5 text-emerald-200/90"
                      }
                    >
                      {u.messagingBlocked ? "Blocked" : "Active"}
                    </span>
                    <p className="mt-1.5 max-w-[14rem] leading-snug text-[10px] text-zinc-600">
                      Block or unblock in{" "}
                      <Link href="/admin/comms" className="text-[var(--brand)] hover:underline">
                        Live Support Chat
                      </Link>{" "}
                      (open thread).
                    </p>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <span
                      className={
                        u.accountBlocked
                          ? "rounded-md border border-red-500/35 bg-red-500/10 px-2 py-0.5 text-red-200/95"
                          : "rounded-md border border-emerald-500/20 bg-emerald-500/5 px-2 py-0.5 text-emerald-200/90"
                      }
                    >
                      {u.accountBlocked ? "Suspended" : "OK"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {u.partsFinderMembershipStatus ? (
                      <>
                        <span
                          className={
                            u.partsFinderMembershipStatus === "ACTIVE"
                              ? "rounded-md border border-emerald-500/20 bg-emerald-500/5 px-2 py-0.5 text-emerald-200/90"
                              : u.partsFinderMembershipStatus === "SUSPENDED"
                                ? "rounded-md border border-red-500/35 bg-red-500/10 px-2 py-0.5 text-red-200/95"
                                : "rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-amber-200"
                          }
                        >
                          {u.partsFinderMembershipStatus}
                        </span>
                        <p className="mt-1 text-[10px] text-zinc-500">
                          {u.partsFinderMembershipEndsAt ? `Ends ${u.partsFinderMembershipEndsAt.slice(0, 10)}` : "No expiry"}
                        </p>
                      </>
                    ) : (
                      <span className="text-zinc-500">Not activated</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-zinc-200">{u.walletBalance.toFixed(2)}</td>
                  <td className="px-4 py-3 text-zinc-400">{u.phone ?? "—"}</td>
                  <td className="px-4 py-3 text-xs text-zinc-500">{u.createdAt.slice(0, 10)}</td>
                  <td className="px-4 py-3 text-right">
                    <form action={roleAction} className="inline-flex flex-wrap items-center justify-end gap-2">
                      <input type="hidden" name="userId" value={u.id} />
                      <select
                        key={`${u.id}-${u.role}`}
                        name="role"
                        defaultValue={u.role}
                        className="h-9 max-w-[200px] rounded-lg border border-white/10 bg-black/40 px-2 text-xs text-white outline-none"
                      >
                        {ROLE_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                      <Button type="submit" size="sm" variant="secondary" className="text-xs">
                        Save role
                      </Button>
                    </form>
                    {u.role !== "SUPER_ADMIN" ? (
                      <>
                        <form action={blockAction} className="mt-2 inline-flex justify-end">
                          <input type="hidden" name="userId" value={u.id} />
                          <input type="hidden" name="blocked" value={u.accountBlocked ? "0" : "1"} />
                          <Button type="submit" size="sm" variant={u.accountBlocked ? "outline" : "destructive"} className="text-xs">
                            {u.accountBlocked ? "Lift suspension" : "Suspend account"}
                          </Button>
                        </form>
                        <form action={partsFinderAction} className="mt-2 inline-flex justify-end">
                          <input type="hidden" name="userId" value={u.id} />
                          <input
                            type="hidden"
                            name="action"
                            value={u.partsFinderMembershipStatus === "ACTIVE" ? "DEACTIVATE" : "ACTIVATE"}
                          />
                          <Button
                            type="submit"
                            size="sm"
                            variant={u.partsFinderMembershipStatus === "ACTIVE" ? "destructive" : "outline"}
                            className="text-xs"
                          >
                            {u.partsFinderMembershipStatus === "ACTIVE" ? "Deactivate Parts Finder" : "Activate Parts Finder"}
                          </Button>
                        </form>
                      </>
                    ) : (
                      <p className="mt-2 text-[10px] text-zinc-600">Super admin — use DB for emergencies.</p>
                    )}
                    {canManagePrivileged ? (
                      <>
                        <form action={walletAction} className="mt-2 inline-flex flex-wrap items-center justify-end gap-2">
                          <input type="hidden" name="userId" value={u.id} />
                          <select
                            name="direction"
                            defaultValue="CREDIT"
                            className="h-9 rounded-lg border border-white/10 bg-black/40 px-2 text-xs text-white outline-none"
                          >
                            <option value="CREDIT">Credit</option>
                            <option value="DEBIT">Deduct</option>
                          </select>
                          <input
                            name="amount"
                            type="number"
                            min="0.01"
                            step="0.01"
                            required
                            placeholder="Amount"
                            className="h-9 w-24 rounded-lg border border-white/10 bg-black/40 px-2 text-xs text-white"
                          />
                          <input name="note" placeholder="Note" className="h-9 w-28 rounded-lg border border-white/10 bg-black/40 px-2 text-xs text-white" />
                          <Button type="submit" size="sm" variant="outline" className="text-xs">
                            Apply
                          </Button>
                        </form>
                        <form action={deleteAction} className="mt-2 inline-flex justify-end">
                          <input type="hidden" name="userId" value={u.id} />
                          <Button type="submit" size="sm" variant="destructive" className="text-xs">
                            Delete
                          </Button>
                        </form>
                      </>
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
