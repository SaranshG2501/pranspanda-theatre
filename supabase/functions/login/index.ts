import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 🔐 Create client with AUTH context (not service yet)
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    // 🔐 Check logged in user
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { headers: corsHeaders, status: 401 }
      );
    }

    // 🔐 Check admin role
    const { data: roleData } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(
        JSON.stringify({ error: "Only admins can add users" }),
        { headers: corsHeaders, status: 403 }
      );
    }

    // 👇 Now use SERVICE ROLE for privileged operations
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { email, uti, role } = await req.json();

    if (!email || !uti) {
      return new Response(
        JSON.stringify({ error: "Missing email or uti" }),
        { headers: corsHeaders, status: 400 }
      );
    }

    // 1️⃣ Create Auth user
    const { data: authUser, error: authError } =
      await adminClient.auth.admin.createUser({
        email: email.toLowerCase(),
        password: uti,
        email_confirm: true,
      });

    if (authError) throw authError;

    // 2️⃣ Insert allowed user
    await adminClient.from("allowed_users").insert({
      email: email.toLowerCase(),
      uti,
    });

    // 3️⃣ Insert role
    await adminClient.from("user_roles").insert({
      user_id: authUser.user.id,
      role: role || "user",
    });

    return new Response(
      JSON.stringify({ success: true }),
      { headers: corsHeaders, status: 200 }
    );

  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { headers: corsHeaders, status: 500 }
    );
  }
});
