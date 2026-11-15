(() => {
  const walletButton = document.getElementById('connect-wallet');
  const walletStatus = document.getElementById('wallet-status');
  const dailyButton = document.getElementById('daily-preview');
  const dailyState = document.getElementById('daily-state');
  const installButton = document.getElementById('install-app');
  const installNote = document.getElementById('install-note');
  let installPrompt = null;

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