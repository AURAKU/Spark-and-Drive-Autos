import { LegalPage } from "@/components/legal/legal-page";
import { DISPUTE_FLOW_TEXT, LEGAL_COMPANY, LEGAL_EFFECTIVE_DATE } from "@/lib/legal";

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms and Conditions"
      intro={
        <p>
          These Terms and Conditions govern your use of the Spark and Drive Autos platform and related services.
          Effective date: {LEGAL_EFFECTIVE_DATE}. By using our services, you agree to these terms.
        </p>
      }
      sections={[
        {
          title: "1. Account use and security",
          body: (
            <p>
              You must provide accurate information and keep your credentials secure. You are responsible for activity
              under your account unless unauthorized use is reported promptly and verified.
            </p>
          ),
        },
        {
          title: "2. Listings, pricing, and availability",
          body: (
            <p>
              Vehicle and parts listings, prices, and stock indicators are subject to change and final confirmation.
              Publication on the platform does not create an unconditional guarantee of availability.
            </p>
          ),
        },
        {
          title: "3. Transaction confirmation and payment verification",
          body: (
            <p>
              A transaction is treated as confirmed only after successful verification in our systems. We may delay,
              reject, or reverse status where payment proof is invalid, mismatched, disputed, or flagged by control
              checks.
            </p>
          ),
        },
        {
          title: "4. Sourcing, logistics, and customs support",
          body: (
            <p>
              Sourcing and logistics assistance is provided on a best-effort basis. Supplier response, freight schedules,
              customs processing, exchange rates, and government charges are external factors outside our direct control.
            </p>
          ),
        },
        {
          title: "5. Platform availability",
          body: (
            <p>
              We aim for reliable service, but we do not guarantee uninterrupted access, error-free operation, or
              immediate availability of all features at all times.
            </p>
          ),
        },
        {
          title: "6. Limitation of liability",
          body: (
            <p>
              To the maximum extent permitted by law, our liability is limited to direct losses reasonably proven and
              attributable to our breach. We are not liable for indirect or consequential losses, including lost profits,
              business interruption, or losses caused by third-party providers.
            </p>
          ),
        },
        {
          title: "7. Third-party services",
          body: (
            <p>
              Payments, logistics, customs, and communications may rely on third-party providers. Their service quality,
              downtime, fees, and policy changes may affect outcomes and remain subject to their own terms.
            </p>
          ),
        },
        {
          title: "8. Force majeure",
          body: (
            <p>
              We are not responsible for delay or non-performance caused by events beyond reasonable control, including
              port disruption, regulatory changes, strikes, conflict, natural events, telecom failure, or payment network
              outages.
            </p>
          ),
        },
      ]}
      footer={
        <div className="space-y-3">
          <p>
            <strong>Governing law:</strong> These Terms are governed by the laws of Ghana, including relevant principles
            under the Electronic Transactions Act, 2008 (Act 772).
          </p>
          <p>{DISPUTE_FLOW_TEXT}</p>
          <p>
            <strong>Complaints and questions:</strong> {LEGAL_COMPANY.email} | {LEGAL_COMPANY.phone}
          </p>
        </div>
      }
    />
  );
}
