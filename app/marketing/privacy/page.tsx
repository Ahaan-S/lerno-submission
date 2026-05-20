import type { Metadata } from "next";
import LegalPageShell from "@/components/marketing/LegalPageShell";

export const metadata: Metadata = {
  title: "Privacy Policy | Lerno",
  description: "Privacy Policy for Lerno — AI tutoring for CBSE students.",
  alternates: { canonical: "https://lerno.in/privacy" },
  robots: { index: true, follow: true },
  openGraph: {
    title: "Privacy Policy | Lerno",
    description: "Privacy Policy for Lerno — AI tutoring for CBSE students.",
    url: "https://lerno.in/privacy",
    siteName: "Lerno",
    locale: "en_IN",
    type: "website",
  },
};

export default function PrivacyPage() {
  return (
    <LegalPageShell title="Privacy Policy">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
        <p>
          How Lerno collects, uses, and protects your personal data.
          <br />
          Effective Date: May 1, 2026
          <br />
          Platform: lerno.in
          <br />
          Governed by the laws of India (Jurisdiction: Delhi, India)
          <br />
          Last updated: April 5, 2026
        </p>

        <section>
          <h2 style={headingStyle}>1. Introduction</h2>
          <p>
            Lerno is committed to protecting your privacy and providing a safe online learning environment. This Privacy Policy explains our practices regarding the collection, use, disclosure, and protection of your personal information. By using Lerno, you consent to the practices described in this Privacy Policy. All references to &ldquo;these Terms&rdquo; throughout this policy refer to our revised Terms of Service.
          </p>
        </section>

        <section>
          <h2 style={headingStyle}>2. Information We Collect</h2>
          <p>
            When you register and use Lerno, we collect the following personal information:
          </p>
          <ul style={listStyle}>
            <li>
              <strong>Account Information:</strong> We use Google Authentication to create your account. This provides us with your name, email address, and profile picture.
            </li>
            <li>
              <strong>Academic Profile:</strong> During onboarding, you provide us with your school level (CBSE grades) and subject preferences.
            </li>
            <li>
              <strong>Learning History and Memory:</strong> We collect and analyze your interactions with our platform, including progress in chapters, areas of difficulty, performance on quizzes, and chat history with the AI Tutor.
            </li>
            <li>
              <strong>Usage Data:</strong> We collect technical information such as your IP address, browser type, device type, and operating system for security and analytics purpose.
            </li>
          </ul>
        </section>

        <section>
          <h2 style={headingStyle}>3. How We Use Your Information</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <p>
              3.1 We use your personal information to personalize your learning experience, maintain your learner profile, and provide syllabus-aligned tutoring.
            </p>
            <p>
              3.2 In alignment with the Digital Personal Data Protection (DPDP) Act, we process your data based on your explicit consent or other legitimate uses as defined by law. You have the right to withdraw your consent at any time.
            </p>
          </div>
        </section>

        <section>
          <h2 style={headingStyle}>4. Information Sharing and Disclosure</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <p>
              4.1 We do not sell, trade, or otherwise transfer your personal information to outside parties for marketing or commercial use.
            </p>
            <p>
              4.2 We only share information with trusted third-party processors who assist us in operating our platform (such as Google Gemini for AI and Supabase for authentication), subject to strict data protection standards.
            </p>
          </div>
        </section>

        <section>
          <h2 style={headingStyle}>5. Data Retention and Security</h2>
          <p>
            We retain your information for as long as your account is active or as needed to provide you with services. We implement industry-standard security measures to safeguard your data, including encryption and secure access controls.
          </p>
        </section>

        <section>
          <h2 style={headingStyle}>6. Your Rights</h2>
          <p>
            Under the DPDP Act and other applicable laws, you have the right to access, correct, or delete your personal information. You can delete your account and all associated data at any time from your account settings or by contacting us.
          </p>
        </section>

        <section>
          <h2 style={headingStyle}>7. Third-Party Services</h2>
          <p>
            Lerno uses processors including Google Gemini, OpenAI (embeddings only), Supabase, Qdrant, and Vercel. Your data may be processed by these providers under their respective terms.
          </p>
        </section>

        <section>
          <h2 style={headingStyle}>8. Cookie Policy</h2>
          <p>
            We use essential cookies for secure authentication and platform functionality. We also use analytics cookies to understand platform performance, which you can manage through your browser settings or our cookie consent banner.
          </p>
        </section>

        <section>
          <h2 style={headingStyle}>9. International Data Transfers</h2>
          <p>
            Lerno&apos;s service providers may process your data on servers located outside India. Where we transfer data internationally, we ensure appropriate safeguards including contractual protections and compliance with data protection standards.
          </p>
        </section>

        <section>
          <h2 style={headingStyle}>10. Contact Information</h2>
          <p>
            For any privacy-related questions or to contact our Data Protection Officer:
            <br />
            Email: help@lerno.in
            <br />
            Website: lerno.in/privacy
          </p>
        </section>

        <p style={{ marginTop: '32px' }}>
          This Privacy Policy was last updated on April 5, 2026.
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

const listStyle = {
  marginLeft: '24px',
  marginTop: '12px',
  listStyleType: 'disc',
  display: 'flex',
  flexDirection: 'column' as const,
  gap: '8px',
};
