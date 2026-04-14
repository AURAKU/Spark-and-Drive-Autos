import { PageHeading } from "@/components/typography/page-headings";

export function AdminPlaceholder({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <PageHeading variant="dashboard">{title}</PageHeading>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}
