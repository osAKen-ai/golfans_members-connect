'use strict';
// Local, fictional prototype data. Production identity and authorization require a server.
const Delegation = (() => {
 const key='takarazuka-delegation-demo-v1';
 const members=[{id:'ito',name:'伊藤 剛',number:'0889582',company:'株式会社サンプル商事'},{id:'sato',name:'佐藤 一郎',number:'0889601',company:'株式会社サンプル商事'},{id:'suzuki',name:'鈴木 健一',number:'0889624',company:'株式会社サンプルホールディングス'}];
 const seed=()=>({version:1,agents:[{id:'agent-yamada',name:'山田 花子',email:'yamada@example.com',organization:'株式会社サンプル商事　秘書室'}],grants:[{id:'grant-ito',member:'ito',agent:'agent-yamada',status:'active'},{id:'grant-sato',member:'sato',agent:'agent-yamada',status:'active'},{id:'grant-suzuki',member:'suzuki',agent:'agent-yamada',status:'active'}]});
 function read(){try{const d=JSON.parse(localStorage.getItem(key));if(d?.version===1&&Array.isArray(d.agents)&&Array.isArray(d.grants)){
  // Upgrade only the built-in sample from before affiliation was introduced.
  // An explicitly saved empty string or custom affiliation must stay unchanged.
  const sample=d.agents.find(a=>a.id==='agent-yamada');
  if(sample&&!Object.prototype.hasOwnProperty.call(sample,'organization'))sample.organization=seed().agents[0].organization;
  return d;
 }}catch{}return seed();}
 function write(d){localStorage.setItem(key,JSON.stringify(d));return d;}
 function uid(){if(typeof crypto.randomUUID==='function')return crypto.randomUUID();return Array.from(crypto.getRandomValues(new Uint8Array(16)),n=>n.toString(16).padStart(2,'0')).join('');}
 function grants(member,d=read()){return d.grants.filter(g=>g.member===member);}
 function agent(id,d=read()){return d.agents.find(a=>a.id===id);}
 function access(id,member,d=read()){return d.grants.some(g=>g.agent===id&&g.member===member&&g.status==='active');}
 function validateInvite(member,name,email,d=read()){
  if(!name.trim())return 'お名前を入力してください。';
  if(name.trim().length>40)return 'お名前は40文字以内で入力してください。';
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())||email.length>254)return 'メールアドレスを確認してください。';
  if(grants(member,d).length>=2)return '登録できる代理人は、招待中・利用停止中を含めて2名までです。';
  const a=d.agents.find(a=>a.email.toLowerCase()===email.trim().toLowerCase());
  if(a&&grants(member,d).some(g=>g.agent===a.id))return 'このメールアドレスはすでに登録されています。';
  return '';
 }
 function invite(member,name,email){const d=read(),error=validateInvite(member,name,email,d);if(error)throw Error(error);let a=d.agents.find(a=>a.email.toLowerCase()===email.trim().toLowerCase());const existing=!!a;if(!a){a={id:uid(),name:name.trim(),email:email.trim().toLowerCase()};d.agents.push(a);}const g={id:uid(),member,agent:a.id,status:'pending',name:name.trim(),expires:Date.now()+7*86400000,existing};d.grants.push(g);write(d);return g;}
 function change(id,action){const d=read(),g=d.grants.find(g=>g.id===id);if(!g)throw Error('この登録は見つかりません。');if(action==='remove')d.grants=d.grants.filter(g=>g.id!==id);else if(action==='pause'&&g.status==='active')g.status='paused';else if(action==='resume'&&g.status==='paused')g.status='active';else if(action==='resend'&&g.status==='pending')g.expires=Date.now()+7*86400000;else throw Error('登録状況が変わりました。画面を開き直してください。');write(d);return g;}
 function profileValues(profile){const name=String(profile.name||'').trim(),organization=String(profile.organization||'').trim();if(!name||name.length>40)throw Error('お名前は1〜40文字で入力してください。');if(organization.length>100)throw Error('企業名・所属は100文字以内で入力してください。');return {name,organization};}
 function updateProfile(id,profile){const d=read(),a=agent(id,d);if(!a)throw Error('アカウントが見つかりません。');Object.assign(a,profileValues(profile));write(d);return a;}
 function accept(id,profile){const d=read(),g=d.grants.find(g=>g.id===id);if(!g||g.status!=='pending')throw Error('この招待は利用済み、または取り消されています。');if(g.expires<Date.now())throw Error('招待の有効期限が切れています。メンバーに再招待をご依頼ください。');if(profile)Object.assign(agent(g.agent,d),profileValues(profile));g.status='active';write(d);return g;}
 return {key,uid,members,read,write,grants,agent,access,validateInvite,invite,change,accept,updateProfile};
})();
