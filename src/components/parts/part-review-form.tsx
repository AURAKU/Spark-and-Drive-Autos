"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";

import { submitPartReviewAction, type PartReviewActionState } from "@/actions/part-reviews";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="mt-3">
      {pending ? "Sending…" : "Submit review"}
    </Button>
  );
}

type Props = {
  partId: string;
};

export function PartReviewForm({ partId }: Props) {
  const router = useRouter();
  const [state, formAction] = useActionState(submitPartReviewAction, null as PartReviewActionState | null);

  useEffect(() => {
    if (state?.ok) {
      toast.success("Thanks — your review is now live.");
      router.refresh();
    } else if (state?.error) toast.error(state.error);
  }, [state, router]);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="partId" value={partId} />
      <div className="space-y-2">
        <Label className="text-xs text-zinc-400">Rating</Label>
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <label
              key={n}
              className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-white/15 bg-black/30 px-2.5 py-1.5 text-sm text-zinc-200 has-[:checked]:border-[var(--brand)] has-[:checked]:text-white"
            >
              <input type="radio" name="rating" value={String(n)} required className="sr-only" />
              <span className="text-amber-400">{"★".repeat(n)}</span>
            </label>
          ))}
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="part-review-body" className="text-xs text-zinc-400">
          Your experience
        </Label>
        <Textarea
          id="part-review-body"
          name="body"
          required
          minLength={10}
          maxLength={4000}
          rows={4}
          placeholder="Quality, fit, delivery — what should other buyers know?"
          className="border-white/15 bg-black/40 text-sm"
        />
      </div>
      <SubmitButton />
    </form>
  );
}
