(() => {
  const walletButton = document.getElementById('connect-wallet');
  const walletStatus = document.getElementById('wallet-status');
  const dailyButton = document.getElementById('daily-preview');
  const dailyState = document.getElementById('daily-state');
  const installButton = document.getElementById('install-app');
  const installNote = document.getElementById('install-note');
  let installPrompt = null;\n\n  const communityConfig = window.KM_CONFIG && window.KM_CONFIG.community || {};
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

  if (!walletButton || !walletStatus) return;
  walletButton.addEventListener('click', async () => {
    if (!window.ethereum || typeof window.ethereum.request !== 'function') {
      walletStatus.textContent = 'No compatible browser wallet detected. You can continue browsing without connecting.';
      return;
    }
    walletButton.disabled = true;
    walletStatus.textContent = 'Waiting for wallet approval…';
    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      const address = Array.isArray(accounts) && accounts.length ? accounts[0] : '';
      if (!address) throw new Error('No account was returned.');
      walletStatus.textContent = 'Wallet connected for this browser session: ' + address.slice(0, 6) + '…' + address.slice(-4) + '. No signature or transaction was requested.';
      walletButton.textContent = 'WALLET CONNECTED';
    } catch (error) {
      walletStatus.textContent = error && error.code === 4001 ? 'Wallet connection was cancelled.' : 'Wallet connection could not be completed.';
      walletButton.disabled = false;
    }
  });
})();