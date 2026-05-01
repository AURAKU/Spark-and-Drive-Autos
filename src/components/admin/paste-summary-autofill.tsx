"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const DEFAULT_PLACEHOLDER =
  "Paste or dictate a summary, e.g. Toyota Corolla 2020, white, automatic, 1.8L, 45,000 km, price GHS 95,000…";

type Props = {
  onAutofill: (text: string) => void | Promise<void>;
  className?: string;
};

export function PasteSummaryAutofill({ onAutofill, className }: Props) {
  const [text, setText] = useState("");

  return (
    <div className={className}>
      <Label htmlFor="paste-summary-autofill">Paste summary</Label>
      <Textarea
        id="paste-summary-autofill"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={DEFAULT_PLACEHOLDER}
        className="mt-1 min-h-[100px] resize-y"
        rows={4}
      />
      <Button type="button" variant="secondary" className="mt-2" onClick={() => void onAutofill(text)}>
        Autofill fields
      </Button>
    </div>
  );
}
