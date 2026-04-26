"use client";

import { UserRole } from "@prisma/client";
import { MessageCircle } from "lucide-react";
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
import { cn } from "@/lib/utils";

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: "CUSTOMER", label: "Customer" },
  { value: "SERVICE_ASSISTANT", label: "Service assistant" },
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
  /** Latest customer chat thread, if any — deep-link from message action. */
  supportChatThreadId: string | null;
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
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">SUPER_ADMIN is static/permanent and cannot be created or reassigned from this panel.</p>
          <form
            action={createAction}
            className="grid gap-2 rounded-2xl border border-border bg-card/40 p-4 sm:grid-cols-5 dark:border-white/10 dark:bg-white/[0.03]"
          >
          <input
            name="email"
            required
            type="email"
            placeholder="Email"
            className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground dark:border-white/10 dark:bg-black/40 dark:text-white"
          />
          <input
            name="name"
            required
            placeholder="Full name"
            className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground dark:border-white/10 dark:bg-black/40 dark:text-white"
          />
          <input
            name="password"
            required
            type="password"
            placeholder="Temporary password"
            className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground dark:border-white/10 dark:bg-black/40 dark:text-white"
          />
          <select
            name="role"
            defaultValue="CUSTOMER"
            className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground dark:border-white/10 dark:bg-black/40 dark:text-white"
          >
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
        </div>
      ) : null}
      <div className="overflow-x-auto rounded-2xl border border-border bg-card/30 shadow-sm ring-1 ring-border/30 dark:border-white/10 dark:bg-transparent dark:ring-white/5">
        <table className="w-full min-w-[920px] text-left text-sm">
          <thead className="border-b border-border bg-muted/50 text-xs font-medium tracking-wide text-muted-foreground dark:border-white/10 dark:bg-white/[0.03]">
            <tr>
              <th className="px-3 py-3">User</th>
              <th className="px-3 py-3">Role</th>
              <th className="px-3 py-3">Account</th>
              <th className="px-3 py-3">Parts Finder</th>
              <th className="px-3 py-3 whitespace-nowrap">Wallet</th>
              <th className="px-3 py-3">Phone</th>
              <th className="px-3 py-3 whitespace-nowrap">Joined</th>
              <th className="px-3 py-3 text-right min-w-[14rem]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                  No users found.
                </td>
              </tr>
            ) : visibleUsers.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                  No users match this search.{" "}
                  <Link href="/admin/users" className="text-[var(--brand)] hover:underline">
                    Clear filter
                  </Link>
                </td>
              </tr>
            ) : (
              visibleUsers.map((u) => {
                const commsHref = u.supportChatThreadId
                  ? `/admin/comms?view=chats&thread=${encodeURIComponent(u.supportChatThreadId)}`
                  : `/admin/comms?view=chats`;
                return (
                  <tr
                    key={u.id}
                    className="border-b border-border/60 last:border-0 hover:bg-muted/35 dark:border-white/5 dark:hover:bg-white/[0.02]"
                  >
                    <td className="max-w-[14rem] px-3 py-3 align-top">
                      <p className="truncate font-medium text-foreground" title={u.email}>
                        {u.email}
                      </p>
                      <p className="truncate text-xs text-muted-foreground" title={u.name ?? undefined}>
                        {u.name ?? "—"}
                      </p>
                      <p className="truncate font-mono text-[10px] text-muted-foreground/80" title={u.id}>
                        {u.id}
                      </p>
                    </td>
                    <td className="px-3 py-3 align-top">
                      <span className="inline-flex rounded-md border border-border bg-muted/40 px-2 py-0.5 text-xs text-foreground/90 dark:border-white/10 dark:bg-black/30 dark:text-zinc-300">
                        {u.role.replaceAll("_", " ")}
                      </span>
                    </td>
                    <td className="px-3 py-3 align-top text-xs">
                      <span
                        className={
                          u.accountBlocked
                            ? "rounded-md border border-red-500/35 bg-red-500/10 px-2 py-0.5 text-red-700 dark:text-red-200/95"
                            : "rounded-md border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-emerald-800 dark:text-emerald-200/90"
                        }
                      >
                        {u.accountBlocked ? "Suspended" : "OK"}
                      </span>
                    </td>
                    <td className="px-3 py-3 align-top text-xs">
                      {u.partsFinderMembershipStatus ? (
                        <>
                          <span
                            className={
                              u.partsFinderMembershipStatus === "ACTIVE"
                                ? "rounded-md border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-emerald-800 dark:text-emerald-200/90"
                                : u.partsFinderMembershipStatus === "SUSPENDED"
                                  ? "rounded-md border border-red-500/35 bg-red-500/10 px-2 py-0.5 text-red-700 dark:text-red-200/95"
                                  : "rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-amber-900 dark:text-amber-200"
                            }
                          >
                            {u.partsFinderMembershipStatus}
                          </span>
                          <p className="mt-1 text-[10px] text-muted-foreground">
                            {u.partsFinderMembershipEndsAt ? `Ends ${u.partsFinderMembershipEndsAt.slice(0, 10)}` : "No expiry"}
                          </p>
                        </>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 align-top tabular-nums text-foreground">{u.walletBalance.toFixed(2)}</td>
                    <td className="max-w-[7rem] truncate px-3 py-3 align-top text-muted-foreground" title={u.phone ?? undefined}>
                      {u.phone ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 align-top text-xs text-muted-foreground">{u.createdAt.slice(0, 10)}</td>
                    <td className="px-3 py-3 align-top text-right">
                      <div className="flex flex-col items-stretch gap-2 sm:items-end">
                        <div className="flex flex-wrap items-center justify-end gap-1.5">
                          <Link
                            href={commsHref}
                            scroll={false}
                            className={cn(
                              "inline-flex size-9 shrink-0 items-center justify-center rounded-lg border text-foreground shadow-sm transition",
                              u.messagingBlocked
                                ? "border-amber-500/40 bg-amber-500/10 text-amber-800 hover:bg-amber-500/15 dark:text-amber-200"
                                : "border-border bg-card hover:border-[var(--brand)]/40 hover:bg-muted/50 dark:border-white/15 dark:bg-white/[0.04]",
                            )}
                            title={
                              u.messagingBlocked
                                ? "Messaging blocked — open Live Support to manage"
                                : u.supportChatThreadId
                                  ? "Open latest chat thread"
                                  : "Live Support — no thread yet; open hub"
                            }
                            aria-label={
                              u.messagingBlocked
                                ? "Live support (messaging blocked for user)"
                                : "Open live support chat for this user"
                            }
                          >
                            <MessageCircle className="size-4" strokeWidth={2} aria-hidden />
                          </Link>
                          <form action={roleAction} className="inline-flex max-w-full flex-wrap items-center justify-end gap-1.5">
                            <input type="hidden" name="userId" value={u.id} />
                            <select
                              key={`${u.id}-${u.role}`}
                              name="role"
                              defaultValue={u.role}
                              className="h-9 max-w-[10.5rem] rounded-lg border border-border bg-background px-2 text-xs text-foreground outline-none dark:border-white/10 dark:bg-black/40 dark:text-white"
                            >
                              {ROLE_OPTIONS.map((o) => (
                                <option key={o.value} value={o.value}>
                                  {o.label}
                                </option>
                              ))}
                            </select>
                            <Button type="submit" size="sm" variant="secondary" className="h-9 shrink-0 text-xs">
                              Save
                            </Button>
                          </form>
                        </div>
                        {u.role !== "SUPER_ADMIN" ? (
                          <div className="flex flex-wrap justify-end gap-1.5">
                            <form action={blockAction} className="inline-flex">
                              <input type="hidden" name="userId" value={u.id} />
                              <input type="hidden" name="blocked" value={u.accountBlocked ? "0" : "1"} />
                              <Button type="submit" size="sm" variant={u.accountBlocked ? "outline" : "destructive"} className="h-8 text-xs">
                                {u.accountBlocked ? "Unsuspend" : "Suspend"}
                              </Button>
                            </form>
                            <form action={partsFinderAction} className="inline-flex">
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
                                className="h-8 text-xs"
                              >
                                {u.partsFinderMembershipStatus === "ACTIVE" ? "PF off" : "PF on"}
                              </Button>
                            </form>
                          </div>
                        ) : (
                          <p className="text-[10px] text-muted-foreground">Super admin — limited actions.</p>
                        )}
                        {canManagePrivileged ? (
                          <div className="flex w-full max-w-[20rem] flex-col items-end gap-1.5 border-t border-border/50 pt-2 dark:border-white/10">
                            <form action={walletAction} className="flex w-full flex-wrap items-center justify-end gap-1.5">
                              <input type="hidden" name="userId" value={u.id} />
                              <select
                                name="direction"
                                defaultValue="CREDIT"
                                className="h-8 rounded-lg border border-border bg-background px-2 text-xs text-foreground dark:border-white/10 dark:bg-black/40 dark:text-white"
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
                                placeholder="Amt"
                                className="h-8 w-20 rounded-lg border border-border bg-background px-2 text-xs text-foreground dark:border-white/10 dark:bg-black/40 dark:text-white"
                              />
                              <input
                                name="note"
                                placeholder="Note"
                                className="h-8 min-w-0 flex-1 rounded-lg border border-border bg-background px-2 text-xs text-foreground dark:border-white/10 dark:bg-black/40 dark:text-white sm:max-w-[6rem]"
                              />
                              <Button type="submit" size="sm" variant="outline" className="h-8 text-xs">
                                Wallet
                              </Button>
                            </form>
                            <form action={deleteAction} className="inline-flex justify-end">
                              <input type="hidden" name="userId" value={u.id} />
                              <Button type="submit" size="sm" variant="destructive" className="h-8 text-xs">
                                Delete
                              </Button>
                            </form>
                          </div>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
