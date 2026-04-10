import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ContactRequest {
  subject: string;
  body: string;
  requestType: 'support' | 'product_idea' | 'urgent';
}

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CONTACT-SUPPORT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) {
      throw new Error("RESEND_API_KEY is not configured");
    }
    logStep("Resend key verified");

    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header provided");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    // Get user profile for additional info
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('display_name, plan_status')
      .eq('id', user.id)
      .single();

    // Parse request body
    const { subject, body, requestType }: ContactRequest = await req.json();
    
    if (!subject || !body) {
      throw new Error("Subject and body are required");
    }
    logStep("Request parsed", { subject, requestType });

    // Format the email
    const typeLabel = requestType === 'urgent' ? '[URGENT]' : requestType === 'product_idea' ? '[Product Idea]' : '[Support]';
    const emailSubject = `${typeLabel} ${subject}`;
    const userName = profile?.display_name || user.email;
    
    const emailHtml = `
      <h2>${typeLabel} Support Request</h2>
      <p><strong>From:</strong> ${userName} (${user.email})</p>
      <p><strong>User ID:</strong> ${user.id}</p>
      <p><strong>Plan:</strong> ${profile?.plan_status || 'Unknown'}</p>
      <p><strong>Type:</strong> ${requestType}</p>
      <hr />
      <h3>Subject: ${subject}</h3>
      <div style="white-space: pre-wrap;">${body}</div>
    `;

    // Send email using Resend via fetch
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Brewery Stack <onboarding@resend.dev>",
        to: ["support@thebrewerystack.com"],
        reply_to: user.email,
        subject: emailSubject,
        html: emailHtml,
      }),
    });

    if (!emailResponse.ok) {
      const errorData = await emailResponse.json();
      throw new Error(`Failed to send email: ${errorData.message || emailResponse.statusText}`);
    }

    const emailResult = await emailResponse.json();

    logStep("Email sent successfully", { emailId: emailResult.id });

    return new Response(
      JSON.stringify({ success: true, message: "Your message has been sent!" }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    logStep("ERROR", { message: error.message });
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
