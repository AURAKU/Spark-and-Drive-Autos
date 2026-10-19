/**
 * Shared customer-facing notice. This is operational policy, not a legal opinion.
 * Counsel should review before these texts are treated as binding advice.
 */
export function Ghana2026LegalNotice() {
  return (
    <div className="space-y-3">
      <p>
        Spark &amp; Drive Autos operates from Ghana. These documents are written so the platform does not ask customers
        to do something Ghana law prohibits, and so staff do not keep identity records the National Identification
        Authority says must not be copied.
      </p>
      <p>The rules we follow include:</p>
      <ul className="list-disc space-y-1 pl-5">
        <li>Data Protection Act, 2012 (Act 843): purpose limitation, security, and access or correction requests.</li>
        <li>Electronic Transactions Act, 2008 (Act 772): electronic records, contracts, and consumer information.</li>
        <li>Cybersecurity Act, 2020 (Act 1038): no unlawful access, interception, or misuse of systems or accounts.</li>
        <li>
          National Identity Register (Amendment) Regulations, 2026 (L.I. 2523): no request, photo, scan, photocopy, or
          stored image of a Ghana Card for identity checks. Where biometric confirmation is required, it is through the
          NIA Identity Verification Services Platform or an NIA-approved device.
        </li>
        <li>Payment Systems and Services Act, 2019 (Act 987): card and mobile-money payments run through a licensed provider. We do not hold card PANs.</li>
        <li>Alternative Dispute Resolution Act, 2010 (Act 798), then the courts of Ghana.</li>
      </ul>
      <p>
        A Ghana Card number and expiry date, if you choose to save them, are an account reference only. They do not prove
        the card is genuine. We do not ask you to upload a Ghana Card, passport, or driver&apos;s licence, and we do not
        ask for a selfie holding any identity document.
      </p>
      <p>
        You must not use the platform for fraud, money laundering, unauthorized access, or to upload another person&apos;s
        identity document. We may suspend an account, hold a payment, or report activity where the law requires it.
      </p>
      <p>
        Website text does not replace registration with the Data Protection Commission, onboarding to the NIA, or advice
        from a Ghana lawyer. If a newer statute conflicts with a sentence here, the statute controls.
      </p>
    </div>
  );
}
