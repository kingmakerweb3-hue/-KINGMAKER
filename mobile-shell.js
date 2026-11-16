(function () {
  "use strict";
  const cap = window.Capacitor;
  const native = Boolean(cap && typeof cap.isNativePlatform === "function" && cap.isNativePlatform());
  document.documentElement.classList.toggle("km-native", native);
  document.documentElement.classList.toggle("km-web", !native);
  if (!native) return;

  document.documentElement.dataset.nativePlatform =
    typeof cap.getPlatform === "function" ? cap.getPlatform() : "native";

  // Keep the mining app immersive and prevent accidental browser-style zoom gestures.
  document.addEventListener("gesturestart", event => event.preventDefault(), { passive: false });
  let lastTouchEnd = 0;
  document.addEventListener("touchend", event => {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) event.preventDefault();
    lastTouchEnd = now;
  }, { passive: false });

  // Use the native status bar API when the platform bridge exposes it.
  const statusBar = cap.Plugins && cap.Plugins.StatusBar;
  if (statusBar && typeof statusBar.setBackgroundColor === "function") {
    statusBar.setBackgroundColor({ color: "#0b1220" }).catch(() => {});
  }
})();
