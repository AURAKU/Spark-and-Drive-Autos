import { LegalPage } from "@/components/legal/legal-page";
import { DISPUTE_FLOW_TEXT, LEGAL_COMPANY, LEGAL_EFFECTIVE_DATE } from "@/lib/legal";

export default function SourcingPolicyPage() {
  return (
    <LegalPage
      title="Vehicle and Parts Sourcing Agreement"
      intro={
        <p>
          The customer authorizes Spark &amp; Drive Gear to source vehicles or parts based on submitted specifications.
          Effective date: {LEGAL_EFFECTIVE_DATE}.
        </p>
      }
      sections={[
        {
          title: "Scope",
          body: (
            <p>
              Sourcing is best-effort and dependent on suppliers and third parties.
            </p>
          ),
        },
        {
          title: "No Guarantee",
          body: (
            <p>
              Availability, pricing, condition, and timelines are not guaranteed.
            </p>
          ),
        },
        {
          title: "Payment",
          body: (
            <p>Processing begins only after verified payment.</p>
          ),
        },
        {
          title: "Non-Refundable Costs",
          body: (
            <p>Deposits and supplier-related costs may be non-refundable.</p>
          ),
        },
        {
          title: "Third-Party Dependence",
          body: (
            <p>We rely on suppliers, logistics providers, and authorities.</p>
          ),
        },
        {
          title: "Liability",
          body: (
            <p>We are not responsible for supplier errors, delays, or regulatory issues.</p>
          ),
        },
        {
          title: "Confirmation",
          body: (
            <p>Customer must verify specifications before final commitment.</p>
          ),
        },
        {
          title: "Acceptance",
          body: (
            <p>Proceeding confirms agreement to these terms.</p>
          ),
        },
      ]}
      footer={
        <div className="space-y-3">
          <p>
            <strong>Governing law:</strong> This Sourcing Policy is governed by the laws of Ghana.
          </p>
          <p>{DISPUTE_FLOW_TEXT}</p>
          <p>
            <strong>Sourcing support:</strong> {LEGAL_COMPANY.supportEmail} | {LEGAL_COMPANY.phone}
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
