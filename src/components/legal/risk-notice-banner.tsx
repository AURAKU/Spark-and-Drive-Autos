export function RiskNoticeBanner({ message }: { message: string }) {
  return (
    <p className="rounded-xl border border-amber-500/35 bg-amber-500/12 px-3.5 py-2.5 text-sm font-medium leading-relaxed text-amber-800 dark:text-amber-100">
      {message}
    </p>
  );
}
