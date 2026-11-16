/* Public browser configuration for KINGMAKER Mining.
 * Fill these two values from Supabase Project Settings > API.
 * The anon/publishable key is intended for browser use; NEVER place a service_role/secret key here.
 * Mining stays disabled in the database until an operator explicitly enables it.
 */
window.KM_CONFIG = Object.freeze({
  supabaseUrl: "",
  supabaseAnonKey: "",
  rewardedAdRestartEnabled: false
});
