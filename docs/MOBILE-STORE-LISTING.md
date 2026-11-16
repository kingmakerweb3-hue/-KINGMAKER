# KINGMAKER Mining — Store Listing Preparation

Status: DRAFT — NOT READY FOR STORE SUBMISSION

This document describes the current native wrapper around the KINGMAKER Mining web portal. The production account service is not configured, mining is pre-launch, and no live CROWN rewards are available. Do not publish a listing that implies users can currently earn money, withdraw crypto, or mine a live token.

## App identity

- App name: KINGMAKER Mining
- Android application ID: com.kingmaker.crownmining
- iOS bundle identifier: com.kingmaker.crownmining
- Primary category: Utilities (confirm category with each store before submission)
- Short description: Access the KINGMAKER CROWN participation portal and six-hour session dashboard.
- Subtitle (iOS draft): CROWN participation portal
- Promotional text: Follow KINGMAKER's CROWN participation service as it prepares for launch.

## Store description — draft

KINGMAKER Mining is the mobile companion to the KINGMAKER CROWN participation portal.

Explore the project, review the published participation rules and access your member dashboard when account services become available.

The planned CROWN participation model uses six-hour sessions. Session availability, eligibility and any credited points are determined by the production service and its published rules.

Important launch status:
- The account and mining backend is not yet configured.
- Live mining sessions and CROWN credits are currently unavailable.
- CROWN is a platform participation point in the current pilot design. It has no cash value and is not currently redeemable or transferable.
- No earnings, investment return, token distribution or withdrawal is promised.
- Any future KGM asset or token is separate and is not enabled by this app.
- An internet connection is required for online services.

KINGMAKER Mining is a participation and project-information app. It does not perform cryptocurrency mining on the device.

## Keywords (iOS draft)

KINGMAKER, CROWN, participation, session, community, Web3, dashboard, civilization

## Screenshot plan

Capture real screenshots from the release candidate on supported device simulators. Do not use mock balances, fake reward claims or fabricated account activity.

1. Welcome / KINGMAKER Mining identity.
2. Six-hour participation rules and pre-launch status.
3. Member sign-in screen.
4. Session dashboard showing the honest unavailable/pre-launch state.
5. CROWN ledger explaining that no balance is shown until server records exist.
6. Community and project information.

Required device sizes and final screenshot counts must be checked against current Apple App Store and Google Play Console requirements at submission time.

## Icon and visual assets

The repository currently has an SVG source icon at `assets/kingmaker-app-icon.svg`. Native Android/iOS icon generation and final screenshot capture still need validation. Do not treat the SVG PWA icon alone as a completed native store asset set.

## Privacy and compliance items still required

Before submission, complete and verify:
- Public privacy policy URL and in-app privacy access.
- Accurate Apple App Privacy and Google Play Data safety declarations based on actual production data flows.
- Account deletion path and support contact, if accounts can be created.
- Data retention, analytics, advertising and third-party SDK disclosures.
- Authentication, Supabase row-level security, abuse prevention and session/claim server-side enforcement.
- Any required terms, eligibility, geographic restrictions and legal review for digital assets/rewards.
- Review of store policies for crypto-related functionality. The app must not describe itself as device cryptocurrency mining.
- Final production backend activation and end-to-end tests before enabling any session or reward control.

## Build status

The GitHub Actions workflow builds:
- Android debug APK (for internal device testing; not a Play Store release).
- iOS simulator app archive (for simulator testing; not an App Store signed archive).

Store release still requires a signed Android App Bundle (AAB), a signed iOS archive, publisher-owned developer accounts, final assets, privacy declarations and store review approval.
