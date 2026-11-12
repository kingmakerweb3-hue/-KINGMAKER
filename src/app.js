(function () {
  "use strict";
  const E = window.KingmakerEngine, KEY = "kingmaker_save_v1", BACKUP = "kingmaker_save_recovery", OLD = "kingmaker_save";
  const $ = id => document.getElementById(id);
  let state, soundOn = false, activeTab = "overview";
  const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const num = v => Math.floor(Number(v) || 0).toLocaleString();
  function toast(message, kind="info") {
    const el=$("toast"); el.textContent=message; el.className="toast "+kind; el.hidden=false;
    clearTimeout(toast.timer); toast.timer=setTimeout(()=>{el.hidden=true;},3800);
  }
  function load() {
    try { const s=localStorage.getItem(KEY); if(s) return E.validateSave(JSON.parse(s)); } catch (_) {
      try { const b=localStorage.getItem(BACKUP); if(b){toast("Recovered your previous safe save. Export it to keep a copy.","warning");return E.migrateSave(JSON.parse(b));} } catch (_) {}
      toast("Latest save was unreadable. A new game is ready; use Import Save to recover a file.","warning");
    }
    try {
      const old=localStorage.getItem(OLD);
      if(old){const migrated=E.migrateSave(JSON.parse(old));localStorage.setItem(BACKUP,old);return migrated;}
    } catch (_) { toast("Old save was damaged. Use Import Save if you have an export.","warning"); }
    return E.createInitialState();
  }
  function persist() {
    try {
      const valid=E.validateSave(state),prior=localStorage.getItem(KEY);
      if(prior)localStorage.setItem(BACKUP,prior);
      localStorage.setItem(KEY,JSON.stringify(valid)); render();
    } catch(e) { toast("Could not save safely: "+e.message+". Export before leaving.","error"); }
  }
  function act(fn) { try { fn(); persist(); beep(); } catch(e) { toast(e.message,"error"); } }
  function beep() {
    if(!soundOn)return;
    try {const C=window.AudioContext||window.webkitAudioContext;if(!C)return;const c=new C(),o=c.createOscillator(),g=c.createGain();o.frequency.value=520;g.gain.setValueAtTime(.035,c.currentTime);g.gain.exponentialRampToValueAtTime(.001,c.currentTime+.08);o.connect(g);g.connect(c.destination);o.start();o.stop(c.currentTime+.08);o.onended=()=>c.close();}catch(_){}
  }
  function tab(name) {
    activeTab=name;
    document.querySelectorAll("[data-tab]").forEach(b=>{const on=b.dataset.tab===name;b.classList.toggle("active",on);b.setAttribute("aria-selected",String(on));});
    document.querySelectorAll(".tab-panel").forEach(p=>p.hidden=p.id!=="panel-"+name);
  }
  const totalBuildings=()=>Object.values(state.buildings).reduce((a,b)=>a+b,0);
  function renderMetrics() {
    $("metrics").innerHTML=[["Population",state.nation.population],["Food",state.resources.food],["Materials",state.resources.materials],["Credits",state.resources.credits],["Science",state.resources.science],["Influence",state.resources.influence]]
      .map(([n,v])=>'<article class="metric-card"><span class="metric-label">'+n+'</span><strong>'+num(v)+'</strong><span class="metric-hint">national reserve</span></article>').join("");
    $("science-reserve").textContent=num(state.resources.science);
  }
  function renderMap() {
    const rivals=Object.values(state.rivals),points=[{x:50,y:50,id:"player",name:state.nation.name,rel:100},...rivals.map((r,i)=>({x:[22,76,70][i],y:[28,35,76][i],id:r.id,name:r.name,rel:r.relation}))];
    const lines=rivals.map((r,i)=>'<line x1="50%" y1="50%" x2="'+points[i+1].x+'%" y2="'+points[i+1].y+'%" class="route '+(r.relation>=25?"friendly":r.relation<=-20?"hostile":"")+'"/>').join("");
    const nodes=points.map((p,i)=>{const color=i===0?"#e5bd6a":p.rel>=25?"#69d7a4":p.rel<=-20?"#ff837f":"#81b6ff",war=state.diplomacy.conflicts.some(c=>c.rivalId===p.id&&c.status==="active");
      return '<g tabindex="0" role="button" class="map-node" data-focus="'+esc(p.id)+'" aria-label="'+esc(p.name)+(war?", conflict":"")+'"><circle cx="'+p.x+'%" cy="'+p.y+'%" r="'+(i===0?19:15)+'" fill="'+color+'"/>'+(war?'<circle class="conflict-ring" cx="'+p.x+'%" cy="'+p.y+'%" r="23"/>':"")+'<text x="'+p.x+'%" y="'+(p.y+1)+'%">'+(i?"": "K")+(i?esc(p.name[0]):"")+'</text><text class="map-name" x="'+p.x+'%" y="'+(p.y+9)+'%">'+esc(p.name)+'</text></g>';}).join("");
    $("world-map").innerHTML='<svg viewBox="0 0 100 100" role="img" aria-label="Strategic map of the player and three rival nations"><defs><pattern id="mapgrid" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M10 0H0V10" fill="none" stroke="#6b87ac" stroke-opacity=".12" stroke-width=".25"/></pattern></defs><rect width="100" height="100" fill="url(#mapgrid)"/><path d="M12 58Q24 48 34 62T56 60Q66 43 87 57M16 17Q30 10 44 22T70 16" fill="none" stroke="#283c59" stroke-width="5"/>'+lines+nodes+'</svg>';
    $("map-legend").innerHTML='<span><i class="dot player"></i>Your nation</span><span><i class="dot friend"></i>Friendly</span><span><i class="dot neutral"></i>Neutral</span><span><i class="dot hostile"></i>Hostile</span>';
  }
  function renderNation() {
    $("nation-name").value=state.nation.name; $("government").value=state.nation.government;
    $("stability-value").textContent=state.nation.stability+"%";$("stability-bar").style.width=state.nation.stability+"%";
    const out=E.productionFor(state.buildings,state.technologies),need=Math.ceil(state.nation.population/12);
    $("production-summary").innerHTML=[["Food",out.food+" produced · "+need+" consumed / turn"],["Materials",out.materials+" / turn"],["Credits",out.credits+Math.floor(state.nation.population/20)+" / turn"],["Science",out.science+" / turn"],["Power",out.power+" / turn"]].map(([a,b])=>'<div class="rowline"><span>'+a+'</span><b>'+b+'</b></div>').join("");
    $("building-list").innerHTML=Object.entries(E.BUILDINGS).map(([id,b])=>'<article class="list-card"><div><h3>'+esc(b.name)+' <span class="level">Lv '+(state.buildings[id]||0)+'</span></h3><p>'+Object.entries(b.production).map(([r,n])=>n+" "+r+" / level").join(", ")+'</p><small>Upgrade: '+Object.entries(b.cost).map(([r,n])=>n+" "+r).join(" + ")+'</small></div><button data-action="build" data-id="'+id+'">Upgrade</button></article>').join("");
  }
  function renderMarket() {
    $("market-list").innerHTML=["food","materials"].map(r=>'<article class="market-row"><div><strong>'+r[0].toUpperCase()+r.slice(1)+'</strong><small>World stock: '+num(state.market.stock[r])+' · Your stock: '+num(state.resources[r])+'</small></div><b>'+state.market.prices[r].toFixed(2)+' cr</b><div class="trade-buttons"><button data-action="trade" data-resource="'+r+'" data-amount="-10">Sell 10</button><button data-action="trade" data-resource="'+r+'" data-amount="10">Buy 10</button></div></article>').join("");
    $("market-trends").innerHTML=["food","materials"].map(r=>'<span>'+r+': '+(state.market.lastFlow[r]>=0?"+":"")+num(state.market.lastFlow[r]||0)+' world flow · '+(state.market.lastFlow[r]>0?"price easing":"price rising")+'</span>').join("");
  }
  function renderDiplomacy() {
    const treatyTypes=["trade","research","non-aggression","alliance"];
    $("diplomacy-list").innerHTML=Object.values(state.rivals).map(r=>{
      const conflict=state.diplomacy.conflicts.find(c=>c.rivalId===r.id&&c.status==="active"),level=r.relation>=50?"Trusted":r.relation>=20?"Friendly":r.relation<=-20?"Hostile":"Cautious";
      const treaties=treatyTypes.map(k=>{const req=k==="alliance"?50:20,active=state.diplomacy.treaties.some(t=>t.rivalId===r.id&&t.kind===k&&t.status==="active");return '<button data-action="treaty" data-id="'+r.id+'" data-kind="'+k+'" '+(active||r.relation<req?"disabled":"")+'>'+(active?k+" active":"Offer "+k)+'</button>';}).join("");
      return '<article class="diplomacy-card"><div class="row"><div><h3>'+esc(r.name)+'</h3><p>'+esc(r.stance)+' · '+num(r.population)+' citizens</p></div><div class="relation '+(r.relation>=20?"good":r.relation<=-20?"bad":"")+'">'+r.relation+'<small>'+level+'</small></div></div><div class="actions"><button data-action="gift" data-id="'+r.id+'">Send 20 cr aid</button><button data-action="strain" data-id="'+r.id+'" '+(state.resources.influence<5?"disabled":"")+'>Recall envoy (−15)</button>'+(conflict?'<button class="danger" data-action="peace" data-id="'+r.id+'">Negotiate peace</button>':'<button class="danger" data-action="conflict" data-id="'+r.id+'" '+(r.relation>-20||state.resources.power<10?"disabled":"")+'>Declare conflict</button>')+'</div><div class="treaty-actions">'+treaties+'</div>'+(conflict?'<p class="notice">Conflict active · '+(state.turn-conflict.startedTurn)+' turns · strength '+conflict.playerScore+' to '+conflict.rivalScore+'</p>':"")+'</article>';
    }).join("");
    const active=state.diplomacy.treaties.filter(t=>t.status==="active");
    $("treaty-summary").textContent=active.length?active.map(t=>t.kind+" with "+state.rivals[t.rivalId].name).join(" · "):"No active agreements";
  }
  function renderResearch() {
    $("technology-list").innerHTML=Object.entries(E.TECHNOLOGIES).map(([id,t])=>{const done=state.technologies.includes(id),effect=t.effect==="stability"?"Raises stability and improves recovery.":t.effect==="growth"?"Improves population growth with food surplus.":"Increases "+t.effect+" output by "+Math.round((t.factor-1)*100)+"%.";return '<article class="list-card"><div><h3>'+esc(t.name)+(done?' <span class="level">Researched</span>':"")+'</h3><p>'+effect+'</p><small>Cost: '+t.cost+' science</small></div><button data-action="research" data-id="'+id+'" '+(done||state.resources.science<t.cost?"disabled":"")+'>'+(done?"Complete":"Research")+'</button></article>';}).join("");
  }
  function renderCampaign() {
    const c=E.CAMPAIGNS[state.campaign.id]; $("campaign-name").textContent=c.name;$("campaign-description").textContent=c.description;
    $("campaign-status").textContent=state.status==="playing"?"Turn "+state.turn+" · Campaign active":state.status.toUpperCase();
    $("campaign-objectives").innerHTML=c.objectives.map(o=>{const done=state.campaign.completedObjectives.includes(o.id);let value=o.resource?state.resources[o.resource]:o.buildings?Math.max(0,totalBuildings()-6):o.relations?Math.max(0,...Object.values(state.rivals).map(r=>r.relation)):state.technologies.length;return '<article class="objective '+(done?"complete":"")+'"><span class="objective-check">'+(done?"✓":"○")+'</span><div><b>'+esc(o.text)+'</b><small>'+(done?"Completed":num(value)+" / "+o.target)+'</small></div></article>';}).join("");
    const medals=[["founding-victory","Founder of the Realm","Complete the founding campaign."],["first-research","Curious Minds","Research a technology."],["builder","Master Builder","Build 10 infrastructure levels."],["good-neighbor","Good Neighbor","Reach 50 relations with a rival."]],earned=new Set(state.achievements);
    $("achievement-list").innerHTML=medals.map(([id,n,d])=>'<div class="achievement '+(earned.has(id)?"earned":"")+'"><span>'+(earned.has(id)?"★":"☆")+'</span><div><b>'+n+'</b><small>'+d+'</small></div></div>').join("");
  }
  function renderCreator() {
    $("creator-list").innerHTML=state.creations.length?state.creations.map(c=>'<article class="list-card"><div><h3>'+esc(c.title)+'</h3><p>'+esc(c.category)+' · by '+esc(c.creator)+'</p><small>'+esc(c.description||"No description")+'</small></div><button class="danger" data-action="delete-creation" data-id="'+esc(c.id)+'">Remove</button></article>').join(""):'<p class="empty">Your registry is ready for its first design.</p>';
  }
  function advice() {
    const a=[],o=E.productionFor(state.buildings,state.technologies),need=Math.ceil(state.nation.population/12);
    if(state.resources.food<state.nation.population)a.push(["Urgent","Food is below one month of demand. Upgrade farms or buy supplies."]);
    else if(o.food<need)a.push(["Priority","Food production is below consumption; stores will shrink each turn."]);
    if(state.nation.stability<50)a.push(["Priority","Stability is fragile. Secure food and power before expanding."]);
    if(state.resources.power<state.nation.population/10)a.push(["Priority","Power is below the national threshold and is reducing stability."]);
    if(!state.buildings.academy)a.push(["Growth","Build an Academy to produce science."]);
    if(!state.technologies.length&&state.resources.science>=28)a.push(["Opportunity","Advanced Agriculture is available to research."]);
    const r=Object.values(state.rivals).sort((x,y)=>x.relation-y.relation)[0];
    if(r&&r.relation<=-20)a.push(["Diplomacy",r.name+" is hostile. A non-aggression offer or peace delegation can contain risk."]);
    if(!state.campaign.completedObjectives.length)a.push(["Campaign","Review the founding objectives; complete all four to win."]);
    if(!a.length)a.push(["Strong","Your nation is balanced. Expand infrastructure, research, and regional agreements."]);
    return a;
  }
  function renderAdvice() {const html=advice().map(([l,t])=>'<article class="advice-card '+l.toLowerCase()+'"><b>'+l+'</b><p>'+esc(t)+'</p></article>').join("");$("director-advice").innerHTML=html;$("director-advice-panel").innerHTML=html;}
  function renderHistory() {
    $("history-list").innerHTML=state.events.slice(0,100).map(e=>'<article class="history-entry"><span class="event-type '+esc(e.type)+'">'+esc(e.type)+'</span><time>Turn '+num(e.turn)+'</time><span>'+esc(e.text)+'</span></article>').join("");
  }
  function render() {
    renderMetrics();renderMap();renderNation();renderMarket();renderDiplomacy();renderResearch();renderCampaign();renderCreator();renderAdvice();renderHistory();
    $("turn-label").textContent="TURN "+state.turn;$("game-banner").textContent=state.status==="playing"?state.nation.name+" · "+state.nation.government:"Campaign "+state.status;
    $("game-banner").className="game-banner "+state.status;$("advance-turn").disabled=state.status!=="playing";tab(activeTab);
  }
  function exportSave() {const blob=new Blob([E.exportSave(state)],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="kingmaker-save-turn-"+state.turn+".json";a.click();URL.revokeObjectURL(a.href);toast("Save exported.","success");}
  async function importSave(file) {
    if(!file)return;
    try {const text=await file.text();if(text.length>2_000_000)throw new Error("Save file exceeds the 2 MB limit.");state=E.migrateSave(JSON.parse(text));persist();toast("Save imported and validated.","success");}
    catch(e){toast("Save not imported: "+e.message,"error");}
    $("import-file").value="";
  }
  document.addEventListener("click",event=>{
    const t=event.target.closest("[data-tab]");if(t)return tab(t.dataset.tab);
    const node=event.target.closest("[data-focus]");if(node){const id=node.dataset.focus;if(id!=="player"){tab("diplomacy");toast(state.rivals[id].name+" · Relations "+state.rivals[id].relation+" · "+state.rivals[id].stance);}return;}
    const b=event.target.closest("[data-action]");if(!b)return;
    const {action,id,resource,amount,kind}=b.dataset;
    act(()=>{
      if(action==="build")E.build(state,id);
      if(action==="trade")E.trade(state,resource,Number(amount));
      if(action==="research"){E.research(state,id);if(!state.achievements.includes("first-research"))state.achievements.push("first-research");}
      if(action==="gift"){E.sendGift(state,id,20);if(state.rivals[id].relation>=50&&!state.achievements.includes("good-neighbor"))state.achievements.push("good-neighbor");}
      if(action==="strain"){if(state.resources.influence<5)throw Error("Recalling an envoy costs 5 influence.");state.resources.influence-=5;state.rivals[id].relation=Math.max(-100,state.rivals[id].relation-15);E.addEvent(state,"Your envoy was recalled from "+state.rivals[id].name+".","diplomacy");}
      if(action==="treaty")E.offerTreaty(state,id,kind);
      if(action==="conflict")E.declareConflict(state,id);
      if(action==="peace")E.makePeace(state,id);
      if(action==="delete-creation")E.deleteCreation(state,id);
      if(totalBuildings()>=10&&!state.achievements.includes("builder"))state.achievements.push("builder");
    });
  });
  $("advance-turn").addEventListener("click",()=>act(()=>E.advanceTurn(state)));
  $("save-profile").addEventListener("click",()=>{const name=$("nation-name").value.trim();if(!name||name.length>48)return toast("Nation name must contain 1–48 characters.","error");state.nation.name=name;state.nation.government=$("government").value;E.addEvent(state,"National charter updated.","player");persist();toast("Nation charter saved.","success");});
  $("export-save").addEventListener("click",exportSave);$("import-save").addEventListener("click",()=>$("import-file").click());$("import-file").addEventListener("change",e=>importSave(e.target.files[0]));
  $("new-game").addEventListener("click",()=>{if(!confirm("Start a new nation? Your current game will remain in the recovery backup."))return;try{localStorage.setItem(BACKUP,JSON.stringify(state));}catch(_){}state=E.createInitialState();persist();toast("A new nation has been founded.","success");});
  $("creator-form").addEventListener("submit",e=>{e.preventDefault();act(()=>{E.registerCreation(state,{creator:$("creator-name").value,title:$("creation-title").value,category:$("creation-category").value,description:$("creation-description").value});e.target.reset();});});
  const assess=()=>{renderAdvice();toast("The local World Director assessed your nation.","success");};
  $("director-run").addEventListener("click",assess);$("director-run-panel").addEventListener("click",assess);
  $("sound-toggle").addEventListener("click",e=>{soundOn=!soundOn;e.currentTarget.setAttribute("aria-pressed",String(soundOn));e.currentTarget.textContent=soundOn?"Sound: on":"Sound: off";beep();});
  state=load();render();persist();
})();
