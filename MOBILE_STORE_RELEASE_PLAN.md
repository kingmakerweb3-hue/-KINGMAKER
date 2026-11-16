# KINGMAKER App Store and Google Play release plan

**Status: preparation only — no store submission has been made.**

KINGMAKER currently runs as a browser game/PWA hosted on GitHub Pages. The installable web app is not yet an Apple App Store or Google Play listing, and no signed iOS or Android release package is present in this repository.

## Release approach

Build one KINGMAKER mobile game app for iOS and Android, with platform-specific builds and a shared game codebase. Do not submit a thin WebView that merely wraps the marketing website. The mobile app must provide a complete, stable game experience and meaningful app-specific value.

### Product work before submission
- [ ] Create a dedicated mobile game entry point, separate from the network/marketing portal.
- [ ] Adapt the nation-building game UI for phones and tablets, including touch controls, safe areas, readable text and responsive layouts.
- [ ] Verify save/load, offline behavior where supported, audio, performance, battery use and crash recovery on real devices.
- [ ] Add an in-app help/support route and accurate publisher contact details.
- [ ] Finalize privacy notice, terms, intended age rating, data disclosures and any required consent flows based on actual app behavior.
- [ ] Review all art, music, fonts, trademarks and third-party SDK licenses.
- [ ] Keep CROWN described accurately as an in-game/off-chain gameplay point unless a separately reviewed token system is actually implemented. Do not advertise earnings, cash value or withdrawals.
- [ ] Complete manual playthroughs and mobile accessibility/security testing.

### Android release
- [ ] Configure the Android application ID, app signing, versioning and release build.
- [ ] Build and test an Android App Bundle (AAB) on supported physical devices.
- [ ] Prepare store icon, phone/tablet screenshots, feature graphic, description, support URL and privacy policy URL.
- [ ] Complete Google Play App content, Data safety, content rating and testing-track requirements.
- [ ] Submit to Google Play review only after the production backend and all advertised features are ready.

### iOS release
- [ ] Configure the iOS bundle identifier, signing, capabilities and release build.
- [ ] Build and test the iOS app on supported iPhones and iPads.
- [ ] Prepare App Store icon, screenshots, description, support URL and privacy policy URL.
- [ ] Complete App Privacy details, age rating, export-compliance and review information in App Store Connect.
- [ ] Submit to Apple review only after the app has meaningful native/mobile value beyond a repackaged website and all advertised features work.

## Publisher access required

The publisher must own and control:
- An Apple Developer Program membership and App Store Connect access.
- A Google Play Console developer account.
- The legal publisher name, support contact, privacy-policy URL and any business/tax details requested by the stores.
- Signing credentials and final approval of store disclosures and submissions.

Never place account passwords, signing keys, private keys, seed phrases, service-role keys or payment credentials in this repository or in chat. Use the official store consoles and secure secret storage.

## Current truth

- Browser/PWA: available through the KINGMAKER website.
- Apple App Store: not published.
- Google Play: not published.
- Native iOS/Android release packages: not built yet.
- Store approval: cannot be guaranteed; Apple and Google make the final review decisions.

Official review references:
- Apple App Review Guidelines: https://developer.apple.com/app-store/review/guidelines/
- Google Play Developer Program Policy: https://support.google.com/googleplay/android-developer/answer/18265346
