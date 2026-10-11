const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const TARGET_URL = process.env.XXW_URL || 'https://127.0.0.1:8443/';
(async()=>{
 const browser=await chromium.launch({headless:false});
 try {
 const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:390,height:844}});
 await context.addInitScript(()=>{localStorage.setItem('xxw_intro_seen','1');window.audioLog=[];const play=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){if(!this.src.startsWith('blob:'))return play.call(this);window.currentReplyAudio=this;if(window.blockAudio){window.blockAudio=false;window.audioLog.push('NotAllowedError');return Promise.reject(new DOMException('blocked','NotAllowedError'));}return play.call(this).then(()=>window.audioLog.push('playing'),e=>{window.audioLog.push(e.name);throw e;});};});
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(TARGET_URL);
 const input=page.locator('.voice-input');const send=page.getByRole('button',{name:'发送',exact:true});
 for(const [i,text] of ['今天我很开心','因为我和朋友一起画画','我们画了一座彩虹城堡','明天我想继续画','你还记得我们画了什么吗'].entries()){
  await input.fill(text);const response=page.waitForResponse(r=>r.url().endsWith('/api/chat'));await send.click();
  await page.waitForFunction(()=>document.querySelector('.subtitle')?.textContent==='小小我正在想……');
  await input.fill('下一条草稿不会丢失');await input.dispatchEvent('keydown',{key:'Enter',code:'Enter',isComposing:false});await input.evaluate(el=>el.blur());assert.equal(await input.inputValue(),'下一条草稿不会丢失');assert(await send.isDisabled());
  const res=await response;assert.equal(res.status(),200);const data=await res.json();
  await page.waitForFunction(reply=>document.querySelector('.subtitle')?.textContent===reply,data.reply);
  await page.waitForFunction(n=>window.audioLog.filter(x=>x==='playing').length>=n,i+1,{timeout:45000});
  assert.equal(await input.inputValue(),'下一条草稿不会丢失');
  console.log('real round',i+1,'reply visible, audio playing; draft preserved');
 }
 await page.screenshot({path:'/tmp/xxw-repaired.png'});
 // 浏览器拦截自动播放，点击后必须复用已生成音频恢复。
 await page.evaluate(()=>window.blockAudio=true);await input.fill('谢谢你陪我聊天');const reply=page.waitForResponse(r=>r.url().endsWith('/api/chat'));await send.click();await reply;
 await page.getByText('点一下，听我说',{exact:true}).waitFor({timeout:45000});
 const count=await page.evaluate(()=>window.audioLog.filter(x=>x==='playing').length);
 await page.getByRole('button',{name:'播放回复',exact:true}).click();
 await page.waitForFunction(n=>window.audioLog.filter(x=>x==='playing').length>n,count);console.log('autoplay blocked -> explicit replay PASS');
 // 合成失败不吞文字；重播重新请求。
 await page.route('**/api/tts',r=>r.fulfill({status:503,body:'unavailable'}));
 await input.fill('再讲一句吧');await send.click();await page.getByText('语音未能播放，可以重试',{exact:true}).waitFor({timeout:45000});assert((await page.locator('.subtitle').innerText()).length>0);
 await page.unroute('**/api/tts');await page.getByRole('button',{name:'播放回复',exact:true}).click();await page.waitForFunction(n=>window.audioLog.filter(x=>x==='playing').length>n,count+1,{timeout:45000});console.log('TTS failure retains text; retry PASS');
 // 聊天错误时保留草稿，解除等待。
 await page.route('**/api/chat',r=>r.fulfill({status:503,body:'unavailable'}));await input.fill('失败后这句话要保留');await send.click();await page.getByRole('alert').waitFor();assert.equal(await input.inputValue(),'失败后这句话要保留');assert(!(await send.isDisabled()));await page.unroute('**/api/chat');console.log('chat failure retains draft and unlocks send PASS');
 // 缓存的旧会话在重开时恢复或重建。
 await page.evaluate(()=>localStorage.setItem('xxw_session_id','expired-regression-session'));await page.reload();await input.fill('重新开始');await send.waitFor();await page.waitForFunction(()=>localStorage.getItem('xxw_session_id')!=='expired-regression-session');assert(!(await input.isDisabled()));console.log('stale session recovery PASS');
 assert.deepEqual(errors,[]);console.log('NO PAGE ERRORS; PASS');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
