"use client";

type Flattened = {
  fieldErrors: Record<string, string[] | undefined>;
  formErrors: string[];
};

export function AdminZodIssues({ issues }: { issues?: Flattened | null }) {
  if (!issues) return null;
  const fe = Object.entries(issues.fieldErrors).filter(([, v]) => v?.length);
  if (!fe.length && !issues.formErrors.length) return null;
  return (
    <div className="sm:col-span-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
      {issues.formErrors.length > 0 ? (
        <ul className="list-disc pl-4">
          {issues.formErrors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      ) : null}
      {fe.length > 0 ? (
        <ul className={issues.formErrors.length ? "mt-2 space-y-1 text-xs" : "space-y-1 text-xs"}>
          {fe.map(([k, v]) => (
            <li key={k}>
              <span className="font-mono text-red-300">{k}</span>: {v?.join(", ")}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
