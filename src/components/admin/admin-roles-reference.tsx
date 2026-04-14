const ROLES = [
  { id: "CUSTOMER", label: "Customer", note: "Default storefront and dashboard access." },
  {
    id: "SERVICE_ASSISTANT",
    label: "Service assistant",
    note: "Live Support Chat inbox only. Assigned by a super admin under Users. Cannot access inventory, payments, or settings.",
  },
  { id: "SUPER_ADMIN", label: "Super admin", note: "Full operations and configuration." },
  { id: "SALES_ADMIN", label: "Sales admin", note: "Inventory, inquiries, quotes, orders." },
  { id: "SOURCING_MANAGER", label: "Sourcing manager", note: "Supplier and sourcing requests." },
  { id: "LOGISTICS_MANAGER", label: "Logistics manager", note: "Shipping milestones and freight." },
  { id: "FINANCE_ADMIN", label: "Finance admin", note: "Payments, duty, and reconciliation." },
] as const;

export function AdminRolesReference() {
  return (
    <div>
      <h2 className="text-lg font-semibold text-white">Role reference</h2>
      <p className="mt-2 max-w-2xl text-sm text-zinc-400">
        Roles are enforced in middleware for <code className="rounded bg-white/5 px-1">/admin</code> and checked again on
        sensitive server actions. Super admins assign roles from the user directory tab. Service assistants use the same
        chat and inquiry threads as the rest of the team, with route-level restrictions.
      </p>
      <ul className="mt-8 space-y-4">
        {ROLES.map((r) => (
          <li key={r.id} className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4">
            <p className="font-medium text-white">{r.label}</p>
            <p className="mt-1 font-mono text-xs text-zinc-500">{r.id}</p>
            <p className="mt-2 text-sm text-zinc-400">{r.note}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
