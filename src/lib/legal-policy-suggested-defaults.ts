import { POLICY_KEYS } from "@/lib/legal-enforcement";

/** Suggested first-time content for admins — not legal advice; counsel should review before publication. */
export const SUGGESTED_POLICY_DEFAULTS: Partial<Record<string, { title: string; content: string }>> = {
  [POLICY_KEYS.PLATFORM_TERMS_PRIVACY]: {
    title: "Platform terms, privacy, and integrated notices",
    content: `By using Spark & Drive Gear, users agree to the active platform terms, privacy policy, payment rules, sourcing terms, Parts Finder disclaimer, dispute process, and risk acknowledgements.

Users accept that vehicle and parts sourcing, logistics, customs support, payment verification, and Parts Finder results may involve third-party providers and external data sources. Payments are valid only after verification in our system. Parts Finder results are guidance only and may require confirmation before purchase or installation.

Spark & Drive Gear may keep transaction, payment, contract, dispute, account, and audit records where necessary for service delivery, fraud prevention, legal compliance, dispute resolution, and operational controls.

This policy is governed by the laws of Ghana, including the Data Protection Act, 2012 (Act 843), the Electronic Transactions Act, 2008 (Act 772), and applicable dispute-resolution frameworks in Ghana.`,
  },
  [POLICY_KEYS.CHECKOUT_AGREEMENT]: {
    title: "Checkout and payment verification",
    content: `Before completing payment, the user agrees that all orders and payments are subject to verification by Spark & Drive Gear. A payment attempt, screenshot, reference, or transfer notice does not confirm an order until the payment is verified in our system.

Orders may remain pending, processing, awaiting proof, under review, failed, successful, disputed, refunded, or reversed depending on verification outcome, provider confirmation, fraud checks, and dispute status.

Special orders, sourcing deposits, logistics charges, third-party commitments, and completed service costs may be non-refundable once processing has begun.`,
  },
  [POLICY_KEYS.PARTS_FINDER_DISCLAIMER]: {
    title: "Parts Finder — guidance only",
    content: `Results are generated using automated systems, search engine assisted processing, and external data sources.

Spark & Drive Gear does not guarantee:
- exact compatibility
- OEM accuracy
- availability

Results are provided for guidance only.
Users must verify all information before purchase or installation.
Spark & Drive Gear is not liable for damages arising from reliance on unverified results.`,
  },
  [POLICY_KEYS.VERIFIED_PART_REQUEST_TERMS]: {
    title: "Verified Part Request terms",
    content: `Verified Part Request is a paid verification and sourcing-support service. Spark & Drive Gear will use reasonable efforts to confirm part fitment using VIN/chassis information, catalog references, supplier responses, and available vehicle data.

Verification does not guarantee part availability, final supplier pricing, delivery timelines, customs charges, installation outcome, or manufacturer warranty unless expressly confirmed in writing.

The verification fee may be non-refundable once review work has started.`,
  },
  [POLICY_KEYS.SOURCING_RISK_ACKNOWLEDGEMENT]: {
    title: "Sourcing risk acknowledgement",
    content: `The user acknowledges that sourcing vehicles, parts, accessories, trims, kits, or special-order items may depend on supplier availability, quotation validity, currency changes, inspection results, shipping schedules, customs processes, and third-party performance.

Spark & Drive Gear provides sourcing support on a best-effort basis. Availability, price, lead time, condition, exact specification, and delivery timeline are not guaranteed until confirmed through agreed commercial terms.

The user agrees that sourcing deposits, supplier commitments, logistics charges, inspection costs, and third-party fees may be non-refundable once processing has started.`,
  },
  [POLICY_KEYS.DISPUTE_COMPLAINT_PROCESS]: {
    title: "Disputes and complaints",
    content: `Users agree to contact Spark & Drive Gear first for payment issues, order concerns, sourcing disputes, account concerns, and complaints.

Spark & Drive Gear may temporarily restrict, review, or hold transactions while a dispute, fraud concern, payment verification issue, or complaint is investigated.

Where internal resolution is not successful, unresolved matters may be referred to alternative dispute resolution or the appropriate courts in Ghana where applicable.`,
  },
  [POLICY_KEYS.PAYMENT_VERIFICATION_POLICY]: {
    title: "Payment verification",
    content: `Payments are confirmed only after internal verification aligned with provider data, fraud checks, and operational controls. Customers should retain references and lawful proof of payment; submission does not override verification outcomes.`,
  },
  [POLICY_KEYS.LOGISTICS_CUSTOMS_NOTICE]: {
    title: "Logistics and customs",
    content: `Shipping, clearance, duties, inspections, and port processes may involve third parties and government authorities. Timelines and costs are estimates until confirmed; users should plan for variability.`,
  },
  [POLICY_KEYS.REFUND_AND_CANCELLATION_POLICY]: {
    title: "Refunds and cancellations",
    content: `Refund and cancellation eligibility depends on order type, processing stage, supplier commitments, and verification status. Deposits and special orders may be non-refundable after processing begins, as stated at checkout and in sourcing agreements.`,
  },
};

export const SUGGESTED_VEHICLE_PARTS_SOURCING_CONTRACT = {
  title: "Vehicle & parts sourcing authorization",
  content: `The customer authorizes Spark & Drive Gear to provide vehicle, parts, or accessories sourcing support based on the customer’s submitted specifications, budget, timeline, and approval.

All sourcing is best-effort and may depend on supplier response, stock availability, quotation validity, inspection outcome, payment verification, logistics, customs processes, and third-party service providers.

Spark & Drive Gear does not guarantee exact availability, price, fitment, delivery timeline, or customs outcome unless confirmed in writing. The customer must review and approve key specifications before final commitment.

Deposits, special orders, supplier commitments, inspection charges, logistics costs, and third-party fees may be non-refundable once processing has begun.

By accepting this agreement, the customer confirms that the information submitted is accurate and that they understand the risks, limits, and third-party dependencies of sourcing and logistics.`,
};
