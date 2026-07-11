import { NextResponse } from "next/server";

import { resolveIntakeQuestions } from "@/lib/duty-intelligence/intake-questions";
import { minimumIntakeSchema } from "@/lib/duty-intelligence/intake-schema";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = minimumIntakeSchema.partial().safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid intake context", details: parsed.error.flatten() }, { status: 400 });
    }

    const questions = resolveIntakeQuestions({
      input: parsed.data,
      expertMode: parsed.data.expertMode,
      hasShippingConfig: body.hasShippingConfig !== false,
      hasInsuranceConfig: body.hasInsuranceConfig !== false,
      modelLookupUncertain: body.modelLookupUncertain === true,
      needsDepreciation: body.needsDepreciation === true,
      classificationUnresolved: body.classificationUnresolved === true,
      inferredFromInventory: Boolean(parsed.data.carId),
    });

    return NextResponse.json({
      questions,
      required: questions.filter((q) => q.required).map((q) => q.id),
    });
  } catch (error) {
    console.error("[duty-intelligence/intake-questions]", error);
    return NextResponse.json({ error: "INTAKE_QUESTIONS_FAILED" }, { status: 500 });
  }
}
