/* Public browser configuration for KINGMAKER Mining.
 * Fill Supabase values from Project Settings > API. Only use the public anon/publishable key.
 * Never place service_role, secret keys, access tokens or database passwords in browser code.
 * Mining stays disabled in the database until an operator explicitly enables it.
 * Community URLs below are public links only; no credentials belong here.
 */
window.KM_CONFIG = Object.freeze({
  supabaseUrl: "https://narpyrvmftxnjvorxxgm.supabase.co",
  supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5hcnB5cnZtZnR4bmp2b3J4eGdtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ4MDQxNzIsImV4cCI6MjExMDM4MDE3Mn0.nl9siNjKWv50qcsJr2hSJi19AukxuR1MRSYbV-GyuIM",
  rewardedAdRestartEnabled: false,
  community: Object.freeze({
    youtubeChannelUrl: "",
    latestVideoUrl: "",
    latestVideoTitle: "",
    xProfileUrl: ""
  })
});
