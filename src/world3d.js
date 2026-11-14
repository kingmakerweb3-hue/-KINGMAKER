(function (root) {
  "use strict";
  const WORLD_VERSION = 1;
  const REGION_NAMES = ["Aurelian Reach","The Verdant Crown","Sable Highlands","Azure Coast","Ember Basin","Northern Marches","Jade Peninsula","The Glass Desert","Crescent Isles","Western Steppe","Ironwood Vale","Southern Archipelago"];
  const NATION_NAMES = ["Asteria","Veyr","Caldrin","Orinth","Myr","Talassar","Eldoria","Kharad"];
  const RESOURCES = ["Fertile soil","Iron","Copper","Coal","Timber","Stone","Fresh water","Rare crystals"];\n  const CITY_NAMES = ["Dawnport","Kingsfall","Highgarden","Stonewatch","Silverkeep","Ravenmoor","Brightwater","Ironhaven","Goldcrest","Westreach","Northgate","Sunspire","Ashford","Windmere","Oakheart","Emberfall"];
  function random(seed) {
    let x = seed >>> 0;
    return function () { x += 0x6D2B79F5; let t=x; t=Math.imul(t^(t>>>15),t|1); t^=t+Math.imul(t^(t>>>7),t|61); return ((t^(t>>>14))>>>0)/4294967296; };
  }
  function generate(seed = 481516) {
    const rand=random(seed), regions=[];
    for(let i=0;i<REGION_NAMES.length;i++){
      const roll=rand(), count=2+Math.floor(rand()*4), resources=[];
      while(resources.length<3){const item=RESOURCES[Math.floor(rand()*RESOURCES.length)];if(!resources.includes(item))resources.push(item);}
      const population=180000+Math.floor(rand()*2200000), latitude=-68+rand()*136, longitude=-180+rand()*360;\n      const cities=Array.from({length:count},(_,j)=>({id:"city-"+(i+1)+"-"+(j+1),name:CITY_NAMES[Math.floor(rand()*CITY_NAMES.length)]+" "+(j?"":""),population:Math.floor(population/count*(.45+rand())),type:j===0?"Capital":"Settlement",latitude:Math.max(-80,Math.min(80,latitude+(rand()-.5)*12)),longitude:((longitude+(rand()-.5)*22+540)%360)-180}));\n      regions.push({id:"region-"+(i+1),name:REGION_NAMES[i],biome:roll<.18?"Tundra":roll<.38?"Temperate":roll<.58?"Forest":roll<.76?"Grassland":roll<.9?"Desert":"Tropical",population,cities,cityCount:count,latitude,longitude,resources,owner:i<8?NATION_NAMES[i]:"Unclaimed",development:Math.floor(rand()*70)+15});
    }
    return {version:WORLD_VERSION,seed:seed>>>0,generatedAtTurn:1,regions,nations:NATION_NAMES.map((name,i)=>({id:"nation-"+i,name,capital:regions[i].name,regionId:regions[i].id,population:regions[i].population,government:["Republic","Federation","Council","Monarchy"][Math.floor(rand()*4)]})),worldAge:0};
  }
  function compile(gl,type,source){const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(shader));return shader;}
  function start(canvas, options={}){
    const gl=canvas.getContext("webgl",{antialias:true,alpha:false});
    if(!gl)return {ok:false,error:"WebGL is unavailable in this browser."};
    const vertex=compile(gl,gl.VERTEX_SHADER,`attribute vec3 position; uniform mat4 matrix; varying vec3 point; void main(){point=normalize(position);gl_Position=matrix*vec4(position,1.0);}`);
    const fragment=compile(gl,gl.FRAGMENT_SHADER,`precision highp float; varying vec3 point; uniform float time; uniform vec3 lightDir;
      float hash(vec3 p){p=fract(p*.3183099+.1);p*=17.0;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
      float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
      void main(){float n=noise(point*4.2)+.48*noise(point*8.5)+.18*noise(point*17.0);float land=smoothstep(.78,1.03,n);float detail=noise(point*42.0);vec3 ocean=mix(vec3(.018,.09,.17),vec3(.035,.23,.31),noise(point*10.0));vec3 earth=mix(vec3(.48,.39,.23),vec3(.20,.39,.24),smoothstep(.55,.82,detail));earth=mix(earth,vec3(.55,.53,.39),smoothstep(.72,.88,detail));float polar=smoothstep(.72,.94,abs(point.y));earth=mix(earth,vec3(.76,.82,.78),polar*.85);vec3 color=mix(ocean,earth,land);float diffuse=max(dot(normalize(point),normalize(lightDir)),0.0);color*=.34+.82*diffuse;float rim=pow(1.0-max(dot(normalize(point),vec3(0.,0.,1.)),0.0),3.0);color+=vec3(.04,.27,.48)*rim*.8;gl_FragColor=vec4(color,1.0);}`);
    const program=gl.createProgram();gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));
    const positions=[],indices=[],lat=72,lon=112;
    for(let y=0;y<=lat;y++){const theta=y*Math.PI/lat;for(let x=0;x<=lon;x++){const phi=x*2*Math.PI/lon;positions.push(Math.sin(theta)*Math.cos(phi),Math.cos(theta),Math.sin(theta)*Math.sin(phi));}}
    for(let y=0;y<lat;y++)for(let x=0;x<lon;x++){const a=y*(lon+1)+x,b=a+lon+1;indices.push(a,b,a+1,b,b+1,a+1);}
    const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(positions),gl.STATIC_DRAW);
    const ib=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(indices),gl.STATIC_DRAW);
    gl.useProgram(program);const loc=gl.getAttribLocation(program,"position");gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,3,gl.FLOAT,false,0,0);
    const matrixLoc=gl.getUniformLocation(program,"matrix"),lightLoc=gl.getUniformLocation(program,"lightDir");
    let yaw=.5,pitch=.15,zoom=2.8,drag=null,frame=0,alive=true;
    const resize=()=>{const dpr=Math.min(devicePixelRatio||1,2),w=Math.max(1,Math.floor(canvas.clientWidth*dpr)),h=Math.max(1,Math.floor(canvas.clientHeight*dpr));if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;gl.viewport(0,0,w,h);}};
    const mat=(a)=>{const c=Math.cos(a),s=Math.sin(a);return [c,0,-s,0,s*Math.sin(pitch),Math.cos(pitch),c*Math.sin(pitch),0,s*Math.cos(pitch),-Math.sin(pitch),c*Math.cos(pitch),0,0,0,-zoom,1];};
    function draw(){if(!alive)return;resize();gl.enable(gl.DEPTH_TEST);gl.clearColor(.025,.055,.09,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);const m=mat(yaw),aspect=canvas.width/canvas.height,f=1/Math.tan(Math.PI/8),proj=[f/aspect,0,0,0,0,f,0,0,0,0,-1,-1,0,0,-.2,0];const out=new Array(16);for(let r=0;r<4;r++)for(let c=0;c<4;c++)out[c*4+r]=proj[r]*m[c*4]+proj[4+r]*m[c*4+1]+proj[8+r]*m[c*4+2]+proj[12+r]*m[c*4+3];gl.uniformMatrix4fv(matrixLoc,false,new Float32Array(out));gl.uniform3f(lightLoc,-.5,.35,1);gl.drawElements(gl.TRIANGLES,indices.length,gl.UNSIGNED_SHORT,0);frame=requestAnimationFrame(draw);}
    canvas.addEventListener("pointerdown",e=>{drag={x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);});
    canvas.addEventListener("pointermove",e=>{if(!drag)return;yaw+=(e.clientX-drag.x)*.008;pitch=Math.max(-1.15,Math.min(1.15,pitch+(e.clientY-drag.y)*.008));drag={x:e.clientX,y:e.clientY};});
    canvas.addEventListener("pointerup",()=>drag=null);canvas.addEventListener("pointercancel",()=>drag=null);
    canvas.addEventListener("wheel",e=>{e.preventDefault();zoom=Math.max(2.0,Math.min(4.5,zoom+e.deltaY*.003));},{passive:false});
    draw();return {ok:true,destroy(){alive=false;cancelAnimationFrame(frame);}};
  }
  root.KingmakerWorld3D={generate,start,WORLD_VERSION};
})(typeof window!=="undefined"?window:globalThis);
