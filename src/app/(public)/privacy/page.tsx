import { LegalPage } from "@/components/legal/legal-page";
import { LEGAL_COMPANY, LEGAL_EFFECTIVE_DATE } from "@/lib/legal";

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      intro={
        <>
          <p>
            {LEGAL_COMPANY.businessName} (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) operates an automotive
            commerce platform in Ghana. This Privacy Policy explains how we collect, use, store, and protect your
            personal information.
          </p>
          <p className="mt-3">
            <strong>Effective date:</strong> {LEGAL_EFFECTIVE_DATE}
          </p>
        </>
      }
      sections={[
        {
          title: "1. Information we collect",
          body: (
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <strong>Account information</strong> — name, email, phone number, and login credentials
              </li>
              <li>
                <strong>Transaction data</strong> — orders, payments, wallet activity, and communication records
              </li>
              <li>
                <strong>Delivery and verification data</strong> — addresses and supporting information
              </li>
              <li>
                <strong>Technical data</strong> — device, usage, and security-related information
              </li>
            </ul>
          ),
        },
        {
          title: "2. How we use your information",
          body: (
            <ul className="list-disc space-y-2 pl-5">
              <li>Provide vehicle, parts, sourcing, and support services</li>
              <li>Process and verify payments and transactions</li>
              <li>Communicate updates, confirmations, and service notices</li>
              <li>Prevent fraud, ensure platform security, and resolve disputes</li>
              <li>Meet legal, regulatory, tax, and audit obligations</li>
            </ul>
          ),
        },
        {
          title: "3. Legal basis for processing",
          body: (
            <ul className="list-disc space-y-2 pl-5">
              <li>Your consent</li>
              <li>The performance of a contract (e.g. orders, sourcing, payments)</li>
              <li>Legal and regulatory obligations</li>
              <li>Our legitimate business interests, including fraud prevention and service improvement</li>
            </ul>
          ),
        },
        {
          title: "4. Data sharing",
          body: (
            <ul className="list-disc space-y-2 pl-5">
              <li>Payment providers (e.g. Paystack) for transaction processing</li>
              <li>Logistics and shipping partners where delivery is requested</li>
              <li>Technology and compliance providers under confidentiality obligations</li>
              <li>Regulators or authorities where required by law</li>
            </ul>
          ),
        },
        {
          title: "5. International data transfers",
          body: (
            <p>
              Some of our service providers or partners may be located outside Ghana. Where this occurs, we take
              reasonable steps to ensure your data is handled securely and in accordance with applicable data protection
              standards.
            </p>
          ),
        },
        {
          title: "6. Data security",
          body: (
            <ul className="list-disc space-y-2 pl-5">
              <li>We implement appropriate technical and organizational safeguards to protect your information.</li>
              <li>
                While no system is completely secure, we continuously work to safeguard your data.
              </li>
              <li>
                You are responsible for keeping your account credentials secure and notifying us promptly of any suspected
                unauthorized activity.
              </li>
            </ul>
          ),
        },
        {
          title: "7. Data retention",
          body: (
            <>
              <p>We retain personal information only for as long as necessary to:</p>
              <ul className="mt-3 list-disc space-y-2 pl-5">
                <li>Provide our services</li>
                <li>Maintain transaction and account records</li>
                <li>Comply with legal and regulatory obligations</li>
                <li>Resolve disputes and enforce agreements</li>
              </ul>
            </>
          ),
        },
        {
          title: "8. Your rights",
          body: (
            <>
              <p>Under applicable Ghana data protection laws, you may have the right to:</p>
              <ul className="mt-3 list-disc space-y-2 pl-5">
                <li>Request access to your personal data</li>
                <li>Request correction of inaccurate information</li>
                <li>Request deletion where legally permitted</li>
                <li>Object to or restrict certain processing</li>
                <li>Withdraw consent where applicable</li>
              </ul>
              <p className="mt-3">
                Requests are subject to identity verification and applicable legal limitations.
              </p>
            </>
          ),
        },
        {
          title: "9. Cookies and usage tracking",
          body: (
            <p>
              We may use cookies or similar technologies to support platform functionality, security, and user
              experience.
            </p>
          ),
        },
        {
          title: "10. Governing law",
          body: (
            <>
              <p>This Privacy Policy is governed by the laws of Ghana, including:</p>
              <ul className="mt-3 list-disc space-y-2 pl-5">
                <li>Data Protection Act, 2012 (Act 843)</li>
                <li>Electronic Transactions Act, 2008 (Act 772)</li>
              </ul>
            </>
          ),
        },
        {
          title: "11. Complaints and dispute resolution",
          body: (
            <p>
              If you have concerns about your personal data, please contact us first so we can attempt to resolve the
              issue. Unresolved matters may be referred to ADR under the Alternative Dispute Resolution Act, 2010 (Act
              798) or the appropriate courts in Ghana.
            </p>
          ),
        },
        {
          title: "12. Contact",
          body: (
            <dl className="space-y-3">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">Email</dt>
                <dd className="mt-1">
                  <a href={`mailto:${LEGAL_COMPANY.email}`} className="text-[var(--brand)] hover:underline">
                    {LEGAL_COMPANY.email}
                  </a>
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">Phone</dt>
                <dd className="mt-1">
                  <a
                    href={`tel:${LEGAL_COMPANY.phone.replace(/\s/g, "")}`}
                    className="text-[var(--brand)] hover:underline"
                  >
                    {LEGAL_COMPANY.phone}
                  </a>
                </dd>
              </div>
            </dl>
          ),
        },
      ]}
      footer={
        <p>
          <strong>Privacy contact:</strong>{" "}
          <a href={`mailto:${LEGAL_COMPANY.email}`} className="text-[var(--brand)] hover:underline">
            {LEGAL_COMPANY.email}
          </a>
          {" · "}
          <a href={`tel:${LEGAL_COMPANY.phone.replace(/\s/g, "")}`} className="text-[var(--brand)] hover:underline">
            {LEGAL_COMPANY.phone}
          </a>
        </p>
      }
    />
  );
}
