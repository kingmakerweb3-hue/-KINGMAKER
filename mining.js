(() => {
  const walletButton = document.getElementById('connect-wallet');
  const walletStatus = document.getElementById('wallet-status');
  const dailyButton = document.getElementById('daily-preview');
  const dailyState = document.getElementById('daily-state');
  const installButton = document.getElementById('install-app');
  const installNote = document.getElementById('install-note');
  let installPrompt = null;

  const communityConfig = window.KM_CONFIG && window.KM_CONFIG.community || {};
  const setCommunityLink = (id, value) => {
    const el = document.getElementById(id);
    if (!el || typeof value !== 'string' || !/^https:\/\//i.test(value)) return false;
    try {
      const url = new URL(value);
      if (!['youtube.com','www.youtube.com','youtu.be','x.com','www.x.com','twitter.com','www.twitter.com'].includes(url.hostname)) return false;
      el.href = url.href;
      el.hidden = false;
      return true;
    } catch (_) { return false; }
  };
  const videoReady = setCommunityLink('community-watch', communityConfig.latestVideoUrl);
  const channelReady = setCommunityLink('community-channel', communityConfig.youtubeChannelUrl);
  const xReady = setCommunityLink('community-x', communityConfig.xProfileUrl);
  if (communityConfig.latestVideoTitle) {
    const title = document.getElementById('community-video-title');
    if (title) title.textContent = String(communityConfig.latestVideoTitle).slice(0, 90);
  }
  if (videoReady) {
    try {
      const videoUrl = new URL(communityConfig.latestVideoUrl);
      let videoId = '';
      if (videoUrl.hostname === 'youtu.be') videoId = videoUrl.pathname.split('/').filter(Boolean)[0] || '';
      else if (videoUrl.hostname.endsWith('youtube.com')) {
        videoId = videoUrl.searchParams.get('v') || (videoUrl.pathname.startsWith('/embed/') ? videoUrl.pathname.split('/')[2] : '');
      }
      if (/^[A-Za-z0-9_-]{11}$/.test(videoId)) {
        const frame = document.getElementById('community-video-frame');
        if (frame) {
          const iframe = document.createElement('iframe');
          iframe.src = 'https://www.youtube-nocookie.com/embed/' + videoId;
          iframe.title = 'KINGMAKER latest official community video';
          iframe.loading = 'lazy';
          iframe.referrerPolicy = 'strict-origin-when-cross-origin';
          iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
          iframe.allowFullscreen = true;
          iframe.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:0';
          frame.replaceChildren(iframe);
          frame.style.minHeight = '280px';
        }
      }
    } catch (_) {}
  }
  const communityStatus = document.getElementById('community-link-status');
  if (communityStatus) {
    communityStatus.textContent = videoReady || channelReady || xReady
      ? 'OFFICIAL COMMUNITY LINKS CONNECTED · SOCIAL VISITS ARE OPTIONAL'
      : 'OFFICIAL CHANNEL LINKS WILL APPEAR HERE WHEN CONFIGURED.';
  }


  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./mining-sw.js').catch(() => {}));
  }

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    installPrompt = event;
    if (installButton) installButton.hidden = false;
  });

  if (installButton) {
    installButton.addEventListener('click', async () => {
      if (!installPrompt) {
        if (installNote) installNote.textContent = 'On iPhone or iPad: open the Share menu in Safari and choose Add to Home Screen. On desktop, use the install icon in your browser address bar when available.';
        return;
      }
      installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (installNote) installNote.textContent = choice && choice.outcome === 'accepted' ? 'KINGMAKER installation accepted by your browser.' : 'Installation was not completed. You can install later from your browser menu.';
      installPrompt = null;
      installButton.hidden = true;
    });
  }

  if (dailyButton && dailyState) {
    dailyButton.addEventListener('click', () => {
      dailyState.textContent = 'DEMO CHECK-IN COMPLETE · NO ACCOUNT RECORD · NO CROWN REWARD';
      dailyButton.textContent = 'PREVIEW COMPLETED';
      dailyButton.disabled = true;
      dailyButton.setAttribute('aria-label', 'Preview check-in completed. No reward was issued.');
    });
  }

  // Secure account-to-wallet linking is handled by mining-foundation.js after authentication.
})();