import type { Metadata } from "next";
import Link from "next/link";
import { LegalShell, Section, Bullets } from "../legal/legal-shell";

export const metadata: Metadata = {
  title: "Privacy Policy — Genalot",
  description: "How Genalot collects, uses, and protects your data.",
};

export default function PrivacyPage() {
  return (
    <LegalShell
      title="Privacy Policy"
      updated="5 July 2026"
      active="/privacy"
      intro="This Privacy Policy explains how Genalot (“Genalot”, “we”, “us”, or “our”) collects, uses, shares, and protects personal information when you use genalot.com and our Service. We are committed to handling your data responsibly and transparently, in line with applicable data-protection laws, including South Africa's Protection of Personal Information Act (POPIA), the EU/UK General Data Protection Regulation (GDPR) where it applies, and the California Consumer Privacy Act (CCPA) where it applies. By using the Service you agree to the practices described here."
    >
      <Section n="1" title="Who we are">
        <p>
          Genalot is the operator of the Service and the controller responsible for your personal
          information. If you have any questions or wish to exercise your rights, contact us at{" "}
          <a href="mailto:privacy@genalot.com" className="text-primary/70 hover:text-primary">privacy@genalot.com</a>.
        </p>
      </Section>

      <Section n="2" title="Information we collect">
        <Bullets
          items={[
            <><strong className="text-white/80">Account information</strong> — your name, email address, password (stored only as a secure hash), and profile details you provide.</>,
            <><strong className="text-white/80">Content you create and upload</strong> — the prompts, reference images, and other Inputs you submit, and the images, videos, and other Outputs you generate and store.</>,
            <><strong className="text-white/80">Billing information</strong> — plan and purchase history, and transaction references. Card and payment details are collected and processed by our payment provider; we do not store full card numbers.</>,
            <><strong className="text-white/80">Connected social accounts</strong> — where you choose to connect a social channel for scheduling or auto-posting, the authorisation tokens and account identifiers needed to publish on your behalf, handled through our distribution partner.</>,
            <><strong className="text-white/80">Usage and device data</strong> — log data, generation activity, credit usage, IP address, browser and device information, and similar technical data, collected to operate and secure the Service.</>,
            <><strong className="text-white/80">Cookies and similar technologies</strong> — used for authentication, preferences, and essential functionality (see Section 9).</>,
          ]}
        />
      </Section>

      <Section n="3" title="How we use your information">
        <Bullets
          items={[
            "To provide, operate, and maintain the Service, including generating content in response to your Inputs.",
            "To process purchases, manage subscriptions and credits, and prevent fraud.",
            "To publish or schedule content to channels you connect, at your direction.",
            "To secure the Service, enforce our Terms, and detect and prevent abuse and prohibited content.",
            "To communicate with you about your Account, transactions, security, and service updates.",
            "To provide support and respond to your requests.",
            "To understand and improve how the Service is used, in aggregated or de-identified form.",
            "To comply with legal obligations and enforce our legal rights.",
          ]}
        />
        <p>
          We do <strong className="text-white/80">not</strong> sell your personal information, and we
          do not use your private Inputs or Outputs to train our own foundational models.
        </p>
      </Section>

      <Section n="4" title="Legal bases for processing">
        <p>Where the GDPR or similar laws apply, we rely on the following legal bases:</p>
        <Bullets
          items={[
            <><strong className="text-white/80">Contract</strong> — to provide the Service you have signed up for and process your purchases.</>,
            <><strong className="text-white/80">Legitimate interests</strong> — to secure, maintain, and improve the Service and prevent abuse, balanced against your rights.</>,
            <><strong className="text-white/80">Consent</strong> — where you connect a social account or opt in to optional communications; you may withdraw consent at any time.</>,
            <><strong className="text-white/80">Legal obligation</strong> — to comply with laws that apply to us.</>,
          ]}
        />
      </Section>

      <Section n="5" title="AI providers and sub-processors">
        <p>
          To deliver the Service we share the minimum data necessary with trusted third-party
          providers who process it on our behalf under contractual and security obligations. These
          include, by category:
        </p>
        <Bullets
          items={[
            "AI model providers that generate your Outputs from your Inputs (for image, video, and text generation).",
            "Cloud hosting and database/storage providers that run the Service and store your Account and content.",
            "A payment provider that processes purchases and subscriptions.",
            "An email provider that sends transactional messages such as confirmations and password resets.",
            "A social-media distribution provider that publishes content to the channels you connect.",
          ]}
        />
        <p>
          When you submit an Input for generation, it is transmitted to the relevant AI provider to
          produce your Output. These providers process the data to perform the generation and under
          their own terms; we select providers that offer appropriate protections. A current list of
          named sub-processors is available on request at{" "}
          <a href="mailto:privacy@genalot.com" className="text-primary/70 hover:text-primary">privacy@genalot.com</a>.
        </p>
      </Section>

      <Section n="6" title="Sharing and disclosure">
        <p>We share personal information only as described in this policy, including:</p>
        <Bullets
          items={[
            "With the sub-processors described above, to operate the Service.",
            "With social platforms you connect, to publish the content you direct us to publish.",
            "To comply with law, legal process, or enforceable governmental requests.",
            "To protect the rights, safety, and property of Genalot, our users, or the public, and to enforce our Terms.",
            "In connection with a merger, acquisition, financing, or sale of assets, subject to this policy continuing to protect your information.",
          ]}
        />
      </Section>

      <Section n="7" title="Data retention">
        <p>
          We retain personal information for as long as your Account is active and as needed to
          provide the Service, and thereafter as required to comply with our legal obligations,
          resolve disputes, and enforce our agreements. You can delete your User Content at any time,
          and you may request deletion of your Account. Residual copies may persist in secure backups
          for a limited period before being overwritten.
        </p>
      </Section>

      <Section n="8" title="Data security">
        <p>
          We use technical and organisational measures designed to protect personal information,
          including encryption in transit, access controls, and secure infrastructure provided by our
          hosting partners. Passwords are stored only as salted hashes. No method of transmission or
          storage is completely secure, however, and we cannot guarantee absolute security. You are
          responsible for keeping your credentials confidential.
        </p>
      </Section>

      <Section n="9" title="Cookies and similar technologies">
        <p>
          We use strictly necessary cookies and similar technologies to keep you signed in, remember
          your preferences, and operate core features. We do not use these technologies to sell your
          data. You can control cookies through your browser settings, though disabling essential
          cookies may prevent parts of the Service from working.
        </p>
      </Section>

      <Section n="10" title="International data transfers">
        <p>
          Genalot operates online and uses providers located in various countries. Your information
          may be processed in, and transferred to, countries other than the one in which you reside,
          which may have different data-protection laws. Where required, we rely on appropriate
          safeguards (such as standard contractual clauses) for such transfers.
        </p>
      </Section>

      <Section n="11" title="Your rights">
        <p>
          Depending on where you live, you may have rights over your personal information, including
          the right to:
        </p>
        <Bullets
          items={[
            "Access the personal information we hold about you and request a copy.",
            "Correct inaccurate or incomplete information.",
            "Delete your information, subject to legal retention requirements.",
            "Object to or restrict certain processing, and withdraw consent where processing is based on consent.",
            "Data portability, where applicable.",
            "Lodge a complaint with your local data-protection authority (in South Africa, the Information Regulator).",
          ]}
        />
        <p>
          To exercise any of these rights, contact{" "}
          <a href="mailto:privacy@genalot.com" className="text-primary/70 hover:text-primary">privacy@genalot.com</a>. We
          will respond within the timeframes required by applicable law and may need to verify your
          identity first.
        </p>
      </Section>

      <Section n="12" title="Children's privacy">
        <p>
          The Service is not intended for anyone under 18, and we do not knowingly collect personal
          information from children. If you believe a child has provided us with personal information,
          contact us and we will take appropriate steps to delete it.
        </p>
      </Section>

      <Section n="13" title="Third-party links">
        <p>
          The Service may contain links to third-party websites or services that we do not operate.
          This policy does not apply to those third parties, and we are not responsible for their
          privacy practices. We encourage you to review their policies.
        </p>
      </Section>

      <Section n="14" title="Changes to this policy">
        <p>
          We may update this Privacy Policy from time to time. When we do, we will revise the
          &ldquo;Last updated&rdquo; date and, for material changes, provide additional notice where
          appropriate. Your continued use of the Service after changes take effect constitutes
          acceptance of the updated policy.
        </p>
      </Section>

      <Section n="15" title="Contact us">
        <p>
          For any privacy question or request, contact{" "}
          <a href="mailto:privacy@genalot.com" className="text-primary/70 hover:text-primary">privacy@genalot.com</a>. See
          also our{" "}
          <Link href="/terms" className="text-primary/70 hover:text-primary">Terms of Service</Link> and{" "}
          <Link href="/refund" className="text-primary/70 hover:text-primary">Refund Policy</Link>.
        </p>
      </Section>
    </LegalShell>
  );
}
