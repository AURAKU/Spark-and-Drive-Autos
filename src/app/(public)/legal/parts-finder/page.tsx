import Link from "next/link";

import { LegalPage } from "@/components/legal/legal-page";
import { LEGAL_EFFECTIVE_DATE } from "@/lib/legal";

export default function LegalPartsFinderNoticePage() {
  return (
    <LegalPage
      title="Parts Finder Notice"
      intro={
        <p>
          Results are generated using automated systems, search engine assisted processing, and external data sources.
          <br />
          <br />
          <strong>Effective Date:</strong> {LEGAL_EFFECTIVE_DATE}
        </p>
      }
      sections={[
        {
          title: "No Guarantee",
          body: (
            <ul className="list-disc space-y-2 pl-5">
              <li>exact compatibility</li>
              <li>OEM accuracy</li>
              <li>availability</li>
            </ul>
          ),
        },
        {
          title: "Guidance only",
          body: <p>Results are provided for guidance only.</p>,
        },
        {
          title: "User verification responsibility",
          body: <p>Users must verify all information before purchase or installation.</p>,
        },
        {
          title: "Liability",
          body: <p>Spark &amp; Drive Gear is not liable for damages arising from reliance on unverified results.</p>,
        },
      ]}
      footer={
        <p>
          Need confirmation before buying?{" "}
          <Link href="/dashboard/chats" className="text-[var(--brand)] hover:underline">
            Open support chat
          </Link>
          .
        </p>
      }
    />
  );
}
