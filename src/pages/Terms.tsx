import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const Terms: React.FC = () => {
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
          <h1 className="text-3xl font-bold text-foreground mb-2">Terms and Conditions</h1>
          <p className="text-sm text-muted-foreground mb-8">TraderCafé</p>

          <div className="prose prose-invert max-w-none space-y-8 text-foreground/90">
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-4">1. DISCLAIMER OF LIABILITY</h2>
              <p className="text-destructive font-semibold mb-4">IMPORTANT: READ CAREFULLY</p>
              <p className="mb-4">By using TraderCafé ("the Service"), you acknowledge and agree that:</p>
              
              <h3 className="text-lg font-medium text-foreground mt-6 mb-3">Investment Risk Disclaimer</h3>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>This app is for INFORMATIONAL and JOURNALING purposes only</li>
                <li>NOT financial advice, investment advice, or trading recommendations</li>
                <li>You are solely responsible for ALL trading decisions and outcomes</li>
                <li>Past performance does NOT indicate future results</li>
                <li>Trading options and stocks involves substantial risk of loss</li>
                <li>You can lose MORE than your initial investment</li>
              </ul>

              <h3 className="text-lg font-medium text-foreground mt-6 mb-3">No Liability Clause</h3>
              <p className="text-muted-foreground">
                THE SERVICE IS PROVIDED "AS IS" WITHOUT ANY WARRANTIES. IN NO EVENT SHALL TRADERCAFÉ, ITS OWNERS, OPERATORS, OR AFFILIATES BE LIABLE FOR:
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground mt-2">
                <li>Any trading losses or investment decisions</li>
                <li>Lost profits or opportunities</li>
                <li>Data loss or corruption</li>
                <li>Service interruptions or errors</li>
                <li>Indirect, incidental, or consequential damages</li>
                <li>ANY damages exceeding $1.00 USD</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-4">2. INDEMNIFICATION</h2>
              <p className="text-muted-foreground">
                You agree to DEFEND, INDEMNIFY, and HOLD HARMLESS TraderCafé and its operators from ANY claims, damages, losses, or legal fees arising from:
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground mt-2">
                <li>Your use of the Service</li>
                <li>Your trading activities</li>
                <li>Violation of these Terms</li>
                <li>Any losses incurred from your investment decisions</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-4">3. NO PROFESSIONAL ADVICE</h2>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>We are NOT registered investment advisors</li>
                <li>We do NOT provide personalized investment advice</li>
                <li>Consult licensed financial professionals for advice</li>
                <li>We make NO guarantees about accuracy of data</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-4">4. USER RESPONSIBILITIES</h2>
              <p className="text-muted-foreground mb-2">You acknowledge:</p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>You are 18+ years old</li>
                <li>You understand trading risks</li>
                <li>You won't hold us liable for ANY losses</li>
                <li>You're using this tool at YOUR OWN RISK</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-4">5. ARBITRATION AGREEMENT</h2>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>Any disputes resolved through BINDING ARBITRATION</li>
                <li>NO CLASS ACTION LAWSUITS</li>
                <li>Each party bears own legal costs</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-4">6. LIMITATION OF LIABILITY</h2>
              <p className="text-muted-foreground">
                Maximum liability shall not exceed the amount paid for the Service or $1.00, whichever is greater.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-4">7. TERMINATION</h2>
              <p className="text-muted-foreground">
                We may terminate your access at any time, for any reason, without notice.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-4">8. OPTIONS TRADING RISKS</h2>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>You can lose your ENTIRE investment</li>
                <li>Options expire worthless</li>
                <li>Time decay erodes value daily</li>
                <li>Implied volatility can cause losses</li>
                <li>Assignment risk exists</li>
                <li>Margin calls may force liquidation</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-4">9. TRADING ADDICTION WARNING</h2>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>Trading can be psychologically addictive</li>
                <li>Seek help if you can't stop trading</li>
                <li>Set limits and stick to them</li>
                <li>We're not responsible for addictive behavior</li>
                <li>Consider professional help if needed</li>
              </ul>
            </section>

            <section className="border-t border-border pt-6">
              <p className="text-muted-foreground font-semibold">
                By using TraderCafé, you WAIVE all rights to sue or claim damages beyond these terms.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Terms;
