'use strict';
// All edits in this prototype remain in the visitor's browser.
titles.companionNew='同伴者の新規登録';
titles.profilePhoto='顔写真の編集';

function menuProfileStatusMarkup(){
 const label={minimal:'ミニマム公開',middle:'ミドル公開',full:'フル公開',custom:'カスタム公開'}[currentVisibilityPreset()];
 return `<button class="menu-profile-status" onclick="openPanel('profileSettings')"><span class="menu-profile-heading">プロフィール公開設定 <b aria-hidden="true">›</b></span><span class="menu-profile-current"><strong>${label}</strong></span></button>`;
}
function refreshMenuProfileStatus(){const host=$('#menuProfileStatus');if(host)host.innerHTML=menuProfileStatusMarkup();}
refreshMenuProfileStatus();

function directoryRegistrationMarkup(){return `<form class="companion-registration" onsubmit="event.preventDefault();registerDirectoryCompanion()"><p class="settings-intro">次のラウンドをご一緒する方を登録できます。</p><label for="directoryName">氏名 <small>必須</small></label><input id="directoryName" class="field" maxlength="40" required placeholder="例：山本 太郎" autocomplete="off"><label for="directoryKana">フリガナ</label><input id="directoryKana" class="field" maxlength="60" placeholder="例：ヤマモト タロウ" autocomplete="off"><label for="directoryType">区分</label><select id="directoryType" class="field"><option value="guest">ゲスト</option><option value="member">メンバー</option></select><label for="directoryPhone">電話番号 <small>任意</small></label><input id="directoryPhone" class="field" type="tel" maxlength="20" placeholder="未入力でも登録できます" autocomplete="off"><p id="directoryRegisterError" class="cp-error" role="alert"></p><button type="submit" class="bk-primary">同伴者リストに登録する</button><button type="button" class="bk-secondary" onclick="backPanel()">登録せずに戻る</button><p class="bk-note">登録した方は、予約時の同伴者リストから選べます。<br>体験版の登録内容は、このブラウザ内に保存されます。</p></form>`;}
function registerDirectoryCompanion(){
 const name=$('#directoryName').value.trim(),error=$('#directoryRegisterError');
 if(!name){error.textContent='氏名を入力してください。';$('#directoryName').focus();return;}
 if(state.companions.some(c=>normalizePersonQuery(c.name)===normalizePersonQuery(name))){error.textContent='同じ氏名の方が登録されています。リストからご確認ください。';return;}
 const phone=$('#directoryPhone').value.trim();
 const c={id:'person'+Date.now()+Math.random().toString(36).slice(2,7),name,kana:$('#directoryKana').value.trim(),type:$('#directoryType').value==='member'?'member':'guest',phone:phone?phone.replace(/.(?=.{4})/g,'*'):'',extraVisits:[]};
 state.companions.push(c);save();
 if(saveFailed){state.companions.pop();error.textContent='保存できませんでした。ブラウザの保存容量・設定をご確認ください。';return;}
 directoryUI.tab='list';directoryUI.initial='全て';
 history.replaceState({...history.state,route:{k:'companionList',arg:null}},'',location.pathname+location.search+'#companionList');render('companionList');toast('同伴者リストに登録しました');
}

function validProfilePhoto(){return typeof state.profilePhoto==='string'&&/^data:image\/(webp|png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(state.profilePhoto);}
function ownPhotoMarkup(){return validProfilePhoto()?`<img class="own-photo" src="${state.profilePhoto}" alt="ご自身の顔写真">`:'<img class="own-photo" src="assets/tsuyoshi-ito-portrait.jpeg" alt="伊藤様の顔写真">';}
function memberPhotoOverlay(checkin){
 if(checkin)return validProfilePhoto()?`<span class="reference-photo-overlay">${ownPhotoMarkup()}</span>`:'';
 return `<button class="reference-photo-overlay editable-photo" onclick="openPanel('profilePhoto')" aria-label="顔写真をタップして編集">${ownPhotoMarkup()}<span class="photo-edit-badge" aria-hidden="true">✎</span></button>`;
}

let photoEditor=null,photoLoadSequence=0;
function cleanupPhotoEditor(){photoLoadSequence++;photoEditor=null;}
function photoEditorMarkup(){return `<div class="photo-editor"><p class="settings-intro">写真を選んで、丸い枠に合わせて調整してください。</p><label class="photo-file-label" for="profilePhotoFile">写真を選択する<input id="profilePhotoFile" type="file" accept="image/*" onchange="selectProfilePhoto(this)"></label><div class="photo-crop-stage"><canvas id="photoCropCanvas" width="320" height="320" aria-label="顔写真の切り抜きプレビュー"></canvas></div><p class="photo-drag-hint">写真をドラッグして位置を調整できます</p><div class="photo-controls"><label for="photoZoom">拡大率 <output id="photoZoomValue">100%</output></label><input id="photoZoom" type="range" min="1" max="3" step="0.01" value="1" oninput="adjustPhoto('zoom',this.value)"><label for="photoX">左右の位置</label><input id="photoX" type="range" min="-100" max="100" value="0" oninput="adjustPhoto('x',this.value)"><label for="photoY">上下の位置</label><input id="photoY" type="range" min="-100" max="100" value="0" oninput="adjustPhoto('y',this.value)"><button class="photo-reset" onclick="resetPhotoCrop()">位置・拡大率をリセット</button></div><p class="cp-error" id="photoError" role="alert"></p><p class="photo-privacy-note">写真を変更しても、公開設定は変わりません。<br>現在：${state.profileVisibility.portrait==='photo'?'顔写真を表示':'他のメンバーにはアイコンで表示'}</p><button id="savePhotoButton" class="bk-primary" onclick="saveProfilePhoto()" disabled>この写真を保存する</button><button class="bk-secondary" onclick="backPanel()">保存せずに戻る</button><p class="bk-note">写真はこのブラウザ内に保存されます。</p></div>`;}
function mountPhotoEditor(){
 photoEditor={image:null,zoom:1,x:0,y:0,drag:null};
 loadPhotoImage(validProfilePhoto()?state.profilePhoto:'assets/member-profile.png',!validProfilePhoto());
 const canvas=$('#photoCropCanvas');
 canvas.addEventListener('pointerdown',e=>{if(!photoEditor?.image)return;canvas.setPointerCapture(e.pointerId);photoEditor.drag={x:e.clientX,y:e.clientY};});
 canvas.addEventListener('pointermove',e=>{if(!photoEditor?.drag)return;const rect=canvas.getBoundingClientRect(),g=photoCropGeometry(photoEditor.image.width,photoEditor.image.height,photoEditor.zoom,photoEditor.x,photoEditor.y);const dx=(e.clientX-photoEditor.drag.x)*320/rect.width,dy=(e.clientY-photoEditor.drag.y)*320/rect.height;photoEditor.x=clampPhoto(photoEditor.x+(g.maxX?dx/g.maxX*100:0),-100,100);photoEditor.y=clampPhoto(photoEditor.y+(g.maxY?dy/g.maxY*100:0),-100,100);photoEditor.drag={x:e.clientX,y:e.clientY};syncPhotoControls();drawPhotoCrop();});
 for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,()=>{if(photoEditor)photoEditor.drag=null;});
}
function selectProfilePhoto(input){
 const file=input.files?.[0];if(!file)return;
 if(!file.type.startsWith('image/')||file.size>20*1024*1024){$('#photoError').textContent='20MB以下の画像を選択してください。';input.value='';return;}
 const url=URL.createObjectURL(file);loadPhotoImage(url,false,()=>URL.revokeObjectURL(url));input.value='';
}
function loadPhotoImage(src,isDefault=false,cleanup=()=>{}){
 const seq=++photoLoadSequence;photoEditor.image=null;$('#savePhotoButton').disabled=true;$('#photoError').textContent='';
 const img=new Image();img.onload=()=>{cleanup();if(seq!==photoLoadSequence||current?.k!=='profilePhoto'||!photoEditor)return;
  if(!img.naturalWidth||img.naturalWidth*img.naturalHeight>80000000){$('#photoError').textContent='画像が大きすぎます。小さくして再度選択してください。';return;}
  const normalized=document.createElement('canvas');
  const crop=isDefault?{x:img.naturalWidth*303/945,y:img.naturalHeight*442/2048,w:img.naturalWidth*339/945,h:img.naturalHeight*339/2048}:{x:0,y:0,w:img.naturalWidth,h:img.naturalHeight};
  const scale=Math.min(1,1600/Math.max(crop.w,crop.h));normalized.width=Math.round(crop.w*scale);normalized.height=Math.round(crop.h*scale);
  normalized.getContext('2d').drawImage(img,crop.x,crop.y,crop.w,crop.h,0,0,normalized.width,normalized.height);photoEditor.image=normalized;resetPhotoCrop();$('#savePhotoButton').disabled=false;
 };img.onerror=()=>{cleanup();if(seq===photoLoadSequence&&current?.k==='profilePhoto')$('#photoError').textContent='画像を読み込めませんでした。JPEG・PNGなど別の画像を選んでください。';};img.src=src;
}
function clampPhoto(v,min,max){return Math.max(min,Math.min(max,v));}
function photoCropGeometry(width,height,zoom,x,y){const scale=Math.max(320/width,320/height)*zoom,w=width*scale,h=height*scale,maxX=(w-320)/2,maxY=(h-320)/2;return {w,h,maxX,maxY,left:(320-w)/2+maxX*x/100,top:(320-h)/2+maxY*y/100};}
function syncPhotoControls(){if(!photoEditor)return;$('#photoZoom').value=photoEditor.zoom;$('#photoX').value=photoEditor.x;$('#photoY').value=photoEditor.y;$('#photoZoomValue').textContent=Math.round(photoEditor.zoom*100)+'%';}
function resetPhotoCrop(){if(!photoEditor)return;photoEditor.zoom=1;photoEditor.x=photoEditor.y=0;syncPhotoControls();drawPhotoCrop();}
function adjustPhoto(key,value){if(!photoEditor)return;const n=Number(value);if(!Number.isFinite(n))return;photoEditor[key]=clampPhoto(n,key==='zoom'?1:-100,key==='zoom'?3:100);syncPhotoControls();drawPhotoCrop();}
function drawPhotoCrop(){if(!photoEditor?.image)return;const c=$('#photoCropCanvas'),ctx=c.getContext('2d'),g=photoCropGeometry(photoEditor.image.width,photoEditor.image.height,photoEditor.zoom,photoEditor.x,photoEditor.y);ctx.clearRect(0,0,320,320);ctx.drawImage(photoEditor.image,g.left,g.top,g.w,g.h);}
function saveProfilePhoto(){
 if(!photoEditor?.image)return;
 const canvas=document.createElement('canvas');canvas.width=canvas.height=320;const ctx=canvas.getContext('2d');ctx.beginPath();ctx.arc(160,160,160,0,Math.PI*2);ctx.clip();ctx.drawImage($('#photoCropCanvas'),0,0);
 const previous=state.profilePhoto;state.profilePhoto=canvas.toDataURL('image/webp',0.88);save();
 if(saveFailed){state.profilePhoto=previous;$('#photoError').textContent='写真を保存できませんでした。ブラウザの保存容量・設定をご確認ください。';return;}
 history.replaceState({...history.state,route:{k:'profile',arg:null}},'',location.pathname+location.search+'#profile');render('profile');toast('顔写真を保存しました');
}


// Course handicaps are shown by course and tee in the details dialog.
const profileHandicap={jgaIndex:'10.2'};
function profileIdentityMarkup(){return `<section class="profile-identity" aria-label="会員情報"><div class="profile-portrait">${memberPhotoOverlay(false)}</div><h3 class="profile-member-name">伊藤 剛</h3><p class="profile-english-name">Tsuyoshi Ito</p><p class="profile-tenure">在籍：13年359日</p><p class="profile-joined">（入会：2012年11月1日）</p><p class="profile-birthday">生年月日：1985年6月18日（41歳）</p><div class="profile-handicap" aria-label="ハンディキャップ"><div class="profile-handicap-cell"><span>JGA Index</span><strong>${profileHandicap.jgaIndex}</strong></div><button type="button" class="profile-handicap-cell profile-course-handicap" aria-label="コースHDCPの詳細" onclick="document.getElementById('courseHandicapDialog').showModal()"><span>コースHDCP</span><strong class="profile-handicap-details">詳細</strong></button></div><div class="profile-membership"><span>正会員</span><strong>0889582</strong></div><div class="profile-barcode" role="img" aria-label="会員番号0889582のサンプルバーコード"></div><p class="profile-barcode-number">0889582</p></section>${courseHandicapMarkup()}`;}
function courseHandicapMarkup(){const rows=[['バック',14,14],['レギュラー',13,12],['フロント',11,10],['レディース',8,'-'],['ゴールド',7,6]];return `<dialog id="courseHandicapDialog" class="profile-handicap-dialog" aria-labelledby="handicapDialogTitle" onclick="if(event.target===this)this.close()"><div class="profile-handicap-dialog-content"><header><div><h3 id="handicapDialogTitle">伊藤 剛様のコースHDCP</h3><p class="handicap-updated">（2027年4月10日更新）</p></div><button type="button" class="handicap-dialog-close" aria-label="詳細を閉じる" onclick="document.getElementById('courseHandicapDialog').close()">✖︎</button></header><section class="profile-handicap-modal"><table class="course-handicap-table" aria-label="ティー別のコースHDCP"><colgroup><col style="width:44%"><col style="width:28%"><col style="width:28%"></colgroup><thead><tr><th scope="col"><span class="handicap-sr-only">ティー</span></th><th scope="col">旧コース</th><th scope="col">新コース</th></tr></thead><tbody>${rows.map(([tee,oldCourse,newCourse])=>`<tr><th scope="row">${tee}</th><td>${oldCourse}</td><td>${newCourse}</td></tr>`).join('')}</tbody></table><p class="handicap-sample">サンプル画面</p><button type="button" class="secondary" onclick="document.getElementById('courseHandicapDialog').close()">閉じる</button></section></div></dialog>`;}

function checkinIdentityMarkup(){return `<section class="profile-identity checkin-identity" aria-label="チェックイン会員情報"><div class="profile-barcode checkin-barcode" role="img" aria-label="会員番号0889582のサンプルバーコード"></div><p class="profile-barcode-number">0889582</p><div class="profile-portrait">${ownPhotoMarkup()}</div><h3 class="profile-member-name">伊藤 剛</h3><p class="profile-english-name">Tsuyoshi Ito</p><div class="checkin-tenure-row"><p class="profile-tenure">在籍：13年359日</p><p class="profile-joined">（入会：2012-11-1）</p></div><div class="profile-membership"><span>正会員</span><strong>0889582</strong></div></section>`;}
