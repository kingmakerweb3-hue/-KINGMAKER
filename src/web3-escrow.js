import { BrowserProvider, Contract, formatEther, parseEther } from "https://cdn.jsdelivr.net/npm/ethers@6.13.4/+esm";

(() => {
  "use strict";
  const config = window.KINGMAKER_WEB3_CONFIG || {};
  const abi = [
    "function createListing(address assetContract,uint256 tokenId,uint256 amount,uint256 price) returns (uint256 listingId)",
    "function cancelListing(uint256 listingId)",
    "function purchase(uint256 listingId) payable",
    "function withdrawProceeds()",
    "function nextListingId() view returns (uint256)",
    "function listings(uint256) view returns (address seller,address assetContract,uint256 tokenId,uint256 amount,uint256 price,uint8 status)",
    "function pendingProceeds(address) view returns (uint256)",
    "event ListingCreated(uint256 indexed listingId,address indexed seller,address indexed assetContract,uint256 tokenId,uint256 amount,uint256 price)",
    "event ListingCancelled(uint256 indexed listingId)",
    "event AssetPurchased(uint256 indexed listingId,address indexed buyer,address indexed seller,uint256 price)",
    "event ProceedsWithdrawn(address indexed seller,uint256 amount)"
  ];
  const assetAbi = [
    "function setApprovalForAll(address operator,bool approved)",
    "function isApprovedForAll(address account,address operator) view returns (bool)"
  ];
  const validAddress = value => typeof value === "string" && /^0x[0-9a-fA-F]{40}$/.test(value);
  const esc = value => String(value).replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
  const statusNames = ["Missing", "Active", "Sold", "Cancelled"];

  function mount(panel) {
    if (panel.dataset.escrowMounted === "true") return;
    panel.dataset.escrowMounted = "true";
    const card = document.createElement("article");
    card.className = "panel span-12";
    card.id = "web3-escrow";
    card.innerHTML = '<p class="eyebrow">ON-CHAIN EXCHANGE · WALLET TRANSACTIONS</p><h2>Escrow marketplace</h2><p class="muted">Create listings by depositing ERC-1155 assets into escrow. Buyers pay the chain native currency. Seller proceeds are withdrawn separately. Every write requires wallet confirmation.</p><div id="escrow-config" class="notice"></div><div class="web3-market-heading"><div><b id="escrow-wallet">Wallet not connected</b><small id="escrow-proceeds">Connect wallet to check seller proceeds.</small></div><button type="button" id="escrow-refresh">Refresh</button></div><form id="escrow-create" class="web3-listing-form"><h3>Deposit an asset for sale</h3><label for="escrow-asset">Asset</label><select id="escrow-asset"></select><label for="escrow-amount">Quantity</label><input id="escrow-amount" type="number" min="1" step="1" value="1" required><label for="escrow-price">Price (native currency)</label><input id="escrow-price" type="number" min="0.000000000000000001" step="any" placeholder="0.01" required><button class="primary" type="submit" id="escrow-submit" disabled>Create escrow listing</button></form><div class="web3-market-heading"><h3>On-chain listings</h3><span class="tag">LIVE CONTRACT DATA</span></div><div id="escrow-list" class="web3-market-list"><div class="empty">Configure a verified deployment to load listings.</div></div><button type="button" id="escrow-older" hidden>Load older listings</button><div class="web3-market-heading"><h3>Transaction activity</h3><span class="tag">RECENT ON-CHAIN EVENTS</span></div><div id="escrow-activity" class="web3-market-list"><div class="empty">Connect to load recent activity.</div></div><div id="escrow-status" class="notice" role="status">Contract writes are disabled until deployment configuration and network checks pass.</div>';
    panel.append(card);
    const $ = selector => card.querySelector(selector);
    const assets = Array.isArray(config.assets) ? config.assets.filter(item => item && /^[0-9]+$/.test(String(item.tokenId))) : [];
    const ready = validAddress(config.marketplaceAddress) && validAddress(config.contractAddress) && typeof config.chainId === "string" && /^0x[0-9a-fA-F]+$/.test(config.chainId) && assets.length > 0;
    $(" #escrow-config".trim()).textContent = ready
      ? "Deployment configuration detected. Verify contract addresses and chain before signing transactions."
      : "Not configured. Set KINGMAKER_WEB3_CONFIG.marketplaceAddress, contractAddress, chainId and assets before enabling escrow. No addresses are bundled.";
    $(" #escrow-asset".trim()).innerHTML = assets.map(item => '<option value="'+esc(item.tokenId)+'">'+esc(item.name || item.id)+' · token '+esc(item.tokenId)+'</option>').join("") || '<option value="">No token IDs configured</option>';
    let provider, signer, account, market, token;
    let oldestLoadedId = 0n;
    const listingPageSize = 50;
    const status = message => { $(" #escrow-status".trim()).textContent = message; };
    const connected = async () => {
      if (!ready) throw new Error("Escrow contract configuration is incomplete.");
      if (!window.ethereum?.request) throw new Error("Open KINGMAKER in a browser with an EVM wallet.");
      provider = new BrowserProvider(window.ethereum);
      const network = await provider.getNetwork();
      if ("0x"+network.chainId.toString(16) !== config.chainId.toLowerCase()) throw new Error("Switch wallet to configured chain ID "+parseInt(config.chainId,16)+".");
      signer = await provider.getSigner();
      account = await signer.getAddress();
      market = new Contract(config.marketplaceAddress, abi, signer);
      token = new Contract(config.contractAddress, assetAbi, signer);
      $(" #escrow-wallet".trim()).textContent = account;
      return account;
    };
    async function loadListingPage(reset = false) {
      if (!market || oldestLoadedId < 1n) return;
      const rows = [];
      let checked = 0;
      while (oldestLoadedId >= 1n && checked < listingPageSize) {
        const id = oldestLoadedId--;
        checked++;
        const item = await market.listings(id);
        if (Number(item.status) !== 1) continue;
        const asset = assets.find(entry => String(entry.tokenId) === item.tokenId.toString());
        const own = item.seller.toLowerCase() === account.toLowerCase();
        rows.push('<div class="web3-listing"><div><b>'+esc(asset?.name || ("Token "+item.tokenId))+'</b><small>#'+id+' · '+esc(item.amount.toString())+' units · '+(own?'Your escrow': 'Seller '+esc(item.seller.slice(0,6)+'…'+item.seller.slice(-4)))+'</small></div><strong>'+esc(formatEther(item.price))+'<small>NATIVE</small></strong>'+(own?'<button data-cancel="'+id+'">Cancel & return</button>':'<button data-buy="'+id+'">Buy</button>')+'</div>');
      }
      const list = $(" #escrow-list".trim());
      if (rows.length) list.insertAdjacentHTML("beforeend", rows.join(""));
      else if (reset && oldestLoadedId < 1n) list.innerHTML = '<div class="empty">No active on-chain listings.</div>';
      $(" #escrow-older".trim()).hidden = oldestLoadedId < 1n;
    }
    $(" #escrow-older".trim()).addEventListener("click", async () => {
      try { await connected(); await loadListingPage(); }
      catch (error) { status(error.shortMessage || error.message || "Could not load older listings."); }
    });
    async function loadActivity() {
      const feed = $(" #escrow-activity".trim());
      try {
        const response = await fetch("/api/market/activity?limit=20", { credentials: "same-origin", cache: "no-store" });
        if (response.ok) {
          const indexed = await response.json();
          if (indexed.configured) {
            if (!indexed.events.length) {
              feed.innerHTML = '<div class="empty">The persistent index is ready; no confirmed marketplace events have been indexed yet.</div>';
              return;
            }
            feed.innerHTML = indexed.events.map(item => {
              const a = item.args || {};
              let detail = "";
              if (item.name === "ListingCreated") detail = "Listing #"+a.listingId+" created · "+a.amount+" units · "+formatEther(BigInt(a.price))+" native";
              if (item.name === "ListingCancelled") detail = "Listing #"+a.listingId+" cancelled";
              if (item.name === "AssetPurchased") detail = "Listing #"+a.listingId+" purchased · "+formatEther(BigInt(a.price))+" native";
              if (item.name === "ProceedsWithdrawn") detail = "Seller withdrew "+formatEther(BigInt(a.amount))+" native";
              const txUrl = config.explorerUrl ? config.explorerUrl.replace(/\/$/, "")+"/tx/"+item.transactionHash : "";
              return '<div class="web3-listing"><div><b>'+esc(item.name.replace(/([A-Z])/g, " $1").trim())+'</b><small>'+esc(detail)+' · block '+item.blockNumber+'</small></div><a href="'+esc(txUrl || "#")+'" '+(txUrl?'target="_blank" rel="noopener noreferrer"':'hidden')+'>View tx</a></div>';
            }).join("");
            return;
          }
        }
        // Local browser query remains a fallback for an unconfigured server-side indexer.
        const latest = await provider.getBlockNumber();
        const fromBlock = Math.max(0, latest - 4999);
        const eventSpecs = [
          ["ListingCreated", market.filters.ListingCreated()],
          ["ListingCancelled", market.filters.ListingCancelled()],
          ["AssetPurchased", market.filters.AssetPurchased()],
          ["ProceedsWithdrawn", market.filters.ProceedsWithdrawn()]
        ];
        const batches = await Promise.all(eventSpecs.map(async ([name, filter]) =>
          (await market.queryFilter(filter, fromBlock, latest)).map(event => ({ name, event }))
        ));
        const events = batches.flat().sort((a, b) => b.event.blockNumber - a.event.blockNumber || b.event.index - a.event.index).slice(0, 20);
        if (!events.length) {
          feed.innerHTML = '<div class="empty">No marketplace activity in the most recent 5,000 blocks.</div>';
          return;
        }
        feed.innerHTML = events.map(({name, event}) => {
          const a = event.args;
          let detail = "";
          if (name === "ListingCreated") detail = "Listing #"+a.listingId+" created · "+a.amount+" units · "+formatEther(a.price)+" native";
          if (name === "ListingCancelled") detail = "Listing #"+a.listingId+" cancelled";
          if (name === "AssetPurchased") detail = "Listing #"+a.listingId+" purchased · "+formatEther(a.price)+" native";
          if (name === "ProceedsWithdrawn") detail = "Seller withdrew "+formatEther(a.amount)+" native";
          const txUrl = config.explorerUrl ? config.explorerUrl.replace(/\/$/, "")+"/tx/"+event.transactionHash : "";
          return '<div class="web3-listing"><div><b>'+esc(name.replace(/([A-Z])/g, " $1").trim())+'</b><small>'+esc(detail)+' · block '+event.blockNumber+'</small></div><a href="'+esc(txUrl || "#")+'" '+(txUrl?'target="_blank" rel="noopener noreferrer"':'hidden')+'>View tx</a></div>';
        }).join("");
      } catch (error) {
        feed.innerHTML = '<div class="empty">Activity unavailable: '+esc(error.shortMessage || error.message || "RPC log query failed")+'</div>';
      }
    }
    async function refresh() {
      if (!ready) return;
      try {
        await connected();
        const proceeds = await market.pendingProceeds(account);
        $(" #escrow-proceeds".trim()).textContent = "Withdrawable proceeds: "+formatEther(proceeds)+" native currency";
        const end = await market.nextListingId();
        oldestLoadedId = end > 1n ? end - 1n : 0n;
        $(" #escrow-list".trim()).innerHTML = "";
        await loadListingPage(true);
        $(" #escrow-older".trim()).hidden = oldestLoadedId <= 1n;
        if (proceeds > 0n) $(" #escrow-proceeds".trim()).insertAdjacentHTML("beforeend",' <button type="button" id="escrow-withdraw">Withdraw proceeds</button>');
        $(" #escrow-submit".trim()).disabled = false;
        await loadActivity();
      } catch (error) {
        $(" #escrow-submit".trim()).disabled = true;
        status(error.message || "Could not read marketplace contract.");
      }
    }
    $(" #escrow-refresh".trim()).addEventListener("click", refresh);
    $(" #escrow-create".trim()).addEventListener("submit", async event => {
      event.preventDefault();
      try {
        await connected();
        const assetId = $(" #escrow-asset".trim()).value;
        const amount = BigInt($(" #escrow-amount".trim()).value);
        const price = parseEther($(" #escrow-price".trim()).value);
        if (amount <= 0n || price <= 0n) throw new Error("Quantity and price must be greater than zero.");
        status("Checking asset approval…");
        const approved = await token.isApprovedForAll(account, config.marketplaceAddress);
        if (!approved) {
          status("Approve the marketplace in your wallet to escrow this asset.");
          await (await token.setApprovalForAll(config.marketplaceAddress, true)).wait();
        }
        status("Confirm the escrow listing transaction in your wallet.");
        await (await market.createListing(config.contractAddress, BigInt(assetId), amount, price)).wait();
        status("Asset deposited into escrow and listing confirmed on-chain.");
        await refresh();
      } catch (error) { status(error.shortMessage || error.message || "Listing failed."); }
    });
    $(" #escrow-list".trim()).addEventListener("click", async event => {
      const buy = event.target.closest("[data-buy]");
      const cancel = event.target.closest("[data-cancel]");
      try {
        await connected();
        if (buy) {
          const listing = await market.listings(BigInt(buy.dataset.buy));
          status("Confirm purchase of "+formatEther(listing.price)+" native currency in your wallet.");
          await (await market.purchase(BigInt(buy.dataset.buy), { value: listing.price })).wait();
          status("Purchase confirmed. Escrowed asset transferred to your wallet.");
        } else if (cancel) {
          status("Confirm cancellation and return of escrowed assets in your wallet.");
          await (await market.cancelListing(BigInt(cancel.dataset.cancel))).wait();
          status("Listing cancelled and assets returned.");
        } else return;
        await refresh();
      } catch (error) { status(error.shortMessage || error.message || "Transaction failed."); }
    });
    $(" #escrow-proceeds".trim()).addEventListener("click", async event => {
      if (event.target.id !== "escrow-withdraw") return;
      try {
        await connected();
        status("Confirm proceeds withdrawal in your wallet.");
        await (await market.withdrawProceeds()).wait();
        status("Seller proceeds withdrawn successfully.");
        await refresh();
      } catch (error) { status(error.shortMessage || error.message || "Withdrawal failed."); }
    });
    window.ethereum?.on?.("accountsChanged", refresh);
    window.ethereum?.on?.("chainChanged", refresh);
    if (!ready) $(" #escrow-submit".trim()).disabled = true;
    else refresh();
  }

  const observer = new MutationObserver(() => {
    const panel = document.getElementById("panel-web3");
    if (panel) mount(panel);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  const existing = document.getElementById("panel-web3");
  if (existing) mount(existing);
})();
