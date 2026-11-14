import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js";
import { OrbitControls } from "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/controls/OrbitControls.js";

(() => {
  "use strict";
  const host=document.getElementById("world3d-viewport");
  if(!host)return;
  let scene,camera,renderer,controls,landGroup,buildingGroup,peopleGroup,roadGroup,playerRoadGroup,districtGroup,trafficGroup,cloudGroup,waterMesh,waterPositions;
  const trafficVehicles=[];
  let lastState=null,animationId=0,autoRotate=true,resizeObserver,clock,selectedBuilding=null,roadMode=false,roadStart=null,selectedDistrict=null,districtMode=false,raycaster,groundPlane,previewMarker,placementPointer=null;
  const COLORS={farm:0xc6a35d,mine:0x78838d,workshop:0x9c7652,factory:0x697b8e,transport:0x9b9b8b,market:0xc49b52,academy:0x8b80b8,power:0x75b9c9,housing:0xd6c5a3};
  const material=(color,roughness=.86)=>new THREE.MeshStandardMaterial({color,roughness});
  const boxGeo=new THREE.BoxGeometry(1,1,1);
  const rand=(x,z)=>{const n=Math.sin(x*127.1+z*311.7)*43758.5453;return n-Math.floor(n);};
  const heightAt=(x,z)=>Math.sin(x*.19+Math.cos(z*.13))*Math.cos(z*.21)*.72+Math.sin((x+z*.62)*.43)*Math.cos((z-x*.28)*.37)*.42+Math.sin(x*.91+z*.36)*Math.cos(z*.83-x*.2)*.11+Math.max(0,1-Math.hypot(x+3,z-2)/7)*1.05;
  function makeTree(x,z,scale=1){
    const g=new THREE.Group();g.position.set(x,heightAt(x,z),z);g.scale.setScalar(scale);
    const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.075,.14,.82,8),material(0x594331,.98));trunk.position.y=.4;trunk.castShadow=true;g.add(trunk);
    const tone=rand(x,z),crownMat=material(tone>.66?0x315d43:tone>.33?0x426f4b:0x587d50,1);
    for(let i=0;i<3;i++){const crown=new THREE.Mesh(new THREE.IcosahedronGeometry(.58-i*.09,2),crownMat);crown.position.set((rand(x+i,z)-.5)*.18,.92+i*.34,(rand(x,z+i)-.5)*.18);crown.scale.set(1,.9,1);crown.castShadow=true;g.add(crown);}
    landGroup.add(g);
  }
  function makeBuilding(type,index,total,position){
    const angle=index*2.399963,ring=2.7+Math.floor(index/9)*1.7;
    const x=position?.x??Math.cos(angle)*ring,z=position?.z??Math.sin(angle)*ring;
    const g=new THREE.Group();g.position.set(x,heightAt(x,z),z);
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
    buildingGroup.add(g);
  }
  function clearGroup(group){while(group.children.length){const obj=group.children.pop();obj.traverse?.(o=>{o.geometry?.dispose();if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());else o.material?.dispose();});}}
  function makeDistrict(d){
    const colors={residential:0x65b9a0,commercial:0xe4bd65,industrial:0x8c9bb3,agricultural:0x8dbb68};
    const color=colors[d.type]||0xffffff;
    const mat=new THREE.MeshBasicMaterial({color,transparent:true,opacity:.19,side:THREE.DoubleSide,depthWrite:false});
    const ring=new THREE.Mesh(new THREE.CircleGeometry(d.radius,48),mat);ring.rotation.x=-Math.PI/2;ring.position.set(d.x,heightAt(d.x,d.z)+.075,d.z);districtGroup.add(ring);
    const edge=new THREE.Mesh(new THREE.RingGeometry(d.radius-.055,d.radius,48),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.8,side:THREE.DoubleSide}));edge.rotation.x=-Math.PI/2;edge.position.set(d.x,heightAt(d.x,d.z)+.09,d.z);districtGroup.add(edge);
    const detail=new THREE.Group();detail.position.set(d.x,heightAt(d.x,d.z)+.1,d.z);districtGroup.add(detail);
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
  function makePlayerRoad(a,b){const curve=new THREE.LineCurve3(new THREE.Vector3(a.x,heightAt(a.x,a.z)+.06,a.z),new THREE.Vector3(b.x,heightAt(b.x,b.z)+.06,b.z));const mesh=new THREE.Mesh(new THREE.TubeGeometry(curve,24,.09,6,false),material(0xd7c39b));playerRoadGroup.add(mesh);}
  function makeTrafficVehicle(a,b,index){
    const car=new THREE.Group();
    const body=new THREE.Mesh(new THREE.BoxGeometry(.48,.22,.78),material(index%2?0x3d6478:0xb65d48));body.position.y=.2;car.add(body);
    const cabin=new THREE.Mesh(new THREE.BoxGeometry(.34,.2,.34),material(0xb9d0d5));cabin.position.set(0,.39,-.04);car.add(cabin);
    const wheelMat=material(0x263039);
    for(const x of [-.25,.25])for(const z of [-.24,.24]){const wheel=new THREE.Mesh(new THREE.CylinderGeometry(.075,.075,.055,8),wheelMat);wheel.rotation.z=Math.PI/2;wheel.position.set(x,.105,z);car.add(wheel);}
    trafficGroup.add(car);trafficVehicles.push({mesh:car,a,b,phase:index*.47,speed:.055+(index%3)*.012});
  }
  function makeRoad(points){
    const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(p[0],heightAt(p[0],p[1])+.035,p[1])));
    const mesh=new THREE.Mesh(new THREE.TubeGeometry(curve,100,.075,5,false),material(0xb9a88c));roadGroup.add(mesh);
  }
  function createScene(){
    scene=new THREE.Scene();scene.background=new THREE.Color(0x9bb8c7);scene.fog=new THREE.FogExp2(0x9bb8c7,.012);
    camera=new THREE.PerspectiveCamera(42,1,.1,150);camera.position.set(17,15,20);
    renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:"high-performance"});renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.75));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;
    host.innerHTML="";host.appendChild(renderer.domElement);
    controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.06;controls.maxPolarAngle=Math.PI*.48;controls.minDistance=9;controls.maxDistance=42;controls.target.set(0,0,0);controls.autoRotate=true;controls.autoRotateSpeed=.42;
    scene.add(new THREE.HemisphereLight(0xd9efff,0x465b45,1.45));scene.add(new THREE.AmbientLight(0x9fb7c4,.34));
    const sun=new THREE.DirectionalLight(0xffe3b5,3.4);sun.position.set(-18,28,14);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-22;sun.shadow.camera.right=22;sun.shadow.camera.top=22;sun.shadow.camera.bottom=-22;sun.shadow.bias=-.00018;sun.shadow.normalBias=.025;scene.add(sun);
    const waterGeo=new THREE.BufferGeometry(),waterVerts=[],waterIndices=[],waterRings=28,waterSegments=128;
    for(let ring=0;ring<=waterRings;ring++){const radius=42*ring/waterRings;for(let seg=0;seg<=waterSegments;seg++){const angle=seg/waterSegments*Math.PI*2;waterVerts.push(Math.cos(angle)*radius,-.5,Math.sin(angle)*radius);if(ring<waterRings&&seg<waterSegments){const a=ring*(waterSegments+1)+seg,b=a+1,c=a+waterSegments+1,d=c+1;waterIndices.push(a,c,b,b,c,d);}}}
    waterGeo.setAttribute("position",new THREE.Float32BufferAttribute(waterVerts,3));waterGeo.setIndex(waterIndices);waterGeo.computeVertexNormals();
    waterMesh=new THREE.Mesh(waterGeo,new THREE.MeshPhysicalMaterial({color:0x286b80,roughness:.23,metalness:.12,clearcoat:.8,clearcoatRoughness:.16,transparent:true,opacity:.94,side:THREE.DoubleSide}));scene.add(waterMesh);waterPositions=waterMesh.geometry.attributes.position.array.slice();
    landGroup=new THREE.Group();buildingGroup=new THREE.Group();peopleGroup=new THREE.Group();roadGroup=new THREE.Group();playerRoadGroup=new THREE.Group();districtGroup=new THREE.Group();trafficGroup=new THREE.Group();cloudGroup=new THREE.Group();scene.add(landGroup,roadGroup,districtGroup,playerRoadGroup,buildingGroup,peopleGroup,trafficGroup,cloudGroup);
    const n=176,verts=[],indices=[],colors=[];
    for(let iz=0;iz<=n;iz++)for(let ix=0;ix<=n;ix++){
      const x=(ix/n-.5)*30,z=(iz/n-.5)*30,angle=Math.atan2(z,x),coast=14.1+Math.sin(angle*3+1.1)*.85+Math.sin(angle*7-.6)*.34,d=Math.hypot(x,z),edge=THREE.MathUtils.smoothstep(coast-d,0,2.2);
      const y=heightAt(x,z)*edge*1.35-.2;verts.push(x,y,z);
      const col=new THREE.Color(y>.88?0x777c78:y>.52?0x737e69:y>.1?0x55734f:d>12.5?0x8b9478:d>10.7?0xa49b78:0x53764f);colors.push(col.r,col.g,col.b);
      if(ix<n&&iz<n){const a=iz*(n+1)+ix,b=a+1,c=a+n+1,d2=c+1;indices.push(a,c,b,b,c,d2);}
    }
    const geo=new THREE.BufferGeometry();geo.setAttribute("position",new THREE.Float32BufferAttribute(verts,3));geo.setAttribute("color",new THREE.Float32BufferAttribute(colors,3));geo.setIndex(indices);geo.computeVertexNormals();
    const terrain=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.96,metalness:0,flatShading:false}));terrain.receiveShadow=true;terrain.castShadow=true;landGroup.add(terrain);
    const beach=new THREE.Mesh(new THREE.CircleGeometry(15.3,80),material(0xb8b080));beach.rotation.x=-Math.PI/2;beach.position.y=-.22;beach.scale.set(1,1,.98);landGroup.add(beach);
    for(let i=0;i<210;i++){const x=(rand(i,3)-.5)*27,z=(rand(i,8)-.5)*27,d=Math.hypot(x,z);if(d>7.2&&d<13.35&&Math.abs(x)>1.5)makeTree(x,z,.65+rand(i,5)*.75);}
    for(let i=0;i<8;i++){const cloud=new THREE.Group();cloud.position.set((rand(i,91)-.5)*38,8+rand(i,92)*5,(rand(i,93)-.5)*34);for(let j=0;j<5;j++){const puff=new THREE.Mesh(new THREE.SphereGeometry(.75+rand(i,j)*.55,14,10),new THREE.MeshStandardMaterial({color:0xf1f4f2,roughness:1,transparent:true,opacity:.78}));puff.position.set((j-2)*.58,rand(j,i)*.24,Math.sin(j)*.24);puff.scale.y=.42;cloud.add(puff);}cloudGroup.add(cloud);}
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
    renderer.domElement.addEventListener("pointerup",event=>{if(placementPointer&&Math.hypot(event.clientX-placementPointer.x,event.clientY-placementPointer.y)<5){if(roadMode)placeRoadPoint(event);else if(districtMode)placeSelectedDistrict(event);else placeSelectedBuilding(event);}placementPointer=null;});
    resizeObserver=new ResizeObserver(resize);resizeObserver.observe(host);resize();
    document.getElementById("world3d-home")?.addEventListener("click",()=>{camera.position.set(17,15,20);controls.target.set(0,0,0);controls.update();});
    document.getElementById("world3d-rotate")?.addEventListener("click",e=>{autoRotate=!autoRotate;controls.autoRotate=autoRotate;e.currentTarget.setAttribute("aria-pressed",String(autoRotate));e.currentTarget.textContent="Auto-rotate: "+(autoRotate?"on":"off");});
    document.getElementById("world3d-road")?.addEventListener("click",e=>{roadMode=!roadMode;roadStart=null;districtMode=false;selectedDistrict=null;selectedBuilding=null;if(previewMarker)previewMarker.visible=false;e.currentTarget.classList.toggle("selected",roadMode);e.currentTarget.setAttribute("aria-pressed",String(roadMode));e.currentTarget.textContent=roadMode?"Cancel road":"Build road";const hint=document.getElementById("world3d-build-hint");if(hint)hint.textContent=roadMode?"Tap two points on the island to connect them. Tap again to draw another segment.":"Select a structure or build a road.";if(renderer)renderer.domElement.style.cursor=roadMode?"crosshair":"grab";});
    document.querySelectorAll("[data-world-district]").forEach(button=>button.addEventListener("click",()=>{selectedDistrict=button.dataset.worldDistrict;districtMode=true;roadMode=false;roadStart=null;selectedBuilding=null;document.getElementById("world3d-road")?.classList.remove("selected");document.getElementById("world3d-road")?.setAttribute("aria-pressed","false");document.getElementById("world3d-road")&&(document.getElementById("world3d-road").textContent="Build road");document.querySelectorAll("[data-world-district]").forEach(b=>b.classList.toggle("selected",b===button));const hint=document.getElementById("world3d-build-hint");if(hint)hint.textContent="Tap the island to place a "+selectedDistrict+" district.";if(renderer)renderer.domElement.style.cursor="crosshair";}));
    animate();
  }
  function updatePlacementPreview(event){if(!selectedBuilding||!renderer)return;const rect=renderer.domElement.getBoundingClientRect();const pointer=new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,-((event.clientY-rect.top)/rect.height)*2+1);raycaster.setFromCamera(pointer,camera);const point=new THREE.Vector3();if(raycaster.ray.intersectPlane(groundPlane,point)&&Math.hypot(point.x,point.z)<13.2){previewMarker.position.set(point.x,.045,point.z);previewMarker.visible=true;}else previewMarker.visible=false;}
  function getGroundPoint(event){const rect=renderer.domElement.getBoundingClientRect();const pointer=new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,-((event.clientY-rect.top)/rect.height)*2+1);raycaster.setFromCamera(pointer,camera);const point=new THREE.Vector3();return raycaster.ray.intersectPlane(groundPlane,point)&&Math.hypot(point.x,point.z)<=13.2?point:null;}
  function placeSelectedBuilding(event){if(!selectedBuilding||event.button!==0)return;const point=getGroundPoint(event);if(!point)return;window.dispatchEvent(new CustomEvent("kingmaker:place-building",{detail:{type:selectedBuilding,x:point.x,z:point.z}}));}
  function placeSelectedDistrict(event){if(!selectedDistrict||event.button!==0)return;const point=getGroundPoint(event);if(!point)return;if(Math.abs(point.x)>10.5||Math.abs(point.z)>10.5){const hint=document.getElementById("world3d-build-hint");if(hint)hint.textContent="Districts must be placed farther inside the island.";return;}window.dispatchEvent(new CustomEvent("kingmaker:place-district",{detail:{type:selectedDistrict,x:Number(point.x.toFixed(2)),z:Number(point.z.toFixed(2)),radius:2.6}}));}
  function placeRoadPoint(event){if(event.button!==0)return;const point=getGroundPoint(event);if(!point)return;const spot={x:Number(point.x.toFixed(2)),z:Number(point.z.toFixed(2))};if(!roadStart){roadStart=spot;const hint=document.getElementById("world3d-build-hint");if(hint)hint.textContent="Start selected. Tap the road destination.";return;}if(Math.hypot(spot.x-roadStart.x,spot.z-roadStart.z)<1){roadStart=spot;return;}window.dispatchEvent(new CustomEvent("kingmaker:place-road",{detail:{from:roadStart,to:spot}}));roadStart=null;const hint=document.getElementById("world3d-build-hint");if(hint)hint.textContent="Road built. Tap two points to add another segment."; }
  function selectBuilding(type){selectedBuilding=type||null;districtMode=false;selectedDistrict=null;document.querySelectorAll("[data-world-district]").forEach(b=>b.classList.remove("selected"));if(previewMarker)previewMarker.visible=false;const hint=document.getElementById("world3d-build-hint");if(hint)hint.textContent=selectedBuilding?"Tap an open spot on the island to build a "+selectedBuilding+".":"Select a structure to begin.";document.querySelectorAll("[data-world-build]").forEach(button=>button.classList.toggle("selected",button.dataset.worldBuild===selectedBuilding));if(renderer)renderer.domElement.style.cursor=selectedBuilding?"crosshair":"grab";}
  function resize(){if(!renderer||!host.clientWidth)return;const w=host.clientWidth,h=host.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
  function animate(){
    animationId=requestAnimationFrame(animate);const t=clock.getElapsedTime();controls.update();
    if(waterMesh){const attr=waterMesh.geometry.attributes.position;for(let i=0;i<attr.count;i++){const x=waterPositions[i*3],z=waterPositions[i*3+2];attr.array[i*3+1]=waterPositions[i*3+1]+Math.sin(x*.32+t*.65)*.055+Math.cos(z*.27-t*.48)*.04;}attr.needsUpdate=true;waterMesh.geometry.computeVertexNormals();}
    cloudGroup.children.forEach((cloud,i)=>{cloud.position.x+=.0012+Math.sin(t*.025+i)*.0005;if(cloud.position.x>24)cloud.position.x=-24;});
    peopleGroup.children.forEach((p,i)=>{const a=t*.17+i*.53;p.position.x=Math.cos(a)*(2.5+(i%4)*.45);p.position.z=Math.sin(a)*(2.5+(i%4)*.45);p.position.y=heightAt(p.position.x,p.position.z)+Math.abs(Math.sin(t*2+i))*.055;});
    trafficVehicles.forEach(v=>{const p=(t*v.speed+v.phase)%1;const x=v.a.x+(v.b.x-v.a.x)*p,z=v.a.z+(v.b.z-v.a.z)*p;v.mesh.position.set(x,heightAt(x,z)+.055,z);v.mesh.rotation.y=Math.atan2(v.b.x-v.a.x,v.b.z-v.a.z);});
    renderer.render(scene,camera);
  }
  function update(state){
    if(!state)return;lastState=state;
    const total=Object.values(state.buildings||{}).reduce((sum,n)=>sum+(Number(n)||0),0);
    const status=document.getElementById("world3d-status");if(status)status.textContent="TURN "+state.turn+" · "+total+" BUILDING LEVELS";
    const stats=document.getElementById("world3d-stats");
    const zones=state.world?.placedDistricts||[];const zoneCount=zones.length;if(stats)stats.innerHTML=[["Citizens",state.nation.population],["Infrastructure",total+" levels"],["Districts",zoneCount+" zones"],["Traffic",trafficVehicles.length+" vehicles"],["Stability",state.nation.stability+"%"],["Territory", "1 island · 6 neighbors"]].map(([label,value])=>'<div class="world3d-stat"><b>'+String(value).replace(/[&<>]/g,"")+'</b><small>'+label+'</small></div>').join("");
    if(!buildingGroup)return;
    clearGroup(buildingGroup);clearGroup(playerRoadGroup);clearGroup(districtGroup);clearGroup(trafficGroup);trafficVehicles.length=0;
    const roads=state.world?.placedRoads||[];roads.forEach((road,i)=>{makePlayerRoad(road.from,road.to);if(i<30){makeTrafficVehicle(road.from,road.to,i*2);makeTrafficVehicle(road.to,road.from,i*2+1);}});
    (state.world?.placedDistricts||[]).forEach(makeDistrict);
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