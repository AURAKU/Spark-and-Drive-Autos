"use client";

import { CarRequestSourcePref, EngineType } from "@prisma/client";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { cn } from "@/lib/utils";
import { toast } from "sonner";

import { PageHeading } from "@/components/typography/page-headings";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const CALLBACK = "/request-a-car";

function RequestACarForm() {
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard/requests";
  const [loading, setLoading] = useState(false);

  const registerHref = `/register?callbackUrl=${encodeURIComponent(CALLBACK)}`;
  const loginHref = `/login?callbackUrl=${encodeURIComponent(CALLBACK)}`;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!session?.user) {
      toast.error("Sign in to submit a vehicle request.");
      return;
    }
    const fd = new FormData(e.currentTarget);
    setLoading(true);
    try {
      const res = await fetch("/api/car-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guestName: fd.get("guestName"),
          guestEmail: session.user.email,
          guestPhone: fd.get("guestPhone"),
          country: fd.get("country"),
          brand: fd.get("brand"),
          model: fd.get("model"),
          yearFrom: fd.get("yearFrom") ? Number(fd.get("yearFrom")) : undefined,
          yearTo: fd.get("yearTo") ? Number(fd.get("yearTo")) : undefined,
          trim: fd.get("trim") || undefined,
          engineType: fd.get("engineType") || undefined,
          transmission: fd.get("transmission") || undefined,
          colorPreference: fd.get("colorPreference") || undefined,
          budgetMin: fd.get("budgetMin") ? Number(fd.get("budgetMin")) : undefined,
          budgetMax: fd.get("budgetMax") ? Number(fd.get("budgetMax")) : undefined,
          destinationCountry: fd.get("destinationCountry") || undefined,
          destinationCity: fd.get("destinationCity") || undefined,
          sourcePreference: fd.get("sourcePreference") ?? CarRequestSourcePref.EITHER,
          notes: fd.get("notes") || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      toast.success("Request received. Our sourcing team will follow up.");
      e.currentTarget.reset();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  if (status === "loading") {
    return <div className="mx-auto max-w-3xl px-4 py-16 text-sm text-zinc-500 sm:px-6">Loading…</div>;
  }

  if (status !== "authenticated" || !session.user) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 sm:px-6">
        <PageHeading>Request a car</PageHeading>
        <p className="mt-4 text-sm leading-relaxed text-zinc-400">
          Vehicle sourcing requests are available to signed-in customers only, so we can match your enquiry to your
          account, send updates, and keep everything in one place. Create a free account or sign in to continue.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            href={registerHref}
            className={cn(
              buttonVariants({ size: "default" }),
              "bg-[var(--brand)] text-center font-semibold text-black hover:opacity-90",
            )}
          >
            Create an account
          </Link>
          <Link
            href={loginHref}
            className={cn(buttonVariants({ variant: "outline", size: "default" }), "border-white/20 text-center")}
          >
            Sign in
          </Link>
        </div>
        <p className="mt-6 text-xs text-zinc-600">
          After signing in you&apos;ll return here to complete your request. You can also open{" "}
          <Link href={callbackUrl} className="text-[var(--brand)] hover:underline">
            your dashboard
          </Link>{" "}
          from the menu.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <PageHeading>Request a car</PageHeading>
      <p className="mt-3 text-sm text-zinc-400">
        Tell us what you are looking for—Ghana inventory, China sourcing, or either. This creates a sourcing lead for our
        team. Track submissions under{" "}
        <Link href="/dashboard/requests" className="text-[var(--brand)] hover:underline">
          Sourcing requests
        </Link>
        .
      </p>

      <form onSubmit={onSubmit} className="mt-10 grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor="guestName">Full name</Label>
          <Input
            id="guestName"
            name="guestName"
            required
            className="mt-1"
            defaultValue={session.user.name ?? ""}
          />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="accountEmail">Account email</Label>
          <Input id="accountEmail" readOnly className="mt-1 bg-white/5 text-zinc-400" value={session.user.email ?? ""} />
        </div>
        <div>
          <Label htmlFor="guestPhone">Phone / WhatsApp</Label>
          <Input id="guestPhone" name="guestPhone" required className="mt-1" />
        </div>
        <div>
          <Label htmlFor="country">Country</Label>
          <Input id="country" name="country" placeholder="Ghana" className="mt-1" />
        </div>
        <div>
          <Label htmlFor="brand">Make</Label>
          <Input id="brand" name="brand" required className="mt-1" />
        </div>
        <div>
          <Label htmlFor="model">Model</Label>
          <Input id="model" name="model" required className="mt-1" />
        </div>
        <div>
          <Label htmlFor="yearFrom">Year from</Label>
          <Input id="yearFrom" name="yearFrom" type="number" className="mt-1" />
        </div>
        <div>
          <Label htmlFor="yearTo">Year to</Label>
          <Input id="yearTo" name="yearTo" type="number" className="mt-1" />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="trim">Trim</Label>
          <Input id="trim" name="trim" className="mt-1" />
        </div>
        <div>
          <Label htmlFor="engineType">Engine</Label>
          <select
            id="engineType"
            name="engineType"
            className="mt-1 h-10 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white"
            defaultValue=""
          >
            <option value="">Any</option>
            {Object.values(EngineType).map((v) => (
              <option key={v} value={v}>
                {v.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="transmission">Transmission</Label>
          <Input id="transmission" name="transmission" className="mt-1" />
        </div>
        <div>
          <Label htmlFor="colorPreference">Color preference</Label>
          <Input id="colorPreference" name="colorPreference" className="mt-1" />
        </div>
        <div>
          <Label htmlFor="budgetMin">Budget min</Label>
          <Input id="budgetMin" name="budgetMin" type="number" className="mt-1" />
        </div>
        <div>
          <Label htmlFor="budgetMax">Budget max</Label>
          <Input id="budgetMax" name="budgetMax" type="number" className="mt-1" />
        </div>
        <div>
          <Label htmlFor="destinationCountry">Destination country</Label>
          <Input id="destinationCountry" name="destinationCountry" className="mt-1" />
        </div>
        <div>
          <Label htmlFor="destinationCity">Destination city</Label>
          <Input id="destinationCity" name="destinationCity" placeholder="Accra" className="mt-1" />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="sourcePreference">Source preference</Label>
          <select
            id="sourcePreference"
            name="sourcePreference"
            defaultValue={CarRequestSourcePref.EITHER}
            className="mt-1 h-10 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white"
          >
            <option value={CarRequestSourcePref.CHINA}>China</option>
            <option value={CarRequestSourcePref.GHANA}>Ghana</option>
            <option value={CarRequestSourcePref.EITHER}>Either</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="notes">Notes</Label>
          <Textarea id="notes" name="notes" rows={5} className="mt-1" />
        </div>
        <div className="sm:col-span-2">
          <Button type="submit" disabled={loading}>
            {loading ? "Submitting…" : "Submit request"}
          </Button>
        </div>
      </form>
    </div>
  );
}

export default function RequestACarPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-3xl px-4 py-16 text-sm text-zinc-500">Loading…</div>}>
      <RequestACarForm />
    </Suspense>
  );
}
