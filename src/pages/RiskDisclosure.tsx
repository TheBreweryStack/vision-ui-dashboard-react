import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, AlertTriangle } from "lucide-react";

const RiskDisclosure: React.FC = () => {
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
            <AlertTriangle className="h-8 w-8 text-destructive" />
            <h1 className="text-3xl font-bold text-foreground">Risk Disclosure Statement</h1>
          </div>
          <p className="text-sm text-muted-foreground mb-8">TraderCafé - Important Investment Risks</p>

          <div className="prose prose-invert max-w-none space-y-8 text-foreground/90">
            <section className="p-4 rounded-lg bg-destructive/10 border border-destructive/20">
              <h2 className="text-xl font-semibold text-destructive mb-4">⚠️ IMPORTANT WARNING</h2>
              <p className="text-muted-foreground font-medium">
                Trading stocks and options involves substantial risk of loss and is not suitable for all investors. 
                You should carefully consider whether trading is appropriate for you in light of your financial condition.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-4">OPTIONS TRADING RISKS</h2>
              <ul className="list-disc list-inside space-y-3 text-muted-foreground">
                <li><strong className="text-foreground">Total Loss Risk:</strong> You can lose your ENTIRE investment in options trading</li>
                <li><strong className="text-foreground">Expiration Risk:</strong> Options can expire completely worthless, resulting in 100% loss</li>
                <li><strong className="text-foreground">Time Decay:</strong> Option values erode daily due to theta decay, even if the stock doesn't move</li>
                <li><strong className="text-foreground">Volatility Risk:</strong> Implied volatility changes can cause significant losses regardless of stock direction</li>
                <li><strong className="text-foreground">Assignment Risk:</strong> You may be assigned shares unexpectedly, requiring additional capital</li>
                <li><strong className="text-foreground">Margin Calls:</strong> Leveraged positions may force liquidation at unfavorable prices</li>
                <li><strong className="text-foreground">Liquidity Risk:</strong> Some options have wide bid-ask spreads, making exits costly</li>
                <li><strong className="text-foreground">Gap Risk:</strong> Overnight or weekend gaps can result in losses beyond stop-loss levels</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-4">STOCK TRADING RISKS</h2>
              <ul className="list-disc list-inside space-y-3 text-muted-foreground">
                <li><strong className="text-foreground">Market Risk:</strong> Stock prices can decline significantly, even to zero</li>
                <li><strong className="text-foreground">Company Risk:</strong> Individual companies can go bankrupt, resulting in total loss</li>
                <li><strong className="text-foreground">Sector Risk:</strong> Entire sectors can underperform for extended periods</li>
                <li><strong className="text-foreground">Economic Risk:</strong> Recessions and economic downturns affect all investments</li>
                <li><strong className="text-foreground">Currency Risk:</strong> International investments are affected by exchange rate fluctuations</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-4">NO SUCCESS GUARANTEE</h2>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>Other users' results do NOT guarantee your success</li>
                <li>Displayed statistics are historical only and not predictive</li>
                <li>Market conditions change constantly and unpredictably</li>
                <li>Past performance does NOT equal future results</li>
                <li>No trading strategy works 100% of the time</li>
                <li>Backtested results may not reflect real trading conditions</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-4">LEVERAGE RISKS</h2>
              <p className="text-muted-foreground mb-4">
                If you trade on margin or use leveraged products:
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>Losses can exceed your initial investment</li>
                <li>You may owe money to your broker</li>
                <li>Positions may be liquidated without your consent</li>
                <li>Interest charges accumulate on borrowed funds</li>
              </ul>
            </section>

            <section className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <h2 className="text-xl font-semibold text-amber-500 mb-4">🧠 TRADING ADDICTION WARNING</h2>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>Trading can be psychologically addictive similar to gambling</li>
                <li>Seek professional help if you cannot control your trading behavior</li>
                <li>Set strict limits on time and money spent trading</li>
                <li>Never trade money you cannot afford to lose</li>
                <li>Take breaks and maintain perspective on your overall financial health</li>
                <li>Consider speaking with a financial therapist if trading affects your wellbeing</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-4">BEFORE YOU TRADE</h2>
              <p className="text-muted-foreground mb-4">
                Before engaging in any trading activity, you should:
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>Understand all the risks involved</li>
                <li>Only invest money you can afford to lose completely</li>
                <li>Consider your investment objectives and experience level</li>
                <li>Consult with a licensed financial advisor</li>
                <li>Read all applicable disclosures from your broker</li>
                <li>Understand the specific products you are trading</li>
              </ul>
            </section>

            <section className="border-t border-border pt-6">
              <p className="text-destructive font-bold text-lg mb-4">
                YOU ACKNOWLEDGE UNDERSTANDING ALL RISKS
              </p>
              <p className="text-muted-foreground">
                By using TraderCafé, you acknowledge that you have read, understood, and agree to all risks 
                disclosed in this statement. You accept full responsibility for your trading decisions and 
                any resulting gains or losses.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RiskDisclosure;
