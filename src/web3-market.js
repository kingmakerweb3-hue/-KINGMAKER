(function () {
  "use strict";
  const INVENTORY_KEY = "kingmaker.web3.inventory.v1";
  const API = "/api/market/listings";
  const esc = value => String(value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const readInventory = () => { try { return JSON.parse(localStorage.getItem(INVENTORY_KEY) || "{}"); } catch { return {}; } };
  const init = async () => {
    const panel = document.getElementById("panel-web3");
    if (!panel || panel.querySelector("#web3-market")) return;
    const economy = window.KingmakerAssetEconomy;
    const section = document.createElement("article");
    section.id = "web3-market";
    section.className = "panel span-12";
    section.innerHTML = '<p class="eyebrow">SHARED SERVER LISTINGS · DEVELOPMENT</p><h2>Asset exchange</h2><p class="muted">Listings are stored by the KINGMAKER development server and can be viewed across browsers using that server. This prototype has no sign-in or verified wallet signatures. Asking prices are display-only game credits; no payment or transfer occurs.</p><div class="web3-market-layout"><form id="market-form" class="web3-listing-form"><h3>Create a listing</h3><label for="market-asset">Your asset</label><select id="market-asset" required></select><label for="market-price">Asking price (game credits)</label><input id="market-price" type="number" min="1" max="1000000000" value="100" required><label for="market-duration">Duration</label><select id="market-duration"><option value="5">5 turns</option><option value="10" selected>10 turns</option><option value="25">25 turns</option></select><button class="primary" id="market-create" type="submit">Publish simulated listing</button></form><div><div class="web3-market-heading"><h3>Open listings</h3><button type="button" id="market-refresh">Refresh</button></div><div id="market-list" class="web3-market-list"></div></div></div><div id="market-status" class="notice" role="status">Server-backed listing prototype · no payments or on-chain settlement.</div>';
    panel.append(section);
    const form=section.querySelector("#market-form"), select=section.querySelector("#market-asset"), list=section.querySelector("#market-list"), status=section.querySelector("#market-status");
    let account=null, marketItems=[];
    try { const accounts=await window.ethereum?.request({method:"eth_accounts"}); account=accounts?.[0]?.toLowerCase() || null; } catch {}
    const refreshOptions=()=>{
      const own=account ? (readInventory()[account] || []) : [];
      select.innerHTML=own.length?own.map(a=>'<option value="'+esc(a.id)+'">'+esc(a.name)+'</option>').join(""):'<option value="">Connect wallet and add an asset first</option>';
      section.querySelector("#market-create").disabled=!account || !own.length;
    };
    const request=async (url,options={})=>{
      const response=await fetch(url,{...options,headers:{"Content-Type":"application/json",...(options.headers||{})}});
      const payload=await response.json().catch(()=>({error:"Invalid server response."}));
      if(!response.ok)throw new Error(payload.error || "Marketplace request failed.");
      return payload;
    };
    const refresh=async()=>{
      list.innerHTML='<div class="empty">Loading shared listings…</div>';
      try {
        const result=await request(API);
        marketItems=Array.isArray(result.listings)?result.listings:[];
        list.innerHTML=marketItems.length?marketItems.map(item=>{
          const asset=economy?.ASSETS.find(a=>a.id===item.assetId);
          const own=account && item.seller===account;
          return '<div class="web3-listing"><div><b>'+esc(asset?.name || item.assetId)+'</b><small>'+(own?'Your listing':'Seller '+esc(item.seller.slice(0,6)+'…'+item.seller.slice(-4)))+' · expires turn '+item.expiresTurn+'</small></div><strong>'+Number(item.price).toLocaleString()+'<small>GAME CREDITS</small></strong>'+(own?'<button data-cancel="'+esc(item.id)+'">Cancel</button>':'<span class="tag">VIEW ONLY</span>')+'</div>';
        }).join(""):'<div class="empty">No active listings yet. Publish the first listing from your local inventory.</div>';
      } catch(error) { list.innerHTML='<div class="empty">Marketplace server unavailable. Start the KINGMAKER server to use shared listings.</div>'; status.textContent=error.message; }
    };
    form.addEventListener("submit",async event=>{
      event.preventDefault(); if(!account || !economy)return;
      try {
        const own=readInventory()[account] || [];
        if(!own.some(a=>a.id===select.value))throw new Error("Asset is not in this browser's local inventory.");
        await request(API,{method:"POST",body:JSON.stringify({assetId:select.value,seller:account,price:Number(section.querySelector("#market-price").value),durationTurns:Number(section.querySelector("#market-duration").value)})});
        status.textContent="Listing published to the shared development server. No payment or token transfer is enabled.";
        await refresh();
      } catch(error){status.textContent=error.message;}
    });
    section.querySelector("#market-refresh").addEventListener("click",refresh);
    list.addEventListener("click",async event=>{
      const button=event.target.closest("[data-cancel]"); if(!button || !account)return;
      try {
        await request(API+"/"+encodeURIComponent(button.dataset.cancel),{method:"DELETE",body:JSON.stringify({seller:account})});
        status.textContent="Your listing was cancelled on the development server.";
        await refresh();
      } catch(error){status.textContent=error.message;}
    });
    if(window.ethereum?.on)window.ethereum.on("accountsChanged",accounts=>{account=accounts?.[0]?.toLowerCase()||null;refreshOptions();refresh();});
    refreshOptions(); await refresh();
  };
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>setTimeout(init,0),{once:true});else setTimeout(init,0);
})();