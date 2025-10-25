
(function(){
  const canvas = document.getElementById('canvas');
  const speed = document.getElementById('speed');
  const resetBtn = document.getElementById('resetBtn');
  const livesEl = document.getElementById('lives');
  const statusEl = document.getElementById('status');

  
  let scoreEl = document.getElementById('score');
  if(!scoreEl){
    const bar = document.querySelector('.bar') || document.body;
    const wrap = document.createElement('span');
    wrap.style.marginLeft = '8px';
    wrap.innerHTML = 'Score: <b id="score">0</b>';
    bar.appendChild(wrap);
    scoreEl = document.getElementById('score');
  }

  const aspect = canvas.width / canvas.height;
  const WORLD = { left:-10*aspect, right:10*aspect, bottom:-10, top:10 };

  let keyL=false, keyR=false;
  addEventListener('keydown',e=>{ if(e.key==='ArrowLeft') keyL=true; if(e.key==='ArrowRight') keyR=true; });
  addEventListener('keyup',e=>{ if(e.key==='ArrowLeft') keyL=false; if(e.key==='ArrowRight') keyR=false; });

  const state = {
    lives:4, gameOver:false, win:false, score:0,
    paddle:{pos:[0,-8], size:[3.5,1.0], speed:0.45},
    ball:{pos:[0,-6.5], size:[1,1], d:[0.15,0.18]},
    blocks:[] 
  };

  function buildBlocks(){
    state.blocks.length = 0;
    const wid=3.5, hgh=1.0;
    const rows=4, cols=6;
    const xSpacing = wid + 0.7;
    const ySpacing = hgh + 0.6;
    const startX = -((cols-1) * xSpacing)/2;
    const startY = 6.5;
    const colors=[ [0.90,0.35,0.35,1],[0.95,0.72,0.35,1],[0.35,0.85,0.55,1],[0.45,0.70,0.95,1] ];
    for(let r=0;r<rows;r++){
      for(let c=0;c<cols;c++){
        state.blocks.push({
          pos:[ startX + c*xSpacing, startY - r*ySpacing ],
          size:[ wid, hgh ],
          color: colors[r%colors.length],
          vis:true
        });
      }
    }
  }

  function resetBall(){
    state.ball.pos=[0,-6.5];
    state.ball.d=[(Math.random()<0.5?-1:1)*0.15, 0.18];
  }
  function resetAll(){
    state.lives=4; livesEl.textContent='4';
    state.gameOver=false; state.win=false; statusEl.textContent='';
    state.score=0; scoreEl.textContent='0';
    state.paddle.pos=[0,-8]; resetBall(); buildBlocks();
  }
  resetBtn.onclick=resetAll;
  buildBlocks();
  livesEl.textContent = String(state.lives);
  scoreEl.textContent = String(state.score);

  function rect(pos,size){ return {x1:pos[0]-size[0]/2,x2:pos[0]+size[0]/2,y1:pos[1]-size[1]/2,y2:pos[1]+size[1]/2, cx:pos[0], cy:pos[1]}; }
  function overlap(a,b,c,d){ return !(a>d || c>b); }

  function update(){
    if(state.gameOver || state.win) return;
    const k=parseFloat(speed.value);
    state.ball.pos[0]+=state.ball.d[0]*k;
    state.ball.pos[1]+=state.ball.d[1]*k;
    if(keyL) state.paddle.pos[0]-=state.paddle.speed*k;
    if(keyR) state.paddle.pos[0]+=state.paddle.speed*k;

    // clamp paddle
    const pr=rect(state.paddle.pos,state.paddle.size);
    if(pr.x1<WORLD.left)  state.paddle.pos[0]+= (WORLD.left - pr.x1);
    if(pr.x2>WORLD.right) state.paddle.pos[0]-= (pr.x2 - WORLD.right);

    // walls
    const br=rect(state.ball.pos,state.ball.size);
    if(br.x1<=WORLD.left || br.x2>=WORLD.right) state.ball.d[0]*=-1;
    if(br.y2>=WORLD.top) state.ball.d[1]*=-1;
    if(br.y1<=WORLD.bottom){
      // MISSED PADDLE - lose a life and reset ball
      state.lives--; livesEl.textContent=String(state.lives);
      if(state.lives<=0){ state.gameOver=true; statusEl.textContent='Game Over'; }
      else resetBall();
    }

    // PADDLE COLLISION - bounce (do NOT reset)
    if(overlap(br.x1,br.x2,pr.x1,pr.x2)&&overlap(br.y1,br.y2,pr.y1,pr.y2)){
      // Bounce upward
      state.ball.d[1] = Math.abs(state.ball.d[1]);
      
      const hitOffset = br.cx - pr.cx; // positive if right side
      state.ball.d[0] += 0.02 * Math.sign(hitOffset);
    }

    // blocks collision: remove on first hit + bounce Y/X by penetration + increment score
    for(const blk of state.blocks){
      if(!blk.vis) continue;
      const rr = rect(blk.pos, blk.size);
      if(overlap(br.x1,br.x2,rr.x1,rr.x2) && overlap(br.y1,br.y2,rr.y1,rr.y2)){
        blk.vis=false;
        state.score += 1;
        scoreEl.textContent = String(state.score);
        const penTop = Math.abs(rr.y2 - br.y1);
        const penBottom = Math.abs(br.y2 - rr.y1);
        const penLeft = Math.abs(rr.x2 - br.x1);
        const penRight = Math.abs(br.x2 - rr.x1);
        const minPen = Math.min(penTop, penBottom, penLeft, penRight);
        if(minPen===penTop || minPen===penBottom) state.ball.d[1]*=-1; else state.ball.d[0]*=-1;
        if(state.blocks.every(b=>!b.vis)){ state.win=true; statusEl.textContent='You Win!'; }
        break;
      }
    }
  }

  
  const useCanvas2D = !('gpu' in navigator);

  
  const wx=(x)=> (x - WORLD.left) / (WORLD.right - WORLD.left) * canvas.width;
  const wy=(y)=> (1 - (y - WORLD.bottom)/(WORLD.top - WORLD.bottom)) * canvas.height;
  const sx=(w)=> w / (WORLD.right - WORLD.left) * canvas.width;
  const sy=(h)=> h / (WORLD.top - WORLD.bottom) * canvas.height;

  if(useCanvas2D){
    const g = canvas.getContext('2d');
    function draw2D(){
      update();
      g.clearRect(0,0,canvas.width,canvas.height);
      // draw blocks
      for(const blk of state.blocks){
        if(!blk.vis) continue;
        const rr=rect(blk.pos,blk.size);
        g.fillStyle = `rgba(${Math.round(blk.color[0]*255)},${Math.round(blk.color[1]*255)},${Math.round(blk.color[2]*255)},${blk.color[3]})`;
        g.fillRect(wx(rr.x1), wy(rr.y2), sx(rr.x2-rr.x1), sy(rr.y2-rr.y1));
      }
      // paddle
      const pr=rect(state.paddle.pos,state.paddle.size);
      g.fillStyle='#fff';
      g.fillRect(wx(pr.x1), wy(pr.y2), sx(pr.x2-pr.x1), sy(pr.y2-pr.y1));
      // ball
      const br=rect(state.ball.pos,state.ball.size);
      g.fillRect(wx(br.x1), wy(br.y2), sx(br.x2-br.x1), sy(br.y2-br.y1));
      requestAnimationFrame(draw2D);
    }
    requestAnimationFrame(draw2D);
    return;
  }

  // WebGPU path without top-level await
  (async function(){
    try{
      const adapter = await navigator.gpu.requestAdapter();
      if(!adapter) throw new Error('requestAdapter() returned null');
      const device = await adapter.requestDevice();
      const ctx = canvas.getContext('webgpu');
      const format = navigator.gpu.getPreferredCanvasFormat();
      ctx.configure({device, format, alphaMode:'opaque'});

      const shader = device.createShaderModule({code:`
struct U{ color:vec4f, pos:vec2f, size:vec2f, bounds:vec4f }
@group(0) @binding(0) var<uniform> u: U;
@vertex fn vs(@location(0)p:vec2f)->@builtin(position) vec4f{
  let world = p*u.size + u.pos;
  let x = ((world.x - u.bounds.x)/(u.bounds.y - u.bounds.x))*2.0 - 1.0;
  let y = ((world.y - u.bounds.z)/(u.bounds.w - u.bounds.z))*2.0 - 1.0;
  return vec4f(x,y,0,1);
}
@fragment fn fs()->@location(0) vec4f{ return u.color; }`});
      const verts=new Float32Array([-0.5,-0.5,0.5,-0.5,0.5,0.5,-0.5,-0.5,0.5,0.5,-0.5,0.5]);
      const vbo=device.createBuffer({size:verts.byteLength,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST});
      device.queue.writeBuffer(vbo,0,verts);
      const pipeline=device.createRenderPipeline({
        layout:'auto',
        vertex:{module:shader,entryPoint:'vs',buffers:[{arrayStride:8,attributes:[{shaderLocation:0,offset:0,format:'float32x2'}]}]},
        fragment:{module:shader,entryPoint:'fs',targets:[{format}]},
        primitive:{topology:'triangle-list'}
      });

      function makeU(color){
        const buf=device.createBuffer({size:64,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});
        const arr=new Float32Array(16);
        arr[0]=color[0];arr[1]=color[1];arr[2]=color[2];arr[3]=color[3];
        arr[8]=WORLD.left;arr[9]=WORLD.right;arr[10]=WORLD.bottom;arr[11]=WORLD.top;
        const bg=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:buf}}]});
        return {buf,arr,bg};
      }
      const uP=makeU([1,1,1,1]), uB=makeU([1,1,1,1]);
      const blockUs = state.blocks.map(b=>makeU(b.color));

      function drawUnit(pass,u,pos,size){
        u.arr[4]=pos[0]; u.arr[5]=pos[1]; u.arr[6]=size[0]; u.arr[7]=size[1];
        device.queue.writeBuffer(u.buf,0,u.arr);
        pass.setBindGroup(0,u.bg);
        pass.draw(6);
      }

      function frame(){
        update();
        const enc=device.createCommandEncoder();
        const pass=enc.beginRenderPass({colorAttachments:[{view:ctx.getCurrentTexture().createView(),clearValue:{r:0,g:0,b:0,a:1},loadOp:'clear',storeOp:'store'}]});
        pass.setPipeline(pipeline);
        pass.setVertexBuffer(0,vbo);

        // draw blocks
        for(let i=0;i<state.blocks.length;i++){
          const blk=state.blocks[i]; if(!blk.vis) continue;
          drawUnit(pass, blockUs[i], blk.pos, blk.size);
        }
        // paddle
        drawUnit(pass,uP,state.paddle.pos,state.paddle.size);
        // ball
        drawUnit(pass,uB,state.ball.pos,state.ball.size);

        pass.end();
        device.queue.submit([enc.finish()]);
        requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    }catch(err){
      console.warn('WebGPU path failed, but Canvas2D already handled rendering.', err);
    }
  })();
})();