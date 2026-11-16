# KINGMAKER Mining App Store and Google Play release plan

**Scope confirmed: distribute the existing CROWN Mining app only. The nation-building game is not part of this mobile store app.**

**Status: preparation only — no store submission has been made.**

The existing KINGMAKER website remains the project hub. The mobile package is the CROWN Mining portal at `mining.html`, with its mining dashboard, account/session experience and wallet connection interface. A Capacitor native packaging foundation is being prepared for iOS and Android.

## App identity
- Display name: KINGMAKER Mining
- Application identifier: `com.kingmaker.crownmining`
- Android package: same identifier, subject to final publisher confirmation
- iOS bundle identifier: same identifier, subject to final publisher confirmation

## Product and backend gates
- [ ] Verify the mining app's production Supabase project, authentication, row-level security, migrations and session lifecycle.
- [ ] Verify the six-hour mining session and claim/expiry behavior end-to-end on a production-like backend.
- [ ] Confirm what CROWN represents and accurately disclose that it is not cash, not redeemable and not a promise of earnings unless future legal/product approvals change that.
- [ ] Complete wallet connection testing. Never request or store seed phrases/private keys; disclose what wallet connection does and does not do.
- [ ] Test offline, network loss, expired login, account deletion/support and error states.
- [ ] Add accurate in-app support, publisher contact, privacy notice and terms based on actual data handling.
- [ ] Test the app on real iPhones, iPads and Android devices, including accessibility and performance.

## Android release
- [ ] Generate and test the Android native project.
- [ ] Produce a signed Android App Bundle (AAB) using publisher-controlled signing credentials.
- [ ] Prepare app icon, phone/tablet screenshots, feature graphic, description, support and privacy URLs.
- [ ] Complete Google Play App content, Data safety, content rating and required testing track.
- [ ] Submit to Google Play review after all advertised mining features and backend safeguards are verified.

## iOS release
- [ ] Generate and test the iOS native project on supported devices.
- [ ] Produce a signed iOS archive using the publisher's Apple Developer account.
- [ ] Prepare App Store icon, screenshots, description, support and privacy URLs.
- [ ] Complete App Privacy details, age rating, export compliance and review notes.
- [ ] Submit to Apple review after the app provides a reliable, complete mining-app experience and all disclosures are accurate.

## Publisher access required

The publisher must own and control:
- Apple Developer Program membership and App Store Connect access.
- Google Play Console developer account.
- Legal publisher name, support contact, privacy-policy URL and any requested business/tax details.
- Signing credentials and final approval of store disclosures and submissions.

Never put account passwords, signing keys, private keys, seed phrases, Supabase service-role keys or payment credentials in this repository or chat. Use official consoles and secure secret storage.

## Current truth
- KINGMAKER website and mining portal: published as a browser experience.
- Native app packaging: build foundation committed; automated test builds pending.
- Apple App Store: not published.
- Google Play: not published.
- Signed release packages: not yet produced.
- Store approval: decided by Apple and Google; not guaranteed.

Official review references:
- Apple App Review Guidelines: https://developer.apple.com/app-store/review/guidelines/
- Google Play Developer Program Policy: https://support.google.com/googleplay/android-developer/answer/18265346
