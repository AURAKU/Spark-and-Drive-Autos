import { LegalPage } from "@/components/legal/legal-page";
import { LEGAL_COMPANY } from "@/lib/legal";

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms and Conditions"
      intro={
        <p>
          Spark &amp; Drive Gear (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) operates an automotive commerce
          platform providing vehicle sales, parts sourcing, Parts Finder tools, and related services. By accessing or
          using our platform, you agree to these Terms.
          <br />
          <br />
          <strong>Effective Date:</strong> [21-May_2025]
        </p>
      }
      sections={[
        {
          title: "1. Introduction",
          body: (
            <p>
              These Terms govern your use of Spark &amp; Drive Gear services across listings, purchases, sourcing, and
              platform operations.
            </p>
          ),
        },
        {
          title: "2. Services",
          body: (
            <>
              <p>We provide:</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>Vehicle listings and sales</li>
                <li>Parts and accessories sales</li>
                <li>AI-assisted Parts Finder tools</li>
                <li>International sourcing support</li>
                <li>Logistics coordination assistance</li>
              </ul>
              <p className="mt-3">All services are provided on a best-effort basis.</p>
            </>
          ),
        },
        {
          title: "3. Parts Finder disclaimer",
          body: (
            <>
              <p>
                Results are generated using automated systems, search engine assisted processing, and external data
                sources.
              </p>
              <p className="mt-3">Spark &amp; Drive Gear does not guarantee exact compatibility, OEM accuracy, or availability.</p>
              <p className="mt-3">Results are provided for guidance only.</p>
              <p className="mt-3">Users must verify all information before purchase or installation.</p>
              <p className="mt-3">
                Spark &amp; Drive Gear is not liable for damages arising from reliance on unverified results.
              </p>
            </>
          ),
        },
        {
          title: "4. No professional advice",
          body: (
            <p>
              Information provided on this platform does not constitute mechanical, engineering, or professional advice.
              Independent verification is required before reliance.
            </p>
          ),
        },
        {
          title: "5. Payments",
          body: (
            <>
              <p>Payments are valid only after verification within our system.</p>
              <p className="mt-3">We reserve the right to request proof of payment, delay or suspend transactions, and reverse or refuse transactions under review.</p>
            </>
          ),
        },
        {
          title: "6. Identity verification requirement",
          body: (
            <>
              <p>
                Spark &amp; Drive Gear reserves the right to request identity verification from users at any time where
                necessary, including but not limited to:
              </p>
              <ul className="mt-3 list-disc space-y-2 pl-5">
                <li>high-value transactions</li>
                <li>vehicle purchases</li>
                <li>sourcing requests or deposits</li>
                <li>manual payment verification</li>
                <li>dispute resolution</li>
                <li>suspected fraud or unusual activity</li>
              </ul>
              <p className="mt-3">Failure to provide requested verification may result in:</p>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>delayed processing</li>
                <li>restricted access to certain services</li>
                <li>cancellation of transactions where appropriate</li>
              </ul>
              <p className="mt-3">
                All verification processes are conducted in accordance with applicable data protection laws and internal
                security procedures.
              </p>
            </>
          ),
        },
        {
          title: "7. Refunds",
          body: (
            <>
              <p>Refund eligibility depends on transaction type, processing stage, and third-party commitments.</p>
              <p className="mt-3">
                Deposits, sourcing costs, logistics charges, and supplier commitments may be non-refundable once processing
                begins.
              </p>
            </>
          ),
        },
        {
          title: "8. Sourcing and logistics",
          body: (
            <>
              <p>Sourcing and delivery depend on third-party suppliers, carriers, and regulatory authorities.</p>
              <p className="mt-3">We do not guarantee availability, pricing, or delivery timelines.</p>
            </>
          ),
        },
        {
          title: "9. User responsibilities",
          body: (
            <ul className="list-disc space-y-2 pl-5">
              <li>Provide accurate information</li>
              <li>Verify part compatibility</li>
              <li>Maintain account security</li>
            </ul>
          ),
        },
        {
          title: "10. Limitation of liability",
          body: (
            <p>
              To the maximum extent permitted by law, Spark &amp; Drive Gear shall not be liable for indirect, incidental,
              or consequential damages, including losses arising from incorrect part selection, sourcing delays, supplier
              issues, or logistics failures.
              <br />
              <br />
              Our total liability shall not exceed the amount paid for the specific transaction giving rise to the claim.
            </p>
          ),
        },
        {
          title: "11. Indemnity",
          body: (
            <p>
              Users agree to indemnify and hold harmless Spark &amp; Drive Gear from claims, damages, or losses arising from
              misuse of the platform, inaccurate information provided, or reliance on unverified results.
            </p>
          ),
        },
        {
          title: "12. Service availability",
          body: (
            <p>
              We do not guarantee uninterrupted or error-free operation. Services may be modified, suspended, or restricted
              at any time.
            </p>
          ),
        },
        {
          title: "13. Force majeure",
          body: (
            <p>
              We are not liable for delays or failures caused by events beyond our control, including supplier failures,
              shipping disruptions, regulatory actions, or unforeseen circumstances.
            </p>
          ),
        },
        {
          title: "14. Disputes",
          body: (
            <p>
              Users agree to attempt internal resolution first. Unresolved matters may proceed to alternative dispute
              resolution or courts in Ghana.
            </p>
          ),
        },
        {
          title: "15. Governing law",
          body: <p>These Terms are governed by the laws of Ghana.</p>,
        },
        {
          title: "16. Jurisdiction",
          body: (
            <p>
              All disputes shall be subject to the exclusive jurisdiction of the courts of Ghana unless otherwise resolved
              through agreed dispute mechanisms.
            </p>
          ),
        },
        {
          title: "17. Updates",
          body: (
            <p>
              We may update these Terms at any time. Continued use constitutes acceptance of updated versions.
            </p>
          ),
        },
        {
          title: "18. Contact",
          body: (
            <p>
              {LEGAL_COMPANY.email}
              <br />
              {LEGAL_COMPANY.phone}
              <br />
              [{LEGAL_COMPANY.officeAddress}]
              <br />
              <br />
              <strong>Business Hours</strong>
              <br />
              {LEGAL_COMPANY.workingHours}
            </p>
          ),
        },
      ]}
      footer={
        <div className="space-y-3">
          <p>
            <strong>Complaints and questions:</strong> {LEGAL_COMPANY.email} | {LEGAL_COMPANY.phone}
          </p>
        </div>
      }
    />
  );
}
