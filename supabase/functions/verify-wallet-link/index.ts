// Verify EIP-191 wallet ownership before linking an address to the authenticated member.
import { createClient } from "npm:@supabase/supabase-js@2";
import { recoverMessageAddress } from "npm:viem@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};
const reply = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: cors });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply(405, { error: "Method not allowed" });

  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anonKey || !serviceKey) return reply(503, { error: "Wallet verification service is not configured" });

  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return reply(401, { error: "Authentication required" });

  let payload: { address?: string; nonce?: string; signature?: string };
  try { payload = await req.json(); } catch { return reply(400, { error: "Invalid JSON body" }); }
  const address = typeof payload.address === "string" ? payload.address.toLowerCase() : "";
  const nonce = typeof payload.nonce === "string" ? payload.nonce : "";
  const signature = typeof payload.signature === "string" ? payload.signature : "";
  if (!/^0x[a-f0-9]{40}$/.test(address) || !/^[a-f0-9]{48}$/.test(nonce) ||
      !/^0x(?:[a-fA-F0-9]{130}|[a-fA-F0-9]{128})$/.test(signature)) {
    return reply(400, { error: "Wallet address, nonce, or signature format is invalid" });
  }

  const authClient = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await authClient.auth.getUser(token);
  if (authError || !authData.user) return reply(401, { error: "Session is invalid or expired" });

  const { data: challenge, error: challengeError } = await authClient
    .from("kingmaker_wallet_challenges")
    .select("wallet_address,nonce,message,expires_at,consumed_at")
    .eq("user_id", authData.user.id)
    .eq("nonce", nonce)
    .maybeSingle();
  // The challenge table is deliberately inaccessible to clients; fetch it via the
  // privileged client only after independently resolving the caller's auth identity.
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: privilegedChallenge, error: privilegedChallengeError } = await admin
    .from("kingmaker_wallet_challenges")
    .select("wallet_address,nonce,message,expires_at,consumed_at,user_id")
    .eq("user_id", authData.user.id)
    .eq("nonce", nonce)
    .maybeSingle();

  if (privilegedChallengeError || !privilegedChallenge || privilegedChallenge.consumed_at ||
      new Date(privilegedChallenge.expires_at).getTime() <= Date.now() ||
      privilegedChallenge.wallet_address !== address) {
    return reply(400, { error: "Wallet challenge is invalid, expired, or already used" });
  }
  let recovered: string;
  try { recovered = (await recoverMessageAddress({
    message: privilegedChallenge.message,
    signature: signature as `0x${string}`,
  })).toLowerCase(); } catch { return reply(400, { error: "Wallet signature could not be verified" }); }
  if (recovered !== address) return reply(403, { error: "Signature does not prove ownership of this wallet" });

  const { error: linkError } = await admin.rpc("complete_kingmaker_wallet_link", {
    p_user_id: authData.user.id,
    p_wallet_address: address,
    p_nonce: nonce,
  });
  if (linkError) return reply(409, { error: linkError.message.includes("already linked")
    ? "This wallet is already linked to another account"
    : "Wallet link could not be completed. Request a new challenge and retry." });
  return reply(200, { linked: true, address });
});
