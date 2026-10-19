import { Ghana2026LegalNotice } from "@/components/legal/ghana-2026-legal-notice";
import { LegalPage } from "@/components/legal/legal-page";
import { LEGAL_COMPANY, LEGAL_EFFECTIVE_DATE } from "@/lib/legal";

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      intro={
        <>
          <p>
            Spark &amp; Drive Gear (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) operates an automotive commerce
            platform in Ghana. This Privacy Policy explains how we collect, use, store, and protect personal information.
          </p>
          <p className="mt-3">
            <strong>Effective Date:</strong> {LEGAL_EFFECTIVE_DATE}
          </p>
        </>
      }
      sections={[
        {
          title: "1. Information We Collect",
          body: (
            <ul className="list-disc space-y-2 pl-5">
              <li>Account data (name, email, phone)</li>
              <li>Transaction and payment records</li>
              <li>Delivery and verification details</li>
              <li>Technical and usage data</li>
            </ul>
          ),
        },
        {
          title: "2. How We Use Information",
          body: (
            <ul className="list-disc space-y-2 pl-5">
              <li>Provide services</li>
              <li>Process and verify payments</li>
              <li>Communicate updates</li>
              <li>Prevent fraud and resolve disputes</li>
            </ul>
          ),
        },
        {
          title: "3. Legal Basis",
          body: (
            <ul className="list-disc space-y-2 pl-5">
              <li>User consent</li>
              <li>Contract performance</li>
              <li>Legal obligations</li>
              <li>Legitimate business interests</li>
            </ul>
          ),
        },
        {
          title: "4. Data Sharing",
          body: (
            <ul className="list-disc space-y-2 pl-5">
              <li>Payment providers</li>
              <li>Logistics partners</li>
              <li>Technology providers</li>
              <li>Regulatory authorities where required</li>
            </ul>
          ),
        },
        {
          title: "5. International Transfers",
          body: (
            <p>
              Data may be processed outside Ghana with appropriate safeguards.
            </p>
          ),
        },
        {
          title: "6. Data Security",
          body: (
            <p>
              We implement appropriate safeguards. Users are responsible for protecting account credentials. We are not
              liable for breaches caused by user negligence or external compromise beyond our control.
            </p>
          ),
        },
        {
          title: "7. Data Retention",
          body: (
            <>
              <p>Data is retained as necessary for:</p>
              <ul className="mt-3 list-disc space-y-2 pl-5">
                <li>service delivery</li>
                <li>compliance</li>
                <li>dispute resolution</li>
              </ul>
            </>
          ),
        },
        {
          title: "8. User Rights",
          body: (
            <p>
              Users may request access, correction, or deletion subject to legal limitations and verification.
            </p>
          ),
        },
        {
          title: "9. Cookies",
          body: (
            <p>We use cookies for functionality, security, and performance.</p>
          ),
        },
        {
          title: "10. Automated Systems",
          body: (
            <p>
              Some services use AI and automated processing. Outputs are not guaranteed and must be independently verified.
            </p>
          ),
        },
        {
          title: "11. Limitation of Liability",
          body: (
            <p>
              We are not liable for damages arising from data use, system access, or reliance on automated outputs.
            </p>
          ),
        },
        {
          title: "12. Governing Law",
          body: (
            <>
              <p>Governed by Ghana law including:</p>
              <ul className="mt-3 list-disc space-y-2 pl-5">
                <li>Data Protection Act, 2012 (Act 843)</li>
                <li>Electronic Transactions Act, 2008 (Act 772)</li>
                <li>Cybersecurity Act, 2020 (Act 1038)</li>
                <li>National Identity Register (Amendment) Regulations, 2026 (L.I. 2523)</li>
                <li>Payment Systems and Services Act, 2019 (Act 987)</li>
              </ul>
              <div className="mt-3">
                <Ghana2026LegalNotice />
              </div>
            </>
          ),
        },
        {
          title: "13. Identity Verification",
          body: (
            <>
              <p>
                To protect our platform, users, and transactions, Spark &amp; Drive Gear may request identity verification
                for certain activities, including high-value transactions, sourcing requests, payment verification, dispute
                resolution, and fraud prevention.
              </p>
              <p className="mt-3">
                We do not request or store photographs, scans, or photocopies of a Ghana Card, passport, or driver&apos;s
                licence, and we do not ask for a selfie holding an identity document. Where a Ghana Card number is
                collected, it is an account reference only. Where the law requires biometric confirmation, that is done
                through the National Identification Authority.
              </p>
              <ul className="mt-3 list-disc space-y-2 pl-5">
                <li>A saved Ghana Card number and expiry date are used only as an account reference.</li>
                <li>They are stored with access limited to authorized staff.</li>
                <li>They are not shared except where the law requires it.</li>
                <li>They are kept only as long as the account purpose requires.</li>
              </ul>
              <p className="mt-3">
                We retain such data only for as long as necessary for these purposes, after which it may be securely deleted.
              </p>
              <p className="mt-3">
                You may request access, correction, or deletion of your data subject to legal and operational limitations.
              </p>
            </>
          ),
        },
        {
          title: "14. Disputes",
          body: (
            <p>
              Disputes should first be resolved internally, then via ADR or Ghana courts.
            </p>
          ),
        },
        {
          title: "15. Contact",
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
