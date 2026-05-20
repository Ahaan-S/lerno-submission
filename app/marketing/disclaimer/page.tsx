import type { Metadata } from "next";
import LegalPageShell from "@/components/marketing/LegalPageShell";

export const metadata: Metadata = {
  title: "Disclaimer | Lerno",
  description: "AI Content and Educational Disclaimer for Lerno — AI tutoring for CBSE students.",
  alternates: { canonical: "https://lerno.in/disclaimer" },
  robots: { index: true, follow: true },
  openGraph: {
    title: "Disclaimer | Lerno",
    description: "AI Content and Educational Disclaimer for Lerno — AI tutoring for CBSE students.",
    url: "https://lerno.in/disclaimer",
    siteName: "Lerno",
    locale: "en_IN",
    type: "website",
  },
};

export default function DisclaimerPage() {
  return (
    <LegalPageShell title="Disclaimer">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
        <p>
          Last updated: April 5, 2026
        </p>

        <section>
          <h2 style={headingStyle}>Purpose of This Disclaimer</h2>
          <p>
            This AI Content and Educational Disclaimer (&ldquo;Disclaimer&rdquo;) explains the nature, limitations, and proper use of Lerno&apos;s artificial intelligence features. By using the Lerno AI Tutor or any AI-powered feature, you acknowledge that you have read, understood, and agree to this Disclaimer. This Disclaimer is incorporated into and forms part of Lerno&apos;s Terms of Service.
          </p>
        </section>

        <section>
          <h2 style={headingStyle}>Nature of the AI Tutor</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <h3 style={subHeadingStyle}>2.1 What It Is</h3>
              <p>
                Lerno&apos;s AI Tutor is a conversational AI system powered by large language models (primarily Google&apos;s Gemini family), using Retrieval-Augmented Generation (RAG) grounded in NCERT textbooks and CBSE Previous Year Questions. It maintains a memory of your interactions to personalise responses based on your weak topics, common mistakes, learning pace, and preferred explanation style.
              </p>
            </div>

            <div>
              <h3 style={subHeadingStyle}>2.2 What It Is NOT</h3>
              <p>The Lerno AI Tutor is NOT:</p>
              <ul style={listStyle}>
                <li>A human tutor, teacher, or qualified educational professional.</li>
                <li>Infallible or perfectly accurate. AI systems can and do make errors, including hallucinations.</li>
                <li>A replacement for school, teachers, or official NCERT/CBSE materials.</li>
                <li>Affiliated with, endorsed by, or officially connected to CBSE, NCERT, or the Ministry of Education.</li>
                <li>A certified examination preparation service with guaranteed results.</li>
              </ul>
            </div>
          </div>
        </section>

        <section>
          <h2 style={headingStyle}>Known Limitations of AI Responses</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <h3 style={subHeadingStyle}>3.1 Factual Accuracy</h3>
              <p>
                AI-generated responses may contain factual errors, oversimplifications, outdated information, or hallucinated details even when they appear confident.
              </p>
            </div>

            <div>
              <h3 style={subHeadingStyle}>3.2 Mathematical and Scientific Content</h3>
              <p>
                Always verify numerical answers, solution steps, and diagrams against your official NCERT textbook. Solution formats may differ from your school&apos;s preferred method.
              </p>
            </div>

            <div>
              <h3 style={subHeadingStyle}>3.3 Memory and Personalisation</h3>
              <p>
                Memory profiles are AI-generated inferences and may not perfectly reflect your actual abilities. Earlier conversations may influence later responses.
              </p>
            </div>
          </div>
        </section>

        <section>
          <h2 style={headingStyle}>Recommended Use of the AI Tutor</h2>
          <p>For safe and effective use:</p>
          <ul style={listStyle}>
            <li>Always cross-reference answers with your official NCERT textbook.</li>
            <li>Discuss AI explanations with your school teacher.</li>
            <li>Use Lerno only as a supplement to classroom learning.</li>
            <li>Never submit AI-generated answers verbatim in school assignments without full understanding and verification.</li>
            <li>If a response contradicts your textbook, trust the textbook and report the issue to us.</li>
            <li>Academic success remains your responsibility — Lerno is a support tool, not a substitute for effort or teacher guidance.</li>
          </ul>
        </section>

        <section>
          <h2 style={headingStyle}>No Affiliation with CBSE or NCERT</h2>
          <p>
            Lerno is an independent educational technology platform. It is not affiliated with, authorized by, endorsed by, or connected in any way to CBSE, NCERT, or any government education authority. References to CBSE/NCERT are made solely to indicate curriculum alignment.
          </p>
        </section>

        <section>
          <h2 style={headingStyle}>No Guarantee of Academic Results</h2>
          <p>
            Lerno makes no representation or warranty that use of the platform will result in improved academic performance or examination scores. Results depend on factors outside Lerno&apos;s control.
          </p>
        </section>

        <section>
          <h2 style={headingStyle}>Reporting Inaccurate AI Responses</h2>
          <p>If you find a response that is factually incorrect, misleading, or harmful:</p>
          <ul style={listStyle}>
            <li>Use the in-app thumbs-down / report button, or</li>
            <li>Email help@lerno.in with subject &ldquo;AI Error Report&rdquo; including the question, AI response, and correct NCERT reference.</li>
          </ul>
          <p style={{ marginTop: '16px' }}>
            We review every report and continuously improve the platform.
          </p>
        </section>

        <section>
          <h2 style={headingStyle}>Contact</h2>
          <p>Questions about this Disclaimer?</p>
          <p>
            Email: help@lerno.in<br />
            Website: lerno.in
          </p>
        </section>

        <p style={{ marginTop: '32px' }}>
          This Disclaimer was last updated on April 5, 2026.
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

const subHeadingStyle = {
  fontSize: '16px',
  fontWeight: '700',
  marginBottom: '8px',
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
