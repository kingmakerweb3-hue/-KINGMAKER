"use strict";
(() => {
  const KEY="kingmaker.network.demo.v1";
  const $=id=>document.getElementById(id);
  const today=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");};
  const yesterday=()=>{const d=new Date();d.setDate(d.getDate()-1);return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");};
  const fresh=()=>({points:0,streak:0,total:0,lastDay:null,history:[]});
  const load=()=>{try{const s=JSON.parse(localStorage.getItem(KEY)||"null");return s&&Number.isFinite(s.points)&&Array.isArray(s.history)?s:fresh();}catch{return fresh();}};
  let state=load();
  const save=()=>localStorage.setItem(KEY,JSON.stringify(state));
  function render(){
    $("points").textContent=state.points.toLocaleString();
    $("streak").textContent=state.streak;
    $("checkins").textContent=state.total;
    const done=state.lastDay===today();
    $("checkin").disabled=done;
    $("checkin").textContent=done?"✓ Today's check-in complete":"⚡ Activate daily check-in";
    $("checkin-state").textContent=done?"You checked in today. Come back tomorrow.":"Ready when you are";
    $("progress").style.width=(state.streak%7===0&&state.streak>0?100:(state.streak%7)/7*100)+"%";
    $("next-checkin").textContent=done?"Next daily check-in available after local midnight.":"Your next check-in starts your daily streak.";
  }
  $("checkin").addEventListener("click",()=>{
    const day=today();
    if(state.lastDay===day)return;
    state.streak=state.lastDay===yesterday()?state.streak+1:1;
    const reward=10+(state.streak%7===0?5:0);
    state.points+=reward;state.total+=1;state.lastDay=day;
    state.history.push({day,reward,streak:state.streak});
    if(state.history.length>90)state.history=state.history.slice(-90);
    save();render();
    $("checkin-state").textContent=state.streak%7===0?"Seven-day streak bonus earned!":"Daily participation recorded!";
  });
  $("wallet").addEventListener("click",async()=>{
    const label=$("wallet-label");
    if(!window.ethereum?.request){label.textContent="No browser wallet detected. You can still use daily check-in.";return;}
    try{const accounts=await window.ethereum.request({method:"eth_requestAccounts"});label.textContent=accounts[0]?accounts[0].slice(0,8)+"…"+accounts[0].slice(-6):"Wallet not connected";}
    catch(e){label.textContent=e?.code===4001?"Wallet connection cancelled.":"Wallet connection unavailable.";}
  });
  $("invite-link").value=location.origin+location.pathname;
  $("copy").addEventListener("click",async()=>{try{await navigator.clipboard.writeText($("invite-link").value);$("copy-state").textContent="Link copied.";}catch{$("copy-state").textContent="Select and copy the link above."; }});
  let installPrompt=null;
  window.addEventListener("beforeinstallprompt",event=>{event.preventDefault();installPrompt=event;$("install").hidden=false;});
  $("install").addEventListener("click",async()=>{if(!installPrompt)return;installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;$("install").hidden=true;});
  if("serviceWorker" in navigator && location.protocol.startsWith("http"))navigator.serviceWorker.register("./network-sw.js").catch(()=>{});
  render();
})();