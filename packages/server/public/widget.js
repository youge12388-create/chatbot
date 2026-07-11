(function(){"use strict";class S{constructor(e,t,n){this.conversationId=null,this.apiHost=e,this.siteId=t,this.lang=n,this.visitorId=this.getOrCreateVisitorId()}getOrCreateVisitorId(){const e="chatbot_visitor_id";let t=localStorage.getItem(e);return t||(t=crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random().toString(36).slice(2)}`,localStorage.setItem(e,t)),t}async createSession(){const t=await(await fetch(`${this.apiHost}/api/chat/session`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({siteId:this.siteId,visitorId:this.visitorId,metadata:{url:location.href,userAgent:navigator.userAgent}})})).json();return this.conversationId=t.data.id,this.conversationId}async sendMessage(e){return this.conversationId||await this.createSession(),(await(await fetch(`${this.apiHost}/api/chat/message`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({conversationId:this.conversationId,content:e,lang:this.lang})})).json()).data}async submitLead(e){await fetch(`${this.apiHost}/api/chat/lead`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({conversationId:this.conversationId,...e})})}async getFaqs(){return(await(await fetch(`${this.apiHost}/api/chat/faqs?siteId=${this.siteId}`)).json()).data||[]}}const w={"zh-CN":{"header.title":"在线咨询","input.placeholder":"输入问题...",loading:"正在思考...",networkError:"网络异常，请稍后重试。","form.title":"请留下联系方式，方便我们为您服务","form.name":"姓名","form.namePlaceholder":"您的称呼","form.phone":"手机号","form.phonePlaceholder":"您的手机号码","form.wechat":"微信号（选填）","form.wechatPlaceholder":"微信号","form.education":"当前学历","form.educationPlaceholder":"如：本科、大专、高中","form.major":"意向专业（选填）","form.majorPlaceholder":"您想申请的专业","form.submit":"提交","form.cancel":"稍后再说","form.success":"信息已收到，我们会尽快联系您。","transfer.reply":"已将您的需求转给专业顾问，稍后会联系您。"},en:{"header.title":"Online Support","input.placeholder":"Type your question...",loading:"Thinking...",networkError:"Network error, please try again.","form.title":"Please leave your contact info","form.name":"Name","form.namePlaceholder":"Your name","form.phone":"Phone","form.phonePlaceholder":"Your phone number","form.wechat":"WeChat (optional)","form.wechatPlaceholder":"WeChat ID","form.education":"Education","form.educationPlaceholder":"e.g. Bachelor, Diploma, High School","form.major":"Intended Major (optional)","form.majorPlaceholder":"Your intended major","form.submit":"Submit","form.cancel":"Later","form.success":"We've received your info, we'll contact you soon.","transfer.reply":"Your request has been forwarded to a consultant."},ru:{"header.title":"Онлайн консультация","input.placeholder":"Введите вопрос...",loading:"Думаю...",networkError:"Ошибка сети, попробуйте позже.","form.title":"Оставьте контактные данные","form.name":"Имя","form.namePlaceholder":"Ваше имя","form.phone":"Телефон","form.phonePlaceholder":"Ваш номер телефона","form.wechat":"WeChat (необязательно)","form.wechatPlaceholder":"WeChat ID","form.education":"Образование","form.educationPlaceholder":"например: Бакалавр, Диплом, Школа","form.major":"Специальность (необязательно)","form.majorPlaceholder":"Ваша специальность","form.submit":"Отправить","form.cancel":"Позже","form.success":"Мы получили ваши данные, скоро свяжемся.","transfer.reply":"Ваш запрос передан консультанту."}};function I(){var i;const o=document.querySelector("script[data-site-id]"),e=o==null?void 0:o.getAttribute("data-lang");if(e==="zh-CN"||e==="en"||e==="ru")return e;const t=(i=document.documentElement.lang)==null?void 0:i.toLowerCase();if(t){if(t.startsWith("zh"))return"zh-CN";if(t.startsWith("ru"))return"ru";if(t.startsWith("en"))return"en"}const n=navigator.language;return n.startsWith("zh")?"zh-CN":n.startsWith("ru")?"ru":n.startsWith("en")?"en":"zh-CN"}function r(o,e){var t;return((t=w[o])==null?void 0:t[e])||w["zh-CN"][e]||e}function C(o,e,t,n){o.innerHTML=`
    <h4>${r(e,"form.title")}</h4>
    <div class="chat-form-row">
      <label>${r(e,"form.name")}</label>
      <input type="text" name="name" placeholder="${r(e,"form.namePlaceholder")}" />
    </div>
    <div class="chat-form-row">
      <label>${r(e,"form.phone")}</label>
      <input type="tel" name="phone" placeholder="${r(e,"form.phonePlaceholder")}" />
    </div>
    <div class="chat-form-row">
      <label>${r(e,"form.wechat")}</label>
      <input type="text" name="wechat" placeholder="${r(e,"form.wechatPlaceholder")}" />
    </div>
    <div class="chat-form-row">
      <label>${r(e,"form.education")}</label>
      <input type="text" name="education" placeholder="${r(e,"form.educationPlaceholder")}" />
    </div>
    <div class="chat-form-row">
      <label>${r(e,"form.major")}</label>
      <input type="text" name="targetMajor" placeholder="${r(e,"form.majorPlaceholder")}" />
    </div>
    <div class="chat-form-actions">
      <button class="chat-form-submit">${r(e,"form.submit")}</button>
      <button class="chat-form-cancel">${r(e,"form.cancel")}</button>
    </div>
  `,o.querySelector(".chat-form-submit").addEventListener("click",()=>{const i=o.querySelectorAll("input"),c={};i.forEach(h=>{c[h.name]=h.value}),t(c)}),o.querySelector(".chat-form-cancel").addEventListener("click",n)}const q=`
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
}
.chat-widget-button:hover {
  transform: scale(1.05);
}
.chat-widget-button svg {
  width: 28px;
  height: 28px;
  fill: white;
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
`;function F(o){const e=new S(o.apiHost,o.siteId,o.lang),t=o.lang,n=document.createElement("div");n.style.cssText=["position: fixed","top: 50%","right: 20px","transform: translateY(-50%)","z-index: 999999",'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',"font-size: 14px","line-height: 1.5"].join(";");const i=n.attachShadow({mode:"open"});i.innerHTML=`
    <style>${q}</style>
    <div class="chat-widget-window">
      <div class="chat-widget-header">
        <h3>${r(t,"header.title")}</h3>
        <div class="chat-widget-close">
          <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
        </div>
      </div>
      <div class="chat-widget-messages"></div>
      <div class="chat-widget-faqs"></div>
      <div class="chat-widget-input">
        <input type="text" placeholder="${r(t,"input.placeholder")}" />
        <button class="chat-widget-send" disabled>
          <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
        </button>
      </div>
      <div class="chat-widget-form-overlay"></div>
    </div>
    <div class="chat-widget-button">
      <svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
    </div>
  `,document.body.appendChild(n);const c=i.querySelector(".chat-widget-button"),h=i.querySelector(".chat-widget-window"),L=i.querySelector(".chat-widget-close"),l=i.querySelector(".chat-widget-messages"),P=i.querySelector(".chat-widget-faqs"),d=i.querySelector(".chat-widget-input input"),p=i.querySelector(".chat-widget-send"),u=i.querySelector(".chat-widget-form-overlay");let m=!1,x=[],b=!1;function v(){m=!m,m?(h.classList.add("open"),c.style.display="none",b||E()):(h.classList.remove("open"),c.style.display="block")}c.addEventListener("click",v),L.addEventListener("click",v);async function E(){b=!0,await e.createSession(),$()}async function $(){x=await e.getFaqs(),x.forEach(a=>{const s=document.createElement("button");s.className="chat-faq-btn",s.textContent=a.question,s.addEventListener("click",()=>g(a.question)),P.appendChild(s)})}function f(a){const s=document.createElement("div");s.className=`chat-message ${a.role}`,s.textContent=a.content,l.appendChild(s),l.scrollTop=l.scrollHeight}function j(){const a=document.createElement("div");a.className="chat-widget-loading",a.textContent=r(t,"loading"),a.id="loading-msg",l.appendChild(a),l.scrollTop=l.scrollHeight}function y(){const a=i.getElementById("loading-msg");a&&a.remove()}async function g(a){if(a.trim()){d.value="",p.disabled=!0,f({role:"user",content:a}),j();try{const s=await e.sendMessage(a);y(),f({role:"assistant",content:s.reply}),s.needForm&&N()}catch{y(),f({role:"assistant",content:r(t,"networkError")})}finally{p.disabled=!1,d.focus()}}}p.addEventListener("click",()=>g(d.value)),d.addEventListener("keydown",a=>{a.key==="Enter"&&g(d.value)});function N(){C(u,t,async a=>{await e.submitLead(a),k(),f({role:"assistant",content:r(t,"form.success")})},k),u.classList.add("open")}function k(){u.classList.remove("open")}d.addEventListener("input",()=>{p.disabled=!d.value.trim()})}function z(){const o=document.querySelector("script[data-site-id]");return o?{siteId:o.getAttribute("data-site-id")||"",apiHost:o.getAttribute("data-api-host")||"http://localhost:3001",lang:I()}:(console.error("[ChatWidget] 缺少 data-site-id 属性"),{siteId:"",apiHost:"",lang:"zh-CN"})}(function(){const e=z();e.siteId&&F(e)})()})();
//# sourceMappingURL=widget.js.map
