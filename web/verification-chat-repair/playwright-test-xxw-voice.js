const { chromium } = require('playwright');
const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({headless:false,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream','--use-file-for-fake-audio-capture=/home/xixil/xiaoxiaowo/api/scripts/asr_example_zh.wav']});try {
const page=await browser.newPage({ignoreHTTPSErrors:true,viewport:{width:390,height:844}});
await page.addInitScript(()=>{localStorage.setItem('xxw_intro_seen','1');window.replyAudio=null;const play=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){if(this.src.startsWith('blob:'))window.replyAudio=this;return play.call(this);};});
await page.goto(process.env.XXW_URL||'https://127.0.0.1:8443/');await page.waitForFunction(()=>!document.querySelector('.voice-input').disabled);
await page.getByRole('button',{name:'切换输入方式'}).click();const hold=page.getByRole('button',{name:'按住说话，松开发送'});await hold.dispatchEvent('pointerdown',{pointerId:1,pointerType:'touch'});await page.getByText('正在听… 松开就发送',{exact:true}).waitFor();
await page.waitForTimeout(7000); // 收集固定中文测试音频，模拟真实麦克风输入
const stt=page.waitForResponse(r=>r.url().endsWith('/api/stt'));const chat=page.waitForResponse(r=>r.url().endsWith('/api/chat'));const tts=page.waitForResponse(r=>r.url().endsWith('/api/tts'));await hold.dispatchEvent('pointerup',{pointerId:1,pointerType:'touch'});
const sr=await stt;assert.equal(sr.status(),200);assert((await sr.json()).text.length>0);const cr=await chat;assert.equal(cr.status(),200);const reply=(await cr.json()).reply;const tr=await tts;assert.equal(tr.status(),200);assert.equal(tr.request().postDataJSON().text,reply);assert.equal(await page.locator('.subtitle').innerText(),reply);
await page.waitForFunction(()=>window.replyAudio && !window.replyAudio.paused && window.replyAudio.currentTime>0.15,{},{timeout:45000});console.log('recorded fixture -> local STT -> real DeepSeek -> real TTS -> browser playback clock advanced PASS');
await hold.dispatchEvent('pointerdown',{pointerId:1,pointerType:'touch'});await page.getByText('正在听… 松开就发送',{exact:true}).waitFor();assert(await page.evaluate(()=>window.replyAudio.paused || window.replyAudio.src.startsWith('data:audio/wav')));console.log('barge-in removes old reply source; only silence used for activation PASS');await hold.dispatchEvent('pointerup',{pointerId:1,pointerType:'touch'});
} finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
