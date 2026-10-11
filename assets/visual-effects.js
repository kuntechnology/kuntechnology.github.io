/* Local-only Earth artwork, ambient starfield, and graceful motion/WebGL fallbacks. */
(() => {
  'use strict';

  const stage = document.getElementById('artwork');
  const earthCanvas = document.getElementById('earth-scene');
  const ambientCanvas = document.getElementById('ambient');
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const fx = window.__kuntechFx = {
    webgl: 'fallback', texture: 'pending', canvas: 'fallback', gsap: 'static',
    reducedMotion: motion.matches, paused: true, frames: 0, fallbackReason: '',
    starCount: 0, ambientFrames: 0, ambientDpr: 1, cometsSpawned: 0, cometActiveCount: 0, pointerActive: false
  };
  const gsap = window.gsap || null;
  let gl = null, earthProgram = null, airProgram = null, vertexBuffer = null, indexBuffer = null, texture = null;
  let indexCount = 0, width = 0, height = 0, raf = 0, ambientRaf = 0, lastFrame = 0;
  let visible = true, ambientVisible = true, ambientCtx = null, dust = [], comets = [], entrance = null;
  let pointerTarget = {x:0,y:0}, pointer = {x:0,y:0}, pointerMedia = window.matchMedia('(hover: hover) and (pointer: fine)');
  let pointerEnabled = pointerMedia.matches && !motion.matches, ambientLastFrame = 0, nextCometAt = 0;

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
    ambientCanvas.style.backgroundImage='none';
    function createStarfield(){
      let seed=73119;
      const random=()=>{seed=(seed*16807)%2147483647;return(seed-1)/2147483646;};
      const count=Math.min(180,Math.max(72,Math.round(innerWidth*innerHeight/6800)));
      dust=Array.from({length:count},()=>{
        const depth=.08+Math.pow(random(),.78)*.92;
        return {x:random(),y:random(),depth,r:.23+Math.pow(depth,1.75)*1.45,alpha:.12+depth*.39,phase:random()*6.28,speed:.3+depth*1.6};
      });
      fx.starCount=dust.length;
    }
    function size(){
      const area=Math.max(1,innerWidth*innerHeight);
      const scale=Math.min(window.devicePixelRatio||1,1.1,Math.sqrt(1100000/area));
      ambientCanvas.width=Math.max(1,Math.round(innerWidth*scale));
      ambientCanvas.height=Math.max(1,Math.round(innerHeight*scale));
      ambientCtx.setTransform(scale,0,0,scale,0,0);
      fx.ambientDpr=scale;
      createStarfield();
      drawAmbient(0);
    }
    function updateCamera(){
      if(!pointerEnabled||motion.matches){pointer.x=0;pointer.y=0;}
      else{
        pointer.x+=(pointerTarget.x-pointer.x)*.075;
        pointer.y+=(pointerTarget.y-pointer.y)*.075;
      }
      if(stage){
        stage.style.setProperty('--camera-x',`${(pointer.x*8).toFixed(2)}px`);
        stage.style.setProperty('--camera-y',`${(pointer.y*6).toFixed(2)}px`);
      }
      fx.pointerActive=pointerEnabled&&!motion.matches;
    }
    function drawComets(now,ctx,w,h){
      if(now>=nextCometAt){
        if(Math.random()<.62){
          const depth=.18+Math.random()*.78, angle=(.14+Math.random()*.42)*(Math.random()<.5?-1:1);
          const speed=190+depth*260;
          comets.push({x:Math.random()*w,y:Math.random()*h*.82,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,depth,length:15+depth*39,life:650+Math.random()*850,start:now});
          fx.cometsSpawned++;
        }
        nextCometAt=now+14000+Math.random()*26000;
      }
      comets=comets.filter(comet=>{
        const elapsed=now-comet.start, progress=elapsed/comet.life;
        if(progress>=1) return false;
        const x=comet.x+comet.vx*elapsed/1000, y=comet.y+comet.vy*elapsed/1000;
        const norm=Math.hypot(comet.vx,comet.vy)||1, tailX=x-comet.vx/norm*comet.length, tailY=y-comet.vy/norm*comet.length;
        const fade=Math.min(1,progress*5,(1-progress)*4), alpha=(.15+comet.depth*.22)*fade;
        const trail=ctx.createLinearGradient(x,y,tailX,tailY);
        trail.addColorStop(0,`rgba(186,229,255,${alpha})`); trail.addColorStop(1,'rgba(104,174,226,0)');
        ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(tailX,tailY);
        ctx.strokeStyle=trail; ctx.lineWidth=.45+comet.depth*.65; ctx.stroke();
        ctx.beginPath(); ctx.arc(x,y,.55+comet.depth*.55,0,Math.PI*2);
        ctx.fillStyle=`rgba(211,240,255,${alpha*.82})`; ctx.fill();
        return true;
      });
      fx.cometActiveCount=comets.length;
    }
    function drawAmbient(now){
      if(!ambientCtx) return;
      const ctx=ambientCtx,w=innerWidth,h=innerHeight,reduced=motion.matches;
      updateCamera();
      ctx.clearRect(0,0,w,h);
      if(pointerEnabled&&!reduced){
        const cx=w*(.5+pointer.x*.5),cy=h*(.5+pointer.y*.5),glow=ctx.createRadialGradient(cx,cy,0,cx,cy,300);
        glow.addColorStop(0,'rgba(111,183,224,.035)'); glow.addColorStop(1,'rgba(111,183,224,0)');
        ctx.fillStyle=glow; ctx.fillRect(0,0,w,h);
      }
      for(const point of dust){
        const drift=reduced?0:now*.001*point.speed;
        const x=((point.x*w+pointer.x*point.depth*12)%w+w)%w;
        const y=((point.y*h+drift)%h+h)%h;
        const shimmer=reduced?.82:.76+.24*Math.sin(now*.0012+point.phase);
        ctx.beginPath(); ctx.arc(x,y,point.r,0,Math.PI*2);
        ctx.fillStyle=`rgba(151,207,244,${point.alpha*shimmer})`; ctx.fill();
      }
      if(!reduced) drawComets(now,ctx,w,h); else {comets=[];fx.cometActiveCount=0;}
      fx.ambientFrames++;
    }
    function paint(now){
      ambientRaf=0;
      if(!ambientVisible||document.hidden||motion.matches) return;
      if(now-ambientLastFrame<1000/30){ambientRaf=requestAnimationFrame(paint);return;}
      ambientLastFrame=now;
      drawAmbient(now);
      ambientRaf=requestAnimationFrame(paint);
    }
    function start(){
      if(motion.matches||document.hidden||!ambientVisible||ambientRaf) return;
      if(!nextCometAt||nextCometAt<performance.now()) nextCometAt=performance.now()+14000+Math.random()*26000;
      ambientRaf=requestAnimationFrame(paint);
    }
    nextCometAt=performance.now()+14000+Math.random()*26000;
    size();
    window.addEventListener('resize',size,{passive:true});
    window.addEventListener('pointermove',event=>{
      if(!pointerEnabled||event.pointerType!=='mouse') return;
      pointerTarget.x=(event.clientX/Math.max(1,innerWidth)-.5)*2;
      pointerTarget.y=(event.clientY/Math.max(1,innerHeight)-.5)*2;
    },{passive:true});
    window.addEventListener('blur',()=>{pointerTarget={x:0,y:0};},{passive:true});
    document.querySelectorAll('.index-link').forEach(link=>{
      link.addEventListener('pointermove',event=>{
        if(!pointerEnabled||event.pointerType!=='mouse') return;
        const rect=link.getBoundingClientRect();
        link.style.setProperty('--link-glow-x',`${event.clientX-rect.left}px`);
        link.style.setProperty('--link-glow-y',`${event.clientY-rect.top}px`);
      },{passive:true});
      link.addEventListener('pointerleave',()=>{
        link.style.setProperty('--link-glow-x','50%');
        link.style.setProperty('--link-glow-y','50%');
      },{passive:true});
    });
    const pointerChange=event=>{pointerEnabled=event.matches&&!motion.matches;if(!pointerEnabled) pointerTarget={x:0,y:0};};
    if(pointerMedia.addEventListener) pointerMedia.addEventListener('change',pointerChange); else pointerMedia.addListener?.(pointerChange);
    window.__kuntechAmbientStart=start;
    window.__kuntechAmbientStatic=()=>drawAmbient(0);
    start();
  }
  function stopAmbient(){if(ambientRaf) cancelAnimationFrame(ambientRaf); ambientRaf=0;}
  function syncActivity(){
    const sceneActive=!document.hidden&&visible, ambientActive=!document.hidden&&ambientVisible;
    fx.paused=!sceneActive||motion.matches;
    if(stage) stage.dataset.paused=String(!sceneActive||motion.matches);
    if(!sceneActive){stopGL();if(entrance) entrance.pause();}
    else if(motion.matches){stopGL();draw(0);}
    else{startGL();if(entrance) entrance.play();}
    if(!ambientActive||motion.matches){stopAmbient();if(motion.matches&&window.__kuntechAmbientStatic) window.__kuntechAmbientStatic();}
    else if(window.__kuntechAmbientStart) window.__kuntechAmbientStart();
  }
  function motionChange(event){
    fx.reducedMotion=typeof event?.matches==='boolean'?event.matches:motion.matches;
    fx.gsap=fx.reducedMotion?'reduced':(gsap?'ready':'unavailable');
    pointerEnabled=pointerMedia.matches&&!motion.matches;
    if(!pointerEnabled) pointerTarget={x:0,y:0};
    resizeGL(); syncActivity();
  }
  if(motion.addEventListener) motion.addEventListener('change',motionChange); else motion.addListener?.(motionChange);
  document.addEventListener('visibilitychange',syncActivity);
  window.addEventListener('pagehide',()=>{stopGL();stopAmbient();if(entrance) entrance.pause();});
  window.addEventListener('pageshow',syncActivity);
  if('IntersectionObserver'in window){
    if(stage){
      const sceneObserver=new IntersectionObserver(entries=>{
        visible=Boolean(entries[0]?.isIntersecting);
        syncActivity();
      },{threshold:.01});
      sceneObserver.observe(stage);
    }
    if(ambientCanvas){
      const ambientObserver=new IntersectionObserver(entries=>{
        ambientVisible=Boolean(entries[0]?.isIntersecting);
        syncActivity();
      },{threshold:.01});
      ambientObserver.observe(ambientCanvas);
    }
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
