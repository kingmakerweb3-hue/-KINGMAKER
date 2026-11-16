-- Increase entropy of newly generated referral codes.
-- Existing member codes remain valid; new codes use 80 random bits.
-- The UI accepts up to 24 characters, so the 20-character code fits.
alter table public.kingmaker_profiles
  alter column referral_code
  set default upper(substr(encode(gen_random_bytes(16), 'hex'), 1, 20));
