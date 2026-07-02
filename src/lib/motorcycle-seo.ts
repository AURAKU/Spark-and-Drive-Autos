export function generateMotorcycleSeo(params: {
  year: number;
  brand: string;
  model: string;
  variant?: string | null;
  sourceType: string;
}): { seoTitle: string; seoDescription: string; slugBase: string } {
  const name = [params.year, params.brand, params.model, params.variant].filter(Boolean).join(" ");
  const origin =
    params.sourceType === "IN_CHINA"
      ? "imported from China with worldwide shipping"
      : params.sourceType === "IN_GHANA"
        ? "available in Ghana"
        : "available for import";
  return {
    seoTitle: `${name} For Sale | Spark & Drive Autos`,
    seoDescription: `Buy a ${name} ${origin}. Reserve online with flexible payment options.`,
    slugBase: `${params.brand}-${params.model}-${params.year}`.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
  };
}
