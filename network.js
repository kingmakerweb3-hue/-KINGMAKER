"use strict";
(()=> {
 const $=id=>document.getElementById(id), toast=(m)=>{const t=$("toast");t.textContent=m;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),3000)};
 let provider=null,account=null,installPrompt=null;
 const walletButtons=[$("wallet"),$("wallet2")];
 async function connect(){if(!window.ethereum){toast("No injected wallet found. Open this site in your wallet's browser or use a supported desktop wallet.");return}
 try{const accounts=await window.ethereum.request({method:"eth_requestAccounts"});account=accounts?.[0]||null;provider=window.ethereum;if(account){$("wallet-result").textContent="Connected public address: "+account.slice(0,8)+"…"+account.slice(-6);walletButtons.forEach(b=>b.textContent="Wallet connected");toast("Wallet connected. No transaction or signature requested.");}}
 catch(e){toast(e?.code===4001?"Wallet connection cancelled.":"Wallet connection failed. Please try again.");}}
 walletButtons.forEach(b=>b.addEventListener("click",connect));
 if(window.ethereum?.on){window.ethereum.on("accountsChanged",a=>{account=a?.[0]||null;$("wallet-result").textContent=account?"Connected public address: "+account.slice(0,8)+"…"+account.slice(-6):"Wallet disconnected";});}
 const KEY="km_genesis_demo_v1", today=()=>new Date().toLocaleDateString("en-CA");
 let s={points:0,streak:0,last:null};try{s={...s,...JSON.parse(localStorage.getItem(KEY)||"{}")}}catch{}
 function draw(){$("points").textContent=s.points;$("streak").textContent=s.streak}
 $("checkin").addEventListener("click",()=>{const d=today();if(s.last===d){toast("You have already checked in today.");return}const prev=new Date();prev.setDate(prev.getDate()-1);const y=prev.toLocaleDateString("en-CA");s.streak=s.last===y?s.streak+1:1;s.points+=10+(s.streak%7===0?5:0);s.last=d;localStorage.setItem(KEY,JSON.stringify(s));draw();toast("Demo activity recorded. These points have no monetary value.");});draw();
 function showInstallHelp(){const ios=/iphone|ipad|ipod/i.test(navigator.userAgent),android=/android/i.test(navigator.userAgent);let m=ios?"On iPhone/iPad: tap Share in Safari, then Add to Home Screen.":android?"On Android: open the browser menu and choose Install app or Add to Home screen.":"On desktop: use the install icon in your browser address bar, or the browser menu → Install KINGMAKER."; $("install-help").textContent=m;toast(m)}
 async function install(){if(installPrompt){installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;return}showInstallHelp()}
 window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();installPrompt=e;$("install").textContent="Install app";$("install2").textContent="Install app ↗"});
 $("install").addEventListener("click",install);$("install2").addEventListener("click",install);
 $("share").addEventListener("click",async()=>{const data={title:"KINGMAKER Network",text:"A new world is coming. Join the KINGMAKER early community.",url:location.href};try{if(navigator.share)await navigator.share(data);else{await navigator.clipboard.writeText(location.href);toast("KINGMAKER link copied.");}}catch{}});
 $("menu").addEventListener("click",()=>{const n=document.querySelector(".nav nav");n.style.display=n.style.display==="flex"?"none":"flex";n.style.position="absolute";n.style.top="70px";n.style.left="0";n.style.right="0";n.style.padding="20px";n.style.background="#081525";n.style.flexDirection="column";});
 if("serviceWorker" in navigator&&location.protocol.startsWith("http"))navigator.serviceWorker.register("./network-sw.js").catch(()=>{});
})();