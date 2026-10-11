/* Local-only Earth artwork, ambient starfield, and graceful motion/WebGL fallbacks. */
(() => {
  'use strict';

  const stage = document.getElementById('artwork');
  const earthCanvas = document.getElementById('earth-scene');
  const ambientCanvas = document.getElementById('ambient');
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const fx = window.__kuntechFx = {
    webgl: 'fallback', texture: 'pending', canvas: 'fallback', gsap: 'static',
    reducedMotion: motion.matches, paused: true, frames: 0, fallbackReason: ''
  };
  const gsap = window.gsap || null;
  let gl = null, earthProgram = null, airProgram = null, vertexBuffer = null, indexBuffer = null, texture = null;
  let indexCount = 0, width = 0, height = 0, raf = 0, ambientRaf = 0, lastFrame = 0;
  let visible = true, ambientVisible = true, ambientCtx = null, dust = [], entrance = null;

  const vertexSource = `
    attribute vec3 a_position;
    attribute vec2 a_uv;
    uniform float u_rotation;
    uniform float u_radius;
    uniform float u_aspect;
    varying vec2 v_uv;
    varying vec3 v_normal;
    void main(){
      float a=u_rotation;
      vec3 p=a_position*u_radius;
      p=vec3(cos(a)*p.x+sin(a)*p.z,p.y,-sin(a)*p.x+cos(a)*p.z);
      float tilt=-0.19;
      p=vec3(p.x,cos(tilt)*p.y-sin(tilt)*p.z,sin(tilt)*p.y+cos(tilt)*p.z);
      v_normal=normalize(p);
      v_uv=a_uv;
      gl_Position=vec4(p.x*.68/u_aspect,p.y*.68,-p.z*.22,1.0);
    }
  `;
  const earthFragmentSource = `
    precision mediump float;
    uniform sampler2D u_map;
    uniform float u_time;
    varying vec2 v_uv;
    varying vec3 v_normal;
    float gridLine(float value,float count,float thickness){
      float f=fract(value*count);
      return 1.0-smoothstep(0.0,thickness,min(f,1.0-f));
    }
    void main(){
      vec3 n=normalize(v_normal);
      vec3 source=texture2D(u_map,v_uv).rgb;
      float sun=max(dot(n,normalize(vec3(-.44,.43,.83))),0.0);
      vec3 color=source*vec3(.70,.94,1.22);
      color=mix(color,color*vec3(.77,.98,1.27)+vec3(.006,.016,.043),.48);
      color*=.29+sun*.81;
      color+=vec3(.006,.025,.071)*(1.0-sun);
      float longitude=gridLine(v_uv.x,24.0,.018);
      float latitude=gridLine(v_uv.y,12.0,.018);
      float grid=max(longitude,latitude);
      color+=vec3(.11,.49,.79)*grid*(.08+sun*.13);
      float sweep=fract(v_uv.y+u_time*.055);
      float scan=1.0-smoothstep(0.0,.013,abs(sweep-.5));
      color+=vec3(.13,.61,.98)*scan*.19;
      float rim=pow(1.0-max(n.z,0.0),2.8);
      color+=vec3(.018,.15,.31)*rim*.24;
      float glint=pow(max(dot(n,normalize(vec3(-.52,.58,.63))),0.0),28.0);
      color+=vec3(.19,.54,.84)*glint*.18;
      gl_FragColor=vec4(color,1.0);
    }
  `;
  const airFragmentSource = `
    precision mediump float;
    varying vec3 v_normal;
    void main(){
      vec3 n=normalize(v_normal);
      float rim=pow(1.0-abs(n.z),2.55);
      float alpha=.035+rim*.43;
      gl_FragColor=vec4(.15,.62,1.0,alpha);
    }
  `;

  function compileShader(type, source){
    const item=gl.createShader(type);
    if(!item) throw new Error('shader-unavailable');
    gl.shaderSource(item,source);
    gl.compileShader(item);
    if(!gl.getShaderParameter(item,gl.COMPILE_STATUS)){
      const reason=gl.getShaderInfoLog(item)||'shader-compile-failed';
      gl.deleteShader(item);
      throw new Error(reason);
    }
    return item;
  }
  function makeProgram(fragmentSource){
    const vs=compileShader(gl.VERTEX_SHADER,vertexSource);
    const fs=compileShader(gl.FRAGMENT_SHADER,fragmentSource);
    const program=gl.createProgram();
    if(!program) throw new Error('program-unavailable');
    gl.attachShader(program,vs);
    gl.attachShader(program,fs);
    gl.bindAttribLocation(program,0,'a_position');
    gl.bindAttribLocation(program,1,'a_uv');
    gl.linkProgram(program);
    gl.deleteShader(vs); gl.deleteShader(fs);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program)||'program-link-failed');
    return {
      handle:program,
      rotation:gl.getUniformLocation(program,'u_rotation'),
      radius:gl.getUniformLocation(program,'u_radius'),
      aspect:gl.getUniformLocation(program,'u_aspect'),
      time:gl.getUniformLocation(program,'u_time'),
      map:gl.getUniformLocation(program,'u_map')
    };
  }
  function buildSphere(){
    const rows=56, columns=84, vertices=[], indices=[];
    for(let row=0;row<=rows;row++){
      const v=row/rows, theta=v*Math.PI, y=Math.cos(theta), r=Math.sin(theta);
      for(let column=0;column<=columns;column++){
        const u=column/columns, phi=u*Math.PI*2;
        vertices.push(r*Math.cos(phi),y,r*Math.sin(phi),u,1-v);
      }
    }
    for(let row=0;row<rows;row++){
      for(let column=0;column<columns;column++){
        const a=row*(columns+1)+column, b=a+columns+1;
        indices.push(a,b,a+1,a+1,b,b+1);
      }
    }
    vertexBuffer=gl.createBuffer(); indexBuffer=gl.createBuffer();
    if(!vertexBuffer||!indexBuffer) throw new Error('geometry-unavailable');
    gl.bindBuffer(gl.ARRAY_BUFFER,vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vertices),gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(indices),gl.STATIC_DRAW);
    indexCount=indices.length;
  }
  function bindSphere(program){
    gl.bindBuffer(gl.ARRAY_BUFFER,vertexBuffer);
    gl.enableVertexAttribArray(0); gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(0,3,gl.FLOAT,false,20,0);
    gl.vertexAttribPointer(1,2,gl.FLOAT,false,20,12);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,indexBuffer);
    gl.useProgram(program.handle);
  }
  function setSceneUniforms(program,seconds,radius){
    if(program.rotation) gl.uniform1f(program.rotation,seconds*.055+.42);
    if(program.radius) gl.uniform1f(program.radius,radius);
    if(program.aspect) gl.uniform1f(program.aspect,width/Math.max(1,height));
    if(program.time) gl.uniform1f(program.time,seconds);
  }
  function draw(seconds){
    if(!gl||!earthProgram||!airProgram||!texture||!width||!height) return;
    gl.viewport(0,0,width,height);
    gl.clearColor(0,0,0,0);
    gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LESS); gl.depthMask(true); gl.disable(gl.BLEND);
    bindSphere(earthProgram); setSceneUniforms(earthProgram,seconds,1.0);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D,texture);
    if(earthProgram.map) gl.uniform1i(earthProgram.map,0);
    gl.drawElements(gl.TRIANGLES,indexCount,gl.UNSIGNED_SHORT,0);
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA,gl.ONE); gl.depthFunc(gl.LEQUAL); gl.depthMask(false);
    bindSphere(airProgram); setSceneUniforms(airProgram,seconds,1.075);
    gl.drawElements(gl.TRIANGLES,indexCount,gl.UNSIGNED_SHORT,0);
    gl.depthMask(true); gl.depthFunc(gl.LESS); gl.disable(gl.BLEND);
    fx.frames++;
  }
  function resizeGL(){
    if(!gl||!stage||!earthCanvas) return;
    const box=stage.getBoundingClientRect();
    if(!box.width||!box.height) return;
    const pixelLimit=motion.matches?480000:840000;
    const scale=Math.min(window.devicePixelRatio||1,1.25,Math.sqrt(pixelLimit/(box.width*box.height)));
    const w=Math.max(1,Math.round(box.width*scale)), h=Math.max(1,Math.round(box.height*scale));
    if(w===width&&h===height) return;
    width=w; height=h; earthCanvas.width=w; earthCanvas.height=h;
    gl.viewport(0,0,w,h);
    draw(0);
  }
  function canAnimate(){return !motion.matches&&!document.hidden&&visible;}
  function frame(now){
    if(!canAnimate()){raf=0;return;}
    if(now-lastFrame>=1000/30){draw(now*.001);lastFrame=now;}
    raf=requestAnimationFrame(frame);
  }
  function startGL(){if(gl&&texture&&!raf&&canAnimate()) raf=requestAnimationFrame(frame);}
  function stopGL(){if(raf) cancelAnimationFrame(raf); raf=0; if(motion.matches) draw(0);}
  function fail(reason){
    fx.webgl='fallback'; fx.fallbackReason=String(reason||'unavailable').slice(0,180);
    fx.texture=fx.texture==='ready'?'ready':'fallback';
    if(stage) stage.dataset.webgl='fallback';
  }
  function initGL(){
    if(!stage||!earthCanvas) return;
    try{
      gl=earthCanvas.getContext('webgl',{alpha:true,antialias:false,depth:true,stencil:false,powerPreference:'low-power',preserveDrawingBuffer:false})
        ||earthCanvas.getContext('experimental-webgl',{alpha:true,antialias:false,depth:true,stencil:false,powerPreference:'low-power'});
      if(!gl) throw new Error('webgl-unavailable');
      earthProgram=makeProgram(earthFragmentSource);
      airProgram=makeProgram(airFragmentSource);
      buildSphere();
      texture=gl.createTexture();
      if(!texture) throw new Error('texture-unavailable');
      gl.bindTexture(gl.TEXTURE_2D,texture);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
      fx.webgl='loading';
      const image=new Image(); image.decoding='async';
      image.onload=()=>{
        if(!gl) return;
        try{
          gl.bindTexture(gl.TEXTURE_2D,texture);
          gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
          gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);
          gl.generateMipmap(gl.TEXTURE_2D);
          fx.texture='ready'; fx.webgl='ready'; stage.dataset.webgl='ready';
          resizeGL(); draw(0); syncActivity();
        }catch(error){fail(error.message||'texture-upload-failed');}
      };
      image.onerror=()=>{fx.texture='fallback';fail('texture-load-failed');};
      image.src='/assets/earth-blue-marble.webp';
      if('ResizeObserver'in window){const observer=new ResizeObserver(resizeGL);observer.observe(stage);}
      resizeGL();
    }catch(error){gl=null;earthProgram=null;airProgram=null;fail(error.message||'webgl-init-failed');}
  }

  function initAmbient(){
    if(!ambientCanvas) return;
    ambientCtx=ambientCanvas.getContext('2d',{alpha:true});
    if(!ambientCtx){fx.canvas='fallback';return;}
    fx.canvas='ready';
    let seed=73119;
    const random=()=>{seed=(seed*16807)%2147483647;return(seed-1)/2147483646;};
    const count=Math.min(46,Math.max(22,Math.round(window.innerWidth/30)));
    dust=Array.from({length:count},()=>({x:random(),y:random(),r:.32+random()*.78,phase:random()*6.28,speed:.000025+random()*.000055}));
    function size(){
      const scale=Math.min(window.devicePixelRatio||1,1);
      ambientCanvas.width=Math.max(1,Math.round(innerWidth*scale));
      ambientCanvas.height=Math.max(1,Math.round(innerHeight*scale));
      ambientCtx.setTransform(scale,0,0,scale,0,0);
    }
    function paint(now){
      if(!ambientVisible||document.hidden||motion.matches){ambientRaf=0;return;}
      const ctx=ambientCtx; ctx.clearRect(0,0,innerWidth,innerHeight);
      for(const point of dust){
        const y=(point.y+now*point.speed)%1;
        const shimmer=.30+.70*(.5+.5*Math.sin(now*.00019+point.phase));
        ctx.beginPath(); ctx.arc(point.x*innerWidth,y*innerHeight,point.r,0,Math.PI*2);
        ctx.fillStyle=`rgba(119,194,242,${.17*shimmer})`; ctx.fill();
      }
      ambientRaf=requestAnimationFrame(paint);
    }
    function start(){
      if(motion.matches||document.hidden||!ambientVisible||ambientRaf) return;
      ambientRaf=requestAnimationFrame(paint);
    }
    size();
    window.addEventListener('resize',size,{passive:true});
    window.__kuntechAmbientStart=start;
    start();
  }
  function stopAmbient(){if(ambientRaf) cancelAnimationFrame(ambientRaf); ambientRaf=0;}
  function syncActivity(){
    const active=!document.hidden&&visible;
    fx.paused=!active||motion.matches;
    if(stage) stage.dataset.paused=String(!active||motion.matches);
    if(!active){stopGL();stopAmbient();if(entrance) entrance.pause();return;}
    if(motion.matches){stopGL();stopAmbient();draw(0);return;}
    startGL();
    if(window.__kuntechAmbientStart) window.__kuntechAmbientStart();
    if(entrance) entrance.play();
  }
  function motionChange(event){
    fx.reducedMotion=typeof event?.matches==='boolean'?event.matches:motion.matches;
    fx.gsap=fx.reducedMotion?'reduced':(gsap?'ready':'unavailable');
    resizeGL(); syncActivity();
  }
  if(motion.addEventListener) motion.addEventListener('change',motionChange); else motion.addListener?.(motionChange);
  document.addEventListener('visibilitychange',syncActivity);
  window.addEventListener('pagehide',()=>{stopGL();stopAmbient();if(entrance) entrance.pause();});
  if('IntersectionObserver'in window&&stage){
    const observer=new IntersectionObserver(entries=>{
      visible=Boolean(entries[0]?.isIntersecting);
      ambientVisible=visible;
      syncActivity();
    },{threshold:.01});
    observer.observe(stage);
  }

  initAmbient();
  initGL();
  if(gsap&&!motion.matches){
    fx.gsap='ready';
    gsap.set(['.artwork-stage','#page-title','.intro','.index li'],{autoAlpha:0});
    entrance=gsap.timeline({paused:true,defaults:{ease:'power2.out'}})
      .fromTo('.artwork-stage',{autoAlpha:0,scale:.982},{autoAlpha:1,scale:1,duration:1.05},0)
      .fromTo('#page-title',{autoAlpha:0,y:8},{autoAlpha:1,y:0,duration:.7},.18)
      .fromTo('.intro',{autoAlpha:0,y:6},{autoAlpha:1,y:0,duration:.58},.29)
      .fromTo('.index li',{autoAlpha:0,y:7},{autoAlpha:1,y:0,duration:.54,stagger:.065},.38);
    syncActivity();
  }else{fx.gsap=motion.matches?'reduced':'unavailable';}
})();
