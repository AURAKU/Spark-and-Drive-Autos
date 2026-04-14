import { PageHeading, SectionHeading } from "@/components/typography/page-headings";

type FaqItem = { q: string; answer: string[] };

export default function FaqPage() {
  const items: FaqItem[] = [
    {
      q: "Which payment methods are supported?",
      answer: [
        "We support secure Paystack payments (card and Mobile Money where available), along with selected manual payment options when offered.",
        "All payments are only confirmed after verification within our system.",
      ],
    },
    {
      q: "Can you source vehicles or parts internationally?",
      answer: [
        "Yes. We provide sourcing support based on supplier availability and your approved specifications.",
        "All sourcing requests are subject to confirmation—no request is guaranteed until commercial terms are agreed.",
      ],
    },
    {
      q: "Do you guarantee shipping and delivery timelines?",
      answer: [
        "No. Timelines are estimates and may change due to supplier lead times, shipping schedules, customs processes, or other external factors beyond our control.",
      ],
    },
    {
      q: "Can you support duty clearance?",
      answer: [
        "Yes, on request. We can assist with clearance processes, but final duty and government charges are determined by the relevant authorities.",
      ],
    },
    {
      q: "How do vehicle reservations work?",
      answer: [
        "Reservations typically require a deposit and are valid for a limited hold period.",
        "If full payment is not completed within that timeframe, the reservation may expire.",
      ],
    },
    {
      q: "When are refunds available?",
      answer: [
        "Refunds depend on the transaction type, verification status, and any costs already incurred.",
        "Sourcing deposits, logistics charges, and third-party fees may not be refundable once committed.",
      ],
    },
    {
      q: "How can I track my order?",
      answer: [
        "You can track your order and payment status directly from your dashboard.",
        "Where available, we provide updates to keep you informed from confirmation through delivery.",
      ],
    },
    {
      q: "How does the parts wallet and cart system work?",
      answer: [
        "You can fund your wallet, add items to your cart, and pay using your wallet balance.",
        "All transactions are verified before orders are confirmed.",
      ],
    },
    {
      q: "What can I do from my account dashboard?",
      answer: [
        "Your dashboard allows you to manage your profile, addresses, payments, wallet activity, order history, notifications, and saved items all in one place.",
      ],
    },
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6 sm:py-16">
      <PageHeading>Frequently Asked Questions</PageHeading>
      <p className="mt-6 text-sm leading-relaxed text-zinc-300 sm:text-[0.9375rem]">
        Find answers to common questions about vehicles, parts and accessories, sourcing, payments, reservations, and
        your account.
      </p>

      <div className="mt-10 space-y-4">
        {items.map((item) => (
          <section
            key={item.q}
            className="rounded-2xl border border-[var(--brand)]/20 bg-white/[0.03] p-5 shadow-[0_0_32px_-16px_rgba(20,216,230,0.15)]"
          >
            <SectionHeading size="compact">{item.q}</SectionHeading>
            <div className="mt-3 space-y-3 text-sm leading-relaxed text-zinc-300 sm:text-[0.9375rem]">
              {item.answer.map((p, i) => (
                <p key={`${item.q}-${i}`}>{p}</p>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
