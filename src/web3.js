const STORAGE_KEY = "kingmaker.web3.inventory.v1";
const ASSET_CATALOG = [
  { id: "founder-banner", name: "Founder Banner", category: "Identity", rarity: "Rare", description: "A ceremonial banner for your nation's founding." },
  { id: "frontier-surveyor", name: "Frontier Surveyor", category: "Land", rarity: "Uncommon", description: "A survey permit concept for future frontier expansion." },
  { id: "royal-blueprint", name: "Royal Blueprint", category: "Blueprint", rarity: "Epic", description: "An architectural blueprint concept for your capital." }
];

const shortAddress = (value) => value ? `${value.slice(0, 6)}…`${value.slice(-4)}` : "";
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, char => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[char]));
const readInventory = (account) => {
  try {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return Array.isArray(all[account.toLowerCase()]) ? all[account.toLowerCase()] : [];
  } catch { return []; }
};
const saveInventory = (account, items) => {
  const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  all[account.toLowerCase()] = items;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
};

function mountWeb3Panel() {
  const nav = document.querySelector(".tabs");
  const main = document.querySelector("#main");
  if (!nav || !main || document.getElementById("tab-web3")) return;
  const tab = document.createElement("button");
  tab.id = "tab-web3";
  tab.type = "button";
  tab.setAttribute("role", "tab");
  tab.setAttribute("aria-controls", "panel-web3");
  tab.setAttribute("aria-selected", "false");
  tab.dataset.tab = "web3";
  tab.textContent = "Web3 & Assets";
  nav.append(tab);

  const panel = document.createElement("section");
  panel.id = "panel-web3";
  panel.className = "tab-panel grid";
  panel.setAttribute("role", "tabpanel");
  panel.setAttribute("aria-labelledby", "tab-web3");
  panel.tabIndex = 0;
  panel.hidden = true;
  panel.innerHTML = `
    <article class="panel span-12 web3-hero">
      <div><p class="eyebrow">PLAYER IDENTITY · DIGITAL OWNERSHIP</p><h2>Enter the KINGMAKER asset economy</h2>
      <p class="muted">Connect a wallet to link your player identity. Your wallet stays under your control; KINGMAKER never asks for your recovery phrase or private key.</p></div>
      <div class="web3-connect"><span id="web3-status" class="web3-status" role="status">Wallet not connected</span><button id="web3-connect" class="primary">Connect wallet</button><button id="web3-disconnect" hidden>Disconnect</button></div>
      <div id="web3-account" class="web3-account" hidden></div>
    </article>
    <article class="panel span-5"><p class="eyebrow">PLAYER INVENTORY</p><h2>Your digital collection</h2><div id="web3-inventory" class="web3-inventory"><div class="empty">Connect a wallet to view your collection.</div></div>
      <p class="notice">Prototype status: inventory entries are stored locally in this browser. They are not NFTs, on-chain tokens, or independently verifiable ownership.</p>
    </article>
    <article class="panel span-7"><p class="eyebrow">ASSET CATALOG · DEVELOPMENT</p><h2>World assets</h2><p class="muted">Explore the first asset categories planned for the player-owned economy.</p><div id="web3-catalog" class="web3-catalog"></div></article>
    <article class="panel span-12"><p class="eyebrow">NETWORK & SECURITY</p><h2>Connection details</h2><div class="web3-facts"><div><small>Wallet standard</small><b>EIP-1193 browser provider</b></div><div><small>Connected network</small><b id="web3-chain">Not connected</b></div><div><small>On-chain contracts</small><b>Not deployed</b></div><div><small>Marketplace</small><b>Not enabled</b></div></div>
      <p class="notice">No blockchain transactions are sent by this prototype. Contract deployment, audited minting, transfers, marketplace settlement, and server-side ownership verification are future integration work.</p>
    </article>`;
  main.append(panel);

  const connectButton = panel.querySelector("#web3-connect");
  const disconnectButton = panel.querySelector("#web3-disconnect");
  const status = panel.querySelector("#web3-status");
  const accountBox = panel.querySelector("#web3-account");
  const inventoryBox = panel.querySelector("#web3-inventory");
  const chainBox = panel.querySelector("#web3-chain");
  let account = null;

  const showInventory = () => {
    if (!account) {
      inventoryBox.innerHTML = '<div class="empty">Connect a wallet to view your collection.</div>';
      return;
    }
    const owned = readInventory(account);
    inventoryBox.innerHTML = owned.length ? owned.map(item => `<div class="web3-item"><div><b>${escapeHtml(item.name)}</b><small>${escapeHtml(item.category)} · Prototype record</small></div><span>${escapeHtml(item.rarity)}</span></div>`).join("") : '<div class="empty">Your collection is empty. Choose a catalog asset to add a local prototype record.</div>';
  };

  const renderConnection = async () => {
    if (!window.ethereum || !account) return;
    const chain = await window.ethereum.request({ method: "eth_chainId" }).catch(() => null);
    chainBox.textContent = chain ? `Chain ID ${Number.parseInt(chain, 16)}` : "Network unavailable";
  };

  const setAccount = async (next) => {
    account = next || null;
    const connected = Boolean(account);
    status.textContent = connected ? "Wallet connected" : "Wallet not connected";
    status.classList.toggle("is-connected", connected);
    connectButton.hidden = connected;
    disconnectButton.hidden = !connected;
    accountBox.hidden = !connected;
    accountBox.textContent = connected ? `Player wallet: ${shortAddress(account)}` : "";
    if (!connected) chainBox.textContent = "Not connected";
    showInventory();
    if (connected) await renderConnection();
    renderCatalog();
  };

  const renderCatalog = () => {
    panel.querySelector("#web3-catalog").innerHTML = ASSET_CATALOG.map(item => `
      <div class="web3-catalog-card"><div class="web3-catalog-top"><span>${item.category}</span><b>${item.rarity}</b></div><h3>${item.name}</h3><p>${item.description}</p><button type="button" data-asset="${item.id}" ${account ? "" : "disabled"}>Add prototype record</button></div>`).join("");
  };

  connectButton.addEventListener("click", async () => {
    if (!window.ethereum || typeof window.ethereum.request !== "function") {
      status.textContent = "No compatible wallet found. Install a browser wallet such as MetaMask.";
      return;
    }
    connectButton.disabled = true;
    status.textContent = "Waiting for wallet approval…";
    try {
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      await setAccount(accounts?.[0]);
      renderCatalog();
    } catch (error) {
      status.textContent = error?.code === 4001 ? "Connection request rejected in wallet." : `Could not connect: ${error?.message || "Unknown wallet error"}`;
    } finally { connectButton.disabled = false; }
  });

  disconnectButton.addEventListener("click", () => setAccount(null));
  panel.querySelector("#web3-catalog").addEventListener("click", event => {
    const button = event.target.closest("[data-asset]");
    if (!button || !account) return;
    const asset = ASSET_CATALOG.find(item => item.id === button.dataset.asset);
    if (!asset) return;
    const owned = readInventory(account);
    if (owned.some(item => item.id === asset.id)) {
      status.textContent = "This prototype record is already in your inventory.";
      return;
    }
    owned.push({ id: asset.id, name: asset.name, category: asset.category, rarity: asset.rarity, addedAt: new Date().toISOString() });
    saveInventory(account, owned);
    showInventory();
    status.textContent = "Prototype record added locally — no blockchain transaction occurred.";
  });

  tab.addEventListener("click", () => {
    document.querySelectorAll(".tabs [role='tab']").forEach(button => {
      const active = button === tab;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", String(active));
    });
    document.querySelectorAll(".tab-panel").forEach(section => { section.hidden = section !== panel; });
  });

  renderCatalog();
  if (window.ethereum?.on) {
    window.ethereum.on("accountsChanged", accounts => setAccount(accounts?.[0]));
    window.ethereum.on("chainChanged", () => renderConnection());
  }
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mountWeb3Panel, { once: true });
else mountWeb3Panel();
