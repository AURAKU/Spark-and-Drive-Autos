import { LegalPage } from "@/components/legal/legal-page";
import { DISPUTE_FLOW_TEXT, LEGAL_COMPANY, LEGAL_EFFECTIVE_DATE } from "@/lib/legal";

export default function ReservationPolicyPage() {
  return (
    <LegalPage
      title="Reservation Policy"
      intro={
        <p>
          This policy governs reservation payments and hold periods for vehicles and selected high-value items where
          reservation is offered. Effective date: {LEGAL_EFFECTIVE_DATE}.
        </p>
      }
      sections={[
        {
          title: "1. Reservation eligibility",
          body: (
            <p>
              Reservation is available only on eligible listings and only after a reservation amount is received and
              verified. Reservation availability may be withdrawn at our discretion before confirmation.
            </p>
          ),
        },
        {
          title: "2. Hold period and timeline",
          body: (
            <p>
              Each confirmed reservation has a stated hold period. If full payment or agreed milestone payment is not
              completed within that period, the reservation may lapse and the item may be released.
            </p>
          ),
        },
        {
          title: "3. Payment verification",
          body: (
            <p>
              Reservation status is valid only after payment verification in system records. Screenshots or external
              notices alone do not constitute final confirmation until reconciled.
            </p>
          ),
        },
        {
          title: "4. Cancellation and transfer",
          body: (
            <p>
              Reservations are generally non-transferable unless approved in writing. Cancellation terms depend on
              whether third-party costs, sourcing commitments, or logistics allocations have already been incurred.
            </p>
          ),
        },
        {
          title: "5. Refund position for reservations",
          body: (
            <p>
              Refunds may be considered for verified overpayment or cases where we cannot proceed due to our own service
              limitation. Deposits linked to confirmed commitments, inspections, sourcing work, or third-party costs may
              be non-refundable.
            </p>
          ),
        },
      ]}
      footer={
        <div className="space-y-3">
          <p>
            <strong>Governing law:</strong> This Reservation Policy is governed by the laws of Ghana.
          </p>
          <p>{DISPUTE_FLOW_TEXT}</p>
          <p>
            <strong>Reservation support:</strong> {LEGAL_COMPANY.supportEmail} | {LEGAL_COMPANY.phone}
          </p>
        </div>
      }
    />
  );
}
