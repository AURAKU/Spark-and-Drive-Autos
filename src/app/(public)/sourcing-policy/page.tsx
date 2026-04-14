import { LegalPage } from "@/components/legal/legal-page";
import { DISPUTE_FLOW_TEXT, LEGAL_COMPANY, LEGAL_EFFECTIVE_DATE } from "@/lib/legal";

export default function SourcingPolicyPage() {
  return (
    <LegalPage
      title="Sourcing Policy"
      intro={
        <p>
          This policy explains how we handle sourcing requests for vehicles, parts, and accessories from local and
          international channels. Effective date: {LEGAL_EFFECTIVE_DATE}.
        </p>
      }
      sections={[
        {
          title: "1. Best-effort sourcing model",
          body: (
            <p>
              Sourcing support is provided on a best-effort basis using available supplier networks. Submitting a request
              does not guarantee that a product will be located, secured, or delivered within a specific timeline.
            </p>
          ),
        },
        {
          title: "2. Specification and approval workflow",
          body: (
            <p>
              We rely on customer-provided specifications and approvals before making commitments. Customers are expected
              to review key details, including model, condition expectations, compatibility, and price range, before
              confirmation.
            </p>
          ),
        },
        {
          title: "3. Price and timeline variability",
          body: (
            <p>
              Sourcing prices and timelines may change due to supplier availability, demand shifts, freight conditions,
              exchange-rate movements, and regulatory charges. Quotations are time-sensitive unless expressly fixed in
              writing.
            </p>
          ),
        },
        {
          title: "4. Shipping, customs, and third-party risks",
          body: (
            <p>
              International movement depends on third-party carriers, ports, and customs authorities. Delays, additional
              charges, inspections, or handling constraints can occur outside our direct control.
            </p>
          ),
        },
        {
          title: "5. Deposits and financial commitment",
          body: (
            <p>
              Some sourcing assignments require a deposit before supplier commitment. Deposits may be non-refundable once
              procurement, inspection, or third-party obligations have started.
            </p>
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
        </div>
      }
    />
  );
}
