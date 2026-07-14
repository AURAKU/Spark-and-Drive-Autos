import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Duty Estimate Report | Spark & Drive Autos",
  robots: { index: false, follow: false },
};

export default function DutyReportLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-neutral-100 text-neutral-900 print:bg-white">
      <style>{`
        @page { size: A4; margin: 12mm; }
        @media print {
          html, body { background: white !important; }
          .no-print { display: none !important; }
          .duty-report-sheet { box-shadow: none !important; max-width: none !important; }
          thead { display: table-header-group; }
          tr, .break-inside-avoid { break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>
      {children}
    </div>
  );
}
