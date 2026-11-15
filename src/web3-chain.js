/**
 * KINGMAKER live ERC-1155 balance reader.
 *
 * Configure before this module loads:
 * window.KINGMAKER_WEB3_CONFIG = {
 *   chainId: "0xaa36a7", // Sepolia example
 *   contractAddress: "0x...",
 *   assets: [{ id: "founder-banner", tokenId: "1", name: "Founder Banner" }]
 * };
 *
 * No address is bundled: an audited, deployed contract and verified network
 * configuration are prerequisites. This module is read-only; it never signs
 * or sends transactions.
 */
(() => {
  "use strict";
  const CONFIG = window.KINGMAKER_WEB3_CONFIG || {};
  const address = typeof CONFIG.contractAddress === "string" ? CONFIG.contractAddress : "";
  const assets = Array.isArray(CONFIG.assets) ? CONFIG.assets : [];
  const validAddress = /^0x[0-9a-fA-F]{40}$/.test(address);
  const validChain = typeof CONFIG.chainId === "string" && /^0x[0-9a-fA-F]+$/.test(CONFIG.chainId);
  const pad = value => value.replace(/^0x/, "").toLowerCase().padStart(64, "0");
  const encodeBalanceOf = (owner, id) => "0x00fdd58e" + pad(owner) + BigInt(id).toString(16).padStart(64, "0");
  const decodeUint = value => BigInt(value || "0x0").toString();

  function attach(panel) {
    if (panel.dataset.chainReaderAttached === "true") return;
    panel.dataset.chainReaderAttached = "true";
    const facts = panel.querySelector(".web3-facts");
    const inventory = panel.querySelector("#web3-inventory");
    const notice = panel.querySelector(".notice");
    if (!facts || !inventory) return;

    const state = document.createElement("div");
    state.className = "notice";
    state.id = "web3-chain-state";
    state.textContent = validAddress && validChain
      ? "On-chain inventory reader configured. Connect your wallet to load verified contract balances."
      : "Live on-chain balances are not configured: deploy and verify the contract, then provide its address, network and asset IDs.";
    facts.parentElement.append(state);

    async function refresh() {
      const account = panel.querySelector("#web3-account");
      const visible = account && !account.hidden;
      if (!visible) return;
      if (!validAddress || !validChain || !window.ethereum?.request) return;
      try {
        const currentChain = await window.ethereum.request({ method: "eth_chainId" });
        if (currentChain.toLowerCase() !== CONFIG.chainId.toLowerCase()) {
          state.textContent = "Switch your wallet to the configured KINGMAKER network to view on-chain balances.";
          return;
        }
        const wallet = window.ethereum.selectedAddress;
        if (!wallet || !/^0x[0-9a-fA-F]{40}$/.test(wallet)) return;
        const balances = await Promise.all(assets.map(async asset => {
          try {
            const raw = await window.ethereum.request({
              method: "eth_call",
              params: [{ to: address, data: encodeBalanceOf(wallet, asset.tokenId) }, "latest"]
            });
            return { name: String(asset.name || asset.id), balance: decodeUint(raw) };
          } catch {
            return { name: String(asset.name || asset.id), balance: "unavailable" };
          }
        }));
        const rows = balances.length
          ? balances.map(item => '<div class="web3-item"><div><b>' + escapeHtml(item.name) + '</b><small>Verified ERC-1155 contract balance</small></div><span>' + escapeHtml(item.balance) + '</span></div>').join("")
          : '<div class="empty">No asset IDs configured for this contract.</div>';
        inventory.innerHTML = '<div class="eyebrow">ON-CHAIN OWNERSHIP · READ ONLY</div>' + rows;
        state.textContent = "Balances read directly from the configured ERC-1155 contract.";
      } catch (error) {
        state.textContent = "Could not read contract balances: " + (error?.message || "wallet RPC error");
      }
    }
    function escapeHtml(value) {
      return value.replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
    }
    panel.querySelector("#web3-connect")?.addEventListener("click", () => setTimeout(refresh, 250));
    window.ethereum?.on?.("accountsChanged", () => setTimeout(refresh, 50));
    window.ethereum?.on?.("chainChanged", () => setTimeout(refresh, 50));
    const observer = new MutationObserver(refresh);
    observer.observe(panel.querySelector("#web3-account"), { attributes: true, attributeFilter: ["hidden"] });
    void notice;
  }

  const observer = new MutationObserver(() => {
    const panel = document.getElementById("panel-web3");
    if (panel) attach(panel);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  const existing = document.getElementById("panel-web3");
  if (existing) attach(existing);
})();
