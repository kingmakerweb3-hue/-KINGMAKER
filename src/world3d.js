(function (root) {
  "use strict";
  const WORLD_VERSION = 2;
  const REGION_NAMES = ["Aurelian Reach","The Verdant Crown","Sable Highlands","Azure Coast","Ember Basin","Northern Marches","Jade Peninsula","The Glass Desert","Crescent Isles","Western Steppe","Ironwood Vale","Southern Archipelago"];
  const NATION_NAMES = ["Asteria","Veyr","Caldrin","Orinth","Myr","Talassar","Eldoria","Kharad"];
  const RESOURCES = ["Fertile soil","Iron","Copper","Coal","Timber","Stone","Fresh water","Rare crystals"];
  const CITY_NAMES = ["Dawnport","Kingsfall","Highgarden","Stonewatch","Silverkeep","Ravenmoor","Brightwater","Ironhaven","Goldcrest","Westreach","Northgate","Sunspire","Ashford","Windmere","Oakheart","Emberfall"];
  function random(seed) {
    let x = seed >>> 0;
    return function () { x += 0x6D2B79F5; let t=x; t=Math.imul(t^(t>>>15),t|1); t^=t+Math.imul(t^(t>>>7),t|61); return ((t^(t>>>14))>>>0)/4294967296; };
  }
  function normalizeLongitude(longitude) { return ((longitude + 540) % 360) - 180; }
  function regionIndexAt(latitude, longitude, regions) {
    if (!Array.isArray(regions) || !regions.length) return -1;
    const lat = latitude * Math.PI / 180, lon = longitude * Math.PI / 180;
    const point = [Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon)];
    let bestIndex = 0, bestScore = -Infinity;
    regions.forEach((region, index) => {
      const rLat = region.latitude * Math.PI / 180, rLon = region.longitude * Math.PI / 180;
      const score = point[0] * Math.cos(rLat) * Math.cos(rLon) + point[1] * Math.sin(rLat) + point[2] * Math.cos(rLat) * Math.sin(rLon);
      if (score > bestScore) { bestScore = score; bestIndex = index; }
    });
    return bestIndex;
  }
  function regionAt(world, latitude, longitude) {
    const index = regionIndexAt(latitude, longitude, world && world.regions);
    return index < 0 ? null : world.regions[index];
  }
  function buildBorders(world, stepDegrees = 3) {
    if (!world || !Array.isArray(world.regions) || world.regions.length < 2) return new Float32Array(0);
    const step = Math.max(2, Math.min(8, Number.isFinite(stepDegrees) ? stepDegrees : 3));
    const latSteps = Math.floor(180 / step), lonSteps = Math.floor(360 / step);
    const labels = new Uint8Array(latSteps * lonSteps);
    for (let row = 0; row < latSteps; row++) {
      const latitude = -90 + (row + .5) * step;
      for (let col = 0; col < lonSteps; col++) {
        const longitude = -180 + (col + .5) * step;
        labels[row * lonSteps + col] = regionIndexAt(latitude, longitude, world.regions);
      }
    }
    const vertices = [];
    function push(latitude, longitude) {
      const theta = (90 - latitude) * Math.PI / 180, phi = longitude * Math.PI / 180, radius = 1.008;
      vertices.push(Math.sin(theta) * Math.cos(phi) * radius, Math.cos(theta) * radius, Math.sin(theta) * Math.sin(phi) * radius);
    }
    for (let row = 0; row < latSteps; row++) {
      const latitude = -90 + (row + .5) * step;
      for (let col = 0; col < lonSteps; col++) {
        const index = row * lonSteps + col, current = labels[index], nextCol = (col + 1) % lonSteps;
        if (current !== labels[row * lonSteps + nextCol]) {
          const boundaryLongitude = -180 + (col + 1) * step;
          push(latitude - step / 2, boundaryLongitude);
          push(latitude + step / 2, boundaryLongitude);
        }
        if (row + 1 < latSteps && current !== labels[(row + 1) * lonSteps + col]) {
          const boundaryLatitude = -90 + (row + 1) * step, longitude = -180 + (col + .5) * step;
          push(boundaryLatitude, longitude - step / 2);
          push(boundaryLatitude, longitude + step / 2);
        }
      }
    }
    return new Float32Array(vertices);
  }
  function generate(seed = 481516) {
    const rand=random(seed), regions=[];
    for(let i=0;i<REGION_NAMES.length;i++){
      const roll=rand(), count=2+Math.floor(rand()*4), resources=[];
      while(resources.length<3){const item=RESOURCES[Math.floor(rand()*RESOURCES.length)];if(!resources.includes(item))resources.push(item);}
      const population=180000+Math.floor(rand()*2200000), latitude=-68+rand()*136, longitude=-180+rand()*360;
      const cities=Array.from({length:count},(_,j)=>({id:"city-"+(i+1)+"-"+(j+1),name:CITY_NAMES[Math.floor(rand()*CITY_NAMES.length)]+(j?" "+(j+1):""),population:Math.floor(population/count*(.45+rand())),type:j===0?"Capital":"Settlement",latitude,longitude}));
      regions.push({id:"region-"+(i+1),name:REGION_NAMES[i],biome:roll<.18?"Tundra":roll<.38?"Temperate":roll<.58?"Forest":roll<.76?"Grassland":roll<.9?"Desert":"Tropical",population,cities,cityCount:count,latitude,longitude,resources,owner:i<8?NATION_NAMES[i]:"Unclaimed",development:Math.floor(rand()*70)+15});
    }
    regions.forEach((region, index) => {
      region.cities.forEach(city => {
        let placed = false;
        for (let attempt = 0; attempt < 120; attempt++) {
          const latitude = Math.max(-84, Math.min(84, region.latitude + (rand() - .5) * 24));
          const longitude = normalizeLongitude(region.longitude + (rand() - .5) * 36);
          if (regionIndexAt(latitude, longitude, regions) === index) {
            city.latitude = latitude; city.longitude = longitude; placed = true; break;
          }
        }
        if (!placed) { city.latitude = region.latitude; city.longitude = region.longitude; }
      });
      region.resourceNodes = region.resources.map((resource, resourceIndex) => {
        let latitude = region.latitude, longitude = region.longitude;
        for (let attempt = 0; attempt < 160; attempt++) {
          const candidateLatitude = Math.max(-84, Math.min(84, region.latitude + (rand() - .5) * 30));
          const candidateLongitude = normalizeLongitude(region.longitude + (rand() - .5) * 42);
          if (regionIndexAt(candidateLatitude, candidateLongitude, regions) === index) {
            latitude = candidateLatitude; longitude = candidateLongitude; break;
          }
        }
        return {id:region.id+"-resource-"+(resourceIndex+1),resource,quantity:40+Math.floor(rand()*160),latitude,longitude};
      });
    });
    return {version:WORLD_VERSION,seed:seed>>>0,generatedAtTurn:1,regions,nations:NATION_NAMES.map((name,i)=>({id:"nation-"+i,name,capital:regions[i].name,regionId:regions[i].id,population:regions[i].population,government:["Republic","Federation","Council","Monarchy"][Math.floor(rand()*4)]})),worldAge:0};
  }
  function compile(gl,type,source){const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(shader));return shader;}
  function start(canvas, options={}){
    const gl=canvas.getContext("webgl",{antialias:true,alpha:false});
    if(!gl)return {ok:false,error:"WebGL is unavailable in this browser."};
    const vertex=compile(gl,gl.VERTEX_SHADER,`attribute vec3 position; uniform mat4 matrix; varying vec3 point; void main(){point=normalize(position);gl_Position=matrix*vec4(position,1.0);}`);
    const fragment=compile(gl,gl.FRAGMENT_SHADER,`precision highp float; varying vec3 point; uniform float clock;
      float hash(vec3 p){p=fract(p*.3183099+.1);p*=17.0;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
      float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
      void main(){vec3 normal=normalize(point);float n=noise(normal*4.2)+.48*noise(normal*8.5)+.18*noise(normal*17.0);float land=smoothstep(.78,1.03,n);float detail=noise(normal*42.0)+.22*noise(normal*92.0);vec3 ocean=mix(vec3(.008,.035,.085),vec3(.025,.20,.32),noise(normal*10.0));float oceanGlint=pow(max(dot(reflect(normalize(vec3(.5,-.35,-1.0)),normal),vec3(0.,0.,1.)),0.0),24.0);ocean+=vec3(.18,.32,.42)*oceanGlint*.34;vec3 earth=mix(vec3(.43,.31,.18),vec3(.16,.36,.20),smoothstep(.48,.82,detail));earth=mix(earth,vec3(.58,.53,.39),smoothstep(.72,.9,detail));float polar=smoothstep(.68,.94,abs(normal.y));earth=mix(earth,vec3(.82,.88,.91),polar*.9);vec3 cloudPoint=normal*vec3(23.0,23.0,23.0)+vec3(clock*.012,.025,clock*.004);float cloudNoise=noise(cloudPoint)*.65+noise(normal*47.0+vec3(-clock*.006,0.,clock*.009))*.35;float clouds=smoothstep(.61,.76,cloudNoise)*(1.0-land*.55);vec3 color=mix(ocean,earth,land);color=mix(color,vec3(.78,.86,.91),clouds*.34);vec3 light=normalize(vec3(-.5,.35,1.));float diffuse=max(dot(normal,light),0.0);float ambient=.16+.84*diffuse;color*=ambient;float specular=pow(max(dot(reflect(-light,normal),vec3(0.,0.,1.)),0.0),38.0);color+=vec3(.65,.78,.92)*specular*.28;float rim=pow(1.0-max(dot(normal,vec3(0.,0.,1.)),0.0),3.0);color+=vec3(.04,.30,.62)*rim*1.05;float night=1.0-smoothstep(-.18,.18,dot(normal,light));float cityLights=pow(noise(normal*115.0),13.0)*land*night;color+=vec3(1.0,.56,.20)*cityLights*.8;gl_FragColor=vec4(color,1.0);}`);
    const program=gl.createProgram();gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));
    const markerVertex=compile(gl,gl.VERTEX_SHADER,`attribute vec3 position;attribute vec3 tint;attribute float pointSize;uniform mat4 matrix;uniform float clock;varying vec3 color;varying float pulse;void main(){color=tint;gl_Position=matrix*vec4(position,1.0);pulse=.88+.12*sin(clock*2.4+position.x*9.0+position.z*7.0);gl_PointSize=pointSize*pulse;}`);
    const markerFragment=compile(gl,gl.FRAGMENT_SHADER,`precision mediump float;varying vec3 color;varying float pulse;void main(){vec2 p=gl_PointCoord-vec2(.5);float d=length(p);if(d>.5)discard;float core=1.0-smoothstep(.12,.34,d);float glow=(1.0-smoothstep(.18,.5,d))*.38;gl_FragColor=vec4(min(vec3(1.0),color*(.72+core*.75+glow)*pulse),1.0);}`);
    const markerProgram=gl.createProgram();gl.attachShader(markerProgram,markerVertex);gl.attachShader(markerProgram,markerFragment);gl.linkProgram(markerProgram);if(!gl.getProgramParameter(markerProgram,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(markerProgram));
    const borderVertex=compile(gl,gl.VERTEX_SHADER,`attribute vec3 position;uniform mat4 matrix;void main(){gl_Position=matrix*vec4(position,1.0);}`);
    const borderFragment=compile(gl,gl.FRAGMENT_SHADER,`precision mediump float;void main(){gl_FragColor=vec4(.96,.76,.39,1.0);}`);
    const borderProgram=gl.createProgram();gl.attachShader(borderProgram,borderVertex);gl.attachShader(borderProgram,borderFragment);gl.linkProgram(borderProgram);if(!gl.getProgramParameter(borderProgram,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(borderProgram));
    const positions=[],indices=[],lat=160,lon=240;
    for(let y=0;y<=lat;y++){const theta=y*Math.PI/lat;for(let x=0;x<=lon;x++){const phi=x*2*Math.PI/lon;positions.push(Math.sin(theta)*Math.cos(phi),Math.cos(theta),Math.sin(theta)*Math.sin(phi));}}
    for(let y=0;y<lat;y++)for(let x=0;x<lon;x++){const a=y*(lon+1)+x,b=a+lon+1;indices.push(a,b,a+1,b,b+1,a+1);}
    const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(positions),gl.STATIC_DRAW);
    const ib=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(indices),gl.STATIC_DRAW);
    const world=options.world||generate(481516),markerData=[];
    const cityPalette=[[.95,.76,.32],[.36,.78,.96],[.45,.86,.62],[.92,.53,.43],[.75,.61,.96],[.94,.83,.53],[.44,.82,.78],[.88,.62,.78]];
    const resourcePalette={"Fertile soil":[.55,.82,.38],"Iron":[.72,.74,.79],"Copper":[.94,.49,.25],"Coal":[.42,.48,.55],"Timber":[.39,.67,.32],"Stone":[.68,.66,.59],"Fresh water":[.28,.65,.96],"Rare crystals":[.77,.52,.96]};
    function addMarker(latitude,longitude,color,size=9) {
      const theta=(90-latitude)*Math.PI/180,phi=longitude*Math.PI/180,r=1.014;
      markerData.push(Math.sin(theta)*Math.cos(phi)*r,Math.cos(theta)*r,Math.sin(theta)*Math.sin(phi)*r,...color,size);
    }
    world.regions.forEach((region,index)=>{
      region.cities.forEach((city,cityIndex)=>addMarker(city.latitude,city.longitude,cityPalette[index%cityPalette.length],city.type==="Capital"?17:cityIndex===0?13:9));
      (region.resourceNodes||[]).forEach(node=>addMarker(node.latitude,node.longitude,resourcePalette[node.resource]||[.75,.55,.95],6));
    });
    const markerBuffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,markerBuffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(markerData),gl.STATIC_DRAW);
    const borderData=buildBorders(world),borderBuffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,borderBuffer);gl.bufferData(gl.ARRAY_BUFFER,borderData,gl.STATIC_DRAW); 
    // Procedural settlement architecture and inter-city transport routes.
    const buildingData=[],roadData=[],transportRoutes=[];
    function surfacePoint(latitude,longitude,radius){
      const theta=(90-latitude)*Math.PI/180,phi=longitude*Math.PI/180;
      return [Math.sin(theta)*Math.cos(phi)*radius,Math.cos(theta)*radius,Math.sin(theta)*Math.sin(phi)*radius];
    }
    function addBuilding(city,regionIndex,buildingIndex){
      const base=surfacePoint(city.latitude,city.longitude,1.009);
      const normal=[base[0],base[1],base[2]],nlen=Math.hypot(...normal);
      for(let k=0;k<3;k++)normal[k]/=nlen;
      const reference=Math.abs(normal[1])<.92?[0,1,0]:[1,0,0];
      let east=[normal[1]*reference[2]-normal[2]*reference[1],normal[2]*reference[0]-normal[0]*reference[2],normal[0]*reference[1]-normal[1]*reference[0]];
      const el=Math.hypot(...east);east=east.map(v=>v/el);
      const north=[normal[1]*east[2]-normal[2]*east[1],normal[2]*east[0]-normal[0]*east[2],normal[0]*east[1]-normal[1]*east[0]];
      const angle=buildingIndex*2.399+regionIndex*.7,offset=.003+(buildingIndex%3)*.003;
      const center=base.map((v,i)=>v+east[i]*Math.cos(angle)*offset+north[i]*Math.sin(angle)*offset);
      const height=(city.type==="Capital"?.018:.009)+((buildingIndex*7+regionIndex*3)%5)*.003;
      const width=city.type==="Capital"?.0048:.0032;
      const top=center.map((v,i)=>v+normal[i]*height);
      const right=center.map((v,i)=>v+east[i]*width),left=center.map((v,i)=>v-east[i]*width);
      const back=center.map((v,i)=>v+north[i]*width),front=center.map((v,i)=>v-north[i]*width);
      const roof=top.map((v,i)=>v+normal[i]*height*.18);
      function tri(a,b,c){buildingData.push(...a,...b,...c);}
      tri(right,back,top);tri(back,left,top);tri(left,front,top);tri(front,right,top);
      tri(right,roof,back);tri(back,roof,left);tri(left,roof,front);tri(front,roof,right);
    }
    function addRoute(a,b){
      const A=surfacePoint(a.latitude,a.longitude,1.011),B=surfacePoint(b.latitude,b.longitude,1.011);
      const dot=Math.max(-1,Math.min(1,A[0]*B[0]+A[1]*B[1]+A[2]*B[2]));
      const angle=Math.acos(dot),segments=Math.max(8,Math.ceil(angle*90)),start=roadData.length/3;
      for(let i=0;i<=segments;i++){
        const t=i/segments,wa=angle<1e-5?1-t:Math.sin((1-t)*angle)/Math.sin(angle),wb=angle<1e-5?t:Math.sin(t*angle)/Math.sin(angle);
        const p=[A[0]*wa+B[0]*wb,A[1]*wa+B[1]*wb,A[2]*wa+B[2]*wb],len=Math.hypot(...p);
        roadData.push(p[0]/len*1.011,p[1]/len*1.011,p[2]/len*1.011);
      }
      transportRoutes.push({start,count:segments+1,phase:transportRoutes.length*.73});
    }
    world.regions.forEach((region,index)=>{
      const cities=region.cities||[];
      cities.forEach((city,cityIndex)=>{
        const count=city.type==="Capital"?6:2;
        for(let k=0;k<count;k++)addBuilding(city,index,k);
        if(cityIndex>0)addRoute(cities[0],city);
      });
    });
    const buildingBuffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buildingBuffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(buildingData),gl.STATIC_DRAW);
    const roadBuffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,roadBuffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(roadData),gl.STATIC_DRAW);
    const transportBuffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,transportBuffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(transportRoutes.length*7),gl.DYNAMIC_DRAW);

    const matrixLoc=gl.getUniformLocation(program,"matrix"),cloudClockLoc=gl.getUniformLocation(program,"clock"),markerMatrixLoc=gl.getUniformLocation(markerProgram,"matrix"),borderMatrixLoc=gl.getUniformLocation(borderProgram,"matrix");
    let yaw=.5,pitch=.15,zoom=2.8,drag=null,frame=0,alive=true;
    const resize=()=>{const dpr=Math.min(Math.max(root.devicePixelRatio||1,1.5),3.5),w=Math.max(1,Math.min(3840,Math.floor(canvas.clientWidth*dpr))),h=Math.max(1,Math.min(2160,Math.floor(canvas.clientHeight*dpr)));if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;gl.viewport(0,0,w,h);}};
    const mat=(a)=>{const c=Math.cos(a),s=Math.sin(a);return [c,0,-s,0,s*Math.sin(pitch),Math.cos(pitch),c*Math.sin(pitch),0,s*Math.cos(pitch),-Math.sin(pitch),c*Math.cos(pitch),0,0,0,-zoom,1];};
    function pickRegion(clientX,clientY) {
      const rect=canvas.getBoundingClientRect(),aspect=rect.width/Math.max(1,rect.height),tanHalf=Math.tan(Math.PI/8);
      const x=((clientX-rect.left)/rect.width*2-1)*aspect*tanHalf,y=(1-(clientY-rect.top)/rect.height*2)*tanHalf,z=-1;
      const length=Math.hypot(x,y,z),dx=x/length,dy=y/length,dz=z/length,dot=-zoom*dz,discriminant=dot*dot-(zoom*zoom-1);
      if(discriminant<0)return;
      const distance=dot-Math.sqrt(discriminant),cameraX=dx*distance,cameraY=dy*distance,cameraZ=dz*distance+zoom;
      const c=Math.cos(yaw),s=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch);
      const worldX=c*cameraX-s*cameraZ,worldY=s*sp*cameraX+cp*cameraY+c*sp*cameraZ,worldZ=s*cp*cameraX-sp*cameraY+c*cp*cameraZ;
      const latitude=Math.asin(Math.max(-1,Math.min(1,worldY)))*180/Math.PI,longitude=Math.atan2(worldZ,worldX)*180/Math.PI;
      const region=regionAt(world,latitude,longitude);
      if(region&&typeof options.onRegionSelect==="function")options.onRegionSelect(region.id);
    }
    function draw(){
      if(!alive)return;resize();gl.enable(gl.DEPTH_TEST);gl.clearColor(.025,.055,.09,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
      const m=mat(yaw),aspect=canvas.width/canvas.height,f=1/Math.tan(Math.PI/8),proj=[f/aspect,0,0,0,0,f,0,0,0,0,-1,-1,0,0,-.2,0],out=new Array(16);
      for(let r=0;r<4;r++)for(let col=0;col<4;col++)out[col*4+r]=proj[r]*m[col*4]+proj[4+r]*m[col*4+1]+proj[8+r]*m[col*4+2]+proj[12+r]*m[col*4+3];
      const matrix=new Float32Array(out);
      gl.useProgram(program);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);const loc=gl.getAttribLocation(program,"position");gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,3,gl.FLOAT,false,0,0);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib);gl.uniformMatrix4fv(matrixLoc,false,matrix);gl.uniform1f(cloudClockLoc,performance.now()*.001);gl.drawElements(gl.TRIANGLES,indices.length,gl.UNSIGNED_SHORT,0);
      gl.useProgram(borderProgram);gl.uniformMatrix4fv(borderMatrixLoc,false,matrix);const borderLoc=gl.getAttribLocation(borderProgram,"position");
      gl.bindBuffer(gl.ARRAY_BUFFER,borderBuffer);gl.enableVertexAttribArray(borderLoc);gl.vertexAttribPointer(borderLoc,3,gl.FLOAT,false,0,0);gl.lineWidth(1);gl.drawArrays(gl.LINES,0,borderData.length/3);
      gl.bindBuffer(gl.ARRAY_BUFFER,roadBuffer);gl.vertexAttribPointer(borderLoc,3,gl.FLOAT,false,0,0);transportRoutes.forEach(route=>gl.drawArrays(gl.LINE_STRIP,route.start,route.count));
      gl.bindBuffer(gl.ARRAY_BUFFER,buildingBuffer);gl.vertexAttribPointer(borderLoc,3,gl.FLOAT,false,0,0);gl.drawArrays(gl.TRIANGLES,0,buildingData.length/3);
      const now=performance.now()*.001,vehicles=[];
      transportRoutes.forEach(route=>{const t=(now*.12+route.phase)%1,idx=Math.min(route.count-2,Math.floor(t*(route.count-1))),mix=t*(route.count-1)-idx,offset=(route.start+idx)*3;
        const x=roadData[offset]*(1-mix)+roadData[offset+3]*mix,y=roadData[offset+1]*(1-mix)+roadData[offset+4]*mix,z=roadData[offset+2]*(1-mix)+roadData[offset+5]*mix;
        vehicles.push(x*1.006,y*1.006,z*1.006,.98,.83,.48,7);
      });
      gl.bindBuffer(gl.ARRAY_BUFFER,transportBuffer);gl.bufferSubData(gl.ARRAY_BUFFER,0,new Float32Array(vehicles));
      gl.useProgram(markerProgram);gl.bindBuffer(gl.ARRAY_BUFFER,transportBuffer);
      const pLoc=gl.getAttribLocation(markerProgram,"position"),cLoc=gl.getAttribLocation(markerProgram,"tint"),sLoc=gl.getAttribLocation(markerProgram,"pointSize");
      gl.enableVertexAttribArray(pLoc);gl.vertexAttribPointer(pLoc,3,gl.FLOAT,false,28,0);gl.enableVertexAttribArray(cLoc);gl.vertexAttribPointer(cLoc,3,gl.FLOAT,false,28,12);gl.enableVertexAttribArray(sLoc);gl.vertexAttribPointer(sLoc,1,gl.FLOAT,false,28,24);gl.uniformMatrix4fv(markerMatrixLoc,false,matrix);gl.uniform1f(gl.getUniformLocation(markerProgram,"clock"),now);gl.drawArrays(gl.POINTS,0,vehicles.length/7);
      gl.bindBuffer(gl.ARRAY_BUFFER,markerBuffer);gl.vertexAttribPointer(pLoc,3,gl.FLOAT,false,28,0);gl.vertexAttribPointer(cLoc,3,gl.FLOAT,false,28,12);gl.vertexAttribPointer(sLoc,1,gl.FLOAT,false,28,24);gl.uniform1f(gl.getUniformLocation(markerProgram,"clock"),now);gl.drawArrays(gl.POINTS,0,markerData.length/7);
      frame=root.requestAnimationFrame(draw);
    }
    canvas.addEventListener("pointerdown",e=>{drag={x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,moved:false};canvas.setPointerCapture(e.pointerId);});
    canvas.addEventListener("pointermove",e=>{if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY)>5)drag.moved=true;yaw+=dx*.008;pitch=Math.max(-1.15,Math.min(1.15,pitch+dy*.008));drag.x=e.clientX;drag.y=e.clientY;});
    canvas.addEventListener("pointerup",e=>{if(drag&&!drag.moved)pickRegion(e.clientX,e.clientY);drag=null;});canvas.addEventListener("pointercancel",()=>drag=null);
    canvas.addEventListener("wheel",e=>{e.preventDefault();zoom=Math.max(2.0,Math.min(4.5,zoom+e.deltaY*.003));},{passive:false});
    draw();return {ok:true,destroy(){alive=false;root.cancelAnimationFrame(frame);}};
  }
  root.KingmakerWorld3D={generate,start,regionAt,buildBorders,WORLD_VERSION};
})(typeof window!=="undefined"?window:globalThis);
