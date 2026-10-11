/* Generative artwork for the Kuntechnology root exhibition. Local-only, graceful by default. */
(() => {
  'use strict';

  const stage = document.getElementById('artwork');
  const glCanvas = document.getElementById('sculpture');
  const ambientCanvas = document.getElementById('ambient');
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const fx = window.__kuntechFx = { webgl: 'fallback', canvas: 'fallback', gsap: 'static', reducedMotion: motion.matches, frames: 0 };
  const gsap = window.gsap || null;
  let gl = null, program = null, buffer = null, resolutionLoc = null, timeLoc = null, pointerLoc = null, raf = 0, lastFrame = 0;
  let width = 0, height = 0, dpr = 1, pointerX = 0.5, pointerY = 0.5, visible = true;
  let ambientRaf = 0, ambientVisible = true, ambientCtx = null, ambientStart = () => {}, dust = [];
  let entrance = null;

  const vertexSource = `
    attribute vec2 a_position;
    void main(){ gl_Position = vec4(a_position, 0.0, 1.0); }
  `;
  const fragmentSource = `
    precision mediump float;
    uniform vec2 u_resolution;
    uniform float u_time;
    uniform vec2 u_pointer;
    mat2 rot(float a){ float c=cos(a), s=sin(a); return mat2(c,-s,s,c); }
    float sdTorus(vec3 p, vec2 t){ vec2 q=vec2(length(p.xz)-t.x,p.y); return length(q)-t.y; }
    float smoothUnion(float a,float b,float k){ float h=clamp(.5+.5*(b-a)/k,0.0,1.0); return mix(b,a,h)-k*h*(1.0-h); }
    float sculpture(vec3 p){
      p.xz=rot(u_time*.105)*p.xz;
      p.xy=rot(.30+sin(u_time*.18)*.055)*p.xy;
      float ang=atan(p.z,p.x);
      vec3 a=p;
      a.xz*=1.0+.075*sin(ang*3.0+p.y*5.0+u_time*.34);
      a.y+=.055*sin(ang*4.0+u_time*.23);
      float d1=sdTorus(a,vec2(.58,.135+.012*sin(ang*3.0+u_time*.25)));
      vec3 b=p;
      b.xy=rot(1.12+sin(u_time*.12)*.045)*b.xy;
      b.xz*=1.0+.055*sin(atan(b.z,b.x)*4.0-b.y*4.5-u_time*.27);
      float d2=sdTorus(b,vec2(.55,.105));
      return smoothUnion(d1,d2,.082);
    }
    vec3 normalAt(vec3 p){
      vec2 e=vec2(.0018,0.0);
      return normalize(vec3(sculpture(p+e.xyy)-sculpture(p-e.xyy),sculpture(p+e.yxy)-sculpture(p-e.yxy),sculpture(p+e.yyx)-sculpture(p-e.yyx)));
    }
    void main(){
      vec2 uv=(gl_FragCoord.xy-.5*u_resolution)/min(u_resolution.x,u_resolution.y);
      uv-=(u_pointer-.5)*.038;
      uv*=1.18;
      vec3 ro=vec3(0.0,0.0,3.12), rd=normalize(vec3(uv,-2.3));
      float t=.0, d=.0; bool hit=false;
      for(int i=0;i<92;i++){
        vec3 p=ro+rd*t; d=sculpture(p);
        if(d<.0018){ hit=true; break; }
        t+=d*.78;
        if(t>5.2) break;
      }
      if(!hit){ gl_FragColor=vec4(0.0); return; }
      vec3 p=ro+rd*t, n=normalAt(p), viewDir=normalize(ro-p);
      vec3 lightDir=normalize(vec3(-.62,.74,.72));
      float diffuse=max(dot(n,lightDir),0.0);
      float spec=pow(max(dot(reflect(-lightDir,n),viewDir),0.0),42.0);
      float rim=pow(1.0-max(dot(n,viewDir),0.0),2.8);
      float bands=.5+.5*sin(atan(p.z,p.x)*3.0+p.y*7.0+u_time*.18);
      float threads=pow(.5+.5*sin(atan(p.z,p.x)*19.0+p.y*13.0+sin(p.y*7.0)),18.0);
      vec3 wine=vec3(.20,.055,.105), rose=vec3(.78,.31,.28), pearl=vec3(.92,.69,.56), ice=vec3(.34,.67,.70);
      vec3 base=mix(wine,rose,smoothstep(.12,.88,bands));
      base=mix(base,pearl,smoothstep(.67,1.0,n.y)*.36);
      base=mix(base,pearl,threads*.42);
      vec3 color=base*(.19+1.02*diffuse)+vec3(1.0,.78,.66)*spec*.78;
      color+=mix(vec3(.55,.20,.35),ice,smoothstep(-.28,.7,n.x))*(rim*.72);
      color+=vec3(.55,.22,.31)*pow(max(dot(n,normalize(vec3(.7,.25,-.65))),0.0),9.0)*.22;
      gl_FragColor=vec4(color,1.0);
    }
  `;

  function shader(type, source){
    const item=gl.createShader(type);
    if(!item) throw new Error('Shader unavailable');
    gl.shaderSource(item,source); gl.compileShader(item);
    if(!gl.getShaderParameter(item,gl.COMPILE_STATUS)){
      const message=gl.getShaderInfoLog(item)||'Shader compile failed'; gl.deleteShader(item); throw new Error(message);
    }
    return item;
  }
  function resizeGL(){
    if(!gl||!stage||!glCanvas) return;
    const box=stage.getBoundingClientRect(); if(!box.width||!box.height) return;
    const pixelCap=motion.matches?360000:760000;
    const scale=Math.min(window.devicePixelRatio||1,1.2,Math.sqrt(pixelCap/(box.width*box.height)));
    const w=Math.max(1,Math.round(box.width*scale)), h=Math.max(1,Math.round(box.height*scale));
    if(w===width&&h===height) return;
    width=w;height=h;dpr=scale;glCanvas.width=w;glCanvas.height=h;gl.viewport(0,0,w,h);draw(0);
  }
  function draw(seconds){
    if(!gl||!program||!width||!height) return;
    gl.useProgram(program);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
    gl.uniform2f(resolutionLoc,width,height);
    gl.uniform1f(timeLoc,seconds);
    gl.uniform2f(pointerLoc,pointerX,pointerY);
    gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);fx.frames++;
  }
  function canAnimate(){return !motion.matches&&!document.hidden&&visible;}
  function frame(now){
    if(!canAnimate()){raf=0;return;}
    if(now-lastFrame>=1000/30){draw(now*.001);lastFrame=now;}
    raf=requestAnimationFrame(frame);
  }
  function syncGL(){
    if(!gl) return;
    if(canAnimate()){if(!raf) raf=requestAnimationFrame(frame);}
    else {if(raf)cancelAnimationFrame(raf);raf=0;if(motion.matches)draw(0);}
  }
  function initGL(){
    if(!stage||!glCanvas) return;
    try{
      gl=glCanvas.getContext('webgl',{alpha:true,antialias:false,depth:false,stencil:false,powerPreference:'low-power'})||glCanvas.getContext('experimental-webgl',{alpha:true,antialias:false,depth:false,stencil:false,powerPreference:'low-power'});
      if(!gl) throw new Error('WebGL unavailable');
      const debugInfo=gl.getExtension('WEBGL_debug_renderer_info');
      const renderer=debugInfo?gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL):'';
      if(/swiftshader|llvmpipe|software rasterizer|softpipe/i.test(renderer)) throw new Error('Software WebGL renderer; retain static artwork');
      const vs=shader(gl.VERTEX_SHADER,vertexSource), fs=shader(gl.FRAGMENT_SHADER,fragmentSource);
      program=gl.createProgram(); if(!program) throw new Error('Program unavailable');
      gl.attachShader(program,vs);gl.attachShader(program,fs);gl.bindAttribLocation(program,0,'a_position');gl.linkProgram(program);
      gl.deleteShader(vs);gl.deleteShader(fs);
      if(!gl.getProgramParameter(program,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program)||'Program link failed');
      buffer=gl.createBuffer();if(!buffer) throw new Error('Buffer unavailable');
      gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
      resolutionLoc=gl.getUniformLocation(program,'u_resolution');timeLoc=gl.getUniformLocation(program,'u_time');pointerLoc=gl.getUniformLocation(program,'u_pointer');
      gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
      stage.dataset.webgl='ready';fx.webgl='ready';resizeGL();syncGL();
      if('ResizeObserver'in window){const observer=new ResizeObserver(resizeGL);observer.observe(stage);}
      stage.addEventListener('pointermove',event=>{
        const box=stage.getBoundingClientRect();pointerX=Math.max(0,Math.min(1,(event.clientX-box.left)/box.width));pointerY=1-Math.max(0,Math.min(1,(event.clientY-box.top)/box.height));
      },{passive:true});
      stage.addEventListener('pointerleave',()=>{pointerX=pointerY=.5;},{passive:true});
      glCanvas.addEventListener('webglcontextlost',event=>{event.preventDefault();if(raf)cancelAnimationFrame(raf);raf=0;gl=null;program=null;buffer=null;stage.dataset.webgl='fallback';fx.webgl='context-lost';});
      glCanvas.addEventListener('webglcontextrestored',()=>{gl=null;initGL();});
    }catch(_){
      gl=null;program=null;buffer=null;stage.dataset.webgl='fallback';fx.webgl='fallback';
    }
  }

  function initAmbient(){
    if(!ambientCanvas) return;
    ambientCtx=ambientCanvas.getContext('2d',{alpha:true});
    if(!ambientCtx){fx.canvas='fallback';return;}
    fx.canvas='ready';
    let seed=71231;const random=()=>{seed=(seed*16807)%2147483647;return(seed-1)/2147483646;};
    const count=Math.min(34,Math.max(15,Math.round(window.innerWidth/38)));
    dust=Array.from({length:count},()=>({x:random(),y:random(),r:.35+random()*.8,phase:random()*6.28,speed:.000035+random()*.000065}));
    function size(){const scale=Math.min(window.devicePixelRatio||1,1);ambientCanvas.width=Math.max(1,Math.round(innerWidth*scale));ambientCanvas.height=Math.max(1,Math.round(innerHeight*scale));ambientCtx.setTransform(scale,0,0,scale,0,0);}
    size();window.addEventListener('resize',size,{passive:true});
    function paint(now){
      if(!ambientVisible||document.hidden||motion.matches){ambientRaf=0;return;}
      const ctx=ambientCtx;ctx.clearRect(0,0,innerWidth,innerHeight);
      for(const point of dust){
        const y=(point.y+(now*point.speed))%1;
        const shimmer=.35+.65*(.5+.5*Math.sin(now*.00022+point.phase));
        ctx.beginPath();ctx.arc(point.x*innerWidth,y*innerHeight,point.r,0,Math.PI*2);
        ctx.fillStyle=`rgba(218,166,151,${.11*shimmer})`;ctx.fill();
      }
      ambientRaf=requestAnimationFrame(paint);
    }
    const start=()=>{if(!ambientRaf&&!motion.matches&&!document.hidden)ambientRaf=requestAnimationFrame(paint);};
    ambientStart=start;
    const stop=()=>{if(ambientRaf)cancelAnimationFrame(ambientRaf);ambientRaf=0;};
    if('IntersectionObserver'in window){const observer=new IntersectionObserver(entries=>{ambientVisible=Boolean(entries[0]?.isIntersecting);ambientVisible?start():stop();});observer.observe(document.body);}
    start();window.addEventListener('resize',start,{passive:true});
  }

  function motionChange(event){
    const reduced=typeof event?.matches==='boolean'?event.matches:window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    fx.reducedMotion=reduced;fx.gsap=reduced?'reduced':(gsap?'ready':'unavailable');syncGL();
    if(reduced){
      if(ambientRaf)cancelAnimationFrame(ambientRaf);ambientRaf=0;
      if(entrance){entrance.progress(1).pause();gsap.set(['.artwork-stage','#page-title','.index li'],{clearProps:'opacity,transform,visibility'});}
    }else if(!document.hidden){if(gl&&!raf)raf=requestAnimationFrame(frame);ambientStart();}
  }
  if(motion.addEventListener)motion.addEventListener('change',motionChange);else motion.addListener?.(motionChange);
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){if(raf)cancelAnimationFrame(raf);if(ambientRaf)cancelAnimationFrame(ambientRaf);raf=ambientRaf=0;}
    else{syncGL();if(!motion.matches&&ambientCtx)ambientStart();}
  });
  window.addEventListener('pagehide',()=>{if(raf)cancelAnimationFrame(raf);if(ambientRaf)cancelAnimationFrame(ambientRaf);raf=ambientRaf=0;});

  initAmbient();initGL();
  if(gsap&&!motion.matches){
    fx.gsap='ready';
    entrance=gsap.timeline({defaults:{ease:'power2.out'}})
      .fromTo('.artwork-stage',{autoAlpha:0,scale:.975},{autoAlpha:1,scale:1,duration:1.25},0)
      .fromTo('#page-title',{autoAlpha:0,y:9},{autoAlpha:1,y:0,duration:.75},.22)
      .fromTo('.index li',{autoAlpha:0,y:8},{autoAlpha:1,y:0,duration:.65,stagger:.075},.35);
  }else{fx.gsap=gsap?'reduced':'unavailable';}
})();
