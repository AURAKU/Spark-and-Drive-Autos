export function PaymentReviewNotice() {
  return (
    <p className="rounded-xl border border-sky-500/25 bg-sky-500/10 p-3 text-xs text-sky-100">
      Payments are confirmed only after verification evidence and provider checks. Status may be updated to under review, disputed,
      refunded, or reversed based on compliance review.
    </p>
  );
}
