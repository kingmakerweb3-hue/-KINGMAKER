(function () {
  "use strict";
  const INVENTORY_KEY = "kingmaker.web3.inventory.v1";
  const MARKET_KEY = "kingmaker.web3.market.v1";
  const esc = value => String(value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const read = key => { try { const v = JSON.parse(localStorage.getItem(key) || (key === MARKET_KEY ? "[]" : "{}")); return v && typeof v === "object" ? v : {}; } catch { return {}; } };
  const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));
  const init = async () => {
    const panel = document.getElementById("panel-web3");
    if (!panel || panel.querySelector("#web3-market")) return;
    const economy = window.KingmakerAssetEconomy;
    const section = document.createElement("article");
    section.id = "web3-market";
    section.className = "panel span-12";
    section.innerHTML = '<p class="eyebrow">PLAYER-TO-PLAYER · LOCAL SIMULATION</p><h2>Asset exchange</h2><p class="muted">Create and browse local listings. Prices are display-only game credits: no balance is charged, no payment is collected, and no blockchain transaction occurs.</p><div class="web3-market-layout"><form id="market-form" class="web3-listing-form"><h3>Create a listing</h3><label for="market-asset">Your asset</label><select id="market-asset" required></select><label for="market-price">Asking price (game credits)</label><input id="market-price" type="number" min="1" max="1000000000" value="100" required><label for="market-duration">Duration</label><select id="market-duration"><option value="5">5 turns</option><option value="10" selected>10 turns</option><option value="25">25 turns</option></select><button class="primary" id="market-create" type="submit">Create simulated listing</button></form><div><div class="web3-market-heading"><h3>Open listings</h3><button type="button" id="market-refresh">Refresh</button></div><div id="market-list" class="web3-market-list"></div></div></div><div id="market-status" class="notice" role="status">Simulation only — no payment or blockchain settlement.</div>';
    panel.append(section);
    const form=section.querySelector("#market-form"), select=section.querySelector("#market-asset"), list=section.querySelector("#market-list"), status=section.querySelector("#market-status");
    let account=null;
    try { const accounts=await window.ethereum?.request({method:"eth_accounts"}); account=accounts?.[0]?.toLowerCase() || null; } catch {}
    const inventory=()=>read(INVENTORY_KEY);
    const listings=()=>{const v=read(MARKET_KEY);return Array.isArray(v)?v:[];};
    const refresh=()=>{
      const owned=account ? (inventory()[account] || []) : [];
      select.innerHTML=owned.length?owned.map(a=>'<option value="'+esc(a.id)+'">'+esc(a.name)+'</option>').join(""):'<option value="">Connect wallet and add an asset first</option>';
      section.querySelector("#market-create").disabled=!account || !owned.length;
      const active=listings().filter(x=>x.status==="ACTIVE");
      list.innerHTML=active.length?active.map(x=>{
        const asset=economy?.ASSETS.find(a=>a.id===x.assetId);
        const own=account && x.seller===account;
        return '<div class="web3-listing"><div><b>'+esc(asset?.name || x.assetId)+'</b><small>'+(own?'Your listing':'Seller '+esc(x.seller.slice(0,6)+'…'+x.seller.slice(-4)))+' · expires turn '+x.expiresTurn+'</small></div><strong>'+Number(x.price).toLocaleString()+'<small>GAME CREDITS</small></strong><button data-action="'+(own?'cancel':'buy')+'" data-id="'+esc(x.id)+'">'+(own?'Cancel':'Simulate buy')+'</button></div>';
      }).join(""):'<div class="empty">No active listings yet. Add an asset to your inventory and create the first listing.</div>';
    };
    form.addEventListener("submit",event=>{
      event.preventDefault(); if(!account || !economy) return;
      try {
        const own=inventory()[account] || [];
        if(!own.some(a=>a.id===select.value)) throw new Error("Asset is not in your local inventory.");
        const item=economy.validateListing({id:"listing-"+Date.now().toString(36),assetId:select.value,seller:account,price:Number(section.querySelector("#market-price").value),durationTurns:Number(section.querySelector("#market-duration").value)},0);
        write(MARKET_KEY,[...listings(),item]); status.textContent="Listing created locally. It is not an on-chain offer and cannot collect payment."; refresh();
      } catch(error){status.textContent=error.message;}
    });
    section.querySelector("#market-refresh").addEventListener("click",refresh);
    list.addEventListener("click",event=>{
      const button=event.target.closest("[data-action]"); if(!button || !account || !economy)return;
      const all=listings(), i=all.findIndex(x=>x.id===button.dataset.id && x.status==="ACTIVE");
      if(i<0){status.textContent="Listing is no longer active.";refresh();return;}
      const item=all[i];
      try{
        if(button.dataset.action==="cancel"){
          if(item.seller!==account)throw new Error("Only the seller wallet can cancel this listing.");
          all[i]=economy.closeListing(item,"CANCELLED",0);
        }else{
          if(item.seller===account)throw new Error("You cannot buy your own listing.");
          const inventories=inventory(), sellerItems=inventories[item.seller]||[], buyerItems=inventories[account]||[];
          if(buyerItems.some(a=>a.id===item.assetId))throw new Error("Your local inventory already contains this asset type.");
          const at=sellerItems.findIndex(a=>a.id===item.assetId); if(at<0)throw new Error("Seller inventory no longer contains this asset.");
          economy.transferRecord(item,account,0);
          const moved=sellerItems.splice(at,1)[0]; inventories[item.seller]=sellerItems; inventories[account]=[...buyerItems,{...moved,addedAt:new Date().toISOString(),acquiredBy:"LOCAL_SIMULATION"}];
          write(INVENTORY_KEY,inventories); all[i]=economy.closeListing(item,"SOLD",0);
          status.textContent="Simulated exchange complete. Inventory records moved locally; no credits were charged and no blockchain transaction occurred.";
          const box=panel.querySelector("#web3-inventory"); if(box)box.innerHTML=inventories[account].map(a=>'<div class="web3-item"><div><b>'+esc(a.name)+'</b><small>'+esc(a.category)+' · Prototype record</small></div><span>'+esc(a.rarity)+'</span></div>').join("");
        }
        write(MARKET_KEY,all);refresh();
      }catch(error){status.textContent=error.message;}
    });
    if(window.ethereum?.on)window.ethereum.on("accountsChanged",accounts=>{account=accounts?.[0]?.toLowerCase()||null;refresh();});
    refresh();
  };
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>setTimeout(init,0),{once:true});else setTimeout(init,0);
})();