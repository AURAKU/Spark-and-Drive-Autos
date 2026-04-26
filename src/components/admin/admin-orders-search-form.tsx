"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Props = {
  initialQuery: string;
};

export function AdminOrdersSearchForm({ initialQuery }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(initialQuery);

  useEffect(() => {
    setValue(initialQuery);
  }, [initialQuery]);

  const apply = useCallback(() => {
    const next = new URLSearchParams(searchParams.toString());
    const t = value.trim();
    if (t) next.set("q", t);
    else next.delete("q");
    next.delete("page");
    router.push(`/admin/orders?${next.toString()}`);
  }, [router, searchParams, value]);

  const clear = useCallback(() => {
    setValue("");
    const next = new URLSearchParams(searchParams.toString());
    next.delete("q");
    next.delete("page");
    router.push(`/admin/orders?${next.toString()}`);
  }, [router, searchParams]);

  return (
    <form
      role="search"
      className="flex w-full max-w-xl flex-col gap-2 sm:flex-row sm:items-center"
      onSubmit={(e) => {
        e.preventDefault();
        apply();
      }}
    >
      <Input
        type="search"
        name="q"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Reference, item, amount, customer…"
        className="h-10 flex-1 border-border bg-background text-foreground placeholder:text-muted-foreground"
        autoComplete="off"
        enterKeyHint="search"
        aria-label="Search orders"
      />
      <div className="flex shrink-0 gap-2">
        <Button type="submit" className="h-10" variant="default">
          Search
        </Button>
        {initialQuery ? (
          <Button type="button" variant="outline" className="h-10 border-border" onClick={clear}>
            Clear
          </Button>
        ) : null}
      </div>
    </form>
  );
}
