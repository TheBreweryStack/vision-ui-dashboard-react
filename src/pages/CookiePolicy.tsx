import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Cookie } from "lucide-react";

const CookiePolicy: React.FC = () => {
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
          <div className="flex items-center gap-3 mb-2">
            <Cookie className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold text-foreground">Cookie Policy</h1>
          </div>
          <p className="text-sm text-muted-foreground mb-8">TraderCafé - Last Updated: December 2024</p>

          <div className="prose prose-invert max-w-none space-y-8 text-foreground/90">
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-4">1. WHAT ARE COOKIES?</h2>
              <p className="text-muted-foreground">
                Cookies are small text files that are stored on your device (computer, tablet, or mobile) when you visit a website. 
                They help websites remember your preferences and improve your browsing experience.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-4">2. HOW WE USE COOKIES</h2>
              <p className="text-muted-foreground mb-4">TraderCafé uses only essential cookies required for the service to function:</p>
              
              <h3 className="text-lg font-medium text-foreground mt-4 mb-3">Essential Cookies (Required)</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-muted-foreground border border-border/50 rounded-lg">
                  <thead className="bg-secondary/30">
                    <tr>
                      <th className="text-left p-3 border-b border-border/50">Cookie Name</th>
                      <th className="text-left p-3 border-b border-border/50">Purpose</th>
                      <th className="text-left p-3 border-b border-border/50">Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="p-3 border-b border-border/30">sb-access-token</td>
                      <td className="p-3 border-b border-border/30">Authentication session</td>
                      <td className="p-3 border-b border-border/30">Session</td>
                    </tr>
                    <tr>
                      <td className="p-3 border-b border-border/30">sb-refresh-token</td>
                      <td className="p-3 border-b border-border/30">Maintains login state</td>
                      <td className="p-3 border-b border-border/30">7 days</td>
                    </tr>
                    <tr>
                      <td className="p-3">theme</td>
                      <td className="p-3">Stores dark/light mode preference</td>
                      <td className="p-3">1 year</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-4">3. COOKIES WE DO NOT USE</h2>
              <p className="text-muted-foreground mb-2">TraderCafé does NOT use:</p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li><strong className="text-foreground">Tracking Cookies:</strong> We do not track your browsing activity</li>
                <li><strong className="text-foreground">Advertising Cookies:</strong> We do not serve ads or share data with advertisers</li>
                <li><strong className="text-foreground">Third-Party Cookies:</strong> We do not allow third parties to place cookies</li>
                <li><strong className="text-foreground">Analytics Cookies:</strong> We do not use Google Analytics or similar services</li>
                <li><strong className="text-foreground">Social Media Cookies:</strong> We do not integrate social media tracking</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-4">4. LOCAL STORAGE</h2>
              <p className="text-muted-foreground mb-4">
                In addition to cookies, we use browser local storage for:
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>Storing your authentication session securely</li>
                <li>Caching app preferences for faster loading</li>
                <li>Temporary data for offline functionality (PWA)</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-4">5. YOUR COOKIE CHOICES</h2>
              <p className="text-muted-foreground mb-4">You have the following options:</p>
              
              <h3 className="text-lg font-medium text-foreground mt-4 mb-3">Browser Settings</h3>
              <p className="text-muted-foreground mb-4">
                Most browsers allow you to control cookies through settings. You can:
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>View what cookies are stored</li>
                <li>Delete specific or all cookies</li>
                <li>Block cookies from specific sites</li>
                <li>Block all cookies (may affect functionality)</li>
              </ul>

              <h3 className="text-lg font-medium text-foreground mt-4 mb-3">Impact of Disabling Cookies</h3>
              <p className="text-muted-foreground">
                If you disable essential cookies, you will NOT be able to:
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground mt-2">
                <li>Log in to your account</li>
                <li>Stay logged in between sessions</li>
                <li>Access your trading journal</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-4">6. GDPR COMPLIANCE</h2>
              <p className="text-muted-foreground mb-4">Under the General Data Protection Regulation (GDPR), you have the right to:</p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li><strong className="text-foreground">Access:</strong> Request information about cookies we use</li>
                <li><strong className="text-foreground">Rectification:</strong> Correct any inaccurate data</li>
                <li><strong className="text-foreground">Erasure:</strong> Request deletion of your data and cookies</li>
                <li><strong className="text-foreground">Restriction:</strong> Limit how we process your data</li>
                <li><strong className="text-foreground">Portability:</strong> Export your data in a portable format</li>
                <li><strong className="text-foreground">Object:</strong> Opt out of certain data processing</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-4">7. CCPA COMPLIANCE</h2>
              <p className="text-muted-foreground mb-4">Under the California Consumer Privacy Act (CCPA), California residents have the right to:</p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>Know what personal information is collected</li>
                <li>Know whether personal information is sold or disclosed</li>
                <li>Say no to the sale of personal information</li>
                <li>Access their personal information</li>
                <li>Request deletion of personal information</li>
                <li>Not be discriminated against for exercising these rights</li>
              </ul>
              <p className="text-muted-foreground mt-4">
                <strong className="text-foreground">We do NOT sell your personal information.</strong>
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-4">8. DATA RETENTION</h2>
              <p className="text-muted-foreground">
                Session cookies are deleted when you close your browser. Persistent cookies are stored for the duration 
                specified in the table above. You can delete these at any time through your browser settings.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-4">9. UPDATES TO THIS POLICY</h2>
              <p className="text-muted-foreground">
                We may update this Cookie Policy from time to time. Any changes will be posted on this page with an 
                updated "Last Updated" date. Continued use of the Service after changes constitutes acceptance.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-4">10. CONTACT US</h2>
              <p className="text-muted-foreground">
                If you have questions about our use of cookies, please contact us at:{" "}
                <a href="mailto:support@thebrewerystack.com" className="text-primary hover:text-primary/80">
                  support@thebrewerystack.com
                </a>
              </p>
            </section>

            <section className="border-t border-border pt-6">
              <p className="text-muted-foreground">
                By continuing to use TraderCafé, you consent to our use of essential cookies as described in this policy.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CookiePolicy;
