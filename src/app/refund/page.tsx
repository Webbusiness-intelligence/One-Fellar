import type { Metadata } from "next";
import { LegalShell, Section, Bullets } from "../legal/legal-shell";

export const metadata: Metadata = {
  title: "Refund Policy — Genalot",
  description: "Genalot's refund policy for subscriptions and credit packs.",
};

export default function RefundPolicyPage() {
  return (
    <LegalShell
      title="Refund Policy"
      updated="5 July 2026"
      active="/refund"
      intro="This Refund Policy explains when and how you may request a refund for purchases made on Genalot, including subscription plans and one-off credit packs. Because Genalot delivers a digital service that consumes real computing resources the moment you generate content, our refund rules are designed to be fair to customers while protecting against abuse. Please read this policy carefully before making a purchase — by completing a purchase you acknowledge and accept these terms."
    >
      <Section n="1" title="Nature of the service">
        <p>
          Genalot is a digital software-as-a-service platform. When you purchase a plan or a credit
          pack, you receive access to AI tools and a balance of &ldquo;credits&rdquo; that are spent
          each time you generate an image, video, or other output. Every generation triggers
          immediate, non-recoverable costs on our third-party AI providers. For this reason, credits
          that have been used cannot be refunded, and our eligibility rules focus on unused
          purchases.
        </p>
      </Section>

      <Section n="2" title="Eligibility for a refund">
        <p>You may be eligible for a refund of your purchase only if all of the following conditions are met:</p>
        <Bullets
          items={[
            <>You request a refund <strong className="text-white/80">within 7 days</strong> of your initial purchase.</>,
            <>You have used <strong className="text-white/80">zero credits</strong> — that is, you have made no image, video, or other generations of any kind since the purchase.</>,
            <>The purchase is your <strong className="text-white/80">first purchase</strong> on Genalot; refunds do not apply to subscription renewals or any purchase after the first.</>,
            <>The request is made through an approved channel (see &ldquo;How to request a refund&rdquo; below) and includes the account email and order reference.</>,
          ]}
        />
        <p>
          If you have already generated content using credits, you are generally{" "}
          <strong className="text-white/80">not eligible</strong> for a refund under this policy,
          because the associated compute costs have already been incurred on your behalf.
        </p>
      </Section>

      <Section n="3" title="Non-refundable purchases">
        <p>The following are not eligible for a refund, except where a refund is required by applicable law:</p>
        <Bullets
          items={[
            "Any purchase where one or more credits have been used (any generation has occurred).",
            "Subscription renewals (second and subsequent billing periods of a recurring plan).",
            "Any purchase after your first purchase on the account.",
            "Requests made more than 7 days after the initial purchase date.",
            "Credit packs or plan credits that have expired.",
            "Purchases flagged for fraud, chargeback abuse, or violation of our Terms of Service.",
          ]}
        />
      </Section>

      <Section n="4" title="Subscription renewals and cancellations">
        <p>
          Subscription plans renew automatically at the end of each billing period until cancelled.
          <strong className="text-white/80"> Refunds apply only to the first purchase, not to renewals.</strong>{" "}
          You can cancel a subscription at any time from your billing settings; cancellation stops
          future renewals but does not retroactively refund a period that has already begun, and you
          retain access and any remaining plan benefits until the end of the current paid period.
        </p>
      </Section>

      <Section n="5" title="Processing fees">
        <p>
          Where a refund is approved, we may deduct a{" "}
          <strong className="text-white/80">processing fee of up to 6%</strong> of the refunded
          amount, to the extent permitted by applicable law. This offsets non-recoverable payment
          processing and currency-conversion costs charged to us by our payment providers. Any such
          fee will be disclosed before the refund is finalised. Where the law of your jurisdiction
          prohibits such a deduction, we will not apply it.
        </p>
      </Section>

      <Section n="6" title="How to request a refund">
        <p>To request a refund, email us with the details below so we can verify eligibility quickly:</p>
        <Bullets
          items={[
            <>Send your request to <a href="mailto:support@genalot.com" className="text-primary/70 hover:text-primary">support@genalot.com</a> from the email address on your account.</>,
            "Include your account email, the order/transaction reference, and the date of purchase.",
            "State that no credits have been used, and briefly why you are requesting a refund.",
          ]}
        />
        <p>
          We may verify your credit usage and purchase history before approving any refund. Requests
          that do not meet the eligibility conditions in Section 2 will be declined, though we may, at
          our sole discretion, offer credits or another remedy instead.
        </p>
      </Section>

      <Section n="7" title="How approved refunds are paid">
        <p>
          Approved refunds are returned to the original payment method used for the purchase. Once
          approved, refunds are typically initiated within 5–10 business days, though the time for
          funds to appear depends on your bank or card issuer and payment provider. Refunds are made
          in the original transaction currency; any difference caused by exchange-rate movement
          between the purchase and the refund is outside our control.
        </p>
      </Section>

      <Section n="8" title="Chargebacks">
        <p>
          If you believe a charge is incorrect, please contact us first — we will always try to
          resolve it directly and quickly. Initiating a chargeback or payment dispute without first
          contacting us, particularly after credits have been used, may result in suspension or
          termination of your account. We reserve the right to contest chargebacks we believe are
          unwarranted, including by providing evidence of account activity and credit usage.
        </p>
      </Section>

      <Section n="9" title="Discretionary and legally required refunds">
        <p>
          Nothing in this policy limits any refund right you may have that cannot be excluded under
          the mandatory consumer-protection laws of your country. Separately, we may issue a refund,
          credit, or other remedy at our sole discretion in circumstances not covered above (for
          example, a verified service fault on our side). Any discretionary refund does not create an
          obligation to provide the same remedy in future cases.
        </p>
      </Section>

      <Section n="10" title="Changes to this policy">
        <p>
          We may update this Refund Policy from time to time. The version in effect at the time of
          your purchase governs that purchase. Material changes will be reflected by updating the
          &ldquo;Last updated&rdquo; date at the top of this page.
        </p>
      </Section>
    </LegalShell>
  );
}
