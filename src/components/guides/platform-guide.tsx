"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Bike,
  Calculator,
  Car,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  MessageCircle,
  ScrollText,
  Search,
  ShoppingBag,
  UserRound,
  XIcon,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Suspense,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

import { GuidePageMock } from "@/components/guides/guide-page-mock";
import {
  PLATFORM_GUIDE_JOURNEYS,
  type GuideIconName,
  type GuideJourney,
  type GuideMockKind,
} from "@/components/guides/platform-guide-data";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ICONS: Record<GuideIconName, typeof Car> = {
  car: Car,
  parts: ShoppingBag,
  finder: Search,
  request: ClipboardList,
  bike: Bike,
  duty: Calculator,
  account: UserRound,
  chat: MessageCircle,
  policies: ScrollText,
};

const ACCENT: Record<GuideJourney["accent"], string> = {
  brand: "border-[var(--brand)]/35 hover:border-[var(--brand)]/70 hover:shadow-[0_18px_40px_-28px_rgba(20,216,230,0.55)]",
  gear: "border-red-500/35 hover:border-red-500/60 hover:shadow-[0_18px_40px_-28px_rgba(239,68,68,0.45)]",
  finder: "border-orange-500/35 hover:border-orange-500/60 hover:shadow-[0_18px_40px_-28px_rgba(249,115,22,0.45)]",
};

const ICON_TONE: Record<GuideJourney["accent"], string> = {
  brand: "bg-[var(--brand)]/12 text-[var(--brand-readable)]",
  gear: "bg-red-500/12 text-red-700 dark:text-red-300",
  finder: "bg-orange-500/12 text-orange-800 dark:text-orange-300",
};

const MOCK_PATH: Record<GuideMockKind, string> = {
  header: "/",
  home: "/",
  inventory: "/inventory",
  "car-detail": "/cars/…",
  checkout: "/checkout",
  parts: "/parts",
  "parts-finder": "/parts-finder",
  "request-car": "/request-a-car",
  "request-parts": "/request-autoparts",
  motorcycles: "/motorcycles",
  duty: "/inventory",
  dashboard: "/dashboard",
  "ghana-card": "/dashboard/profile",
  wallet: "/dashboard/profile",
  receipts: "/dashboard/receipts",
  "chat-gate": "/chat",
  "chat-thread": "/chat",
  policies: "/policies",
};

function chromePathFor(kind: GuideMockKind, route: string) {
  return MOCK_PATH[kind] ?? route.split("?")[0] ?? "/";
}

export function PlatformGuide() {
  return (
    <Suspense fallback={<PlatformGuideSkeleton />}>
      <PlatformGuideInner />
    </Suspense>
  );
}

function PlatformGuideSkeleton() {
  return (
    <section className="mt-12" aria-hidden>
      <div className="sda-hero-panel">
        <p className="text-[11px] font-semibold tracking-[0.2em] text-[var(--brand-readable)] uppercase">
          Platform guide
        </p>
        <h2 className="mt-2 text-xl font-bold tracking-tight text-[var(--brand-readable)] sm:text-2xl">
          How to navigate Spark &amp; Drive Autos
        </h2>
      </div>
    </section>
  );
}

function PlatformGuideInner() {
  const searchParams = useSearchParams();
  const reduceMotion = useReducedMotion();
  const titleId = useId();
  const descId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  const journey = useMemo(
    () => PLATFORM_GUIDE_JOURNEYS.find((item) => item.id === activeId) ?? null,
    [activeId],
  );
  const step = journey?.steps[stepIndex];
  const totalSteps = journey?.steps.length ?? 0;
  const progress = totalSteps > 0 ? ((stepIndex + 1) / totalSteps) * 100 : 0;

  const openJourney = useCallback((id: string) => {
    setStepIndex(0);
    setActiveId(id);
    setOpen(true);
  }, []);

  const onOpenChange = useCallback((next: boolean) => {
    setOpen(next);
  }, []);

  useEffect(() => {
    const requested = searchParams.get("guide");
    if (requested && PLATFORM_GUIDE_JOURNEYS.some((item) => item.id === requested)) {
      setStepIndex(0);
      setActiveId(requested);
      setOpen(true);
    }
  }, [searchParams]);

  const goPrev = useCallback(() => {
    setStepIndex((current) => Math.max(0, current - 1));
  }, []);

  const goNext = useCallback(() => {
    setStepIndex((current) => {
      if (!journey) return current;
      return Math.min(journey.steps.length - 1, current + 1);
    });
  }, [journey]);

  const onDialogKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "ArrowRight") {
        event.preventDefault();
        goNext();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        goPrev();
      }
    },
    [goNext, goPrev],
  );

  return (
    <section id="platform-guide" aria-labelledby={titleId} className="mt-12">
      <div className="sda-hero-panel">
        <p className="text-[11px] font-semibold tracking-[0.2em] text-[var(--brand-readable)] uppercase">
          Platform guide
        </p>
        <h2 id={titleId} className="mt-2 text-xl font-bold tracking-tight text-[var(--brand-readable)] sm:text-2xl">
          How to navigate Spark &amp; Drive Autos
        </h2>
        <p id={descId} className="sda-readable-muted mt-3 max-w-3xl text-sm leading-relaxed">
          Open a guide to see how each live page looks, where to tap next, and when you need an account. Guides work
          for guests. You only sign in when a step says so. Use the header on every page: logo for Home and Dashboard,
          theme in the centre, account and currency on the right.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="sda-chip-ok">No login to view guides</span>
          <span className="sda-chip-info">Escape closes a walkthrough</span>
          <span className="sda-chip-neutral">Arrow keys move between steps</span>
        </div>
      </div>

      <ul className="mt-6 grid gap-3 sm:grid-cols-2">
        {PLATFORM_GUIDE_JOURNEYS.map((item, index) => {
          const Icon = ICONS[item.icon];
          return (
            <motion.li
              key={item.id}
              className="min-w-0"
              initial={reduceMotion ? false : { opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={
                reduceMotion ? { duration: 0 } : { duration: 0.42, delay: index * 0.045, ease: [0.22, 1, 0.36, 1] }
              }
            >
              <button
                type="button"
                onClick={() => openJourney(item.id)}
                aria-haspopup="dialog"
                className={cn(
                  "flex h-full min-h-[11.5rem] w-full flex-col rounded-2xl border bg-card p-4 text-left text-card-foreground transition",
                  ACCENT[item.accent],
                )}
              >
                <span className={cn("grid size-10 place-items-center rounded-xl", ICON_TONE[item.accent])}>
                  <Icon className="size-5" aria-hidden />
                </span>
                <span className="mt-3 text-base font-semibold tracking-tight text-foreground">{item.title}</span>
                <span className="sda-readable-muted mt-1.5 flex-1 text-sm leading-relaxed">{item.summary}</span>
                <span className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="sda-chip-neutral">{item.duration}</span>
                  {item.guestOk ? <span className="sda-chip-ok">Guest friendly</span> : null}
                  <span className="text-xs font-semibold text-[var(--brand-readable)]">Start guide</span>
                </span>
              </button>
            </motion.li>
          );
        })}
      </ul>

      <DialogPrimitive.Root
        open={open}
        onOpenChange={onOpenChange}
        onOpenChangeComplete={(next) => {
          if (!next) setActiveId(null);
        }}
        modal
      >
        <DialogPrimitive.Portal>
          <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-zinc-950/55 supports-backdrop-filter:backdrop-blur-md data-closed:animate-out data-closed:fade-out-0 data-open:animate-in data-open:fade-in-0 dark:bg-black/70" />
          {journey && step ? (
            <DialogPrimitive.Popup
              ref={panelRef}
              tabIndex={-1}
              initialFocus={panelRef}
              aria-labelledby={`${titleId}-dialog`}
              aria-describedby={`${titleId}-step`}
              className="fixed top-1/2 left-1/2 z-50 grid h-[min(92dvh,54rem)] max-h-[min(94dvh,56rem)] w-[calc(100%-0.75rem)] max-w-5xl -translate-x-1/2 -translate-y-1/2 grid-rows-[auto_auto_minmax(0,1fr)_auto] overflow-hidden rounded-2xl border border-border bg-popover text-popover-foreground shadow-2xl outline-none sm:w-[calc(100%-1.5rem)]"
              onKeyDown={onDialogKeyDown}
            >
              <div className="sda-safe-top flex items-start justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
                <div className="min-w-0">
                  <DialogPrimitive.Title
                    id={`${titleId}-dialog`}
                    className="text-base font-semibold tracking-tight text-foreground sm:text-lg"
                  >
                    {journey.title}
                  </DialogPrimitive.Title>
                  <p className="sda-readable-muted mt-0.5 text-xs">
                    Step {stepIndex + 1} of {totalSteps}
                    {step.needsAccount ? " · Account needed for this step" : ""}
                  </p>
                </div>
                <DialogPrimitive.Close
                  aria-label="Close platform guide"
                  className="grid size-9 shrink-0 place-items-center rounded-lg border border-border text-foreground transition hover:bg-muted"
                >
                  <XIcon className="size-4" />
                </DialogPrimitive.Close>
              </div>

              <div className="h-1 bg-muted">
                <motion.div
                  className="h-full bg-[var(--brand)]"
                  initial={false}
                  animate={{ width: `${progress}%` }}
                  transition={reduceMotion ? { duration: 0 } : { duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                />
              </div>

              <div className="min-h-0 overflow-y-auto overscroll-contain">
                <div className="grid gap-4 p-4 pt-5 sm:p-5 lg:grid-cols-[13.5rem_minmax(0,1fr)]">
                  <ol className="hidden gap-1 lg:flex lg:flex-col" aria-label="Guide steps">
                    {journey.steps.map((item, index) => {
                      const current = index === stepIndex;
                      return (
                        <li key={item.id}>
                          <button
                            type="button"
                            onClick={() => setStepIndex(index)}
                            aria-current={current ? "step" : undefined}
                            className={cn(
                              "flex w-full items-start gap-2 rounded-xl px-2.5 py-2 text-left text-xs transition",
                              current
                                ? "bg-[var(--brand)]/12 font-semibold text-foreground"
                                : "text-foreground/80 hover:bg-muted",
                            )}
                          >
                            <span
                              className={cn(
                                "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full text-[10px]",
                                current
                                  ? "bg-[var(--brand)] font-bold text-black"
                                  : "border border-border bg-background",
                              )}
                            >
                              {index + 1}
                            </span>
                            <span className="min-w-0 leading-snug">{item.title}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ol>

                  <div className="min-w-0">
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={step.id}
                        initial={reduceMotion ? { opacity: 1 } : { opacity: 0, x: 28 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={reduceMotion ? { opacity: 1 } : { opacity: 0, x: -28 }}
                        transition={reduceMotion ? { duration: 0 } : { duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                        className="pb-2"
                      >
                        <div className="mb-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-[11px] font-semibold tracking-[0.16em] text-[var(--brand-readable)] uppercase">
                              Where to tap
                            </p>
                            {step.needsAccount ? (
                              <span className="sda-chip-warn">Account required</span>
                            ) : (
                              <span className="sda-chip-ok">Guest friendly</span>
                            )}
                          </div>
                          <DialogPrimitive.Description
                            id={`${titleId}-step`}
                            className="mt-1.5 text-sm font-semibold leading-relaxed text-foreground"
                          >
                            {step.tap}
                          </DialogPrimitive.Description>
                          <p className="sda-readable-muted mt-2 text-sm leading-relaxed">{step.detail}</p>
                        </div>
                        <GuidePageMock kind={step.mock} highlight={step.highlight} path={chromePathFor(step.mock, step.route)} />
                      </motion.div>
                    </AnimatePresence>
                  </div>
                </div>
              </div>

              <div className="sda-action-row border-t border-border bg-muted/50 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:justify-between sm:px-5">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={goPrev}
                    disabled={stepIndex === 0}
                    className={cn(buttonVariants({ variant: "outline" }), "h-9 gap-1 px-3")}
                  >
                    <ChevronLeft className="size-4" aria-hidden />
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={goNext}
                    disabled={stepIndex >= totalSteps - 1}
                    className={cn(
                      buttonVariants(),
                      "h-9 gap-1 bg-[var(--brand)] px-3 font-semibold text-black hover:opacity-90",
                    )}
                  >
                    Next
                    <ChevronRight className="size-4" aria-hidden />
                  </button>
                </div>
                <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
                  <ol className="flex flex-wrap gap-1 lg:hidden" aria-label="Guide progress">
                    {journey.steps.map((item, index) => (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => setStepIndex(index)}
                          aria-label={`Step ${index + 1}: ${item.title}`}
                          aria-current={index === stepIndex ? "step" : undefined}
                          className={cn(
                            "size-2.5 rounded-full",
                            index === stepIndex ? "bg-[var(--brand)]" : "bg-foreground/25",
                          )}
                        />
                      </li>
                    ))}
                  </ol>
                  <Link
                    href={step.route}
                    className={cn(
                      buttonVariants({ variant: "outline" }),
                      "h-9 border-[var(--brand)]/40 px-3 font-semibold text-[var(--brand-readable)]",
                    )}
                  >
                    {step.routeLabel}
                  </Link>
                </div>
              </div>
            </DialogPrimitive.Popup>
          ) : null}
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </section>
  );
}
