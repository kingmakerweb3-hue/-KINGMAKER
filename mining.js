(() => {
  const button = document.getElementById('connect-wallet');
  const status = document.getElementById('wallet-status');
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./mining-sw.js').catch(() => {}));
  }
  if (!button || !status) return;
  button.addEventListener('click', async () => {
    if (!window.ethereum || typeof window.ethereum.request !== 'function') {
      status.textContent = 'No compatible browser wallet detected. You can continue browsing without connecting.';
      return;
    }
    button.disabled = true;
    status.textContent = 'Waiting for wallet approval…';
    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      const address = Array.isArray(accounts) && accounts.length ? accounts[0] : '';
      if (!address) throw new Error('No account was returned.');
      const short = address.slice(0, 6) + '…' + address.slice(-4);
      status.textContent = 'Wallet connected for this browser session: ' + short + '. No signature or transaction was requested.';
      button.textContent = 'WALLET CONNECTED';
    } catch (error) {
      status.textContent = error && error.code === 4001 ? 'Wallet connection was cancelled.' : 'Wallet connection could not be completed.';
      button.disabled = false;
    }
  });
})();