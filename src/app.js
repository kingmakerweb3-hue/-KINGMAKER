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
    try { const s=localStorage.getItem(KEY); if(s) return E.migrateSave(JSON.parse(s)); } catch (_) {
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
    try { E.saveWithRecovery(localStorage,state,KEY,BACKUP); render(); }
    catch(e) { toast("Could not save safely: "+e.message+". Export before leaving.","error"); }
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
    $("metrics").innerHTML=[["Population",state.nation.population],["Food",state.resources.food],["Materials",state.resources.materials],["Ore",state.resources.ore],["Goods",state.resources.goods],["Credits",state.resources.credits],["Power",state.resources.power],["Science",state.resources.science]]
      .map(([n,v])=>'<article class="metric-card"><span class="metric-label">'+n+'</span><strong>'+num(v)+'</strong><span class="metric-hint">national reserve</span></article>').join("");
    $("science-reserve").textContent=num(state.resources.science);
  }
  function renderMap() {
    const rivals=Object.values(state.rivals),coords=[[18,28],[78,20],[83,58],[63,82],[30,80],[17,56],[49,14],[92,38],[48,91]];const points=[{x:50,y:50,id:"player",name:state.nation.name,rel:100},...rivals.map((r,i)=>({x:coords[i%coords.length][0],y:coords[i%coords.length][1],id:r.id,name:r.name,rel:r.relation}))];
    const lines=rivals.map((r,i)=>'<line x1="50%" y1="50%" x2="'+points[i+1].x+'%" y2="'+points[i+1].y+'%" class="route '+(r.relation>=25?"friendly":r.relation<=-20?"hostile":"")+'"/>').join("");
    const nodes=points.map((p,i)=>{const color=i===0?"#e5bd6a":p.rel>=25?"#69d7a4":p.rel<=-20?"#ff837f":"#81b6ff",war=state.diplomacy.conflicts.some(c=>c.rivalId===p.id&&c.status==="active");
      return '<g tabindex="0" role="button" class="map-node" data-focus="'+esc(p.id)+'" aria-label="'+esc(p.name)+(war?", conflict":"")+'"><circle cx="'+p.x+'%" cy="'+p.y+'%" r="'+(i===0?19:15)+'" fill="'+color+'"/>'+(war?'<circle class="conflict-ring" cx="'+p.x+'%" cy="'+p.y+'%" r="23"/>':"")+'<text x="'+p.x+'%" y="'+(p.y+1)+'%">'+(i?"": "K")+(i?esc(p.name[0]):"")+'</text><text class="map-name" x="'+p.x+'%" y="'+(p.y+9)+'%">'+esc(p.name)+'</text></g>';}).join("");
    $("world-map").innerHTML='<svg viewBox="0 0 100 100" role="img" aria-label="Strategic map of the player and '+rivals.length+' rival nations"><defs><pattern id="mapgrid" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M10 0H0V10" fill="none" stroke="#6b87ac" stroke-opacity=".12" stroke-width=".25"/></pattern></defs><rect width="100" height="100" fill="url(#mapgrid)"/><path d="M12 58Q24 48 34 62T56 60Q66 43 87 57M16 17Q30 10 44 22T70 16" fill="none" stroke="#283c59" stroke-width="5"/>'+lines+nodes+'</svg>';
    $("map-legend").innerHTML='<span><i class="dot player"></i>Your nation</span><span><i class="dot friend"></i>Friendly</span><span><i class="dot neutral"></i>Neutral</span><span><i class="dot hostile"></i>Hostile</span>';
  }
  function renderNation() {
    $("nation-name").value=state.nation.name; $("government").value=state.nation.government;
    $("stability-value").textContent=state.nation.stability+"%";$("stability-bar").style.width=state.nation.stability+"%";
    const economy=E.economicSnapshot(state),out=economy.production,need=economy.consumption.food;
    $("production-summary").innerHTML=[["Food",out.food+" produced · "+need+" consumed"],["Materials",out.materials+" produced · "+economy.consumption.materials+" used"],["Ore",out.ore+" produced · "+economy.consumption.ore+" used"],["Goods",out.goods+" produced · "+economy.activeFactories+" active factories"],["Power",out.power+" produced · "+economy.consumption.power+" used"],["Treasury",state.economy.lastIncome+" income − "+state.economy.lastExpenses+" wages = "+(state.economy.lastBalance>=0?"+":"")+state.economy.lastBalance],["Employment",economy.employed+" / "+economy.workforce+" jobs filled · "+economy.requiredJobs+" required for growth"]].map(([a,b])=>'<div class="rowline"><span>'+a+'</span><b>'+b+'</b></div>').join("");
    $("building-list").innerHTML=Object.entries(E.BUILDINGS).map(([id,b])=>'<article class="list-card"><div><h3>'+esc(b.name)+' <span class="level">Lv '+((state&&state.buildings[id])||0)+'</span></h3><p>'+Object.entries(b.production).map(([r,n])=>n+" "+r+" / level").join(", ")+(b.inputs?" · uses "+Object.entries(b.inputs).map(([r,n])=>n+" "+r).join(", "):id==="transport"?" · raises people served per food from 12 to 20, up to 8 hubs":"")+'</p><small>Upgrade: '+Object.entries(b.cost).map(([r,n])=>n+" "+r).join(" + ")+' · '+({farm:4,mine:5,workshop:5,factory:8,transport:4,market:3,academy:4,power:4,housing:1}[id])+" jobs"+'</small></div><button data-action="build" data-id="'+id+'">Upgrade</button></article>').join("");
  }
  function renderMarket() {
    $("market-list").innerHTML=["food","materials","ore","goods","power"].map(r=>'<article class="market-row"><div><strong>'+r[0].toUpperCase()+r.slice(1)+'</strong><small>World stock: '+num(state.market.stock[r])+' · Your stock: '+num(state.resources[r])+'</small></div><b>'+state.market.prices[r].toFixed(2)+' cr</b><div class="trade-buttons"><button data-action="trade" data-resource="'+r+'" data-amount="-10">Sell 10</button><button data-action="trade" data-resource="'+r+'" data-amount="10">Buy 10</button></div></article>').join("");
    $("market-trends").innerHTML=["food","materials","ore","goods","power"].map(r=>{const flow=state.market.lastFlow[r]||0,trend=flow>0?"supply rising":flow<0?"supply falling":"supply steady";return '<span>'+r+': '+(flow>=0?"+":"")+num(flow)+' net supply · '+trend+'</span>';}).join("");
    $("economy-phase").textContent=state.economy.phase[0].toUpperCase()+state.economy.phase.slice(1)+" · "+(state.economy.lastBalance>=0?"+":"")+num(state.economy.lastBalance)+" credits / turn";
    $("economy-ledger").textContent="Last turn: "+num(state.economy.lastIncome)+" income − "+num(state.economy.lastExpenses)+" wages. "+(state.economy.phase==="recession"?"Two or more loss-making turns reduce stability and stop population growth.":state.economy.phase==="recovery"?"The economy is rebuilding stability after a recession.":"Income includes market output, citizen taxes and trade agreements.");
  }
  function renderDiplomacy() {
    const treatyTypes=["trade","research","non-aggression","alliance"];
    $("diplomacy-list").innerHTML=Object.values(state.rivals).map(r=>{
      const conflict=state.diplomacy.conflicts.find(c=>c.rivalId===r.id&&c.status==="active"),level=r.relation>=50?"Trusted":r.relation>=20?"Friendly":r.relation<=-20?"Hostile":"Cautious";
      const treaties=treatyTypes.map(k=>{const req=k==="alliance"?50:20,active=state.diplomacy.treaties.some(t=>t.rivalId===r.id&&t.kind===k&&t.status==="active");return '<button data-action="treaty" data-id="'+r.id+'" data-kind="'+k+'" '+(active||r.relation<req?"disabled":"")+'>'+(active?k+" active":"Offer "+k)+'</button>';}).join("");
      const jobs=E.workforceFor(r.buildings);
      const memory=r.memory.slice(0,3).map(m=>'<li>Turn '+num(m.turn)+': '+esc(m.text)+'</li>').join("");
      return '<article class="diplomacy-card"><div class="row"><div><h3>'+esc(r.name)+' <span class="level">'+esc(r.personality)+'</span></h3><p>'+esc(r.stance)+' · '+num(r.population)+' citizens</p><small class="rival-activity">Objective: '+esc(r.longTermObjective)+'</small><small class="rival-activity">Plan: '+esc(r.plan?r.plan.reason:"evaluating national priorities")+'</small><small class="rival-activity">This turn: '+esc(r.activity)+'</small><small class="rival-activity">Industry: '+(r.buildings.mine||0)+' mines · '+(r.buildings.factory||0)+' factories · '+num(Math.min(jobs,r.population))+'/'+num(jobs)+' jobs · '+num(r.resources.credits)+' credits</small><details class="rival-history"><summary>Recent history ('+r.memory.length+')</summary><ul>'+memory+'</ul></details></div><div class="relation '+(r.relation>=20?"good":r.relation<=-20?"bad":"")+'">'+r.relation+'<small>'+level+'</small></div></div><div class="actions"><button data-action="gift" data-id="'+r.id+'">Send 20 cr aid</button><button data-action="strain" data-id="'+r.id+'" '+(state.resources.influence<5?"disabled":"")+'>Recall envoy (−15)</button>'+(conflict?'<button class="danger" data-action="peace" data-id="'+r.id+'">Negotiate peace</button>':'<button class="danger" data-action="conflict" data-id="'+r.id+'" '+(r.relation>-20||state.resources.power<10?"disabled":"")+'>Declare conflict</button>')+'</div><div class="treaty-actions">'+treaties+'</div>'+(conflict?'<p class="notice">Conflict active · '+(state.turn-conflict.startedTurn)+' turns · strength '+conflict.playerScore+' to '+conflict.rivalScore+'</p>':"")+'</article>';
    }).join("");
    const active=state.diplomacy.treaties.filter(t=>t.status==="active");
    $("treaty-summary").textContent=active.length?active.map(t=>t.kind+" with "+state.rivals[t.rivalId].name).join(" · "):"No active agreements";
  }
  function renderWorldEvents() {
    const events=state.world.activeEvents.slice().sort((a,b)=>a.startedTurn-b.startedTurn);
    if(!events.length){$("world-events").innerHTML='<p class="empty">No major event is active. Markets and rival nations continue to evolve each turn.</p>';return;}
    $("world-events").innerHTML=events.map(event=>{
      const info=E.worldEventInfo(event.key),pending=event.status==="pending";
      const targets=event.affectedNationIds.map(id=>id==="player"?state.nation.name:state.rivals[id].name).join(", ")||"Regional market";
      const responses=pending?'<div class="event-choices">'+info.choices.map(choice=>{
        let available=true;
        if(event.key==="energy_crisis"&&choice.id==="import")available=state.resources.credits>=25&&state.market.stock.power>=10&&state.resources.power+10<=E.RESOURCE_LIMIT;
        if(event.key==="food_shortage"&&choice.id==="buy_grain")available=state.resources.credits>=30&&state.market.stock.food>=20&&state.resources.food+20<=E.RESOURCE_LIMIT;
        if(event.key==="trade_disruption"&&choice.id==="escort")available=state.resources.credits>=18;
        if(event.key==="diplomatic_dispute"&&choice.id==="envoys")available=state.resources.credits>=20;
        if(event.key==="infrastructure_opportunity"&&choice.id==="cofund")available=state.resources.materials>=20&&state.resources.credits>=30&&state.buildings.transport<8;
        return '<div class="event-choice"><button data-action="event-choice" data-event-id="'+esc(event.id)+'" data-choice="'+esc(choice.id)+'" '+(available?"":"disabled")+'>'+esc(choice.label)+'</button><small>'+esc(choice.detail)+'</small></div>';
      }).join("")+'</div>':'<p class="event-duration">Active · '+num(event.remainingTurns)+' turn'+(event.remainingTurns===1?"":"s")+' remaining. '+esc(info.description)+'</p>';
      return '<article class="world-event '+(info.crisis?"crisis":"")+'"><div class="world-event-heading"><h3>'+esc(info.title)+'</h3><span class="tag">'+(pending?"DECISION NEEDED":"ACTIVE")+'</span></div><p>'+esc(info.description)+'</p><small>Affected: '+esc(targets)+' · Began turn '+num(event.startedTurn)+'</small>'+responses+'</article>';
    }).join("");
  }
  function renderResearch() {
    $("technology-list").innerHTML=Object.entries(E.TECHNOLOGIES).map(([id,t])=>{const done=state.technologies.includes(id),missing=(t.requires||[]).filter(required=>!state.technologies.includes(required)),effect=t.effect==="stability"?"Raises stability and improves recovery.":t.effect==="growth"?"Improves population growth with food surplus.":t.effect==="mine"?"Increases ore extraction by 50%.":t.effect==="transport"?"Increases food logistics capacity by 50%.":t.effect==="housing"?"Increases housing capacity by 50% and reduces national wage upkeep by 10%.":"Increases "+t.effect+" output by "+Math.round((t.factor-1)*100)+"%.";return '<article class="list-card"><div><h3>'+esc(t.name)+(done?' <span class="level">Researched</span>':"")+'</h3><p>'+effect+'</p><small>Cost: '+t.cost+' science'+(t.requires&&t.requires.length?' · Requires: '+t.requires.map(required=>esc(E.TECHNOLOGIES[required].name)).join(", "):"")+'</small></div><button data-action="research" data-id="'+id+'" '+(done||missing.length>0||state.resources.science<t.cost?"disabled":"")+'>'+(done?"Complete":missing.length?"Locked":"Research")+'</button></article>';}).join("");
  }
  function renderCampaign() {
    const c=E.CAMPAIGNS[state.campaign.id]; $("campaign-name").textContent=c.name;$("campaign-description").textContent=c.description;
    $("campaign-status").textContent=state.status==="playing"?"Turn "+state.turn+" · Phase "+(c.phases[state.campaign.phaseIndex]||"Complete"):state.status.toUpperCase();
    const picker=$("campaign-picker");picker.innerHTML=Object.entries(E.CAMPAIGNS).map(([id,item])=>'<option value="'+id+'">'+esc(item.name)+'</option>').join("");picker.value=state.campaign.id;
    $("campaign-objectives").innerHTML=c.objectives.map(o=>{const done=state.campaign.completedObjectives.includes(o.id),locked=o.phase>state.campaign.phaseIndex,value=E.campaignObjectiveValue(state,o);return '<article class="objective '+(done?"complete":locked?"locked":"")+'"><span class="objective-check">'+(done?"✓":locked?"🔒":"○")+'</span><div><b>'+esc(o.text)+'</b><small>'+esc(c.phases[o.phase])+" · "+(done?"Completed":locked?"Locked until the prior phase is complete":num(value)+" / "+o.target)+'</small></div></article>';}).join("");
    const medals=[["campaign-victory","Victor of the Realm","Complete any campaign."],["first-research","Curious Minds","Research a technology."],["builder","Master Builder","Build 10 infrastructure levels."],["industrialist","Industrial Age","Build a factory and establish manufacturing."],["good-neighbor","Good Neighbor","Reach 50 relations with a rival."]],earned=new Set(state.achievements);
    $("achievement-list").innerHTML=medals.map(([id,n,d])=>'<div class="achievement '+(earned.has(id)?"earned":"")+'"><span>'+(earned.has(id)?"★":"☆")+'</span><div><b>'+n+'</b><small>'+d+'</small></div></div>').join("");
  }
  function renderCreator() {
    const active=state.creations.filter(c=>c.commissioned&&!c.archived).length, demand=E.creatorDemand(state), demandByCategory=Object.fromEntries(demand.map(item=>[item.category,item])), profiles=E.creatorProfiles(state);
    $("creator-demand").innerHTML=demand.map(item=>'<article class="advice-card '+(item.score>=70?"growth":"")+'"><b>'+esc(item.category)+' · '+item.score+'/100 demand</b><p>'+esc(item.reason)+'</p><small>Highest demand: '+esc(item.nations.map(n=>n.name+" "+n.score).join(", ")||"No nation above current need")+'</small></article>').join("");
    $("creator-profiles").innerHTML=profiles.length?profiles.map(profile=>'<div class="achievement"><span>Lv '+profile.level+'</span><div><b>'+esc(profile.creator)+' · '+profile.reputation+' reputation</b><small>'+profile.experience+' XP · '+profile.published+' published · '+profile.commissioned+' commissioned · '+profile.successfulUses+' successful rival uses · '+profile.activeUses+' active adopters</small></div></div>').join(""): '<p class="empty">Publish a design to start creator progression.</p>';
    const designs=state.creations.filter(c=>!c.archived);
    $("creator-list").innerHTML=designs.length?designs.map(c=>{
      const effect=E.creatorEffectFor(c.category,E.creatorProgress(state,c.creatorId).level),categoryDemand=demandByCategory[c.category],profile=E.creatorProgress(state,c.creatorId),commissionedBefore=state.creatorEconomy.commissions.some(item=>item.designId===c.id),adoptions=state.creatorEconomy.adoptions.filter(item=>item.designId===c.id),activeUses=adoptions.filter(item=>item.active),successes=adoptions.filter(item=>item.successfulUseTurn!==null).length;
      const label=commissionedBefore?'Reactivate commission':'Commission · 30 cr + 12 materials',action=c.commissioned?'<button data-action="withdraw-creation" data-id="'+esc(c.id)+'">Withdraw commission</button>':'<button data-action="commission-creation" data-id="'+esc(c.id)+'" '+(active>=E.MAX_COMMISSIONED_CREATIONS||(!commissionedBefore&&(state.resources.credits<E.CREATOR_COMMISSION_COST.credits||state.resources.materials<E.CREATOR_COMMISSION_COST.materials))||state.status!=="playing"?"disabled":"")+'>'+label+'</button>';
      const adopterNames=activeUses.map(use=>state.rivals[use.rivalId]?.name).filter(Boolean).join(", ")||"No active rival use";
      return '<article class="list-card"><div><h3>'+esc(c.title)+(c.commissioned?' <span class="level">Active nationally</span>':"")+'</h3><p>'+esc(c.category)+' · by '+esc(c.creator)+' · '+esc(effect?.label||"")+'</p><small>'+esc(c.description||"No description")+'</small><small>Demand '+categoryDemand.score+'/100 · '+esc(categoryDemand.reason)+'</small><small>Creator Lv '+profile.level+' · reputation '+profile.reputation+' · '+successes+' successful use'+(successes===1?"":"s")+' · '+adopterNames+'</small>'+(c.commissioned?'<small>Commissioned turn '+num(c.commissionedTurn)+' · effect runs each world turn</small>':"")+'</div><div class="actions">'+action+'<button class="danger" data-action="delete-creation" data-id="'+esc(c.id)+'" '+((c.commissioned||activeUses.length)?"disabled title=\"Withdraw the active use first\"":"")+'>Archive</button></div></article>';
    }).join(""):'<p class="empty">No published designs are available. Publish one to enter it in the regional design market.</p>';
    $("creator-capacity").textContent=active+" / "+E.MAX_COMMISSIONED_CREATIONS+" active national designs · "+state.creatorEconomy.publications.length+" / "+E.MAX_CREATOR_PUBLICATIONS+" lifetime publications · "+num(state.resources.credits)+" credits · "+num(state.resources.materials)+" materials";
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
    if(!state.campaign.completedObjectives.length)a.push(["Campaign","Review the short, medium, and long-term objectives; complete all six to win this scenario."]);
    if(!a.length)a.push(["Strong","Your nation is balanced. Expand infrastructure, research, and regional agreements."]);
    return a;
  }
  function renderAdvice() {const html=advice().map(([l,t])=>'<article class="advice-card '+l.toLowerCase()+'"><b>'+l+'</b><p>'+esc(t)+'</p></article>').join("");$("director-advice").innerHTML=html;$("director-advice-panel").innerHTML=html;}
  function renderHistory() {
    $("history-list").innerHTML=state.events.slice(0,120).map(e=>'<article class="history-entry"><span class="event-type '+esc(e.type)+'">'+esc(e.type)+'</span><time>Turn '+num(e.turn)+'</time><div><span>'+esc(e.text)+'</span>'+(e.details?'<details class="history-details"><summary>Impact and context</summary><p>'+esc(e.details.summary)+'</p><small>Affected: '+esc(e.details.affectedNationIds.map(id=>id==="player"?state.nation.name:state.rivals[id]?.name||id).join(", "))+'</small></details>':"")+'</div></article>').join("");
  }
  function render() {
    renderMetrics();renderMap();renderNation();renderMarket();renderDiplomacy();renderWorldEvents();renderResearch();renderCampaign();renderCreator();renderAdvice();renderHistory();document.querySelectorAll("[data-world-build]").forEach(button=>{const id=button.dataset.worldBuild;const label=E.BUILDINGS[id]?.name||id;button.innerHTML=esc(label)+' <small>Lv '+(state.buildings[id]||0)+'</small>';});if(window.KingmakerWorld3D)window.KingmakerWorld3D.update(state);
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
  const worldBuildPalette=document.getElementById("world3d-build-palette");
  if(worldBuildPalette)worldBuildPalette.innerHTML=Object.entries(E.BUILDINGS).map(([id,b])=>'<button type="button" data-world-build="'+id+'" title="'+esc(b.name)+' · '+Object.entries(b.cost).map(([r,n])=>n+" "+r).join(" + ")+'">'+esc(b.name)+' <small>Lv '+((state&&state.buildings[id])||0)+'</small></button>').join("");
  worldBuildPalette?.addEventListener("click",event=>{const button=event.target.closest("[data-world-build]");if(!button)return;window.KingmakerWorld3D?.selectBuilding(button.dataset.worldBuild);});
  window.addEventListener("kingmaker:place-building",event=>{const type=event.detail?.type;if(!E.BUILDINGS[type])return;act(()=>{E.build(state,type);state.world.placedBuildings=state.world.placedBuildings||[];state.world.placedBuildings.push({type,x:Number(event.detail.x),z:Number(event.detail.z)});if(totalBuildings()>=10&&!state.achievements.includes("builder"))state.achievements.push("builder");});toast(E.BUILDINGS[type].name+" constructed in your nation.","success");});
  document.addEventListener("click",event=>{
    const t=event.target.closest("[data-tab]");if(t)return tab(t.dataset.tab);
    const node=event.target.closest("[data-focus]");if(node){const id=node.dataset.focus;if(id!=="player"){tab("diplomacy");toast(state.rivals[id].name+" · Relations "+state.rivals[id].relation+" · "+state.rivals[id].stance);}return;}
    const b=event.target.closest("[data-action]");if(!b)return;
    const {action,id,resource,amount,kind,eventId,choice}=b.dataset;
    act(()=>{
      if(action==="build")E.build(state,id);
      if(action==="trade")E.trade(state,resource,Number(amount));
      if(action==="research"){E.research(state,id);if(!state.achievements.includes("first-research"))state.achievements.push("first-research");}
      if(action==="gift"){E.sendGift(state,id,20);if(state.rivals[id].relation>=50&&!state.achievements.includes("good-neighbor"))state.achievements.push("good-neighbor");}
      if(action==="strain"){if(state.resources.influence<5)throw Error("Recalling an envoy costs 5 influence.");state.resources.influence-=5;state.rivals[id].relation=Math.max(-100,state.rivals[id].relation-15);E.addEvent(state,"Your envoy was recalled from "+state.rivals[id].name+".","diplomacy");}
      if(action==="treaty")E.offerTreaty(state,id,kind);
      if(action==="conflict")E.declareConflict(state,id);
      if(action==="peace")E.makePeace(state,id);
      if(action==="event-choice")E.resolveWorldEvent(state,eventId,choice);
      if(action==="delete-creation")E.deleteCreation(state,id);
      if(action==="commission-creation")E.commissionCreation(state,id);
      if(action==="withdraw-creation")E.withdrawCreation(state,id);
      if(totalBuildings()>=10&&!state.achievements.includes("builder"))state.achievements.push("builder");
    });
  });
  $("world-map").addEventListener("keydown",event=>{
    if(event.key==="Enter"||event.key===" "){const node=event.target.closest("[data-focus]");if(node){event.preventDefault();node.click();}}
  });
  $("advance-turn").addEventListener("click",()=>act(()=>E.advanceTurn(state)));
  $("save-profile").addEventListener("click",()=>{const name=$("nation-name").value.trim();if(!name||name.length>48)return toast("Nation name must contain 1–48 characters.","error");state.nation.name=name;state.nation.government=$("government").value;E.addEvent(state,"National charter updated.","player");persist();toast("Nation charter saved.","success");});
  $("export-save").addEventListener("click",exportSave);$("import-save").addEventListener("click",()=>$("import-file").click());$("import-file").addEventListener("change",e=>importSave(e.target.files[0]));
  $("new-game").addEventListener("click",()=>{if(!confirm("Start a new nation? Your current game will remain in the recovery backup."))return;try{localStorage.setItem(BACKUP,JSON.stringify(state));}catch(_){}state=E.createInitialState();persist();toast("A new nation has been founded.","success");});
  $("start-campaign").addEventListener("click",()=>{if(!confirm("Begin this campaign? Your current nation will remain in the recovery backup."))return;try{localStorage.setItem(BACKUP,JSON.stringify(state));}catch(_){}state=E.createInitialState({campaignId:$("campaign-picker").value});persist();toast("Campaign started: "+E.CAMPAIGNS[state.campaign.id].name,"success");});
  $("creator-form").addEventListener("submit",e=>{e.preventDefault();act(()=>{E.registerCreation(state,{creator:$("creator-name").value,title:$("creation-title").value,category:$("creation-category").value,description:$("creation-description").value});e.target.reset();});});
  const assess=()=>{renderAdvice();toast("The local World Director assessed your nation.","success");};
  $("director-run").addEventListener("click",assess);$("director-run-panel").addEventListener("click",assess);
  $("sound-toggle").addEventListener("click",e=>{soundOn=!soundOn;e.currentTarget.setAttribute("aria-pressed",String(soundOn));e.currentTarget.textContent=soundOn?"Sound: on":"Sound: off";beep();});
  state=load();render();persist();
})();
