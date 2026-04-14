import { LegalPage } from "@/components/legal/legal-page";
import { DISPUTE_FLOW_TEXT, LEGAL_COMPANY, LEGAL_EFFECTIVE_DATE } from "@/lib/legal";

export default function RefundPolicyPage() {
  return (
    <LegalPage
      title="Refund Policy"
      intro={
        <p>
          This policy explains when refunds may be approved for vehicle, parts, and sourcing-related transactions.
          Effective date: {LEGAL_EFFECTIVE_DATE}.
        </p>
      }
      sections={[
        {
          title: "1. General approach",
          body: (
            <p>
              Refunds are assessed case by case after payment verification and record review. Approval depends on
              transaction status, service stage, and costs already incurred.
            </p>
          ),
        },
        {
          title: "2. Potentially eligible cases",
          body: (
            <ul className="space-y-2">
              <li>Verified duplicate payment or clear overpayment.</li>
              <li>Transaction charged but service cannot proceed due to our internal constraints.</li>
              <li>Other exceptional cases approved by authorized management.</li>
            </ul>
          ),
        },
        {
          title: "3. Non-refundable items and costs",
          body: (
            <ul className="space-y-2">
              <li>Special-order and sourcing deposits after supplier commitment.</li>
              <li>Inspection, processing, logistics, customs, and third-party provider costs already incurred.</li>
              <li>Bank, mobile money, payment gateway, and foreign exchange losses or charges where applicable.</li>
            </ul>
          ),
        },
        {
          title: "4. Refund request process",
          body: (
            <p>
              Requests must include order reference, payment reference, reason, and supporting evidence. We may request
              additional information for verification and compliance checks before a final decision.
            </p>
          ),
        },
        {
          title: "5. Timelines and settlement",
          body: (
            <p>
              Processing timelines vary based on provider reconciliation and review complexity. Approved refunds are
              generally returned through the original payment channel where possible, subject to provider constraints.
            </p>
          ),
        },
      ]}
      footer={
        <div className="space-y-3">
          <p>
            <strong>Governing law:</strong> This Refund Policy is governed by the laws of Ghana.
          </p>
          <p>{DISPUTE_FLOW_TEXT}</p>
          <p>
            <strong>Refund support:</strong> {LEGAL_COMPANY.supportEmail} | {LEGAL_COMPANY.phone}
          </p>
        </div>
      }
    />
  );
}
