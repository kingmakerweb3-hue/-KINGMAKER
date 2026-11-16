# KINGMAKER native mobile app build

KINGMAKER now has a Capacitor-based native iOS/Android project foundation. The browser game remains the shared game engine; Capacitor supplies native application packaging and platform integration. This is not yet a store-ready binary.

## Build the shared mobile bundle

Requirements: Node.js 22 or newer, npm.

```sh
npm install
npm run build:mobile
```

## Generate native projects

```sh
npm run cap:add:android
npm run cap:add:ios
npm run cap:sync
```

Android builds require Android Studio and a supported Android SDK/JDK. iOS builds require macOS, Xcode and Apple signing configuration. iOS cannot be compiled or signed on a Windows/Linux-only runner.

## App identifiers

- Display name: KINGMAKER
- Android/iOS bundle identifier: `com.kingmaker.world`
- Web bundle output: `www/`

Confirm legal ownership and identifier availability before a public store submission. Changing an app identifier after release can be disruptive.

## Remaining native release work

- [ ] Generate and commit Android and iOS platform projects from the pinned Capacitor dependencies.
- [ ] Create native launcher icons and splash assets in required platform sizes.
- [ ] Implement and test native haptics, status bar, app lifecycle and Android back navigation using supported Capacitor plugin APIs.
- [ ] Test real devices, performance, offline behavior, touch accessibility and save recovery.
- [ ] Confirm Three.js and all remote assets load reliably; decide whether to bundle dependencies for offline play.
- [ ] Complete security, privacy, age-rating, support and store disclosure reviews.
- [ ] Produce signed Android App Bundle and iOS archive; test internal/beta releases.
- [ ] Submit through publisher-controlled Google Play Console and App Store Connect accounts.

Do not commit signing certificates, keystores, passwords, provisioning profiles, private keys or store credentials. Store them in secure CI secrets or the platform signing systems.

## Store status

No Android App Bundle, iOS archive, signed release, store listing or store approval is produced by this scaffold alone. The publisher must complete signing and review steps. Store approval is decided by Google and Apple.
