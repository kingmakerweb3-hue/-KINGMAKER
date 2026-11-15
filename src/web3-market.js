(function () {
  "use strict";
  const API = "/api/market/listings";
  const esc = value => String(value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const init = async () => {
    const panel = document.getElementById("panel-web3");
    if (!panel || panel.querySelector("#web3-market")) return;
    const economy = window.KingmakerAssetEconomy;
    const section = document.createElement("article");
    section.id = "web3-market";
    section.className = "panel span-12";
    section.innerHTML = '<p class="eyebrow">WALLET-AUTHENTICATED LISTINGS · DEVELOPMENT</p><h2>Asset exchange</h2><p class="muted">Sign a one-time wallet message to manage listings. Before accepting a listing, the server checks the connected wallet live ERC-1155 balance against its configured contract and network. The signature does not approve a transaction. Prices remain simulated game credits; no payment, asset transfer, or settlement occurs.</p><div class="web3-market-heading"><div><b id="market-account">Wallet not signed in</b><small id="market-auth-state">A signed wallet session is required to publish or cancel listings.</small></div><button type="button" id="market-signin">Connect & sign in</button></div><div class="web3-market-layout"><form id="market-form" class="web3-listing-form"><h3>Create a listing</h3><label for="market-asset">Your asset</label><select id="market-asset" required></select><label for="market-price">Asking price (game credits)</label><input id="market-price" type="number" min="1" max="1000000000" value="100" required><label for="market-duration">Duration</label><select id="market-duration"><option value="5">5 turns</option><option value="10" selected>10 turns</option><option value="25">25 turns</option></select><button class="primary" id="market-create" type="submit" disabled>Publish listing · verify ownership</button></form><div><div class="web3-market-heading"><h3>Open listings</h3><button type="button" id="market-refresh">Refresh</button></div><div id="market-list" class="web3-market-list"></div></div></div><div id="market-status" class="notice" role="status">Signed wallet sessions protect listing changes. This is still a development prototype.</div>';
    panel.append(section);
    const form=section.querySelector("#market-form"), select=section.querySelector("#market-asset"), list=section.querySelector("#market-list"), status=section.querySelector("#market-status"), signin=section.querySelector("#market-signin");
    let account=null, session=null, verifiedAssets=[];
    const request=async (url,options={})=>{
      const response=await fetch(url,{credentials:"same-origin",...options,headers:{"Content-Type":"application/json",...(options.headers||{})}});
      const payload=await response.json().catch(()=>({error:"Invalid server response."}));
      if(!response.ok)throw new Error(payload.error || "Marketplace request failed.");
      return payload;
    };
    const refreshOptions=()=>{
      const own=session && session.address===account ? verifiedAssets.filter(asset=>BigInt(asset.balance)>0n) : [];
      select.innerHTML=own.length?own.map(asset=>'<option value="'+esc(asset.assetId)+'">'+esc(asset.assetId)+' · balance '+esc(asset.balance)+'</option>').join(""):'<option value="">No verified on-chain assets found</option>';
      section.querySelector("#market-create").disabled=!session || session.address!==account || !own.length;
      section.querySelector("#market-account").textContent=session ? session.address : (account || "Wallet not signed in");
      section.querySelector("#market-auth-state").textContent=session ? "Signed in · chain ID "+session.chainId : "A signed wallet session is required to publish or cancel listings.";
      signin.textContent=session ? "Sign out" : "Connect & sign in";
    };
    const refreshInventory=async()=>{
      verifiedAssets=[];
      if(!session || session.address!==account){refreshOptions();return;}
      try {
        const result=await request("/api/market/inventory");
        verifiedAssets=result.assets || [];
        status.textContent=verifiedAssets.some(asset=>BigInt(asset.balance)>0n)?"On-chain inventory verified by the KINGMAKER server.":"No configured on-chain asset balances found for this wallet.";
      } catch(error) { status.textContent=error.message; }
      refreshOptions();
    };
    const refresh=async()=>{
      list.innerHTML='<div class="empty">Loading shared listings…</div>';
      try {
        const result=await request(API);
        list.innerHTML=result.listings.length?result.listings.map(item=>{
          const asset=economy?.ASSETS.find(a=>a.id===item.assetId);
          const own=session && item.seller===session.address;
          return '<div class="web3-listing"><div><b>'+esc(asset?.name || item.assetId)+'</b><small>'+(own?'Your listing':'Seller '+esc(item.seller.slice(0,6)+'…'+item.seller.slice(-4)))+' · expires turn '+item.expiresTurn+'</small></div><strong>'+Number(item.price).toLocaleString()+'<small>GAME CREDITS</small></strong>'+(own?'<button data-cancel="'+esc(item.id)+'">Cancel</button>':'<span class="tag">VIEW ONLY</span>')+'</div>';
        }).join(""):'<div class="empty">No active listings yet. Publish the first listing from your local inventory.</div>';
      } catch(error) { list.innerHTML='<div class="empty">Marketplace server unavailable. Start the KINGMAKER server to use shared listings.</div>'; status.textContent=error.message; }
    };
    const restoreSession=async()=>{
      try { const result=await request("/api/auth/session"); session=result.session; }
      catch { session=null; }
      await refreshInventory();
    };
    signin.addEventListener("click",async()=>{
      try {
        if(session) {
          await request("/api/auth/logout",{method:"POST",body:"{}"});
          session=null; status.textContent="Wallet session ended."; refreshOptions(); await refresh(); return;
        }
        if(!window.ethereum)throw new Error("Install or open an EVM wallet to sign in.");
        const accounts=await window.ethereum.request({method:"eth_requestAccounts"});
        account=accounts?.[0]?.toLowerCase() || null;
        if(!account)throw new Error("No wallet account was selected.");
        const chainId=await window.ethereum.request({method:"eth_chainId"});
        const challenge=await request("/api/auth/challenge",{method:"POST",body:JSON.stringify({address:account,chainId})});
        const signature=await window.ethereum.request({method:"personal_sign",params:[challenge.message,accounts[0]]});
        const verified=await request("/api/auth/verify",{method:"POST",body:JSON.stringify({address:account,nonce:challenge.nonce,message:challenge.message,signature})});
        session=verified.session;
        status.textContent="Wallet signature verified. Loading server-verified on-chain inventory…";
        await refreshInventory(); await refresh();
      } catch(error) { session=null; status.textContent=error.message; refreshOptions(); }
    });
    form.addEventListener("submit",async event=>{
      event.preventDefault(); if(!session || session.address!==account || !economy)return;
      try {
        if(!verifiedAssets.some(asset=>asset.assetId===select.value && BigInt(asset.balance)>0n))throw new Error("The server has not verified ownership of this asset.");
        await request(API,{method:"POST",body:JSON.stringify({assetId:select.value,price:Number(section.querySelector("#market-price").value),durationTurns:Number(section.querySelector("#market-duration").value)})});
        status.textContent="Listing published after the server verified your wallet's live on-chain balance. This check does not escrow the token or enable payment or transfer.";
        await refresh();
      } catch(error){status.textContent=error.message;}
    });
    section.querySelector("#market-refresh").addEventListener("click",async()=>{await refreshInventory();await refresh();});
    list.addEventListener("click",async event=>{
      const button=event.target.closest("[data-cancel]"); if(!button || !session)return;
      try {
        await request(API+"/"+encodeURIComponent(button.dataset.cancel),{method:"DELETE"});
        status.textContent="Your listing was cancelled.";
        await refresh();
      } catch(error){status.textContent=error.message;}
    });
    if(window.ethereum?.on)window.ethereum.on("accountsChanged",async accounts=>{
      account=accounts?.[0]?.toLowerCase()||null;
      try { await request("/api/auth/logout",{method:"POST",body:"{}"}); } catch {}
      session=null; verifiedAssets=[]; refreshOptions(); await refresh();
    });
    try { const accounts=await window.ethereum?.request({method:"eth_accounts"}); account=accounts?.[0]?.toLowerCase()||null; } catch {}
    await restoreSession(); await refresh();
  };
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>setTimeout(init,0),{once:true});else setTimeout(init,0);
})();
