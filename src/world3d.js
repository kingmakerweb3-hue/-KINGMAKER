import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js";
import { OrbitControls } from "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/controls/OrbitControls.js";

(() => {
  "use strict";
  const host=document.getElementById("world3d-viewport");
  if(!host)return;
  let scene,camera,renderer,controls,landGroup,buildingGroup,peopleGroup,roadGroup,playerRoadGroup;
  let lastState=null,animationId=0,autoRotate=true,resizeObserver,clock,selectedBuilding=null,roadMode=false,roadStart=null,raycaster,groundPlane,previewMarker,placementPointer=null;
  const COLORS={farm:0xc6a35d,mine:0x78838d,workshop:0x9c7652,factory:0x697b8e,transport:0x9b9b8b,market:0xc49b52,academy:0x8b80b8,power:0x75b9c9,housing:0xd6c5a3};
  const material=(color,roughness=.86)=>new THREE.MeshStandardMaterial({color,roughness});
  const boxGeo=new THREE.BoxGeometry(1,1,1);
  const rand=(x,z)=>{const n=Math.sin(x*127.1+z*311.7)*43758.5453;return n-Math.floor(n);};
  const heightAt=(x,z)=>.20*Math.sin(x*.42)*Math.cos(z*.34)+.11*Math.sin((x+z)*.72)+.06*Math.cos(z*1.1);
  function makeTree(x,z,scale=1){
    const g=new THREE.Group();g.position.set(x,heightAt(x,z),z);g.scale.setScalar(scale);
    const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.09,.13,.65,6),material(0x76533a));trunk.position.y=.32;g.add(trunk);
    const crown=new THREE.Mesh(new THREE.ConeGeometry(.58,1.45,7),material(rand(x,z)>.5?0x477b57:0x5b895c));crown.position.y=1.25;g.add(crown);landGroup.add(g);
  }
  function makeBuilding(type,index,total,position){
    const angle=index*2.399963,ring=2.7+Math.floor(index/9)*1.7;
    const x=position?.x??Math.cos(angle)*ring,z=position?.z??Math.sin(angle)*ring;
    const g=new THREE.Group();g.position.set(x,heightAt(x,z),z);
    const color=COLORS[type]||0x9aa7b6;
    const height=type==="factory"?1.7:type==="academy"?1.55:type==="housing"?1.25:type==="market"?1.1:.9;
    const base=new THREE.Mesh(boxGeo,material(color));base.scale.set(type==="farm"?1.5:.95,height,type==="farm"?1.25:.95);base.position.y=height/2;g.add(base);
    const roof=new THREE.Mesh(new THREE.ConeGeometry(type==="farm"?.95:.78,.55,4),material(type==="farm"?0x8b563e:0x3c5368));roof.position.y=height+.22;roof.rotation.y=Math.PI/4;g.add(roof);
    if(type==="factory"){
      for(let k=0;k<2;k++){const stack=new THREE.Mesh(new THREE.CylinderGeometry(.12,.15,.8,7),material(0x58616b));stack.position.set(.25+k*.3,height+.62,0);g.add(stack);}
    }
    if(type==="power"){const mast=new THREE.Mesh(new THREE.CylinderGeometry(.035,.05,1.8,5),material(0xdce4e8));mast.position.y=1.35;g.add(mast);}
    if(type==="farm"){
      for(let row=0;row<3;row++){const crop=new THREE.Mesh(new THREE.BoxGeometry(1.2,.04,.07),material(0x668a48));crop.position.set(0,.12,(row-1)*.3);g.add(crop);}
    }
    buildingGroup.add(g);
  }
  function clearGroup(group){while(group.children.length){const obj=group.children.pop();obj.traverse?.(o=>{o.geometry?.dispose();if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());else o.material?.dispose();});}}
  function makePlayerRoad(a,b){const curve=new THREE.LineCurve3(new THREE.Vector3(a.x,heightAt(a.x,a.z)+.06,a.z),new THREE.Vector3(b.x,heightAt(b.x,b.z)+.06,b.z));const mesh=new THREE.Mesh(new THREE.TubeGeometry(curve,24,.09,6,false),material(0xd7c39b));playerRoadGroup.add(mesh);}
  function makeRoad(points){
    const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(p[0],heightAt(p[0],p[1])+.035,p[1])));
    const mesh=new THREE.Mesh(new THREE.TubeGeometry(curve,100,.075,5,false),material(0xb9a88c));roadGroup.add(mesh);
  }
  function createScene(){
    scene=new THREE.Scene();scene.background=new THREE.Color(0xa9c9d0);scene.fog=new THREE.Fog(0xa9c9d0,25,62);
    camera=new THREE.PerspectiveCamera(42,1,.1,150);camera.position.set(17,15,20);
    renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;
    host.innerHTML="";host.appendChild(renderer.domElement);
    controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.06;controls.maxPolarAngle=Math.PI*.48;controls.minDistance=9;controls.maxDistance=42;controls.target.set(0,0,0);controls.autoRotate=true;controls.autoRotateSpeed=.42;
    scene.add(new THREE.HemisphereLight(0xe4f4ff,0x64734e,2.0));
    const sun=new THREE.DirectionalLight(0xfff0d7,2.7);sun.position.set(-12,24,10);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);scene.add(sun);
    const water=new THREE.Mesh(new THREE.CircleGeometry(42,80),material(0x548d9a,.38));water.rotation.x=-Math.PI/2;water.position.y=-.48;scene.add(water);
    landGroup=new THREE.Group();buildingGroup=new THREE.Group();peopleGroup=new THREE.Group();roadGroup=new THREE.Group();playerRoadGroup=new THREE.Group();scene.add(landGroup,roadGroup,playerRoadGroup,buildingGroup,peopleGroup);
    const n=90,verts=[],indices=[],colors=[];
    for(let iz=0;iz<=n;iz++)for(let ix=0;ix<=n;ix++){
      const x=(ix/n-.5)*30,z=(iz/n-.5)*30,d=Math.sqrt(x*x+z*z),edge=Math.max(0,1-d/16);
      const y=heightAt(x,z)*edge*2.4-.18;verts.push(x,y,z);
      const col=new THREE.Color(d>13?0x8aab78:d>9?0x83a56c:y>.28?0x789c65:0x9bb777);colors.push(col.r,col.g,col.b);
      if(ix<n&&iz<n){const a=iz*(n+1)+ix,b=a+1,c=a+n+1,d2=c+1;indices.push(a,c,b,b,c,d2);}
    }
    const geo=new THREE.BufferGeometry();geo.setAttribute("position",new THREE.Float32BufferAttribute(verts,3));geo.setAttribute("color",new THREE.Float32BufferAttribute(colors,3));geo.setIndex(indices);geo.computeVertexNormals();
    const terrain=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,flatShading:true}));terrain.receiveShadow=true;landGroup.add(terrain);
    const beach=new THREE.Mesh(new THREE.CircleGeometry(15.3,80),material(0xb8b080));beach.rotation.x=-Math.PI/2;beach.position.y=-.22;beach.scale.set(1,1,.98);landGroup.add(beach);
    for(let i=0;i<90;i++){const x=(rand(i,3)-.5)*26,z=(rand(i,8)-.5)*26;if(Math.hypot(x,z)>7.5&&Math.hypot(x,z)<13.8)makeTree(x,z,.65+rand(i,5)*.7);}
    makeRoad([[-13,-2],[-8,-1],[-4,0],[0,0],[5,2],[9,5]]);
    makeRoad([[-3,-12],[-2,-7],[0,-3],[0,0],[1,6],[3,11]]);
    const plaza=new THREE.Mesh(new THREE.CylinderGeometry(2.3,2.3,.12,32),material(0xd6c79e));plaza.position.y=.03;scene.add(plaza);
    const keep=new THREE.Group();const tower=new THREE.Mesh(new THREE.BoxGeometry(1.5,2.8,1.5),material(0xe3d9c3));tower.position.y=1.4;keep.add(tower);
    const cap=new THREE.Mesh(new THREE.ConeGeometry(1.15,.8,4),material(0x9b493d));cap.position.y=3.2;cap.rotation.y=Math.PI/4;keep.add(cap);keep.position.set(0,.1,0);buildingGroup.add(keep);
    for(let i=0;i<12;i++){const p=new THREE.Mesh(new THREE.SphereGeometry(.12,8,6),material(0x34495e));p.position.set(Math.cos(i)*3,.18,Math.sin(i)*3);peopleGroup.add(p);}
    clock=new THREE.Clock();
    raycaster=new THREE.Raycaster();groundPlane=new THREE.Plane(new THREE.Vector3(0,1,0),0);
    previewMarker=new THREE.Mesh(new THREE.RingGeometry(.55,.78,32),new THREE.MeshBasicMaterial({color:0xffd36e,side:THREE.DoubleSide}));previewMarker.rotation.x=-Math.PI/2;previewMarker.visible=false;scene.add(previewMarker);
    renderer.domElement.addEventListener("pointermove",updatePlacementPreview);
    renderer.domElement.addEventListener("pointerdown",event=>{placementPointer={x:event.clientX,y:event.clientY};});
    renderer.domElement.addEventListener("pointerup",event=>{if(placementPointer&&Math.hypot(event.clientX-placementPointer.x,event.clientY-placementPointer.y)<5){if(roadMode)placeRoadPoint(event);else placeSelectedBuilding(event);}placementPointer=null;});
    resizeObserver=new ResizeObserver(resize);resizeObserver.observe(host);resize();
    document.getElementById("world3d-home")?.addEventListener("click",()=>{camera.position.set(17,15,20);controls.target.set(0,0,0);controls.update();});
    document.getElementById("world3d-rotate")?.addEventListener("click",e=>{autoRotate=!autoRotate;controls.autoRotate=autoRotate;e.currentTarget.setAttribute("aria-pressed",String(autoRotate));e.currentTarget.textContent="Auto-rotate: "+(autoRotate?"on":"off");});
    document.getElementById("world3d-road")?.addEventListener("click",e=>{roadMode=!roadMode;roadStart=null;selectedBuilding=null;if(previewMarker)previewMarker.visible=false;e.currentTarget.classList.toggle("selected",roadMode);e.currentTarget.setAttribute("aria-pressed",String(roadMode));e.currentTarget.textContent=roadMode?"Cancel road":"Build road";const hint=document.getElementById("world3d-build-hint");if(hint)hint.textContent=roadMode?"Tap two points on the island to connect them. Tap again to draw another segment.":"Select a structure or build a road.";if(renderer)renderer.domElement.style.cursor=roadMode?"crosshair":"grab";});
    animate();
  }
  function updatePlacementPreview(event){if(!selectedBuilding||!renderer)return;const rect=renderer.domElement.getBoundingClientRect();const pointer=new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,-((event.clientY-rect.top)/rect.height)*2+1);raycaster.setFromCamera(pointer,camera);const point=new THREE.Vector3();if(raycaster.ray.intersectPlane(groundPlane,point)&&Math.hypot(point.x,point.z)<13.2){previewMarker.position.set(point.x,.045,point.z);previewMarker.visible=true;}else previewMarker.visible=false;}
  function getGroundPoint(event){const rect=renderer.domElement.getBoundingClientRect();const pointer=new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,-((event.clientY-rect.top)/rect.height)*2+1);raycaster.setFromCamera(pointer,camera);const point=new THREE.Vector3();return raycaster.ray.intersectPlane(groundPlane,point)&&Math.hypot(point.x,point.z)<=13.2?point:null;}
  function placeSelectedBuilding(event){if(!selectedBuilding||event.button!==0)return;const point=getGroundPoint(event);if(!point)return;window.dispatchEvent(new CustomEvent("kingmaker:place-building",{detail:{type:selectedBuilding,x:point.x,z:point.z}}));}
  function placeRoadPoint(event){if(event.button!==0)return;const point=getGroundPoint(event);if(!point)return;const spot={x:Number(point.x.toFixed(2)),z:Number(point.z.toFixed(2))};if(!roadStart){roadStart=spot;const hint=document.getElementById("world3d-build-hint");if(hint)hint.textContent="Start selected. Tap the road destination.";return;}if(Math.hypot(spot.x-roadStart.x,spot.z-roadStart.z)<1){roadStart=spot;return;}window.dispatchEvent(new CustomEvent("kingmaker:place-road",{detail:{from:roadStart,to:spot}}));roadStart=null;const hint=document.getElementById("world3d-build-hint");if(hint)hint.textContent="Road built. Tap two points to add another segment."; }
  function selectBuilding(type){selectedBuilding=type||null;if(previewMarker)previewMarker.visible=false;const hint=document.getElementById("world3d-build-hint");if(hint)hint.textContent=selectedBuilding?"Tap an open spot on the island to build a "+selectedBuilding+".":"Select a structure to begin.";document.querySelectorAll("[data-world-build]").forEach(button=>button.classList.toggle("selected",button.dataset.worldBuild===selectedBuilding));if(renderer)renderer.domElement.style.cursor=selectedBuilding?"crosshair":"grab";}
  function resize(){if(!renderer||!host.clientWidth)return;const w=host.clientWidth,h=host.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
  function animate(){
    animationId=requestAnimationFrame(animate);const t=clock.getElapsedTime();controls.update();
    peopleGroup.children.forEach((p,i)=>{const a=t*.17+i*.53;p.position.x=Math.cos(a)*(2.5+(i%4)*.45);p.position.z=Math.sin(a)*(2.5+(i%4)*.45);p.position.y=.22+Math.abs(Math.sin(t*2+i))*.08;});
    renderer.render(scene,camera);
  }
  function update(state){
    if(!state)return;lastState=state;
    const total=Object.values(state.buildings||{}).reduce((sum,n)=>sum+(Number(n)||0),0);
    const status=document.getElementById("world3d-status");if(status)status.textContent="TURN "+state.turn+" · "+total+" BUILDING LEVELS";
    const stats=document.getElementById("world3d-stats");
    if(stats)stats.innerHTML=[["Citizens",state.nation.population],["Infrastructure",total+" levels"],["Stability",state.nation.stability+"%"],["Territory", "1 island · 6 neighbors"]].map(([label,value])=>'<div class="world3d-stat"><b>'+String(value).replace(/[&<>]/g,"")+'</b><small>'+label+'</small></div>').join("");
    if(!buildingGroup)return;
    clearGroup(buildingGroup);clearGroup(playerRoadGroup);
    (state.world?.placedRoads||[]).forEach(road=>makePlayerRoad(road.from,road.to));
    const capital=new THREE.Group();const base=new THREE.Mesh(boxGeo,material(0xe4dcc7));base.scale.set(1.7,2.8,1.7);base.position.y=1.4;capital.add(base);
    const roof=new THREE.Mesh(new THREE.ConeGeometry(1.25,.9,4),material(0x9d4e3f));roof.position.y=3.25;roof.rotation.y=Math.PI/4;capital.add(roof);buildingGroup.add(capital);
    let index=0;const placedByType={};for(const [type,count] of Object.entries(state.buildings||{})){for(let i=0;i<Math.min(Number(count)||0,18);i++){const n=placedByType[type]||0;const saved=(state.world?.placedBuildings||[]).filter(p=>p.type===type)[n];makeBuilding(type,index++,total,saved);placedByType[type]=n+1;}}
    if(lastState&&state.nation.name){const title=document.getElementById("world3d-status");if(title)title.title=state.nation.name+" · population "+state.nation.population;}
  }
  function dispose(){cancelAnimationFrame(animationId);resizeObserver?.disconnect();renderer?.dispose();controls?.dispose();}
  window.addEventListener("pagehide",dispose,{once:true});
  try{createScene();window.KingmakerWorld3D={update,selectBuilding};if(lastState)update(lastState);}
  catch(error){host.innerHTML='<div class="world3d-loading">3D world could not initialize. Try a browser with WebGL enabled.</div>';const status=document.getElementById("world3d-status");if(status)status.textContent="3D ENGINE UNAVAILABLE";console.error("KINGMAKER 3D:",error);}
})();