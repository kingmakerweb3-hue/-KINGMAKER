/* Public browser configuration for KINGMAKER Mining.
 * Fill Supabase values from Project Settings > API. Only use the public anon/publishable key.
 * Never place service_role, secret keys, access tokens or database passwords in browser code.
 * Mining stays disabled in the database until an operator explicitly enables it.
 * Community URLs below are public links only; no credentials belong here.
 */
window.KM_CONFIG = Object.freeze({
  supabaseUrl: "https://narpyrvmftxnjvorxxgm.supabase.co",
  supabaseAnonKey: "",
  rewardedAdRestartEnabled: false,
  community: Object.freeze({
    youtubeChannelUrl: "",
    latestVideoUrl: "",
    latestVideoTitle: "",
    xProfileUrl: ""
  })
});
