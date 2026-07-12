(function(){"use strict";class N{constructor(e,o,s){this.conversationId=null,this.siteKey=null,this.apiHost=e,this.siteId=o,this.lang=s,this.visitorId=this.getOrCreateVisitorId()}setSiteKey(e){this.siteKey=e}getOrCreateVisitorId(){const e="chatbot_visitor_id";let o=localStorage.getItem(e);return o||(o=crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random().toString(36).slice(2)}`,localStorage.setItem(e,o)),o}async getSiteSettings(){var e;if(!this.siteKey)return null;try{return((e=(await(await fetch(`${this.apiHost}/api/chat/site?siteKey=${this.siteKey}`)).json()).data)==null?void 0:e.settings)||null}catch{return null}}async createSession(){const o=await(await fetch(`${this.apiHost}/api/chat/session`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({siteId:this.siteId,visitorId:this.visitorId,metadata:{url:location.href,userAgent:navigator.userAgent}})})).json();return this.conversationId=o.data.id,{conversationId:this.conversationId,siteSettings:o.data.siteSettings}}async sendMessage(e){return this.conversationId||await this.createSession(),(await(await fetch(`${this.apiHost}/api/chat/message`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({conversationId:this.conversationId,content:e,lang:this.lang})})).json()).data}async submitLead(e){await fetch(`${this.apiHost}/api/chat/lead`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({conversationId:this.conversationId,...e})})}async getFaqs(){return(await(await fetch(`${this.apiHost}/api/chat/faqs?siteId=${this.siteId}`)).json()).data||[]}}const $={"zh-CN":{"header.title":"在线咨询","header.welcome":"您好！有什么可以帮您的？","input.placeholder":"输入问题...",loading:"正在思考...",networkError:"网络异常，请稍后重试。","form.title":"请留下联系方式，方便我们为您服务","form.name":"姓名","form.namePlaceholder":"您的称呼","form.phone":"手机号","form.phonePlaceholder":"您的手机号码","form.wechat":"微信号（选填）","form.wechatPlaceholder":"微信号","form.education":"当前学历","form.educationPlaceholder":"如：本科、大专、高中","form.major":"意向专业（选填）","form.majorPlaceholder":"您想申请的专业","form.submit":"提交","form.cancel":"稍后再说","form.success":"信息已收到，我们会尽快联系您。","transfer.reply":"已将您的需求转给专业顾问，稍后会联系您。"},en:{"header.title":"Online Support","header.welcome":"Hello! How can I help you?","input.placeholder":"Type your question...",loading:"Thinking...",networkError:"Network error, please try again.","form.title":"Please leave your contact info","form.name":"Name","form.namePlaceholder":"Your name","form.phone":"Phone","form.phonePlaceholder":"Your phone number","form.wechat":"WeChat (optional)","form.wechatPlaceholder":"WeChat ID","form.education":"Education","form.educationPlaceholder":"e.g. Bachelor, Diploma, High School","form.major":"Intended Major (optional)","form.majorPlaceholder":"Your intended major","form.submit":"Submit","form.cancel":"Later","form.success":"We've received your info, we'll contact you soon.","transfer.reply":"Your request has been forwarded to a consultant."},ru:{"header.title":"Онлайн консультация","header.welcome":"Здравствуйте! Чем я могу помочь?","input.placeholder":"Введите вопрос...",loading:"Думаю...",networkError:"Ошибка сети, попробуйте позже.","form.title":"Оставьте контактные данные","form.name":"Имя","form.namePlaceholder":"Ваше имя","form.phone":"Телефон","form.phonePlaceholder":"Ваш номер телефона","form.wechat":"WeChat (необязательно)","form.wechatPlaceholder":"WeChat ID","form.education":"Образование","form.educationPlaceholder":"например: Бакалавр, Диплом, Школа","form.major":"Специальность (необязательно)","form.majorPlaceholder":"Ваша специальность","form.submit":"Отправить","form.cancel":"Позже","form.success":"Мы получили ваши данные, скоро свяжемся.","transfer.reply":"Ваш запрос передан консультанту."}};function M(){var n;const r=document.querySelector("script[data-site-id]"),e=r==null?void 0:r.getAttribute("data-lang");if(e==="zh-CN"||e==="en"||e==="ru")return e;const o=(n=document.documentElement.lang)==null?void 0:n.toLowerCase();if(o){if(o.startsWith("zh"))return"zh-CN";if(o.startsWith("ru"))return"ru";if(o.startsWith("en"))return"en"}const s=navigator.language;return s.startsWith("zh")?"zh-CN":s.startsWith("ru")?"ru":s.startsWith("en")?"en":"zh-CN"}function i(r,e){var o;return((o=$[r])==null?void 0:o[e])||$["zh-CN"][e]||e}function D(r){const e=r.trim();return!!(/^1[3-9]\d{9}$/.test(e)||/^\+\d{6,15}$/.test(e))}function k(r,e){r.style.borderColor="#ff4d4f";let o=r.parentElement.querySelector(".chat-form-error");o||(o=document.createElement("div"),o.className="chat-form-error",o.style.cssText="color: #ff4d4f; font-size: 12px; margin-top: 4px;",r.parentElement.appendChild(o)),o.textContent=e}function L(r){r.style.borderColor="#ddd";const e=r.parentElement.querySelector(".chat-form-error");e&&e.remove()}function W(r,e,o,s){r.innerHTML=`
    <h4>${i(e,"form.title")}</h4>
    <div class="chat-form-row">
      <label>${i(e,"form.name")} <span style="color:#ff4d4f">*</span></label>
      <input type="text" name="name" placeholder="${i(e,"form.namePlaceholder")}" />
    </div>
    <div class="chat-form-row">
      <label>${i(e,"form.phone")} <span style="color:#ff4d4f">*</span></label>
      <input type="tel" name="phone" placeholder="${i(e,"form.phonePlaceholder")}" />
    </div>
    <div class="chat-form-row">
      <label>${i(e,"form.wechat")}</label>
      <input type="text" name="wechat" placeholder="${i(e,"form.wechatPlaceholder")}" />
    </div>
    <div class="chat-form-row">
      <label>${i(e,"form.education")}</label>
      <input type="text" name="education" placeholder="${i(e,"form.educationPlaceholder")}" />
    </div>
    <div class="chat-form-row">
      <label>${i(e,"form.major")}</label>
      <input type="text" name="targetMajor" placeholder="${i(e,"form.majorPlaceholder")}" />
    </div>
    <div class="chat-form-actions">
      <button class="chat-form-submit">${i(e,"form.submit")}</button>
      <button class="chat-form-cancel">${i(e,"form.cancel")}</button>
    </div>
  `;const n=r.querySelector('input[name="name"]'),c=r.querySelector('input[name="phone"]');n.addEventListener("input",()=>L(n)),c.addEventListener("input",()=>L(c)),r.querySelector(".chat-form-submit").addEventListener("click",()=>{let h=!1;if(n.value.trim()||(k(n,e==="zh-CN"?"请填写姓名":e==="en"?"Name is required":"Введите имя"),h=!0),c.value.trim()?D(c.value)||(k(c,e==="zh-CN"?"手机号格式不正确":e==="en"?"Invalid phone format":"Неверный формат телефона"),h=!0):(k(c,e==="zh-CN"?"请填写手机号":e==="en"?"Phone is required":"Введите телефон"),h=!0),h)return;const C=r.querySelectorAll("input"),d={};C.forEach(w=>{d[w.name]=w.value.trim()}),o(d)}),r.querySelector(".chat-form-cancel").addEventListener("click",s)}const A=`
.chat-widget-container {
  position: fixed;
  top: 50%;
  right: 20px;
  transform: translateY(-50%);
  z-index: 999999;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  font-size: 14px;
  line-height: 1.5;
}

.chat-widget-button {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: #165DFF;
  box-shadow: 0 4px 12px rgba(22, 93, 255, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: transform 0.2s;
  position: relative;
}
.chat-widget-button:hover {
  transform: scale(1.05);
}
.chat-widget-button svg {
  width: 28px;
  height: 28px;
  fill: white;
}

.chat-widget-bubble {
  position: absolute;
  right: 70px;
  top: 50%;
  transform: translateY(-50%);
  background: white;
  color: #333;
  padding: 10px 16px;
  border-radius: 12px;
  font-size: 13px;
  white-space: nowrap;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.3s;
  pointer-events: none;
}
.chat-widget-bubble.show {
  opacity: 1;
  pointer-events: auto;
}
.chat-widget-bubble::after {
  content: '';
  position: absolute;
  right: -6px;
  top: 50%;
  transform: translateY(-50%);
  border: 6px solid transparent;
  border-left-color: white;
}

.chat-widget-window {
  width: 380px;
  height: 520px;
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
  display: none;
  flex-direction: column;
  overflow: hidden;
  margin-bottom: 16px;
}
.chat-widget-window.open {
  display: flex;
}

.chat-widget-header {
  background: #165DFF;
  color: white;
  padding: 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.chat-widget-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}
.chat-widget-close {
  cursor: pointer;
  padding: 4px;
  line-height: 1;
}
.chat-widget-close svg {
  width: 20px;
  height: 20px;
  fill: white;
}

.chat-widget-messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  background: #f8f9fa;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.chat-message {
  max-width: 80%;
  padding: 10px 14px;
  border-radius: 12px;
  line-height: 1.5;
  word-wrap: break-word;
}
.chat-message.user {
  align-self: flex-end;
  background: #165DFF;
  color: white;
  border-bottom-right-radius: 4px;
}
.chat-message.assistant {
  align-self: flex-start;
  background: white;
  color: #333;
  border-bottom-left-radius: 4px;
  box-shadow: 0 1px 2px rgba(0,0,0,0.1);
}

.chat-widget-faqs {
  padding: 8px 16px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  border-top: 1px solid #eee;
  background: #fff;
}
.chat-faq-btn {
  padding: 6px 12px;
  border: 1px solid #165DFF;
  border-radius: 16px;
  background: #fff;
  color: #165DFF;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}
.chat-faq-btn:hover {
  background: #165DFF;
  color: #fff;
}

.chat-widget-input {
  display: flex;
  padding: 12px 16px;
  gap: 8px;
  border-top: 1px solid #eee;
  background: #fff;
}
.chat-widget-input input {
  flex: 1;
  padding: 10px 14px;
  border: 1px solid #ddd;
  border-radius: 20px;
  outline: none;
  font-size: 14px;
}
.chat-widget-input input:focus {
  border-color: #165DFF;
}
.chat-widget-send {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #165DFF;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.chat-widget-send:disabled {
  background: #ccc;
  cursor: not-allowed;
}
.chat-widget-send svg {
  width: 18px;
  height: 18px;
  fill: white;
}

.chat-widget-form-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.98);
  display: none;
  padding: 16px;
  overflow-y: auto;
}
.chat-widget-form-overlay.open {
  display: block;
}
.chat-widget-form-overlay h4 {
  margin: 0 0 12px 0;
  font-size: 16px;
}
.chat-form-row {
  margin-bottom: 12px;
}
.chat-form-row label {
  display: block;
  font-size: 13px;
  color: #666;
  margin-bottom: 4px;
}
.chat-form-row input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  box-sizing: border-box;
  font-size: 14px;
}
.chat-form-actions {
  display: flex;
  gap: 8px;
  margin-top: 16px;
}
.chat-form-submit {
  flex: 1;
  padding: 10px;
  background: #165DFF;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
}
.chat-form-cancel {
  padding: 10px 16px;
  background: #f5f5f5;
  border: 1px solid #ddd;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
}

.chat-widget-loading {
  align-self: flex-start;
  padding: 8px 12px;
  background: white;
  border-radius: 12px;
  color: #666;
  font-size: 13px;
}

@media (max-width: 480px) {
  .chat-widget-window {
    width: calc(100vw - 40px);
    height: 70vh;
    right: 0;
  }
}
`;function B(r){const e=new N(r.apiHost,r.siteId,r.lang);r.siteKey&&e.setSiteKey(r.siteKey);const o=r.lang,s=document.createElement("div");s.style.cssText=["position: fixed","top: 50%","right: 20px","transform: translateY(-50%)","z-index: 999999",'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',"font-size: 14px","line-height: 1.5"].join(";");const n=s.attachShadow({mode:"open"});n.innerHTML=`
    <style>${A}</style>
    <div class="chat-widget-window">
      <div class="chat-widget-header">
        <h3>${i(o,"header.title")}</h3>
        <div class="chat-widget-close">
          <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
        </div>
      </div>
      <div class="chat-widget-messages"></div>
      <div class="chat-widget-faqs"></div>
      <div class="chat-widget-input">
        <input type="text" placeholder="${i(o,"input.placeholder")}" />
        <button class="chat-widget-send" disabled>
          <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
        </button>
      </div>
      <div class="chat-widget-form-overlay"></div>
    </div>
    <div class="chat-widget-button">
      <svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
      <div class="chat-widget-bubble"></div>
    </div>
  `,document.body.appendChild(s);const c=n.querySelector(".chat-widget-button"),h=n.querySelector(".chat-widget-window"),C=n.querySelector(".chat-widget-close"),d=n.querySelector(".chat-widget-messages"),w=n.querySelector(".chat-widget-faqs"),p=n.querySelector(".chat-widget-input input"),x=n.querySelector(".chat-widget-send"),y=n.querySelector(".chat-widget-form-overlay"),v=n.querySelector(".chat-widget-bubble");let f=!1,z=[],P=!1,m=null,F=!1;r.siteKey&&e.getSiteSettings().then(t=>{t&&(m=t,T(t.primaryColor))}),setTimeout(()=>{if(!f&&!F){const t=(m==null?void 0:m.bubbleMessage)||i(o,"header.welcome");O(t)}},3e3);function T(t){if(!t)return;const a=n.querySelector("style");a.textContent+=`
      .chat-widget-button { background: ${t} !important; }
      .chat-widget-header { background: ${t} !important; }
      .chat-message.user { background: ${t} !important; }
      .chat-widget-send { background: ${t} !important; }
      .chat-faq-btn { border-color: ${t} !important; color: ${t} !important; }
      .chat-faq-btn:hover { background: ${t} !important; }
      .chat-form-submit { background: ${t} !important; }
    `}let S=null;function O(t){!t||f||(v.textContent=t,v.classList.add("show"),F=!0,S=setTimeout(()=>I(),3e3))}function I(){v.classList.remove("show"),S&&(clearTimeout(S),S=null)}v.addEventListener("click",t=>{t.stopPropagation(),I(),f||q()});function q(){f=!f,f?(h.classList.add("open"),c.style.display="none",I(),P||Y()):(h.classList.remove("open"),c.style.display="flex")}c.addEventListener("click",q),C.addEventListener("click",q);async function Y(){P=!0;const a=(await e.createSession()).siteSettings||m;a&&(m=a,T(a.primaryColor));const l=(a==null?void 0:a.welcomeMessage)||i(o,"header.welcome");g({role:"assistant",content:l},!0);const b=a==null?void 0:a.guideMessage;b&&setTimeout(()=>g({role:"assistant",content:b},!0),1500),U()}async function U(){z=await e.getFaqs(),z.forEach(t=>{const a=document.createElement("button");a.className="chat-faq-btn",a.textContent=t.question,a.addEventListener("click",()=>E(t.question)),w.appendChild(a)})}function g(t,a=!1){const l=document.createElement("div");l.className=`chat-message ${t.role}`,d.appendChild(l),a&&t.role==="assistant"?V(l,t.content):(l.textContent=t.content,d.scrollTop=d.scrollHeight)}function V(t,a,l=25){let b=0,u=null;t.style.cursor="pointer",t.addEventListener("click",()=>{u&&(clearInterval(u),u=null),t.textContent=a,t.style.cursor="",d.scrollTop=d.scrollHeight}),u=setInterval(()=>{b<a.length?(t.textContent=a.slice(0,b+1),b++,d.scrollTop=d.scrollHeight):(u&&(clearInterval(u),u=null),t.style.cursor="")},l)}function J(){const t=document.createElement("div");t.className="chat-widget-loading",t.textContent=i(o,"loading"),t.id="loading-msg",d.appendChild(t),d.scrollTop=d.scrollHeight}function j(){const t=n.getElementById("loading-msg");t&&t.remove()}async function E(t){if(t.trim()){p.value="",x.disabled=!0,g({role:"user",content:t}),J();try{const a=await e.sendMessage(t);j(),g({role:"assistant",content:a.reply},!0),a.needForm&&R()}catch{j(),g({role:"assistant",content:i(o,"networkError")},!0)}finally{x.disabled=!1,p.focus()}}}x.addEventListener("click",()=>E(p.value)),p.addEventListener("keydown",t=>{t.key==="Enter"&&E(p.value)});function R(){W(y,o,async t=>{await e.submitLead(t),H(),g({role:"assistant",content:i(o,"form.success")})},H),y.classList.add("open")}function H(){y.classList.remove("open"),y.innerHTML=""}p.addEventListener("input",()=>{x.disabled=!p.value.trim()})}function K(){const r=document.querySelector("script[data-site-id]");return r?{siteId:r.getAttribute("data-site-id")||"",siteKey:r.getAttribute("data-site-key")||void 0,apiHost:r.getAttribute("data-api-host")||"http://localhost:3001",lang:M()}:(console.error("[ChatWidget] 缺少 data-site-id 属性"),{siteId:"",apiHost:"",lang:"zh-CN"})}(function(){const e=K();e.siteId&&B(e)})()})();
//# sourceMappingURL=widget.js.map
