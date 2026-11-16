/* KINGMAKER mining client foundation.
 * Requires a Supabase project and public anon key in window.KM_CONFIG.
 * Never put a service-role key in this browser bundle.
 */
(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const state = $("session-state"), countdown = $("session-countdown");
  const start = $("start-mining"), claim = $("claim-mining");
  const adButton = $("watch-restart-ad"), adStatus = $("ad-status");
  if (!state || !start || !claim) return;

  const config = window.KM_CONFIG || {};
  const say = (label, detail) => {
    state.textContent = label;
    countdown.textContent = detail;
  };
  const fmt = ms => {
    const s = Math.max(0, Math.floor(ms / 1000));
    return [Math.floor(s / 3600), Math.floor(s % 3600 / 60), s % 60]
      .map(v => String(v).padStart(2, "0")).join(":");
  };

  if (!config.supabaseUrl || !config.supabaseAnonKey || !window.supabase?.createClient) {
    say("SIX-HOUR SESSION · BACKEND NOT CONFIGURED",
      "Connect the production Supabase project to enable secure accounts and server-timed sessions.");
    return;
  }

  const db = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
  let activeSession = null, ticker = null;
  const emailInput = $("member-email"), signIn = $("member-signin");
  const signOut = $("member-signout"), memberStatus = $("member-status");
  const crownBalance = $("crown-balance"), ledgerStatus = $("ledger-status");
  if (signIn) signIn.addEventListener("click", async () => {
    const email = (emailInput?.value || "").trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      memberStatus.textContent = "Enter a valid email address."; return;
    }
    signIn.disabled = true;
    const { error } = await db.auth.signInWithOtp({
      email, options: { emailRedirectTo: location.origin + location.pathname }
    });
    memberStatus.textContent = error ? "Sign-in link could not be sent. Check the account configuration." :
      "Check your email for the secure KINGMAKER sign-in link.";
    signIn.disabled = false;
  });
  if (signOut) signOut.addEventListener("click", async () => {
    await db.auth.signOut();
    memberStatus.textContent = "You are signed out.";
    await refresh();
  });

  async function refreshBalance(userId) {
    if (!crownBalance || !ledgerStatus) return;
    ledgerStatus.textContent = "Loading server-recorded CROWN ledger…";
    const { data, error } = await db.from("crown_ledger").select("amount").eq("user_id", userId);
    if (error) {
      crownBalance.textContent = "Unavailable";
      ledgerStatus.textContent = "The server could not load your ledger. No local balance is shown.";
      return;
    }
    const total = (data || []).reduce((sum, row) => sum + Number(row.amount || 0), 0);
    crownBalance.textContent = total.toFixed(8).replace(/\.?0+$/, "") + " CROWN";
    ledgerStatus.textContent = (data || []).length + " verified ledger entr" + ((data || []).length === 1 ? "y" : "ies") + ". This is an off-chain participation ledger, not a withdrawable token balance.";
  }

  async function refresh() {
    const { data: auth } = await db.auth.getUser();
    if (!auth?.user) {
      clearInterval(ticker);
      activeSession = null;
      say("SIGN IN REQUIRED", "A secure KINGMAKER account is required. No local-only mining session is created.");
      start.disabled = true; claim.disabled = true;
      if (memberStatus) memberStatus.textContent = "Not signed in. Request a secure email sign-in link above.";
      if (crownBalance) crownBalance.textContent = "— CROWN";
      if (ledgerStatus) ledgerStatus.textContent = "Sign in to view your recorded balance. No preview balance is displayed.";
      if (signOut) signOut.hidden = true;
      return;
    }
    if (memberStatus) memberStatus.textContent = "Signed in: " + auth.user.email;
    await refreshBalance(auth.user.id);
    if (signOut) signOut.hidden = false;
    const { data, error } = await db.from("mining_sessions")
      .select("id,status,started_at,ends_at").eq("user_id", auth.user.id)
      .order("started_at", { ascending: false }).limit(1).maybeSingle();
    if (error) { say("MINING SERVICE UNAVAILABLE", "The server could not load your session. Please try again later."); return; }
    activeSession = data;
    if (!data) {
      clearInterval(ticker);
      say("READY · NO ACTIVE SESSION", "Start a six-hour session when the network opens.");
      start.disabled = false; claim.disabled = true; return;
    }
    const end = new Date(data.ends_at).getTime();
    if (data.status === "active" && end > Date.now()) {
      say("MINING SESSION ACTIVE", "Time remaining: " + fmt(end - Date.now()));
      start.disabled = true; claim.disabled = true;
      clearInterval(ticker); ticker = setInterval(refreshCountdown, 1000);
    } else if (data.status === "active") {
      say("SESSION COMPLETE · CLAIM AVAILABLE", "Your server-timed six-hour session has ended.");
      start.disabled = true; claim.disabled = false;
    } else {
      say("SESSION CLOSED", "A new session can start when the service rules permit.");
      start.disabled = false; claim.disabled = true;
    }
  }
  async function refreshCountdown() {
    if (!activeSession) return;
    const left = new Date(activeSession.ends_at).getTime() - Date.now();
    if (left <= 0) { clearInterval(ticker); await refresh(); }
    else countdown.textContent = "Time remaining: " + fmt(left);
  }

  start.addEventListener("click", async () => {
    start.disabled = true;
    const { error } = await db.rpc("start_kingmaker_mining");
    if (error) say("SESSION NOT STARTED", error.message.includes("disabled") ?
      "Mining has not been enabled by the KINGMAKER operator." : "The server rejected this request. No reward was created.");
    await refresh();
  });
  claim.addEventListener("click", async () => {
    if (!activeSession) return;
    claim.disabled = true;
    const { error } = await db.rpc("claim_kingmaker_mining", { p_session_id: activeSession.id });
    if (error) say("CLAIM NOT COMPLETED", "The server did not confirm this claim. Please retry or contact support.");
    else say("CLAIM RECORDED", "Your server ledger was updated. Any future token distribution remains subject to launch rules.");
    await refresh();
  });

  // Rewarded-ad restart is intentionally fail-closed. A real provider SDK and
  // server-side signed callback + one-time grant RPC must exist before enabling.
  const ads = window.KM_REWARDED_ADS;
  if (ads && typeof ads.show === "function" && config.rewardedAdRestartEnabled === true) {
    adButton.disabled = false;
    adButton.textContent = "WATCH SPONSORED VIDEO";
    adButton.addEventListener("click", async () => {
      adButton.disabled = true;
      adStatus.textContent = "Opening approved sponsor video…";
      try {
        const result = await ads.show({ placement: "mining_restart" });
        if (!result || result.completed !== true || !result.verificationToken) {
          adStatus.textContent = "Ad completion was not verified. No restart was granted.";
          return;
        }
        const { error } = await db.rpc("restart_mining_after_verified_ad", {
          p_provider_token: result.verificationToken
        });
        if (error) {
          adStatus.textContent = "The server did not validate the sponsor completion. No restart was granted.";
          return;
        }
        adStatus.textContent = "Sponsor completion verified by the server. Your restart request was recorded.";
        await refresh();
      } catch (_) {
        adStatus.textContent = "Sponsor video unavailable. No restart or reward was granted.";
      } finally { adButton.disabled = false; }
    });
  } else if (adStatus) {
    adStatus.textContent = "Not live: connect an approved rewarded-ad provider and server-side verification before enabling this feature.";
  }

  db.auth.onAuthStateChange(() => refresh());
  refresh();
})();