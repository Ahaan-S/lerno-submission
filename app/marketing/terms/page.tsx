import type { Metadata } from "next";
import LegalPageShell from "@/components/marketing/LegalPageShell";

export const metadata: Metadata = {
  title: "Terms of Service | Lerno",
  description: "Terms of Service for Lerno — AI tutoring for CBSE students.",
  alternates: { canonical: "https://lerno.in/terms" },
  robots: { index: true, follow: true },
  openGraph: {
    title: "Terms of Service | Lerno",
    description: "Terms of Service for Lerno — AI tutoring for CBSE students.",
    url: "https://lerno.in/terms",
    siteName: "Lerno",
    locale: "en_IN",
    type: "website",
  },
};

export default function TermsPage() {
  return (
    <LegalPageShell title="Terms of Service">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
        <p>
          Please read these Terms carefully before using Lerno.
          <br />
          Effective Date: May 1, 2025
          <br />
          Platform: lerno.in
          <br />
          Governed by the laws of India (Jurisdiction: Delhi, India)
          <br />
          Last updated: April 5, 2026
        </p>

        <section>
          <h2 style={headingStyle}>1. Introduction and Acceptance</h2>
          <p>
            Welcome to Lerno, an AI-powered, NCERT/CBSE-aligned educational tutoring platform. These Terms of Service (&ldquo;Terms&rdquo;) form a legally binding agreement between you and Lerno. By using Lerno you agree to these Terms. If you do not agree, you must stop using the platform immediately. These Terms are written in plain language for students and parents.
          </p>
        </section>

        <section>
          <h2 style={headingStyle}>2. Eligibility and Age Requirements</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <p>
              2.1 You must be at least 13 years old to use Lerno. Users under 13 are strictly prohibited.
            </p>
            <p>
              2.2 Minors (13&ndash;17) must have parental/guardian awareness and consent. Parents/guardians are responsible for supervising use and ensuring compliance.
            </p>
            <p>
              2.3 Lerno is designed for CBSE/NCERT students in India (Grades 6&ndash;12). Use outside India is at your own risk.
            </p>
          </div>
        </section>

        <section>
          <h2 style={headingStyle}>3. Account Registration and Security</h2>
          <p>
            You must provide accurate information. You are responsible for keeping your login credentials secure and for all activity under your account. Only one account per person is allowed.
          </p>
        </section>

        <section>
          <h2 style={headingStyle}>4. The Lerno Platform and Services</h2>
          <p>
            Lerno provides a Study Feed, AI Tutor, Progress Tracking, and Exam Preparation resources. All services are supplementary educational tools and must be used alongside school and official NCERT/CBSE materials.
          </p>
        </section>

        <section>
          <h2 style={headingStyle}>5. AI Limitations &mdash; Important Disclaimer</h2>
          <p>
            The AI Tutor is powered by artificial intelligence (Google Gemini and supporting models) and may produce inaccurate, incomplete, or outdated information. You must always verify content against official NCERT textbooks. Full details are in the AI Content and Educational Disclaimer (lerno.in/disclaimer), which is incorporated into these Terms.
          </p>
        </section>

        <section>
          <h2 style={headingStyle}>6. Acceptable Use Policy</h2>
          <p>
            You may use Lerno only for personal, non-commercial educational purposes. You must not use it for cheating, plagiarism, academic dishonesty, reverse-engineering, scraping, or any unlawful/harmful activity. Violations may result in immediate account suspension or termination.
          </p>
        </section>

        <section>
          <h2 style={headingStyle}>7. Intellectual Property</h2>
          <p>
            All Lerno content, AI models, and platform features are Lerno&apos;s exclusive property. You receive a limited, revocable licence for personal educational use only. User-generated content (chats, answers) is licensed to Lerno solely to provide and improve the service.
          </p>
        </section>

        <section>
          <h2 style={headingStyle}>8. Privacy and Data</h2>
          <p>
            Your privacy is governed by our Privacy Policy (lerno.in/privacy), which is incorporated by reference. By using Lerno you consent to the data practices described there.
          </p>
        </section>

        <section>
          <h2 style={headingStyle}>9. Third-Party Services</h2>
          <p>
            Lerno uses Google Gemini, OpenAI (embeddings only), Supabase, Qdrant, Vercel, and other processors. Your data may be processed by these providers under their terms. See the Privacy Policy for details.
          </p>
        </section>

        <section>
          <h2 style={headingStyle}>10. Disclaimers and Limitation of Liability</h2>
          <p>
            Lerno is provided &ldquo;as is&rdquo; without warranties. We make no guarantees regarding academic results. To the maximum extent permitted by law, Lerno&apos;s total liability is limited to the amount you paid in the preceding 12 months (or INR 1,000 for free users). You agree to indemnify Lerno against claims arising from your use or violation of these Terms.
          </p>
        </section>

        <section>
          <h2 style={headingStyle}>11. Termination</h2>
          <p>
            You may delete your account at any time. Lerno may suspend or terminate accounts for violation of these Terms or other reasons.
          </p>
        </section>

        <section>
          <h2 style={headingStyle}>12. Modifications</h2>
          <p>
            We may update these Terms. Continued use after notice constitutes acceptance.
          </p>
        </section>

        <section>
          <h2 style={headingStyle}>13. Governing Law and Dispute Resolution</h2>
          <p>
            These Terms are governed by Indian law. Disputes shall first be resolved through good-faith negotiation. If unresolved within 30 days, they shall be referred to arbitration in Delhi under the Arbitration and Conciliation Act, 1996, before a sole arbitrator. The language of arbitration shall be English. Nothing in these Terms limits your rights under the Consumer Protection Act, 2019.
          </p>
        </section>

        <section>
          <h2 style={headingStyle}>14. Miscellaneous</h2>
          <p>
            Entire agreement, severability, no waiver, etc., are standard and remain unchanged.
          </p>
        </section>

        <section>
          <h2 style={headingStyle}>15. Contact</h2>
          <p>
            Legal questions: legal@lerno.in
            <br />
            Support: help@lerno.in
          </p>
        </section>

        <p style={{ marginTop: '32px' }}>
          These Terms of Service were last updated on April 5, 2026.
        </p>
      </div>
    </LegalPageShell>
  );
}

const headingStyle = {
  fontSize: '20px',
  fontWeight: '700',
  marginBottom: '16px',
  color: 'black',
};
