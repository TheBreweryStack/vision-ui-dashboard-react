import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const Privacy: React.FC = () => {
  return (
    <div className="min-h-screen bg-background safe-area-top safe-area-bottom">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <Link to="/auth">
          <Button variant="ghost" size="sm" className="mb-6">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Sign In
          </Button>
        </Link>

        <div
          className="rounded-2xl p-8"
          style={{
            background: "linear-gradient(135deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0.01) 100%)",
            border: "1px solid rgba(255, 255, 255, 0.06)",
            backdropFilter: "blur(20px)",
          }}
        >
          <h1 className="text-3xl font-bold text-foreground mb-2">Privacy Policy</h1>
          <p className="text-sm text-muted-foreground mb-8">TraderCafé - Last Updated: December 2024</p>

          <div className="prose prose-invert max-w-none space-y-8 text-foreground/90">
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-4">1. INFORMATION WE COLLECT</h2>
              
              <h3 className="text-lg font-medium text-foreground mt-4 mb-3">Data You Provide:</h3>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>Email address (for authentication)</li>
                <li>Display name (optional)</li>
                <li>Trading journal entries</li>
                <li>Notes and watchlists</li>
              </ul>

              <h3 className="text-lg font-medium text-foreground mt-4 mb-3">Automatically Collected:</h3>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>IP address</li>
                <li>Browser type</li>
                <li>Usage analytics (anonymous)</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-4">2. HOW WE USE YOUR DATA</h2>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>Provide the Service</li>
                <li>Save your trading journal</li>
                <li>Calculate your statistics</li>
                <li>Send reminder notifications (if enabled)</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-4">3. DATA SECURITY</h2>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>Encrypted in transit (HTTPS)</li>
                <li>Stored in secured Supabase database</li>
                <li>We are NOT responsible for data breaches</li>
                <li>You use the Service at your own risk</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-4">4. DATA SHARING</h2>
              <p className="text-muted-foreground mb-2">We will NEVER:</p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground mb-4">
                <li>Sell your data</li>
                <li>Share your trading information</li>
                <li>Provide data to advertisers</li>
              </ul>
              <p className="text-muted-foreground mb-2">We MAY share data:</p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>If required by law</li>
                <li>To protect our rights</li>
                <li>With your explicit consent</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-4">5. YOUR RIGHTS</h2>
              <p className="text-muted-foreground mb-2">You can:</p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>Export your data (CSV)</li>
                <li>Delete your account</li>
                <li>Request data removal</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-4">6. COOKIES</h2>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>Essential cookies for authentication</li>
                <li>No tracking cookies</li>
                <li>No third-party cookies</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-4">7. CHILDREN</h2>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>Must be 18+ to use</li>
                <li>We don't knowingly collect data from minors</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-4">8. DISCLAIMER</h2>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>We're NOT responsible for data loss</li>
                <li>Backup your own data regularly</li>
                <li>We may delete inactive accounts</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-4">9. CHANGES</h2>
              <p className="text-muted-foreground">
                We may update this policy anytime without notice.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-4">10. CONTACT</h2>
              <p className="text-muted-foreground">
                Email: <a href="mailto:support@thebrewerystack.com" className="text-primary hover:text-primary/80">support@thebrewerystack.com</a>
              </p>
            </section>

            <section className="border-t border-border pt-6">
              <p className="text-muted-foreground font-semibold">
                By using TraderCafé, you accept these terms.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Privacy;
