import { LegalPage } from "@/components/legal/legal-page";
import { LEGAL_COMPANY, LEGAL_EFFECTIVE_DATE } from "@/lib/legal";

export default function PaymentDisputePolicyPage() {
  return (
    <LegalPage
      title="Payment and Dispute Policy"
      intro={
        <p>
          This policy defines how payment verification, transaction status, and dispute handling work on Spark &amp; Drive
          Gear.
          <br />
          <br />
          <strong>Effective Date:</strong> {LEGAL_EFFECTIVE_DATE}
        </p>
      }
      sections={[
        {
          title: "1. Payment verification",
          body: <p>Payments are considered valid only after verification within our system.</p>,
        },
        {
          title: "2. Control actions",
          body: (
            <ul className="list-disc space-y-2 pl-5">
              <li>request proof</li>
              <li>delay processing</li>
              <li>flag transactions for review</li>
            </ul>
          ),
        },
        {
          title: "3. Transaction statuses",
          body: (
            <p>
              PENDING, PROCESSING, AWAITING_PROOF, UNDER_REVIEW, SUCCESS, FAILED, DISPUTED, REFUNDED, REVERSED
            </p>
          ),
        },
        {
          title: "4. Disputes",
          body: (
            <ul className="list-disc space-y-2 pl-5">
              <li>must be raised through the platform</li>
              <li>may result in temporary restrictions</li>
              <li>are subject to investigation</li>
            </ul>
          ),
        },
        {
          title: "5. Final determination",
          body: <p>Final decisions may involve third-party providers and applicable law.</p>,
        },
      ]}
      footer={
        <div className="space-y-1">
          <p>
            <strong>Payment support:</strong> {LEGAL_COMPANY.email} | {LEGAL_COMPANY.phone}
          </p>
          <p>[{LEGAL_COMPANY.officeAddress}]</p>
          <p>
            <strong>Business Hours:</strong> {LEGAL_COMPANY.workingHours}
          </p>
        </div>
      }
    />
  );
}
