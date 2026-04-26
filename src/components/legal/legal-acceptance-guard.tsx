export function LegalAcceptanceGuard({
  allowed,
  fallback,
  children,
}: {
  allowed: boolean;
  fallback: React.ReactNode;
  children: React.ReactNode;
}) {
  return <>{allowed ? children : fallback}</>;
}
