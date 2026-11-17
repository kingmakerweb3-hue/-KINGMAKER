import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js";
import { OrbitControls } from "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/controls/OrbitControls.js";

(() => {
  "use strict";
  const host=document.getElementById("world3d-viewport");
  if(!host)return;
  let scene,camera,renderer,controls,sunLight,starField,moonObject,auroraMesh,landGroup,buildingGroup,peopleGroup,roadGroup,playerRoadGroup,districtGroup,trafficGroup,resourceGroup,territoryGroup,cloudGroup,harborGroup,cargoShip,lighthouseBeacon,windFarmGroup,solarFarmGroup,waterMesh,waterPositions,terrainMesh;
  const trafficVehicles=[];
  const windTurbineRotors=[];
  const solarTrackers=[];
  let lastState=null,animationId=0,autoRotate=true,resizeObserver,clock,selectedBuilding=null,roadMode=false,roadStart=null,selectedDistrict=null,districtMode=false,raycaster,groundPlane,previewMarker,placementPointer=null,territorySignature="",worldFitted=false;
  const COLORS={farm:0xc6a35d,mine:0x78838d,workshop:0x9c7652,factory:0x697b8e,transport:0x9b9b8b,market:0xc49b52,academy:0x8b80b8,power:0x75b9c9,housing:0xd6c5a3};
  const material=(color,roughness=.86)=>new THREE.MeshStandardMaterial({color,roughness});
  const boxGeo=new THREE.BoxGeometry(1,1,1);
  const rand=(x,z)=>{const n=Math.sin(x*127.1+z*311.7)*43758.5453;return n-Math.floor(n);};
  const heightAt=(x,z)=>{const angle=Math.atan2(z,x),coast=14.1+Math.sin(angle*3+1.1)*.85+Math.sin(angle*7-.6)*.34,edge=THREE.MathUtils.smoothstep(coast-Math.hypot(x,z),0,2.2),raw=Math.sin(x*.19+Math.cos(z*.13))*Math.cos(z*.21)*.72+Math.sin((x+z*.62)*.43)*Math.cos((z-x*.28)*.37)*.42+Math.sin(x*.91+z*.36)*Math.cos(z*.83-x*.2)*.11+Math.max(0,1-Math.hypot(x+3,z-2)/7)*1.05;return raw*edge*1.35-.2;};
  function islandHeightAt(x,z,territory){
    const dx=x-territory.x,dz=z-territory.z,distance=Math.hypot(dx,dz),angle=Math.atan2(dz,dx);
    const coast=territory.radius+Math.sin(angle*3+territory.phase)*.42+Math.sin(angle*5-territory.phase)*.2;
    const edge=THREE.MathUtils.smoothstep(coast-distance,0,1.35);
    const raw=Math.sin(dx*.54+territory.phase)*Math.cos(dz*.61-territory.phase)*.46+
      Math.sin((dx+dz*.62)*.82)*Math.cos((dz-dx*.28)*.73)*.28+
      Math.max(0,1-Math.hypot(dx+1.1,dz-1.4)/(territory.radius*.52))*.62;
    return raw*edge*.92-.18;
  }
  function heightAtWorld(x,z,territoryId){
    if(!territoryId||territoryId==="home")return heightAt(x,z);
    const territory=lastState?.world?.territories?.find(item=>item.id===territoryId);
    return territory?islandHeightAt(x,z,territory):-.18;
  }

  function makeTree(x,z,scale=1){
    const g=new THREE.Group();g.position.set(x,heightAt(x,z),z);g.scale.setScalar(scale);
    const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.075,.14,.82,8),material(0x594331,.98));trunk.position.y=.4;trunk.castShadow=true;g.add(trunk);
    const tone=rand(x,z),crownMat=material(tone>.66?0x315d43:tone>.33?0x426f4b:0x587d50,1);
    for(let i=0;i<3;i++){const crown=new THREE.Mesh(new THREE.IcosahedronGeometry(.58-i*.09,2),crownMat);crown.position.set((rand(x+i,z)-.5)*.18,.92+i*.34,(rand(x,z+i)-.5)*.18);crown.scale.set(1,.9,1);crown.castShadow=true;g.add(crown);}
    landGroup.add(g);
  }
  function makeResourceMarker(node){
    const palette={"Fertile soil":0x82a95d,Iron:0x87929a,Copper:0xc27b4b,Coal:0x3c4650,Timber:0x6e9a59,Stone:0x9c9b91,"Fresh water":0x58a8d4,"Rare crystals":0x9a82d8};
    const color=node.depleted?0x6d7780:(palette[node.resource]||0xc7ad72);
    const group=new THREE.Group();
    group.position.set(node.x,heightAtWorld(node.x,node.z,node.territoryId)+.12,node.z);
    group.userData.resourceNodeId=node.id;
    const ring=new THREE.Mesh(new THREE.TorusGeometry(.48,.065,8,28),new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:node.operational && !node.depleted ? 0.34 : 0.08,roughness:.62,transparent:node.depleted,opacity:node.depleted ? 0.5 : 1}));
    ring.rotation.x=-Math.PI/2;group.add(ring);
    const crystalGeometry=node.resource==="Rare crystals"?new THREE.OctahedronGeometry(.34,1):new THREE.DodecahedronGeometry(.32,0);
    const count=node.resource==="Rare crystals"?3:2;
    for(let i=0;i<count;i++){
      const crystal=new THREE.Mesh(crystalGeometry,material(color,.72));
      crystal.position.set((i-(count-1)/2)*.22,.28+(i%2)*.12,(i%2?-.12:.12));
      crystal.scale.set(.72,1.1,.72);crystal.rotation.y=i*.8;crystal.userData.resourceNodeId=node.id;group.add(crystal);
    }
    if(node.operational&&!node.depleted){
      const rig=new THREE.Mesh(new THREE.BoxGeometry(.48,.34,.42),material(0x596a70,.9));
      rig.position.set(0,.18,0);group.add(rig);
      const mast=new THREE.Mesh(new THREE.CylinderGeometry(.035,.05,.62,7),material(0xd7c08b,.7));
      mast.position.set(.28,.42,0);group.add(mast);
    }
    resourceGroup.add(group);
  }
  function makeBuilding(type,index,total,position,territoryId="home"){
    const angle=index*2.399963,ring=2.7+Math.floor(index/9)*1.7;
    const x=position?.x??Math.cos(angle)*ring,z=position?.z??Math.sin(angle)*ring;
    const g=new THREE.Group();g.position.set(x,heightAtWorld(x,z,territoryId),z);
    const palette={farm:0x9b865f,mine:0x697783,workshop:0x8b7866,factory:0x697985,transport:0x929b9b,market:0x9b8668,academy:0x777f93,power:0x718e96,housing:0x9c9a8b};
    const color=palette[type]||0x8c989d;
    const floors=type==="factory"?4:type==="academy"?5:type==="housing"?4:type==="market"?3:type==="transport"?3:2;
    const w=type==="factory"?1.35:type==="farm"?1.6:.9,depth=type==="farm"?1.45:.9,height=floors*.42;
    const base=new THREE.Mesh(new THREE.BoxGeometry(w,height,depth),new THREE.MeshStandardMaterial({color,roughness:.76,metalness:.12}));base.position.y=height/2;base.castShadow=true;base.receiveShadow=true;g.add(base);
    if(type==="farm"){
      const roof=new THREE.Mesh(new THREE.BoxGeometry(w+.12,.14,depth+.12),material(0x59483c));roof.position.y=height+.06;g.add(roof);
      for(let row=0;row<4;row++){const crop=new THREE.Mesh(new THREE.BoxGeometry(1.3,.035,.08),material(0x527344));crop.position.set(0,.08,(row-1.5)*.28);g.add(crop);}
    }else{
      const windowMat=new THREE.MeshStandardMaterial({color:0x9eb8bb,emissive:0x314c54,emissiveIntensity:.22,metalness:.35,roughness:.28});
      for(let floor=0;floor<floors;floor++)for(let col=0;col<3;col++)for(const side of [-1,1]){
        const win=new THREE.Mesh(new THREE.BoxGeometry(.16,.17,.025),windowMat);win.position.set((col-1)*w*.29,height-(floor+.55)*.42,side*(depth/2+.014));g.add(win);
      }
      const roof=new THREE.Mesh(new THREE.BoxGeometry(w+.1,.12,depth+.1),material(0x414e59,.72));roof.position.y=height+.06;g.add(roof);
      const rooftop=new THREE.Mesh(new THREE.BoxGeometry(w*.38,.18,depth*.38),material(color));rooftop.position.set(0,height+.2,0);g.add(rooftop);
    }
    if(type==="factory"){
      for(let k=0;k<2;k++){const stack=new THREE.Mesh(new THREE.CylinderGeometry(.09,.13,.85,10),material(0x555f68));stack.position.set(.3+k*.38,height+.48,0);stack.castShadow=true;g.add(stack);}
    }
    if(type==="power"){
      const mast=new THREE.Mesh(new THREE.CylinderGeometry(.025,.045,2.2,8),material(0xb7c2c5));mast.position.set(.55,height+.95,0);g.add(mast);
      for(let k=-1;k<=1;k++){const arm=new THREE.Mesh(new THREE.BoxGeometry(.85,.045,.05),material(0xb7c2c5));arm.position.set(.55,height+1.65+k*.2,0);g.add(arm);}
    }
    if(type==="transport"){
      const canopy=new THREE.Mesh(new THREE.BoxGeometry(1.2,.1,1.05),material(0x4d6675));canopy.position.y=height+.25;g.add(canopy);
      for(let k=0;k<3;k++){const pillar=new THREE.Mesh(new THREE.CylinderGeometry(.035,.035,.5,8),material(0xc0c5c2));pillar.position.set((k-1)*.42,height,0);g.add(pillar);}
    }
    if(type!=="farm"&&type!=="transport"){
      const door=new THREE.Mesh(new THREE.BoxGeometry(.22,.34,.045),material(type==="market"?0x725039:0x394b57));
      door.position.set(0,.17,depth/2+.025);g.add(door);
      const canopy=new THREE.Mesh(new THREE.BoxGeometry(.42,.055,.18),material(type==="market"?0xd3a65f:0x536b79));
      canopy.position.set(0,.39,depth/2+.06);g.add(canopy);
    }
    if(["factory","academy","market","housing"].includes(type)){
      const panelMat=new THREE.MeshStandardMaterial({color:0x294d68,metalness:.62,roughness:.28,emissive:0x102c42,emissiveIntensity:.24});
      const panelFrame=material(0x9ba9ad,.7);
      for(let k=0;k<2;k++){
        const panel=new THREE.Mesh(new THREE.BoxGeometry(w*.34,.045,depth*.32),panelMat);
        panel.position.set((k-.5)*w*.42,height+.18,0);panel.rotation.x=-.12;g.add(panel);
        const frame=new THREE.Mesh(new THREE.BoxGeometry(w*.36,.035,depth*.34),panelFrame);
        frame.position.set((k-.5)*w*.42,height+.145,0);frame.rotation.x=-.12;g.add(frame);
      }
    }
    if(type==="market"){
      const sign=new THREE.Mesh(new THREE.BoxGeometry(.62,.18,.055),material(0xe1bd72));
      sign.position.set(0,height*.72,depth/2+.055);g.add(sign);
    }
    buildingGroup.add(g);
  }
  function clearGroup(group){while(group.children.length){const obj=group.children.pop();obj.traverse?.(o=>{o.geometry?.dispose();if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());else o.material?.dispose();});}}
  const TERRITORY_COLORS={player:0xe5bd62,aurelia:0x69a9c8,northreach:0x9a8b79,meridian:0x71b98d,solenne:0xd6a96c,ironmarch:0xb87972,duneward:0xc18c5b,unclaimed:0x6ed2bd};
  function fitWorldView(){
    if(!camera||!controls)return;
    const aspect=Math.max(.5,host.clientWidth/Math.max(1,host.clientHeight));
    const halfExtent=30.5,fov=camera.fov*Math.PI/180;
    const distance=halfExtent/(Math.tan(fov/2)*Math.min(1,aspect))*1.08;
    camera.position.set(0,distance*.6,distance*.8);
    controls.target.set(0,0,0);
    controls.maxDistance=Math.max(140,distance*1.8);
    controls.update();
  }
  function makeTerritoryIsland(territory){
    const group=new THREE.Group();group.userData.territoryId=territory.id;
    const n=48,extent=territory.radius+1.05,verts=[],indices=[],colors=[];
    for(let iz=0;iz<=n;iz++)for(let ix=0;ix<=n;ix++){
      const lx=(ix/n-.5)*extent*2,lz=(iz/n-.5)*extent*2;
      const wx=territory.x+lx,wz=territory.z+lz,y=islandHeightAt(wx,wz,territory);
      verts.push(lx,y,lz);
      const color=new THREE.Color(y>.52?0x777e72:y>.12?0x587c55:Math.hypot(lx,lz)>territory.radius-.7?0xa99d78:0x52764e);
      colors.push(color.r,color.g,color.b);
      if(ix<n&&iz<n){const a=iz*(n+1)+ix,b=a+1,c=a+n+1,d=c+1;indices.push(a,c,b,b,c,d);}
    }
    const geo=new THREE.BufferGeometry();geo.setAttribute("position",new THREE.Float32BufferAttribute(verts,3));geo.setAttribute("color",new THREE.Float32BufferAttribute(colors,3));geo.setIndex(indices);geo.computeVertexNormals();
    const terrain=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.96,flatShading:false}));
    terrain.userData.territoryTerrain=true;terrain.position.set(territory.x,0,territory.z);terrain.receiveShadow=true;terrain.castShadow=true;group.add(terrain);
    const beach=new THREE.Mesh(new THREE.CircleGeometry(territory.radius+.28,56),material(0xb8b080));
    beach.rotation.x=-Math.PI/2;beach.position.set(territory.x,-.22,territory.z);group.add(beach);
    const ownerColor=TERRITORY_COLORS[territory.owner]||0x8da0ad;
    const border=new THREE.Mesh(new THREE.TorusGeometry(territory.radius+.34,.105,8,64),new THREE.MeshStandardMaterial({color:ownerColor,emissive:ownerColor,emissiveIntensity:.18,roughness:.65}));
    border.rotation.x=-Math.PI/2;border.position.set(territory.x,-.08,territory.z);group.add(border);
    const flag=new THREE.Group();flag.position.set(territory.x,islandHeightAt(territory.x,territory.z,territory)+.1,territory.z);
    const pole=new THREE.Mesh(new THREE.CylinderGeometry(.045,.065,2.05,8),material(0xd7d9d3,.65));pole.position.y=1.02;flag.add(pole);
    const cloth=new THREE.Mesh(new THREE.BoxGeometry(.78,.43,.055),new THREE.MeshStandardMaterial({color:ownerColor,roughness:.75,side:THREE.DoubleSide}));
    cloth.position.set(.4,1.72,0);flag.add(cloth);
    const beacon=new THREE.Mesh(new THREE.SphereGeometry(.13,10,8),new THREE.MeshStandardMaterial({color:ownerColor,emissive:ownerColor,emissiveIntensity:.7}));
    beacon.position.y=2.16;flag.add(beacon);group.add(flag);
    territoryGroup.add(group);
  }
  function syncTerritories(territories){
    if(!territoryGroup||!Array.isArray(territories))return;
    const signature=territories.map(t=>[t.id,t.owner,t.x,t.z,t.radius,t.phase].join(":")).join("|");
    if(signature===territorySignature)return;
    clearGroup(territoryGroup);territorySignature=signature;
    territories.filter(t=>t.id!=="home").forEach(makeTerritoryIsland);
    if(!worldFitted){fitWorldView();worldFitted=true;}
  }
  function makeDistrict(d){
    const surface=(x,z)=>heightAtWorld(x,z,d.territoryId||"home");
    const colors={residential:0x65b9a0,commercial:0xe4bd65,industrial:0x8c9bb3,agricultural:0x8dbb68};
    const color=colors[d.type]||0xffffff;
    const mat=new THREE.MeshBasicMaterial({color,transparent:true,opacity:.19,side:THREE.DoubleSide,depthWrite:false});
    const ring=new THREE.Mesh(new THREE.CircleGeometry(d.radius,48),mat);ring.rotation.x=-Math.PI/2;ring.position.set(d.x,surface(d.x,d.z)+.075,d.z);districtGroup.add(ring);
    const edge=new THREE.Mesh(new THREE.RingGeometry(d.radius-.055,d.radius,48),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.8,side:THREE.DoubleSide}));edge.rotation.x=-Math.PI/2;edge.position.set(d.x,surface(d.x,d.z)+.09,d.z);districtGroup.add(edge);
    const detail=new THREE.Group();detail.position.set(d.x,surface(d.x,d.z)+.1,d.z);districtGroup.add(detail);
    const addBox=(x,z,w,h,depth,tint,roof=true)=>{const b=new THREE.Mesh(new THREE.BoxGeometry(w,h,depth),material(tint));b.position.set(x,h/2,z);detail.add(b);if(roof){const r=new THREE.Mesh(new THREE.ConeGeometry(Math.max(w,depth)*.72,.28,4),material(0x43596a));r.position.set(x,h+.12,z);r.rotation.y=Math.PI/4;detail.add(r);}};
    if(d.type==="residential"){
      [[-.8,-.65],[.75,-.55],[0,.8]].forEach((p,i)=>addBox(p[0],p[1],.58,.62+(i%2)*.12,.58,0xd8c6a6));
      const tree=new THREE.Mesh(new THREE.SphereGeometry(.3,7,6),material(0x56865c));tree.position.set(1.05,.42,.95);detail.add(tree);
    }else if(d.type==="commercial"){
      [[-.72,-.45],[.65,-.4],[0,.72]].forEach((p,i)=>{const h=1.15+i*.38;const tower=new THREE.Mesh(new THREE.BoxGeometry(.62,h,.62),material(i===1?0xc6d4d8:0xb7a16e));tower.position.set(p[0],h/2,p[1]);detail.add(tower);});
    }else if(d.type==="industrial"){
      addBox(-.45,0,1.05,.72,.85,0x718394,false);
      for(let i=0;i<2;i++){const stack=new THREE.Mesh(new THREE.CylinderGeometry(.1,.13,.95,7),material(0x555f68));stack.position.set(.25+i*.35,.95,-.12);detail.add(stack);}
    }else if(d.type==="agricultural"){
      for(let row=0;row<4;row++){const crop=new THREE.Mesh(new THREE.BoxGeometry(1.55,.045,.12),material(0x668f4e));crop.position.set(0,.08,(row-1.5)*.36);detail.add(crop);}
      const barn=new THREE.Mesh(new THREE.BoxGeometry(.55,.48,.5),material(0x9a6547));barn.position.set(.82,.24,.72);detail.add(barn);
      const roof=new THREE.Mesh(new THREE.ConeGeometry(.48,.3,4),material(0x704a38));roof.position.set(.82,.62,.72);roof.rotation.y=Math.PI/4;detail.add(roof);
    }
  }
  function makeStreetLamp(x,z,territoryId="home"){
    const lamp=new THREE.Group();lamp.position.set(x,heightAtWorld(x,z,territoryId),z);
    const metal=material(0x53616a,.58),glow=new THREE.MeshStandardMaterial({color:0xffe6a6,emissive:0xffc96b,emissiveIntensity:1.35,roughness:.3});
    const pole=new THREE.Mesh(new THREE.CylinderGeometry(.035,.055,1.18,8),metal);pole.position.y=.59;pole.castShadow=true;lamp.add(pole);
    const arm=new THREE.Mesh(new THREE.BoxGeometry(.34,.045,.055),metal);arm.position.set(.14,1.12,0);lamp.add(arm);
    const bulb=new THREE.Mesh(new THREE.SphereGeometry(.105,10,8),glow);bulb.position.set(.29,1.08,0);lamp.add(bulb);
    const shade=new THREE.Mesh(new THREE.ConeGeometry(.16,.12,10),metal);shade.position.set(.29,1.17,0);lamp.add(shade);
    playerRoadGroup.add(lamp);
  }
  function makePlayerRoad(a,b,territoryId="home"){
    const dx=b.x-a.x,dz=b.z-a.z,length=Math.hypot(dx,dz);
    const curve=new THREE.LineCurve3(new THREE.Vector3(a.x,heightAtWorld(a.x,a.z,territoryId)+.06,a.z),new THREE.Vector3(b.x,heightAtWorld(b.x,b.z,territoryId)+.06,b.z));
    const mesh=new THREE.Mesh(new THREE.TubeGeometry(curve,24,.09,6,false),material(0xd7c39b));playerRoadGroup.add(mesh);
    if(length>3){const nx=-dz/length,nz=dx/length;for(const t of [.25,.75])for(const side of [-1,1])makeStreetLamp(a.x+dx*t+nx*side*.48,a.z+dz*t+nz*side*.48,territoryId);}
  }
  function makeTrafficVehicle(a,b,index){
    const car=new THREE.Group();
    const body=new THREE.Mesh(new THREE.BoxGeometry(.48,.22,.78),material(index%2?0x3d6478:0xb65d48));body.position.y=.2;car.add(body);
    const cabin=new THREE.Mesh(new THREE.BoxGeometry(.34,.2,.34),material(0xb9d0d5));cabin.position.set(0,.39,-.04);car.add(cabin);
    const wheelMat=material(0x263039);
    for(const x of [-.25,.25])for(const z of [-.24,.24]){const wheel=new THREE.Mesh(new THREE.CylinderGeometry(.075,.075,.055,8),wheelMat);wheel.rotation.z=Math.PI/2;wheel.position.set(x,.105,z);car.add(wheel);}
    const headlight=new THREE.MeshStandardMaterial({color:0xfff1c7,emissive:0xffd98a,emissiveIntensity:1.1,roughness:.3});
    const taillight=new THREE.MeshStandardMaterial({color:0x9f2828,emissive:0xff2020,emissiveIntensity:.65,roughness:.35});
    for(const x of [-.16,.16]){
      const front=new THREE.Mesh(new THREE.BoxGeometry(.09,.065,.025),headlight);front.position.set(x,.25,.397);car.add(front);
      const rear=new THREE.Mesh(new THREE.BoxGeometry(.09,.065,.025),taillight);rear.position.set(x,.25,-.397);car.add(rear);
    }
    trafficGroup.add(car);trafficVehicles.push({mesh:car,a,b,phase:index*.47,speed:.055+(index%3)*.012});
  }
  function makeRoad(points){
    const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(p[0],heightAt(p[0],p[1])+.035,p[1])));
    const mesh=new THREE.Mesh(new THREE.TubeGeometry(curve,100,.075,5,false),material(0xb9a88c));roadGroup.add(mesh);
  }
  function createCitizenAvatar(index,citizen){
    const person=new THREE.Group();
    const role=String(citizen?.role||"citizen");
    const palette={farmer:0x6f8954,builder:0xb77a43,engineer:0x547f9d,merchant:0x98734e,researcher:0x766b9d,medic:0x4c9b91,courier:0xc18d42,artisan:0x9a657d};
    const coat=material(palette[role]||[0x9c684e,0x435c72,0xc0b18f][index%3],.82);
    const torso=new THREE.Mesh(new THREE.CylinderGeometry(.12,.16,.42,8),coat);torso.position.y=.46;person.add(torso);
    const head=new THREE.Mesh(new THREE.SphereGeometry(.085,10,8),material(0xc89d7b));head.position.y=.72;person.add(head);
    const limbs=[];
    for(const side of [-1,1]){
      const arm=new THREE.Mesh(new THREE.CylinderGeometry(.035,.045,.25,7),coat);arm.position.set(side*.13,.48,0);person.add(arm);
      const leg=new THREE.Mesh(new THREE.CylinderGeometry(.045,.055,.24,7),material(0x34414c));leg.position.set(side*.055,.19,0);person.add(leg);
      limbs.push({arm,leg,side});
    }
    person.userData.limbs=limbs;
    syncCitizenAvatar(person,index,citizen);
    return person;
  }
  function syncCitizenAvatar(person,index,citizen){
    const role=String(citizen?.role||"citizen");
    person.userData.citizenId=citizen?.id||"citizen-"+(index+1);
    person.userData.citizenName=citizen?.name||"Resident "+(index+1);
    person.userData.role=role;
    person.userData.activity=String(citizen?.activity||"walking");
    person.userData.mood=Number(citizen?.mood)||0;
    person.userData.phase=index*.53;
    person.userData.radius=2.6+(index%5)*.36;
    person.userData.walkFactor=/rest|study|care|seek/i.test(person.userData.activity)?.35:1;
  }
  function syncCitizenPopulation(citizens){
    if(!peopleGroup)return;
    const residents=Array.isArray(citizens)?citizens.slice(0,48):[];
    while(peopleGroup.children.length>residents.length){
      const avatar=peopleGroup.children[peopleGroup.children.length-1];
      peopleGroup.remove(avatar);
      avatar.traverse(node=>{node.geometry?.dispose();if(Array.isArray(node.material))node.material.forEach(m=>m.dispose());else node.material?.dispose();});
    }
    while(peopleGroup.children.length<residents.length){
      const i=peopleGroup.children.length;
      peopleGroup.add(createCitizenAvatar(i,residents[i]));
    }
    residents.forEach((citizen,i)=>syncCitizenAvatar(peopleGroup.children[i],i,citizen));
  }

  function createHarbor(){
    harborGroup=new THREE.Group();scene.add(harborGroup);
    const timber=material(0x76583d),metal=material(0x56636a,.55);
    const dockY=heightAt(8.2,8.2)+.02;
    const dock=new THREE.Mesh(new THREE.BoxGeometry(.72,.2,6.2),timber);dock.position.set(8.2,dockY,8.2);dock.rotation.y=.75;dock.castShadow=true;harborGroup.add(dock);
    for(let i=0;i<13;i++){const plank=new THREE.Mesh(new THREE.BoxGeometry(.76,.035,.075),material(i%2?0x9a7650:0x806044));plank.position.set(8.2,dockY+.12,5.35+i*.47);plank.rotation.y=.75;harborGroup.add(plank);}
    for(const side of [-1,1])for(let z=0;z<4;z++){const post=new THREE.Mesh(new THREE.CylinderGeometry(.09,.12,.9,8),timber);post.position.set(8.2+side*.38,dockY-.18,5.5+z*1.65);harborGroup.add(post);}
    for(const side of [-1,1]){const bollard=new THREE.Mesh(new THREE.CylinderGeometry(.07,.08,.28,8),metal);bollard.position.set(8.2+side*.23,dockY+.3,5.35);harborGroup.add(bollard);}
    const warehouse=new THREE.Group();const walls=new THREE.Mesh(new THREE.BoxGeometry(2.1,1.25,1.55),material(0xb8aa8b));walls.position.set(6.6,heightAt(6.6,7.5)+.68,7.5);warehouse.add(walls);const roof=new THREE.Mesh(new THREE.BoxGeometry(2.3,.18,1.75),material(0x53636b));roof.position.set(6.6,heightAt(6.6,7.5)+1.38,7.5);warehouse.add(roof);harborGroup.add(warehouse);
    const crane=new THREE.Group(),cranePaint=material(0xd5a43e,.58),darkMetal=material(0x414d53,.5);
    const cx=5.25,cz=9.45,cy=heightAt(cx,cz);
    for(const x of [-.62,.62]){const leg=new THREE.Mesh(new THREE.BoxGeometry(.16,2.65,.18),cranePaint);leg.position.set(x,1.32,0);crane.add(leg);const foot=new THREE.Mesh(new THREE.BoxGeometry(.42,.16,.48),darkMetal);foot.position.set(x,.08,0);crane.add(foot);}
    const crossbar=new THREE.Mesh(new THREE.BoxGeometry(1.5,.18,.2),cranePaint);crossbar.position.y=2.55;crane.add(crossbar);
    const boom=new THREE.Mesh(new THREE.BoxGeometry(.22,.2,3.5),cranePaint);boom.position.set(0,2.9,1.55);crane.add(boom);
    const counter=new THREE.Mesh(new THREE.BoxGeometry(.52,.42,.58),darkMetal);counter.position.set(0,2.65,-.5);crane.add(counter);
    const trolley=new THREE.Mesh(new THREE.BoxGeometry(.38,.2,.42),darkMetal);trolley.position.set(0,2.72,1.55);crane.add(trolley);
    const cable=new THREE.Mesh(new THREE.CylinderGeometry(.025,.025,.9,6),darkMetal);cable.position.set(0,2.15,1.55);crane.add(cable);
    const hook=new THREE.Mesh(new THREE.TorusGeometry(.12,.025,6,12,Math.PI*1.5),darkMetal);hook.position.set(0,1.67,1.55);hook.rotation.x=Math.PI/2;crane.add(hook);
    crane.position.set(cx,cy,cz);crane.rotation.y=-.72;crane.traverse(o=>{if(o.isMesh)o.castShadow=true;});harborGroup.add(crane);
    const cargoColors=[0x426e83,0xb45c43,0x597b62,0xc29a50];
    for(let i=0;i<4;i++){const container=new THREE.Group();const body=new THREE.Mesh(new THREE.BoxGeometry(.72,.58,1.28),material(cargoColors[i],.72));body.castShadow=true;container.add(body);for(let rib=-2;rib<=2;rib++){const bar=new THREE.Mesh(new THREE.BoxGeometry(.025,.52,1.3),material(0x26343a,.8));bar.position.x=rib*.13;container.add(bar);}container.position.set(5.15+(i%2)*.82,cy+.31,7.45+Math.floor(i/2)*1.42);container.rotation.y=-.72;harborGroup.add(container);}
    for(const [lx,lz] of [[7.25,6.25],[9.05,9.35]]){const lamp=new THREE.Group();const pole=new THREE.Mesh(new THREE.CylinderGeometry(.045,.065,1.9,8),darkMetal);pole.position.y=.95;lamp.add(pole);const arm=new THREE.Mesh(new THREE.BoxGeometry(.55,.055,.055),darkMetal);arm.position.set(.22,1.83,0);lamp.add(arm);const glow=new THREE.Mesh(new THREE.SphereGeometry(.13,10,8),new THREE.MeshStandardMaterial({color:0xffe3a0,emissive:0xffc45a,emissiveIntensity:1.7}));glow.position.set(.46,1.76,0);lamp.add(glow);lamp.position.set(lx,heightAt(lx,lz),lz);harborGroup.add(lamp);}
    cargoShip=new THREE.Group();
    const hull=new THREE.Mesh(new THREE.BoxGeometry(1.05,.48,2.9),material(0x263f50,.48));hull.position.y=.02;cargoShip.add(hull);
    const bow=new THREE.Mesh(new THREE.ConeGeometry(.56,.85,4),material(0x314f60));bow.rotation.x=Math.PI/2;bow.position.set(0,.02,1.72);cargoShip.add(bow);
    const deck=new THREE.Mesh(new THREE.BoxGeometry(.94,.12,2.55),material(0x9a7650));deck.position.y=.29;cargoShip.add(deck);
    for(let row=0;row<2;row++)for(let col=0;col<2;col++){const box=new THREE.Mesh(new THREE.BoxGeometry(.39,.48,.72),material([0xb45c43,0x426e83,0xc29a50,0x597b62][row*2+col]));box.position.set(col?.23:-.23,.57,row?.48:-.38);cargoShip.add(box);}
    const bridge=new THREE.Mesh(new THREE.BoxGeometry(.52,.62,.48),material(0xd9d5c6));bridge.position.set(0,.66,-1.02);cargoShip.add(bridge);
    const windows=new THREE.Mesh(new THREE.BoxGeometry(.4,.16,.025),new THREE.MeshStandardMaterial({color:0x8fc5d2,emissive:0x315765,emissiveIntensity:.35}));windows.position.set(0,.82,-.77);cargoShip.add(windows);
    const mast=new THREE.Mesh(new THREE.CylinderGeometry(.025,.035,.8,6),metal);mast.position.set(.22,1.05,-.92);cargoShip.add(mast);
    cargoShip.position.set(12.1,-.13,12.4);cargoShip.rotation.y=.75;harborGroup.add(cargoShip);
  }

  function createCoastalLighthouse(){
    const tower=new THREE.Group(),stone=material(0xe5dfc9),red=material(0xb95748),dark=material(0x394b55,.55);
    const x=-9.8,z=-7.4,base=heightAt(x,z);
    const footing=new THREE.Mesh(new THREE.CylinderGeometry(.78,.9,.32,20),dark);footing.position.y=.16;tower.add(footing);
    const shaft=new THREE.Mesh(new THREE.CylinderGeometry(.42,.66,3.65,20),stone);shaft.position.y=2.05;shaft.castShadow=true;tower.add(shaft);
    for(const y of [.95,2.05,3.12]){const stripe=new THREE.Mesh(new THREE.CylinderGeometry(.55-(y-1)*.08,.62-(y-1)*.08,.24,20),red);stripe.position.y=y;tower.add(stripe);}
    const balcony=new THREE.Mesh(new THREE.CylinderGeometry(.72,.72,.13,24),dark);balcony.position.y=3.85;tower.add(balcony);
    const rail=new THREE.Mesh(new THREE.TorusGeometry(.68,.035,6,24),dark);rail.rotation.x=Math.PI/2;rail.position.y=4.02;tower.add(rail);
    for(let i=0;i<12;i++){const post=new THREE.Mesh(new THREE.CylinderGeometry(.025,.025,.34,6),dark);const a=i*Math.PI/6;post.position.set(Math.cos(a)*.68,3.99,Math.sin(a)*.68);tower.add(post);}
    const lantern=new THREE.Mesh(new THREE.CylinderGeometry(.38,.42,.62,12),new THREE.MeshStandardMaterial({color:0x9dcbd0,emissive:0x427e88,emissiveIntensity:.5,metalness:.25,roughness:.22,transparent:true,opacity:.78}));lantern.position.y=4.38;tower.add(lantern);
    const cap=new THREE.Mesh(new THREE.ConeGeometry(.48,.48,12),red);cap.position.y=4.93;tower.add(cap);
    const beacon=new THREE.Group();beacon.position.y=4.38;
    const lamp=new THREE.Mesh(new THREE.SphereGeometry(.15,12,10),new THREE.MeshStandardMaterial({color:0xffefb2,emissive:0xffd15a,emissiveIntensity:3}));beacon.add(lamp);
    const beam=new THREE.Mesh(new THREE.ConeGeometry(.28,5.8,16,1,true),new THREE.MeshBasicMaterial({color:0xffe8a3,transparent:true,opacity:.19,depthWrite:false,side:THREE.DoubleSide}));beam.rotation.x=-Math.PI/2;beam.position.z=2.9;beacon.add(beam);
    const glow=new THREE.PointLight(0xffd77a,2.2,10);glow.position.set(0,0,.35);beacon.add(glow);
    tower.add(beacon);lighthouseBeacon=beacon;tower.position.set(x,base,z);tower.traverse(o=>{if(o.isMesh)o.castShadow=true;});scene.add(tower);
  }

  function createWindFarm(){
    windFarmGroup=new THREE.Group();
    const concrete=material(0x8a918f),steel=material(0xd9dedb,.48),dark=material(0x53636a,.58),bladeMat=material(0xf0f1e9,.5);
    const sites=[[-5.2,-9.1],[-1.4,-10.2],[2.5,-9.5]];
    sites.forEach(([x,z],index)=>{
      const turbine=new THREE.Group(),base=heightAt(x,z);
      const pad=new THREE.Mesh(new THREE.CylinderGeometry(.72,.8,.16,20),concrete);pad.position.y=.08;turbine.add(pad);
      const tower=new THREE.Mesh(new THREE.CylinderGeometry(.13,.25,3.55,12),steel);tower.position.y=1.86;tower.castShadow=true;turbine.add(tower);
      const nacelle=new THREE.Mesh(new THREE.BoxGeometry(.42,.34,.78),dark);nacelle.position.set(0,3.7,.08);nacelle.castShadow=true;turbine.add(nacelle);
      const rotor=new THREE.Group();rotor.position.set(0,3.7,.49);
      rotor.add(new THREE.Mesh(new THREE.SphereGeometry(.19,12,10),steel));
      for(let blade=0;blade<3;blade++){const arm=new THREE.Group();arm.rotation.z=blade*Math.PI*2/3;const vane=new THREE.Mesh(new THREE.BoxGeometry(.105,1.62,.07),bladeMat);vane.position.y=.91;vane.castShadow=true;arm.add(vane);const tip=new THREE.Mesh(new THREE.SphereGeometry(.075,8,6),bladeMat);tip.position.y=1.72;arm.add(tip);rotor.add(arm);}
      turbine.add(rotor);turbine.position.set(x,base,z);windFarmGroup.add(turbine);windTurbineRotors.push({rotor,phase:index*.65,speed:.62+index*.08});
    });
    const sign=new THREE.Group(),post=new THREE.Mesh(new THREE.BoxGeometry(.09,.85,.09),dark);post.position.y=.42;sign.add(post);
    const panel=new THREE.Mesh(new THREE.BoxGeometry(1.15,.42,.08),material(0x28566a));panel.position.y=.88;sign.add(panel);
    const label=new THREE.Mesh(new THREE.BoxGeometry(.82,.07,.02),material(0x9de1d1));label.position.set(0,.91,.052);sign.add(label);
    sign.position.set(4.7,heightAt(4.7,-8.7),-8.7);windFarmGroup.add(sign);scene.add(windFarmGroup);
  }

  function createSolarFarm(){
    solarFarmGroup=new THREE.Group();
    const frameMat=material(0x66757a,.52),panelMat=new THREE.MeshPhysicalMaterial({color:0x163d59,metalness:.62,roughness:.24}),silver=material(0xc4ccd0,.42),cabinetMat=material(0x87979a,.68);
    for(let row=0;row<3;row++)for(let col=0;col<4;col++){
      const x=6.0+col*1.12,z=-6.7+row*1.12,base=heightAt(x,z),rack=new THREE.Group();
      const legA=new THREE.Mesh(new THREE.CylinderGeometry(.035,.045,.72,7),frameMat);legA.position.set(-.43,.36,.18);rack.add(legA);
      const legB=new THREE.Mesh(new THREE.CylinderGeometry(.035,.045,.48,7),frameMat);legB.position.set(.43,.24,-.18);rack.add(legB);
      const panel=new THREE.Mesh(new THREE.BoxGeometry(1.02,.055,.78),panelMat);panel.position.y=.72;panel.rotation.x=-.36;panel.castShadow=true;rack.add(panel);
      for(let line=1;line<4;line++){const grid=new THREE.Mesh(new THREE.BoxGeometry(.012,.008,.75),silver);grid.position.set(-.38+line*.19,.758,.0);grid.rotation.x=-.36;rack.add(grid);}
      const rail=new THREE.Mesh(new THREE.BoxGeometry(1.1,.055,.055),silver);rail.position.set(0,.54,.19);rack.add(rail);
      rack.position.set(x,base,z);solarFarmGroup.add(rack);solarTrackers.push({rack,phase:row*.3+col*.12});
    }
    const station=new THREE.Group(),foundation=new THREE.Mesh(new THREE.BoxGeometry(1.75,.18,1.2),material(0x777f7d));foundation.position.y=.09;station.add(foundation);
    const cabinet=new THREE.Mesh(new THREE.BoxGeometry(1.25,1.1,.78),cabinetMat);cabinet.position.y=.72;cabinet.castShadow=true;station.add(cabinet);
    for(let side=-1;side<=1;side+=2){const vent=new THREE.Mesh(new THREE.BoxGeometry(.08,.58,.045),frameMat);vent.position.set(side*.64,.72,.1);station.add(vent);}
    const roof=new THREE.Mesh(new THREE.BoxGeometry(1.38,.09,.9),silver);roof.position.y=1.31;station.add(roof);
    const statusLight=new THREE.Mesh(new THREE.SphereGeometry(.07,8,8),new THREE.MeshStandardMaterial({color:0x73f0b0,emissive:0x2ab879,emissiveIntensity:1.8}));statusLight.position.set(0,1.05,.42);station.add(statusLight);
    station.position.set(10.2,heightAt(10.2,-4.7),-4.7);solarFarmGroup.add(station);
    const pole=new THREE.Group(),mast=new THREE.Mesh(new THREE.CylinderGeometry(.055,.08,2.25,8),silver);mast.position.y=1.12;pole.add(mast);
    for(let i=-1;i<=1;i++){const insulator=new THREE.Mesh(new THREE.CylinderGeometry(.045,.045,.3,8),material(0x4d7180));insulator.rotation.z=Math.PI/2;insulator.position.set(i*.23,2.18,0);pole.add(insulator);}
    pole.position.set(9.4,heightAt(9.4,-6.3),-6.3);solarFarmGroup.add(pole);
    scene.add(solarFarmGroup);
  }

  function createPowerNetwork(){
    const cableMat=new THREE.MeshStandardMaterial({color:0x263943,metalness:.42,roughness:.48});
    const insulatorMat=material(0x8eb8c1,.42);
    const pole={x:9.4,z:-6.3,y:heightAt(9.4,-6.3)+2.18};
    const station={x:10.2,z:-4.7,y:heightAt(10.2,-4.7)+1.28};
    const cable=(points,radius=.025)=>{
      const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(p.x,p.y,p.z)));
      const mesh=new THREE.Mesh(new THREE.TubeGeometry(curve,32,radius,7,false),cableMat);
      mesh.castShadow=true;scene.add(mesh);
    };
    const sites=[[-5.2,-9.1],[-1.4,-10.2],[2.5,-9.5]];
    sites.forEach(([x,z],index)=>{
      const y=heightAt(x,z)+3.7;
      const dx=pole.x-x,dz=pole.z-z,length=Math.hypot(dx,dz)||1;
      const ox=-dz/length*.13,oz=dx/length*.13;
      for(let phase=-1;phase<=1;phase++){
        const offset=phase*.13;
        cable([
          {x:x+ox*phase,y:y+offset,z:z+oz*phase},
          {x:x+dx*.48+ox*phase,y:y-.58+offset,z:z+dz*.48+oz*phase},
          {x:pole.x+offset,y:pole.y+.12,z:pole.z}
        ],.018);
      }
      const insulator=new THREE.Mesh(new THREE.SphereGeometry(.095,8,8),insulatorMat);
      insulator.position.set(x,y,z);scene.add(insulator);
    });
    for(let phase=-1;phase<=1;phase++){
      cable([
        {x:pole.x,y:pole.y+phase*.13,z:pole.z},
        {x:9.85,y:pole.y-.28+phase*.13,z:-5.55},
        {x:station.x,y:station.y,z:station.z}
      ],.02);
    }
    const junction=new THREE.Mesh(new THREE.BoxGeometry(.36,.18,.3),material(0x667c80,.52));
    junction.position.set(9.82,heightAt(9.82,-5.45)+.22,-5.45);junction.castShadow=true;scene.add(junction);
  }

  function createScene(){
    scene=new THREE.Scene();scene.background=new THREE.Color(0x9bb8c7);scene.fog=new THREE.FogExp2(0x9bb8c7,.005);
    // Distant stars and a moon make the existing day/night cycle read as a complete sky transition.
    const starVertices=[];
    for(let i=0;i<420;i++){const y=THREE.MathUtils.randFloatSpread(1),angle=Math.random()*Math.PI*2,r=Math.sqrt(1-y*y),radius=92;starVertices.push(Math.cos(angle)*r*radius,y*radius,Math.sin(angle)*r*radius);}
    const starGeometry=new THREE.BufferGeometry();starGeometry.setAttribute("position",new THREE.Float32BufferAttribute(starVertices,3));
    const starMaterial=new THREE.PointsMaterial({color:0xd9eaff,size:.15,sizeAttenuation:false,transparent:true,opacity:0,fog:false,depthWrite:false});
    starField=new THREE.Points(starGeometry,starMaterial);scene.add(starField);
    const moonMaterial=new THREE.MeshBasicMaterial({color:0xdce8f2,transparent:true,opacity:0,fog:false});
    moonObject=new THREE.Mesh(new THREE.SphereGeometry(2.15,24,18),moonMaterial);moonObject.position.set(38,30,-52);scene.add(moonObject);
    // Procedural aurora curtain, driven by the same day/night cycle.
    const auroraMaterial=new THREE.ShaderMaterial({uniforms:{uTime:{value:0},uDaylight:{value:1}},vertexShader:"varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}",fragmentShader:"uniform float uTime; uniform float uDaylight; varying vec2 vUv;\nvoid main(){\nfloat wave=sin(vUv.x*18.0+uTime*.16)*.10+sin(vUv.x*7.0-uTime*.09)*.13;\nfloat curtain=sin((vUv.y+wave)*19.0+uTime*.22);\nfloat bands=smoothstep(.12,.92,curtain)*smoothstep(0.0,.2,vUv.y)*(1.0-smoothstep(.72,1.0,vUv.y));\nfloat drift=.55+.45*sin(vUv.x*11.0-uTime*.12);\nfloat alpha=bands*drift*pow(1.0-uDaylight,1.8)*.32;\nvec3 aurora=mix(vec3(.08,.82,.67),vec3(.28,.48,1.0),vUv.x);\ngl_FragColor=vec4(aurora,alpha);\n}",transparent:true,depthWrite:false,side:THREE.DoubleSide});
    auroraMesh=new THREE.Mesh(new THREE.PlaneGeometry(76,25),auroraMaterial);auroraMesh.position.set(0,22,-30);scene.add(auroraMesh);
    camera=new THREE.PerspectiveCamera(42,1,.1,250);camera.position.set(17,15,20);
    renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:"high-performance"});renderer.setPixelRatio(Math.min(devicePixelRatio||1,window.innerWidth<760?1.35:1.75));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;
    host.innerHTML="";host.appendChild(renderer.domElement);
    controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.06;controls.maxPolarAngle=Math.PI*.48;controls.minDistance=9;controls.maxDistance=140;controls.target.set(0,0,0);controls.autoRotate=true;controls.autoRotateSpeed=.42;
    scene.add(new THREE.HemisphereLight(0xd9efff,0x465b45,1.45));scene.add(new THREE.AmbientLight(0x9fb7c4,.34));
    sunLight=new THREE.DirectionalLight(0xffe3b5,3.4);sunLight.position.set(-18,28,14);sunLight.castShadow=true;sunLight.shadow.mapSize.set(2048,2048);sunLight.shadow.camera.left=-22;sunLight.shadow.camera.right=22;sunLight.shadow.camera.top=22;sunLight.shadow.camera.bottom=-22;sunLight.shadow.bias=-.00018;sunLight.shadow.normalBias=.025;scene.add(sunLight);
    const waterGeo=new THREE.BufferGeometry(),waterVerts=[],waterIndices=[],waterRings=28,waterSegments=128;
    for(let ring=0;ring<=waterRings;ring++){const radius=42*ring/waterRings;for(let seg=0;seg<=waterSegments;seg++){const angle=seg/waterSegments*Math.PI*2;waterVerts.push(Math.cos(angle)*radius,-.5,Math.sin(angle)*radius);if(ring<waterRings&&seg<waterSegments){const a=ring*(waterSegments+1)+seg,b=a+1,c=a+waterSegments+1,d=c+1;waterIndices.push(a,c,b,b,c,d);}}}
    waterGeo.setAttribute("position",new THREE.Float32BufferAttribute(waterVerts,3));waterGeo.setIndex(waterIndices);waterGeo.computeVertexNormals();
    waterMesh=new THREE.Mesh(waterGeo,new THREE.MeshPhysicalMaterial({color:0x286b80,roughness:.23,metalness:.12,clearcoat:.8,clearcoatRoughness:.16,transparent:true,opacity:.94,side:THREE.DoubleSide}));scene.add(waterMesh);waterPositions=waterMesh.geometry.attributes.position.array.slice();
    landGroup=new THREE.Group();buildingGroup=new THREE.Group();peopleGroup=new THREE.Group();roadGroup=new THREE.Group();playerRoadGroup=new THREE.Group();districtGroup=new THREE.Group();trafficGroup=new THREE.Group();resourceGroup=new THREE.Group();territoryGroup=new THREE.Group();cloudGroup=new THREE.Group();scene.add(landGroup,roadGroup,districtGroup,playerRoadGroup,resourceGroup,territoryGroup,buildingGroup,peopleGroup,trafficGroup,cloudGroup);createHarbor();createCoastalLighthouse();createWindFarm();createSolarFarm();createPowerNetwork();
    const n=176,verts=[],indices=[],colors=[];
    for(let iz=0;iz<=n;iz++)for(let ix=0;ix<=n;ix++){
      const x=(ix/n-.5)*30,z=(iz/n-.5)*30,d=Math.hypot(x,z),y=heightAt(x,z);verts.push(x,y,z);
      const col=new THREE.Color(y>.88?0x777c78:y>.52?0x737e69:y>.1?0x55734f:d>12.5?0x8b9478:d>10.7?0xa49b78:0x53764f);colors.push(col.r,col.g,col.b);
      if(ix<n&&iz<n){const a=iz*(n+1)+ix,b=a+1,c=a+n+1,d2=c+1;indices.push(a,c,b,b,c,d2);}
    }
    const geo=new THREE.BufferGeometry();geo.setAttribute("position",new THREE.Float32BufferAttribute(verts,3));geo.setAttribute("color",new THREE.Float32BufferAttribute(colors,3));geo.setIndex(indices);geo.computeVertexNormals();
    terrainMesh=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.96,metalness:0,flatShading:false}));terrainMesh.receiveShadow=true;terrainMesh.castShadow=true;landGroup.add(terrainMesh);
    const beach=new THREE.Mesh(new THREE.CircleGeometry(15.3,80),material(0xb8b080));beach.rotation.x=-Math.PI/2;beach.position.y=-.22;beach.scale.set(1,1,.98);landGroup.add(beach);
    for(let i=0;i<210;i++){const x=(rand(i,3)-.5)*27,z=(rand(i,8)-.5)*27,d=Math.hypot(x,z);if(d>7.2&&d<13.35&&Math.abs(x)>1.5)makeTree(x,z,.65+rand(i,5)*.75);}
    for(let i=0;i<8;i++){const cloud=new THREE.Group();cloud.position.set((rand(i,91)-.5)*38,8+rand(i,92)*5,(rand(i,93)-.5)*34);for(let j=0;j<5;j++){const puff=new THREE.Mesh(new THREE.SphereGeometry(.75+rand(i,j)*.55,14,10),new THREE.MeshStandardMaterial({color:0xf1f4f2,roughness:1,transparent:true,opacity:.78}));puff.position.set((j-2)*.58,rand(j,i)*.24,Math.sin(j)*.24);puff.scale.y=.42;cloud.add(puff);}cloudGroup.add(cloud);}
    makeRoad([[-13,-2],[-8,-1],[-4,0],[0,0],[5,2],[9,5]]);
    makeRoad([[-3,-12],[-2,-7],[0,-3],[0,0],[1,6],[3,11]]);
    const plaza=new THREE.Mesh(new THREE.CylinderGeometry(2.3,2.3,.12,32),material(0xd6c79e));plaza.position.y=.03;scene.add(plaza);
    const keep=new THREE.Group();const stone=material(0xb8b8ae,.82),roofMat=material(0x475b67,.72),glass= new THREE.MeshStandardMaterial({color:0xa6c3c5,emissive:0x314d50,emissiveIntensity:.3,roughness:.3});
    const podium=new THREE.Mesh(new THREE.BoxGeometry(3.4,.35,3.1),stone);podium.position.y=.18;keep.add(podium);
    const hall=new THREE.Mesh(new THREE.BoxGeometry(2.35,2.25,2.1),stone);hall.position.y=1.42;hall.castShadow=true;keep.add(hall);
    for(const side of [-1,1])for(let floor=0;floor<3;floor++){const win=new THREE.Mesh(new THREE.BoxGeometry(.24,.48,.035),glass);win.position.set(side*.68, .72+floor*.58,1.075);keep.add(win);}
    for(const side of [-1,1]){const wing=new THREE.Mesh(new THREE.BoxGeometry(.62,1.55,1.8),stone);wing.position.set(side*1.48,.95,0);keep.add(wing);}
    const roof=new THREE.Mesh(new THREE.BoxGeometry(2.55,.18,2.3),roofMat);roof.position.y=2.62;keep.add(roof);
    const spire=new THREE.Mesh(new THREE.ConeGeometry(.72,.95,4),material(0x8d4e42));spire.position.y=3.18;spire.rotation.y=Math.PI/4;keep.add(spire);
    keep.position.set(0,.1,0);buildingGroup.add(keep);
    for(let i=0;i<22;i++) peopleGroup.add(createCitizenAvatar(i, null));
    clock=new THREE.Clock();
    raycaster=new THREE.Raycaster();groundPlane=new THREE.Plane(new THREE.Vector3(0,1,0),0);
    previewMarker=new THREE.Mesh(new THREE.RingGeometry(.55,.78,32),new THREE.MeshBasicMaterial({color:0xffd36e,side:THREE.DoubleSide}));previewMarker.rotation.x=-Math.PI/2;previewMarker.visible=false;scene.add(previewMarker);
    renderer.domElement.addEventListener("pointermove",updatePlacementPreview);
    renderer.domElement.addEventListener("pointerdown",event=>{placementPointer={x:event.clientX,y:event.clientY};});
    renderer.domElement.addEventListener("pointerup",event=>{if(placementPointer&&Math.hypot(event.clientX-placementPointer.x,event.clientY-placementPointer.y)<5){if(roadMode)placeRoadPoint(event);else if(districtMode)placeSelectedDistrict(event);else if(selectedBuilding)placeSelectedBuilding(event);else if(!inspectResource(event)&&!inspectTerritory(event))inspectCitizen(event);}placementPointer=null;});
    resizeObserver=new ResizeObserver(resize);resizeObserver.observe(host);resize();
    document.getElementById("world3d-home")?.addEventListener("click",fitWorldView);
    document.getElementById("world3d-rotate")?.addEventListener("click",e=>{autoRotate=!autoRotate;controls.autoRotate=autoRotate;e.currentTarget.setAttribute("aria-pressed",String(autoRotate));e.currentTarget.textContent="Auto-rotate: "+(autoRotate?"on":"off");});
    document.getElementById("world3d-road")?.addEventListener("click",e=>{roadMode=!roadMode;roadStart=null;districtMode=false;selectedDistrict=null;selectedBuilding=null;if(previewMarker)previewMarker.visible=false;e.currentTarget.classList.toggle("selected",roadMode);e.currentTarget.setAttribute("aria-pressed",String(roadMode));e.currentTarget.textContent=roadMode?"Cancel road":"Build road";const hint=document.getElementById("world3d-build-hint");if(hint)hint.textContent=roadMode?"Tap two points on the same player-controlled island to connect them.":"Select a structure or build a road.";if(renderer)renderer.domElement.style.cursor=roadMode?"crosshair":"grab";});
    document.querySelectorAll("[data-world-district]").forEach(button=>button.addEventListener("click",()=>{
      const togglingOff=districtMode&&selectedDistrict===button.dataset.worldDistrict;
      selectedDistrict=togglingOff?null:button.dataset.worldDistrict;districtMode=!togglingOff;
      roadMode=false;roadStart=null;selectedBuilding=null;
      document.getElementById("world3d-road")?.classList.remove("selected");document.getElementById("world3d-road")?.setAttribute("aria-pressed","false");
      const roadButton=document.getElementById("world3d-road");if(roadButton)roadButton.textContent="Build road";
      document.querySelectorAll("[data-world-build]").forEach(b=>b.classList.remove("selected"));
      document.querySelectorAll("[data-world-district]").forEach(b=>b.classList.toggle("selected",districtMode&&b===button));
      const hint=document.getElementById("world3d-build-hint");
      if(hint)hint.textContent=districtMode?"Tap a player-controlled island to place a "+selectedDistrict+" district.":"Select a structure or a world object to inspect.";
      if(renderer)renderer.domElement.style.cursor=districtMode?"crosshair":"grab";
    }));
    animate();
  }
  function inspectCitizen(event){
    if(!renderer||!camera||!peopleGroup||!lastState)return;
    const rect=renderer.domElement.getBoundingClientRect();
    const pointer=new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,-((event.clientY-rect.top)/rect.height)*2+1);
    raycaster.setFromCamera(pointer,camera);
    const hit=raycaster.intersectObjects(peopleGroup.children,true)[0];
    if(!hit)return;
    let avatar=hit.object;
    while(avatar&&avatar.parent!==peopleGroup)avatar=avatar.parent;
    const id=avatar?.userData?.citizenId;
    const citizen=(lastState.citizens||[]).find(c=>c.id===id);
    if(!citizen)return;
    let panel=document.getElementById("world3d-citizen-inspector");
    if(!panel){
      panel=document.createElement("aside");panel.id="world3d-citizen-inspector";panel.className="world3d-citizen-inspector";
      panel.setAttribute("aria-live","polite");host.appendChild(panel);
    }
    const esc=value=>String(value??"").replace(/[&<>"]/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[ch]));
    const needs=citizen.needs||{};
    const bars=Object.entries(needs).map(([key,value])=>'<div class="citizen-need"><span>'+esc(key)+'</span><b>'+Math.max(0,Math.min(100,Number(value)||0))+'%</b><i><em style="width:'+Math.max(0,Math.min(100,Number(value)||0))+'%"></em></i></div>').join("");
    const memories=(citizen.memory||[]).slice(-4).reverse().map(m=>'<li>Turn '+Number(m.turn||0)+': '+esc(m.text)+'</li>').join("")||"<li>No recorded memories yet.</li>";
    panel.innerHTML='<button type="button" class="citizen-inspector-close" aria-label="Close citizen details">×</button><span class="eyebrow">CITIZEN PROFILE · '+esc(citizen.id)+'</span><h3>'+esc(citizen.name)+'</h3><p>'+esc(citizen.role)+' · '+esc(citizen.activity)+'</p><strong class="citizen-mood">'+Math.max(0,Math.min(100,Number(citizen.mood)||0))+'% mood</strong><div class="citizen-needs">'+bars+'</div><h4>Recent memories</h4><ul>'+memories+'</ul>';
    panel.querySelector("button").addEventListener("click",()=>panel.remove());
  }
  function inspectTerritory(event){
    if(!renderer||!camera||!territoryGroup)return false;
    const rect=renderer.domElement.getBoundingClientRect();
    const pointer=new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,-((event.clientY-rect.top)/rect.height)*2+1);
    raycaster.setFromCamera(pointer,camera);
    const hit=raycaster.intersectObjects(territoryGroup.children,true)[0];
    if(!hit)return false;
    let marker=hit.object;
    while(marker&&marker.parent!==territoryGroup)marker=marker.parent;
    const id=marker?.userData?.territoryId;
    if(!id)return false;
    window.dispatchEvent(new CustomEvent("kingmaker:inspect-territory",{detail:{id}}));
    return true;
  }
  function inspectResource(event){
    if(!renderer||!camera||!resourceGroup||!lastState)return false;
    const rect=renderer.domElement.getBoundingClientRect();
    const pointer=new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,-((event.clientY-rect.top)/rect.height)*2+1);
    raycaster.setFromCamera(pointer,camera);
    const hit=raycaster.intersectObjects(resourceGroup.children,true)[0];
    if(!hit)return false;
    let marker=hit.object;
    while(marker&&marker.parent!==resourceGroup)marker=marker.parent;
    const id=marker?.userData?.resourceNodeId;
    if(!id)return false;
    window.dispatchEvent(new CustomEvent("kingmaker:inspect-resource",{detail:{id}}));
    return true;
  }
  function getGroundPoint(event){
    if(!renderer||!camera)return null;
    const rect=renderer.domElement.getBoundingClientRect();
    const pointer=new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,-((event.clientY-rect.top)/rect.height)*2+1);
    raycaster.setFromCamera(pointer,camera);
    const hits=[];
    if(terrainMesh){const homeHit=raycaster.intersectObject(terrainMesh,false)[0];if(homeHit&&Math.hypot(homeHit.point.x,homeHit.point.z)<=13.2)hits.push({...homeHit,territoryId:"home"});}
    if(territoryGroup){
      const remoteHit=raycaster.intersectObjects(territoryGroup.children,true).find(hit=>hit.object.userData.territoryTerrain===true);
      if(remoteHit){
        let island=remoteHit.object;
        while(island&&island.parent!==territoryGroup)island=island.parent;
        const territoryId=island?.userData?.territoryId;
        const territory=lastState?.world?.territories?.find(item=>item.id===territoryId);
        if(territory&&Math.hypot(remoteHit.point.x-territory.x,remoteHit.point.z-territory.z)<=territory.radius-.15)hits.push({...remoteHit,territoryId});
      }
    }
    const hit=hits.sort((a,b)=>a.distance-b.distance)[0];
    return hit?{point:hit.point,territoryId:hit.territoryId}:null;
  }
  function updatePlacementPreview(event){
    if(!selectedBuilding||!renderer)return;
    const target=getGroundPoint(event);
    if(target){previewMarker.position.copy(target.point);previewMarker.position.y+=.045;previewMarker.visible=true;}
    else previewMarker.visible=false;
  }
  function placeSelectedBuilding(event){
    if(!selectedBuilding||event.button!==0)return;
    const target=getGroundPoint(event);if(!target)return;
    window.dispatchEvent(new CustomEvent("kingmaker:place-building",{detail:{type:selectedBuilding,x:target.point.x,z:target.point.z,territoryId:target.territoryId}}));
  }
  function placeSelectedDistrict(event){
    if(!selectedDistrict||event.button!==0)return;
    const target=getGroundPoint(event);if(!target)return;
    window.dispatchEvent(new CustomEvent("kingmaker:place-district",{detail:{type:selectedDistrict,x:Number(target.point.x.toFixed(2)),z:Number(target.point.z.toFixed(2)),radius:2.6,territoryId:target.territoryId}}));
  }
  function placeRoadPoint(event){
    if(event.button!==0)return;
    const target=getGroundPoint(event);if(!target)return;
    const spot={x:Number(target.point.x.toFixed(2)),z:Number(target.point.z.toFixed(2)),territoryId:target.territoryId};
    if(!roadStart){roadStart=spot;const hint=document.getElementById("world3d-build-hint");if(hint)hint.textContent="Start selected. Tap a destination on the same island.";return;}
    if(spot.territoryId!==roadStart.territoryId){roadStart=spot;const hint=document.getElementById("world3d-build-hint");if(hint)hint.textContent="Roads must stay on one island. New start selected.";return;}
    if(Math.hypot(spot.x-roadStart.x,spot.z-roadStart.z)<1){roadStart=spot;return;}
    window.dispatchEvent(new CustomEvent("kingmaker:place-road",{detail:{from:{x:roadStart.x,z:roadStart.z},to:{x:spot.x,z:spot.z},territoryId:spot.territoryId}}));
    roadStart=null;const hint=document.getElementById("world3d-build-hint");if(hint)hint.textContent="Road built. Tap two points to add another segment.";
  }
  function selectBuilding(type){
    selectedBuilding=type&&selectedBuilding!==type?type:null;
    roadMode=false;roadStart=null;districtMode=false;selectedDistrict=null;
    const roadButton=document.getElementById("world3d-road");
    roadButton?.classList.remove("selected");roadButton?.setAttribute("aria-pressed","false");
    if(roadButton)roadButton.textContent="Build road";
    document.querySelectorAll("[data-world-district]").forEach(button=>button.classList.remove("selected"));
    if(previewMarker)previewMarker.visible=false;
    const hint=document.getElementById("world3d-build-hint");
    if(hint)hint.textContent=selectedBuilding?"Tap an open spot on a player-controlled island to build a "+selectedBuilding+".":"Select a structure or a world object to inspect.";
    document.querySelectorAll("[data-world-build]").forEach(button=>button.classList.toggle("selected",button.dataset.worldBuild===selectedBuilding));
    if(renderer)renderer.domElement.style.cursor=selectedBuilding?"crosshair":"grab";
  }
  function resize(){if(!renderer||!host.clientWidth)return;const w=host.clientWidth,h=host.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
  function animate(){
    animationId=requestAnimationFrame(animate);const t=clock.getElapsedTime();controls.update();
    const daylight=THREE.MathUtils.clamp(Math.sin(t*.035)*.5+.5,0,1),nightSky=new THREE.Color(0x101d35),daySky=new THREE.Color(0x9bb8c7);scene.background.lerpColors(nightSky,daySky,daylight);if(auroraMesh){auroraMesh.material.uniforms.uTime.value=t;auroraMesh.material.uniforms.uDaylight.value=daylight;}if(starField)starField.material.opacity=Math.pow(1-daylight,1.7)*.92;if(moonObject)moonObject.material.opacity=Math.pow(1-daylight,1.5)*.88;if(scene.fog)scene.fog.color.copy(scene.background);sunLight.intensity=.22+daylight*3.15;sunLight.position.set(Math.cos(t*.035)*25,Math.max(3,Math.sin(t*.035)*28),14);sunLight.color.setRGB(1,.72+daylight*.2,.52+daylight*.42);
    if(waterMesh){const attr=waterMesh.geometry.attributes.position;for(let i=0;i<attr.count;i++){const x=waterPositions[i*3],z=waterPositions[i*3+2];attr.array[i*3+1]=waterPositions[i*3+1]+Math.sin(x*.32+t*.65)*.055+Math.cos(z*.27-t*.48)*.04;}attr.needsUpdate=true;waterMesh.geometry.computeVertexNormals();}
    cloudGroup.children.forEach((cloud,i)=>{cloud.position.x+=.0012+Math.sin(t*.025+i)*.0005;if(cloud.position.x>24)cloud.position.x=-24;});
    peopleGroup.children.forEach((p,i)=>{const a=t*(.12+.05*p.userData.walkFactor)+p.userData.phase,step=t*(2.1+1.2*p.userData.walkFactor)+p.userData.phase;p.position.x=Math.cos(a)*p.userData.radius;p.position.z=Math.sin(a)*p.userData.radius;p.position.y=heightAt(p.position.x,p.position.z);p.rotation.y=-a;for(const limb of p.userData.limbs){const swing=Math.sin(step)*.42*limb.side;limb.arm.rotation.x=-swing;limb.leg.rotation.x=swing;}});
    trafficVehicles.forEach(v=>{const p=(t*v.speed+v.phase)%1;const x=v.a.x+(v.b.x-v.a.x)*p,z=v.a.z+(v.b.z-v.a.z)*p;v.mesh.position.set(x,heightAt(x,z)+.055,z);v.mesh.rotation.y=Math.atan2(v.b.x-v.a.x,v.b.z-v.a.z);});
    if(cargoShip){cargoShip.position.x=12.1+Math.sin(t*.12)*.42;cargoShip.position.z=12.4+Math.cos(t*.12)*.32;cargoShip.position.y=-.13+Math.sin(t*1.35)*.045;cargoShip.rotation.y=.75+Math.sin(t*.12)*.035;}
    if(lighthouseBeacon)lighthouseBeacon.rotation.y=-t*.42;
    windTurbineRotors.forEach(({rotor,phase,speed})=>{rotor.rotation.z=t*speed+phase;});
    solarTrackers.forEach(({rack,phase})=>{rack.rotation.z=Math.sin(t*.025+phase)*.018;});
    renderer.render(scene,camera);
  }
  function update(state){
    if(!state)return;lastState=state;
    syncCitizenPopulation(state.citizens||[]);
    const total=Object.values(state.buildings||{}).reduce((sum,n)=>sum+(Number(n)||0),0);
    const status=document.getElementById("world3d-status");if(status)status.textContent="TURN "+state.turn+" · "+total+" BUILDING LEVELS";
    const stats=document.getElementById("world3d-stats");
    const residents=Array.isArray(state.citizens)?state.citizens:[];
    const averageMood=residents.length?Math.round(residents.reduce((sum,c)=>sum+(Number(c.mood)||0),0)/residents.length):0;
    const zones=state.world?.placedDistricts||[];const zoneCount=zones.length;const territories=state.world?.territories||[];const unclaimed=territories.filter(t=>t.owner==="unclaimed").length;const deposits=state.world?.resourceNodes||[];const activeSites=deposits.filter(n=>n.operational&&!n.depleted).length;const undevelopedSites=deposits.filter(n=>!n.operational&&!n.depleted).length;const exhaustedSites=deposits.filter(n=>n.depleted).length;if(stats)stats.innerHTML=[["Citizens",state.nation.population],["3D Agents",residents.length+" · "+averageMood+"% mood"],["Infrastructure",total+" levels"],["Districts",zoneCount+" zones"],["Resource sites",activeSites+" active · "+undevelopedSites+" undeveloped"],["Exhausted deposits",exhaustedSites+" · "+deposits.length+" total"],["Traffic",trafficVehicles.length+" vehicles"],["Stability",state.nation.stability+"%"],["Archipelago",territories.length+" islands · "+unclaimed+" unclaimed"]].map(([label,value])=>'<div class="world3d-stat"><b>'+String(value).replace(/[&<>]/g,"") +'</b><small>'+label+'</small></div>').join("");
    syncTerritories(territories);
    if(!buildingGroup)return;
    clearGroup(buildingGroup);clearGroup(playerRoadGroup);clearGroup(districtGroup);clearGroup(trafficGroup);clearGroup(resourceGroup);trafficVehicles.length=0;
    const roads=state.world?.placedRoads||[];roads.forEach((road,i)=>{const territoryId=road.territoryId||"home";makePlayerRoad(road.from,road.to,territoryId);if(territoryId==="home"&&i<30){makeTrafficVehicle(road.from,road.to,i*2);makeTrafficVehicle(road.to,road.from,i*2+1);}});
    (state.world?.placedDistricts||[]).forEach(makeDistrict);
    (state.world?.resourceNodes||[]).forEach(makeResourceMarker);
    const capital=new THREE.Group();const base=new THREE.Mesh(boxGeo,material(0xe4dcc7));base.scale.set(1.7,2.8,1.7);base.position.y=1.4;capital.add(base);
    const roof=new THREE.Mesh(new THREE.ConeGeometry(1.25,.9,4),material(0x9d4e3f));roof.position.y=3.25;roof.rotation.y=Math.PI/4;capital.add(roof);buildingGroup.add(capital);
    let index=0;const placedByType={};for(const [type,count] of Object.entries(state.buildings||{})){for(let i=0;i<Math.min(Number(count)||0,18);i++){const n=placedByType[type]||0;const saved=(state.world?.placedBuildings||[]).filter(p=>p.type===type)[n];makeBuilding(type,index++,total,saved,saved?.territoryId||"home");placedByType[type]=n+1;}}
    if(lastState&&state.nation.name){const title=document.getElementById("world3d-status");if(title)title.title=state.nation.name+" · population "+state.nation.population;}
  }
  function handleVisibilityChange(){
    if(document.hidden){cancelAnimationFrame(animationId);animationId=0;return;}
    if(renderer&&!animationId)animate();
  }
  document.addEventListener("visibilitychange",handleVisibilityChange);
  function dispose(){cancelAnimationFrame(animationId);animationId=0;document.removeEventListener("visibilitychange",handleVisibilityChange);resizeObserver?.disconnect();renderer?.dispose();controls?.dispose();}
  window.addEventListener("pagehide",dispose,{once:true});
  try{createScene();window.KingmakerWorld3D={update,selectBuilding};window.dispatchEvent(new Event("kingmaker:world3d-ready"));if(lastState)update(lastState);}
  catch(error){host.innerHTML='<div class="world3d-loading">3D world could not initialize. Try a browser with WebGL enabled.</div>';const status=document.getElementById("world3d-status");if(status)status.textContent="3D ENGINE UNAVAILABLE";console.error("KINGMAKER 3D:",error);}
})();