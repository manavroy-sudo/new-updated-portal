/* ============================================================
   Partner Engage Portal — app.js v13
   Complete logic: login, overview, partner table, AM/team cards,
   View modal with 14-month trend, Tele-RM tab, daily run rate
   ============================================================ */

(function(){
'use strict';

var API = (typeof API_URL !== 'undefined') ? API_URL : '';
var DATA = null;  // Full response from getData
var USER = null;  // Logged-in user object
var ALL_PARTNERS = [];
var MY_PARTNERS  = [];
var AP_PAGE = 1, MP_PAGE = 1;
var AP_SORT = {col:'name',dir:'asc'};
var AP_FILTERS = {};
var ITEMS_PER_PAGE = 50;

// Month labels
var MONTHS = ["Apr'25","May'25","Jun'25","Jul'25","Aug'25","Sep'25",
              "Oct'25","Nov'25","Dec'25","Jan'26","Feb'26","Mar'26","Apr'26"];
var MONTH_KEYS = ['apr25','may25','jun25','jul25','aug25','sep25',
                  'oct25','nov25','dec25','jan26','feb26','mar26','apr26'];

// ── Utilities ────────────────────────────────────────────────
function $(id){ return document.getElementById(id); }
function safe(v){ return (v===null||v===undefined)?'':String(v); }

function fmt(val){
  var v=Number(val)||0;
  if(v===0) return '₹0';
  if(Math.abs(v)>=10000000) return '₹'+(v/10000000).toFixed(2)+' Cr';
  if(Math.abs(v)>=100000)   return '₹'+(v/100000).toFixed(2)+' L';
  if(Math.abs(v)>=1000)     return '₹'+(v/1000).toFixed(1)+' K';
  return '₹'+Math.round(v).toLocaleString('en-IN');
}

function fmtN(val){
  var v=Number(val)||0;
  return v.toLocaleString('en-IN');
}

function fmtPct(val){ return (Number(val)||0)+'%'; }

function pctClass(v){
  v=Number(v)||0;
  if(v>0) return 'val-green';
  if(v<0) return 'val-red';
  return 'val-dim';
}

function statusPill(active){
  var a=String(active||'').toLowerCase();
  var isActive=(a==='active'||a==='1'||a==='yes'||Number(active)>0);
  return isActive
    ? '<span class="pill pill-active">● Active</span>'
    : '<span class="pill pill-inactive">○ Inactive</span>';
}

function growthPill(growth){
  var g=String(growth||'').toLowerCase();
  if(g.indexOf('degrowth')>=0) return '<span class="pill pill-degrowth">▼ Degrowth</span>';
  if(g.indexOf('growth')>=0)   return '<span class="pill pill-growth">▲ Growth</span>';
  var pv=parseFloat(String(growth).replace('%',''))||0;
  if(pv>0) return '<span class="pill pill-growth">▲ Growth</span>';
  if(pv<0) return '<span class="pill pill-degrowth">▼ Degrowth</span>';
  return '<span class="pill pill-inactive">— Flat</span>';
}

function connPill(p){
  return (p.calls>0||p.visits>0)
    ? '<span class="pill pill-conn">● Connected</span>'
    : '<span class="pill pill-notconn">○ Not Connected</span>';
}

function callApi(action,params,cb){
  var url=API+'?action='+encodeURIComponent(action);
  if(params) Object.keys(params).forEach(function(k){
    url+='&'+encodeURIComponent(k)+'='+encodeURIComponent(params[k]);
  });
  var cbName='cb_'+Date.now()+'_'+Math.floor(Math.random()*9999);
  window[cbName]=function(data){
    delete window[cbName];
    var s=document.getElementById('jsonp_'+cbName);
    if(s) s.remove();
    cb(null,data);
  };
  url+='&callback='+cbName;
  var s=document.createElement('script');
  s.id='jsonp_'+cbName;
  s.src=url;
  s.onerror=function(){cb(new Error('Network error'));};
  document.head.appendChild(s);
}

function setLoading(show,msg){
  $('loadingScreen').style.display=show?'flex':'none';
  if(msg) $('loadingMsg').textContent=msg;
}

// ── Login ───────────────────────────────────────────────────
function initLogin(){
  $('loginScreen').style.display='flex';
  $('appShell').style.display='none';
  $('btnLogin').addEventListener('click',doLogin);
  $('loginPass').addEventListener('keydown',function(e){ if(e.key==='Enter') doLogin(); });
  $('loginGID').addEventListener('keydown',function(e){ if(e.key==='Enter') doLogin(); });
}

function doLogin(){
  var gid=$('loginGID').value.trim();
  var pass=$('loginPass').value;
  if(!gid){ showError('Please enter your GID'); return; }
  $('loginError').style.display='none';
  $('btnLogin').textContent='Signing in…';
  callApi('login',{uid:gid,password:pass},function(err,res){
    $('btnLogin').textContent='Sign In';
    if(err||!res||!res.success){
      showError((res&&res.message)||'Login failed. Check your GID and password.');
      return;
    }
    USER=res.user;
    localStorage.setItem('pe_user',JSON.stringify(USER));
    loadDashboard();
  });
}

function showError(msg){
  var el=$('loginError');
  el.textContent=msg;
  el.style.display='block';
}

function doLogout(){
  localStorage.removeItem('pe_user');
  USER=null; DATA=null; ALL_PARTNERS=[];
  $('loginScreen').style.display='flex';
  $('appShell').style.display='none';
  $('loginGID').value='';
  $('loginPass').value='';
}

// ── Dashboard Load ───────────────────────────────────────────
function loadDashboard(){
  $('loginScreen').style.display='none';
  setLoading(true,'Loading your dashboard…');

  var action = (USER.role==='MASTER') ? 'getMaster' : 'getData';

  callApi(action,{uid:USER.gid},function(err,res){
    setLoading(false);
    if(err||!res||!res.success){
      showError((res&&res.message)||'Failed to load data.');
      $('loginScreen').style.display='flex';
      return;
    }
    DATA=res;
    $('appShell').style.display='block';
    setupHeader();
    setupNav();
    buildAllData();
    showTab('overview');
  });
}

function setupHeader(){
  $('hdrName').textContent=USER.name||'—';
  $('hdrRole').textContent=USER.role+(USER.zone?' · '+USER.zone:'');
  $('btnLogout').addEventListener('click',doLogout);
}

function setupNav(){
  var role=(USER.role||'').toUpperCase();
  var zone=(USER.zone||'').toLowerCase();
  var isTele = zone.indexOf('tele')>=0;
  var isZH   = role==='ZH'||role==='MASTER';
  var isSH   = role==='SH'||role==='RH';

  // Hide/show tabs based on role
  if(isTele){
    $('tabTeleRM').style.display='';
    $('tabAMPerf').style.display='';
    $('tabTeamPerf').style.display='';
  } else if(isZH||isSH){
    $('tabAMPerf').style.display='';
    $('tabTeamPerf').style.display='';
  } else {
    // AM/RM
    $('tabAMPerf').style.display='none';
    $('tabTeamPerf').style.display='none';
  }

  document.querySelectorAll('.nav-tab').forEach(function(btn){
    btn.addEventListener('click',function(){
      showTab(this.dataset.tab);
    });
  });
}

function showTab(tab){
  document.querySelectorAll('.nav-tab').forEach(function(b){
    b.classList.toggle('active', b.dataset.tab===tab);
  });
  document.querySelectorAll('.page').forEach(function(p){
    p.classList.toggle('active', p.id==='page-'+tab);
  });
  if(tab==='allPartners') renderAllPartners();
  if(tab==='myPartners')  renderMyPartners();
  if(tab==='amPerf')      renderAMPerf();
  if(tab==='teamPerf')    renderTeamPerf();
  if(tab==='teleRM')      renderTeleRM();
  if(tab==='dailyRR')     renderDailyRR();
}

// ── Build data from API response ────────────────────────────
function buildAllData(){
  var role=USER.role.toUpperCase();
  var name=USER.name||'';

  if(DATA.main){
    // MASTER view
    ALL_PARTNERS = DATA.main.partners||[];
    MY_PARTNERS  = ALL_PARTNERS;
  } else {
    ALL_PARTNERS = DATA.partners||[];
    // MY PARTNERS = where ownerName matches current user
    MY_PARTNERS  = ALL_PARTNERS.filter(function(p){
      return p.oName===name || p.oEmp===USER.empId;
    });
    if(MY_PARTNERS.length===0) MY_PARTNERS=ALL_PARTNERS; // fallback
  }

  buildOverview();
  populateFilters();
}

// ── Overview ────────────────────────────────────────────────
function buildOverview(){
  var s = DATA.summary || (DATA.main&&DATA.main.summary) || {};

  $('ovTotalPartners').textContent = fmtN(s.total||0);
  $('ovActive').textContent        = 'Active: '+fmtN(s.active||0);
  $('ovInactive').textContent      = 'Inactive: '+fmtN(s.inactive||0);

  $('ovMTD').textContent   = fmt(s.mtd||0).replace('₹','');
  $('ovMTD2').textContent  = fmt(s.mtd||0).replace('₹','');
  $('ovLMTD').textContent  = fmt(s.lmtd||0).replace('₹','');
  $('ovMaxPot').textContent= fmt(s.maxPot||0).replace('₹','');
  $('ovOPot').textContent  = fmt(s.oPot||0).replace('₹','');
  $('ovTarget').textContent= fmt(s.target||0).replace('₹','');
  $('ovMaxAch').textContent= fmtPct(s.maxAch||0);

  var mom=s.mom||0;
  $('ovMOM').textContent='MoM: '+(mom>=0?'+':'')+mom+'%';
  $('ovAch').textContent='Ach: '+(s.ach||0)+'%';
  $('ovMTDvsLMTD').textContent=(mom>=0?'▲ +':'▼ ')+mom+'% vs last month';
  $('ovMTDvsLMTD').className=mom>=0?'up':'down';

  $('ovEngagement').textContent=fmtN(s.connected||0)+' / '+fmtN(s.total||0);
  $('ovConn').textContent='Connected: '+fmtN(s.connected||0);
  $('ovNotConn').textContent='Not: '+fmtN(s.notConn||0);

  $('ovCalls').textContent   = fmtN(s.calls||0);
  $('ovVisits').textContent  = fmtN(s.visits||0);
  $('ovGrowth').textContent  = fmtN(s.growth||0);
  $('ovDegrowth').textContent= fmtN(s.degrowth||0);

  // Donut charts
  buildDonut('chartActiveInactive',
    [s.active||0, s.inactive||0],
    ['Active','Inactive'],
    ['var(--green)','var(--text3)']
  );
  buildDonut('chartConnected',
    [s.connected||0, s.notConn||0],
    ['Connected','Not Connected'],
    ['var(--blue)','var(--amber)']
  );
  buildDonut('chartGrowth',
    [s.growth||0, s.degrowth||0],
    ['Growth','Degrowth'],
    ['var(--green)','var(--red)']
  );
}

function buildDonut(containerId, values, labels, colors){
  var el=$(containerId);
  if(!el) return;
  var total=values.reduce(function(a,b){return a+b;},0)||1;
  var r=50, cx=60, cy=60, sw=16;
  var circumference=2*Math.PI*r;
  var svgParts='', offset=circumference*0.25; // start from top

  values.forEach(function(v,i){
    var slice=(v/total)*circumference;
    var dash=slice+' '+(circumference-slice);
    svgParts+='<circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="none" stroke="'+colors[i]+'"'+
              ' stroke-width="'+sw+'" stroke-dasharray="'+dash+'" stroke-dashoffset="'+offset+'"'+
              ' stroke-linecap="butt" style="transition:stroke-dashoffset .6s ease;" />';
    offset-=slice;
  });

  var svgHTML='<svg class="donut-svg" viewBox="0 0 120 120" width="100" height="100">'+
    '<circle cx="60" cy="60" r="50" fill="none" stroke="var(--border)" stroke-width="16"/>'+
    svgParts+
    '<text x="60" y="56" text-anchor="middle" fill="var(--text)" font-size="14" font-weight="700" font-family="DM Sans,sans-serif">'+
    (total===1&&values[0]===0&&values[1]===0?'0':fmtN(values[0]))+'</text>'+
    '<text x="60" y="70" text-anchor="middle" fill="var(--text2)" font-size="9" font-family="DM Sans,sans-serif">'+
    (labels[0]||'')+'</text>'+
    '</svg>';

  var legendHTML='<div class="donut-legend">';
  values.forEach(function(v,i){
    var pct2=total>0?Math.round(v*100/total):0;
    legendHTML+='<div class="donut-legend-item">'+
      '<div class="donut-legend-label">'+
        '<div class="donut-legend-dot" style="background:'+colors[i]+'"></div>'+
        '<span>'+labels[i]+'</span>'+
      '</div>'+
      '<div><span class="donut-legend-val" style="color:'+colors[i]+'">'+fmtN(v)+'</span>'+
      ' <span style="color:var(--text3);font-size:11px;">('+pct2+'%)</span></div>'+
      '</div>';
  });
  legendHTML+='</div>';

  el.innerHTML=svgHTML+legendHTML;
}

// ── Populate filter dropdowns ────────────────────────────────
function populateFilters(){
  var cities = DATA.cities||[];
  var states = DATA.states||[];

  // City
  var cityEl=$('apCity');
  cities.forEach(function(c){
    var o=document.createElement('option');
    o.value=c; o.textContent=c;
    cityEl.appendChild(o);
  });

  // State
  var stateEl=$('apState');
  states.forEach(function(s){
    var o=document.createElement('option');
    o.value=s; o.textContent=s;
    stateEl.appendChild(o);
  });

  // Owner
  var ownerEl=$('apOwner');
  var owners={};
  ALL_PARTNERS.forEach(function(p){ if(p.oName) owners[p.oName]=p.oRole||''; });
  Object.keys(owners).sort().forEach(function(n){
    var o=document.createElement('option');
    o.value=n; o.textContent=n+' ('+owners[n]+')';
    ownerEl.appendChild(o);
  });

  // Role
  var roleEl=$('apRole');
  var roles={};
  ALL_PARTNERS.forEach(function(p){ if(p.oRole) roles[p.oRole]=1; });
  Object.keys(roles).sort().forEach(function(r){
    var o=document.createElement('option');
    o.value=r; o.textContent=r;
    roleEl.appendChild(o);
  });

  // AM filter for AM Performance
  var amEl=$('amFilter');
  var ams={};
  ALL_PARTNERS.forEach(function(p){
    if((p.oRole||'').toUpperCase()==='AM'||(p.oRole||'').toUpperCase()==='RM') ams[p.oName]=1;
  });
  Object.keys(ams).sort().forEach(function(n){
    var o=document.createElement('option');
    o.value=n; o.textContent=n;
    amEl.appendChild(o);
  });

  // Filter event listeners
  ['apSearch','apState','apCity','apOwner','apRole','apStatus','apTrend','apConn','apMTD'].forEach(function(id){
    var el=$(id);
    if(el) el.addEventListener('input',function(){ AP_PAGE=1; renderAllPartners(); });
  });
  $('apClear').addEventListener('click',function(){
    ['apSearch','apState','apCity','apOwner','apRole','apStatus','apTrend','apConn','apMTD'].forEach(function(id){
      var el=$(id); if(el) el.value='';
    });
    AP_PAGE=1; renderAllPartners();
  });
  $('apExport').addEventListener('click', exportCSV);

  // AM Performance filters
  ['amSearch','amSort','amFilter'].forEach(function(id){
    var el=$(id); if(el) el.addEventListener('input',renderAMPerf);
  });

  // My Partners filters
  ['mpSearch','mpStatus','mpTrend'].forEach(function(id){
    var el=$(id); if(el) el.addEventListener('input',function(){ MP_PAGE=1; renderMyPartners(); });
  });

  // Table sort headers
  document.querySelectorAll('.tbl th.sortable').forEach(function(th){
    th.addEventListener('click',function(){
      var col=this.dataset.col;
      var tblId=this.closest('table').id;
      if(tblId==='apTable'){
        if(AP_SORT.col===col) AP_SORT.dir=AP_SORT.dir==='asc'?'desc':'asc';
        else{AP_SORT.col=col;AP_SORT.dir='desc';}
        AP_PAGE=1;
        renderAllPartners();
      }
    });
  });
}

// ── Filter & sort partners ───────────────────────────────────
function applyFilters(partners){
  var search=($('apSearch')&&$('apSearch').value||'').toLowerCase().trim();
  var state =$('apState')&&$('apState').value||'';
  var city  =$('apCity')&&$('apCity').value||'';
  var owner =$('apOwner')&&$('apOwner').value||'';
  var role  =$('apRole')&&$('apRole').value||'';
  var status=$('apStatus')&&$('apStatus').value||'';
  var trend =$('apTrend')&&$('apTrend').value||'';
  var conn  =$('apConn')&&$('apConn').value||'';

  return partners.filter(function(p){
    if(search && !(
      (p.name||'').toLowerCase().indexOf(search)>=0 ||
      (p.gid||'').toLowerCase().indexOf(search)>=0  ||
      (p.city||'').toLowerCase().indexOf(search)>=0
    )) return false;
    if(state && p.state!==state) return false;
    if(city  && p.city!==city)   return false;
    if(owner && p.oName!==owner) return false;
    if(role  && p.oRole!==role)  return false;
    if(status){
      var a=String(p.active||'').toLowerCase();
      var isAct=(a==='active'||a==='1'||a==='yes'||Number(p.active)>0);
      if(status==='active'&&!isAct) return false;
      if(status==='inactive'&&isAct) return false;
    }
    if(trend){
      var g=String(p.growth||'').toLowerCase();
      if(trend==='growth'&&g.indexOf('degrowth')>=0) return false;
      if(trend==='degrowth'&&g.indexOf('degrowth')<0) return false;
    }
    if(conn){
      var isConn=(p.calls>0||p.visits>0);
      if(conn==='connected'&&!isConn) return false;
      if(conn==='not'&&isConn) return false;
    }
    return true;
  });
}

function sortPartners(partners, sort){
  var dir=sort.dir==='asc'?1:-1;
  return partners.slice().sort(function(a,b){
    var av=a[sort.col]||0, bv=b[sort.col]||0;
    if(sort.col==='name'){ av=a.name||''; bv=b.name||''; }
    if(typeof av==='string') return av.localeCompare(bv)*dir;
    return (Number(av)-Number(bv))*dir;
  });
}

// ── Render All Partners ─────────────────────────────────────
function renderAllPartners(){
  var filtered=applyFilters(ALL_PARTNERS);
  var sorted=sortPartners(filtered, AP_SORT);

  $('apCount').textContent=filtered.length+' of '+ALL_PARTNERS.length+' partners';

  var totalPages=Math.max(1,Math.ceil(sorted.length/ITEMS_PER_PAGE));
  if(AP_PAGE>totalPages) AP_PAGE=1;
  var page=sorted.slice((AP_PAGE-1)*ITEMS_PER_PAGE, AP_PAGE*ITEMS_PER_PAGE);

  var body=$('apBody');
  body.innerHTML=page.map(function(p){ return partnerRow(p,true); }).join('');

  renderPagination('apPagination', AP_PAGE, totalPages, function(pg){ AP_PAGE=pg; renderAllPartners(); });
  attachViewButtons(body);
}

function partnerRow(p, showOwner){
  var mom=0;
  if(p.lmtd>0) mom=Math.round((p.mtd-p.lmtd)*100/p.lmtd);
  else if(p.mtd>0) mom=100;
  var momClass=pctClass(mom);

  return '<tr>'+
    '<td class="name-cell"><div class="p-name">'+safe(p.name)+'</div><div class="p-gid">'+safe(p.gid)+'</div></td>'+
    '<td style="color:var(--text2)">'+safe(p.city)+'<br><span style="font-size:11px;color:var(--text3)">'+safe(p.state)+'</span></td>'+
    (showOwner?'<td style="color:var(--text2)">'+safe(p.oName)+'<br><span style="font-size:11px;color:var(--text3)">'+safe(p.oRole)+'</span></td>':'')+
    '<td class="val-dim">'+fmt(p.maxPot)+'</td>'+
    '<td class="val-amber">'+fmt(p.oPot)+'</td>'+
    '<td class="val-dim">'+fmt(p.target)+'</td>'+
    '<td class="'+(p.mtd>p.lmtd?'val-green':'val-amber')+'">'+fmt(p.mtd)+'</td>'+
    '<td class="val-dim">'+fmt(p.lmtd)+'</td>'+
    '<td class="'+momClass+'">'+(mom>=0?'+':'')+mom+'%</td>'+
    '<td>'+growthPill(p.growth)+'</td>'+
    '<td>'+statusPill(p.active)+'</td>'+
    '<td>'+connPill(p)+'</td>'+
    '<td class="val-green">'+fmtN(p.calls)+'</td>'+
    '<td class="val-dim">'+fmtN(p.visits)+'</td>'+
    '<td><button class="btn-view" data-gid="'+safe(p.gid)+'" data-name="'+safe(p.name)+'">View</button></td>'+
    '</tr>';
}

function myPartnerRow(p){
  var mom=0;
  if(p.lmtd>0) mom=Math.round((p.mtd-p.lmtd)*100/p.lmtd);
  else if(p.mtd>0) mom=100;

  return '<tr>'+
    '<td class="name-cell"><div class="p-name">'+safe(p.name)+'</div><div class="p-gid">'+safe(p.gid)+'</div></td>'+
    '<td style="color:var(--text2)">'+safe(p.city)+'<br><span style="font-size:11px;color:var(--text3)">'+safe(p.state)+'</span></td>'+
    '<td class="val-dim">'+fmt(p.maxPot)+'</td>'+
    '<td class="val-amber">'+fmt(p.oPot)+'</td>'+
    '<td class="val-dim">'+fmt(p.target)+'</td>'+
    '<td class="'+(p.mtd>p.lmtd?'val-green':'val-amber')+'">'+fmt(p.mtd)+'</td>'+
    '<td class="val-dim">'+fmt(p.lmtd)+'</td>'+
    '<td>'+growthPill(p.growth)+'</td>'+
    '<td>'+statusPill(p.active)+'</td>'+
    '<td class="val-green">'+fmtN(p.calls)+'</td>'+
    '<td class="val-dim">'+fmtN(p.visits)+'</td>'+
    '<td><button class="btn-view" data-gid="'+safe(p.gid)+'" data-name="'+safe(p.name)+'">View</button></td>'+
    '</tr>';
}

function renderMyPartners(){
  var search=($('mpSearch')&&$('mpSearch').value||'').toLowerCase();
  var status=$('mpStatus')&&$('mpStatus').value||'';
  var trend =$('mpTrend')&&$('mpTrend').value||'';

  var filtered=MY_PARTNERS.filter(function(p){
    if(search&&!(p.name||'').toLowerCase().includes(search)&&!(p.gid||'').toLowerCase().includes(search)) return false;
    if(status){
      var a=String(p.active||'').toLowerCase();
      var isAct=(a==='active'||a==='1'||a==='yes'||Number(p.active)>0);
      if(status==='active'&&!isAct) return false;
      if(status==='inactive'&&isAct) return false;
    }
    if(trend){
      var g=String(p.growth||'').toLowerCase();
      if(trend==='growth'&&g.indexOf('degrowth')>=0) return false;
      if(trend==='degrowth'&&g.indexOf('degrowth')<0) return false;
    }
    return true;
  });

  var totalPages=Math.max(1,Math.ceil(filtered.length/ITEMS_PER_PAGE));
  if(MP_PAGE>totalPages) MP_PAGE=1;
  var page=filtered.slice((MP_PAGE-1)*ITEMS_PER_PAGE,MP_PAGE*ITEMS_PER_PAGE);

  var body=$('mpBody');
  body.innerHTML=page.map(function(p){ return myPartnerRow(p); }).join('');
  renderPagination('mpPagination',MP_PAGE,totalPages,function(pg){ MP_PAGE=pg; renderMyPartners(); });
  attachViewButtons(body);
}

// ── Pagination ───────────────────────────────────────────────
function renderPagination(containerId,current,total,onPage){
  var el=$(containerId);
  if(!el||total<=1){ if(el) el.innerHTML=''; return; }

  var html='<div style="color:var(--text2)">Page '+current+' of '+total+'</div><div class="pg-btns">';
  html+='<button class="pg-btn" '+(current===1?'disabled':'')+' data-pg="'+(current-1)+'">‹ Prev</button>';

  // Show at most 5 page buttons
  var start=Math.max(1,current-2), end=Math.min(total,current+2);
  for(var i=start;i<=end;i++){
    html+='<button class="pg-btn'+(i===current?' active':'')+'" data-pg="'+i+'">'+i+'</button>';
  }
  html+='<button class="pg-btn" '+(current===total?'disabled':'')+' data-pg="'+(current+1)+'">Next ›</button>';
  html+='</div>';
  el.innerHTML=html;

  el.querySelectorAll('.pg-btn:not(:disabled)').forEach(function(btn){
    btn.addEventListener('click',function(){ onPage(parseInt(this.dataset.pg)); });
  });
}

// ── AM Performance ───────────────────────────────────────────
function renderAMPerf(){
  var search=($('amSearch')&&$('amSearch').value||'').toLowerCase();
  var sortVal=$('amSort')?$('amSort').value:'mtd_desc';
  var filterAM=$('amFilter')?$('amFilter').value:'';

  // Group by AM/RM owners
  var owners={};
  ALL_PARTNERS.forEach(function(p){
    var role=(p.oRole||'').toUpperCase().replace(':','').trim();
    if(role!=='AM'&&role!=='RM') return;
    if(!owners[p.oName]) owners[p.oName]={name:p.oName,role:p.oRole,emp:p.oEmp,partners:[]};
    owners[p.oName].partners.push(p);
  });

  var list=Object.values(owners).map(function(o){
    var s=summarizeList(o.partners);
    return {name:o.name,role:o.role,emp:o.emp,count:o.partners.length,summary:s,partners:o.partners};
  });

  // Filter
  if(search) list=list.filter(function(o){ return o.name.toLowerCase().indexOf(search)>=0; });
  if(filterAM) list=list.filter(function(o){ return o.name===filterAM; });

  // Sort
  list.sort(function(a,b){
    if(sortVal==='mtd_asc') return a.summary.mtd-b.summary.mtd;
    if(sortVal==='name_asc') return a.name.localeCompare(b.name);
    if(sortVal==='count_desc') return b.count-a.count;
    return b.summary.mtd-a.summary.mtd; // mtd_desc
  });

  var grid=$('amGrid');
  if(list.length===0){
    grid.innerHTML='';
    $('amEmpty').style.display='block';
    return;
  }
  $('amEmpty').style.display='none';
  grid.innerHTML=list.map(function(o){ return teamCardHTML(o); }).join('');

  grid.querySelectorAll('.team-card').forEach(function(card,i){
    card.addEventListener('click',function(){
      openTeamModal(list[i]);
    });
  });
}

// ── Team Performance ─────────────────────────────────────────
function renderTeamPerf(){
  var team=DATA.team||[];
  $('teamPerfCount').textContent=team.length+' MEMBERS';

  if(team.length===0){
    $('teamGrid').innerHTML='<div class="empty-state"><div class="es-icon">👥</div><p>No team data.</p></div>';
    return;
  }

  $('teamGrid').innerHTML=team.map(function(o){ return teamCardHTML(o); }).join('');

  var cards=$('teamGrid').querySelectorAll('.team-card');
  cards.forEach(function(card,i){
    card.addEventListener('click',function(){
      openTeamModal(team[i]);
    });
  });
}

function teamCardHTML(o){
  var s=o.summary||{};
  var ach=s.target>0?Math.round(s.mtd*100/s.target):0;
  var mom=s.mom||0;
  return '<div class="team-card">'+
    '<div class="tc-header">'+
      '<div>'+
        '<div class="tc-name">'+safe(o.name)+'</div>'+
        '<div style="font-size:11px;color:var(--text2);margin-top:3px;">'+fmtN(o.count||0)+' partners</div>'+
      '</div>'+
      '<div class="tc-role">'+safe(o.role)+'</div>'+
    '</div>'+
    '<div class="tc-metrics">'+
      '<div><div class="tc-m-label">MTD</div><div class="tc-m-value amber">'+fmt(s.mtd||0)+'</div></div>'+
      '<div><div class="tc-m-label">LMTD</div><div class="tc-m-value dim">'+fmt(s.lmtd||0)+'</div></div>'+
      '<div><div class="tc-m-label">Target</div><div class="tc-m-value dim">'+fmt(s.target||0)+'</div></div>'+
      '<div><div class="tc-m-label">Calls</div><div class="tc-m-value green">'+fmtN(s.calls||0)+'</div></div>'+
      '<div><div class="tc-m-label">Visits</div><div class="tc-m-value red">'+fmtN(s.visits||0)+'</div></div>'+
      '<div><div class="tc-m-label">Ach%</div><div class="tc-m-value '+(ach>=80?'green':ach>=50?'amber':'red')+'">'+ach+'%</div></div>'+
    '</div>'+
    '<div class="tc-bar"><div class="tc-bar-fill" style="width:'+Math.min(ach,100)+'%"></div></div>'+
    '<div class="tc-footer">'+
      '<span>MoM: <strong class="'+(mom>=0?'up':'down')+'">'+(mom>=0?'+':'')+mom+'%</strong></span>'+
      '<span>Connected: '+fmtN(s.connected||0)+'/'+fmtN(o.count||0)+'</span>'+
    '</div>'+
  '</div>';
}

// ── Team Drill Modal ─────────────────────────────────────────
function openTeamModal(owner){
  $('tmModalName').textContent=owner.name||'—';
  $('tmModalSub').textContent=(owner.role||'')+(owner.count?' · '+owner.count+' partners':'');

  var partners=owner.partners||[];
  var s=owner.summary||{};

  var kpis='<div class="modal-kpi-row">'+
    '<div class="modal-kpi"><div class="mk-label">MTD</div><div class="mk-value amber">'+fmt(s.mtd||0)+'</div></div>'+
    '<div class="modal-kpi"><div class="mk-label">LMTD</div><div class="mk-value">'+fmt(s.lmtd||0)+'</div></div>'+
    '<div class="modal-kpi"><div class="mk-label">Target</div><div class="mk-value">'+fmt(s.target||0)+'</div></div>'+
    '<div class="modal-kpi"><div class="mk-label">Calls / Visits</div><div class="mk-value green">'+fmtN(s.calls||0)+' / '+fmtN(s.visits||0)+'</div></div>'+
    '<div class="modal-kpi"><div class="mk-label">Connected</div><div class="mk-value">'+fmtN(s.connected||0)+' / '+fmtN(owner.count||0)+'</div></div>'+
    '<div class="modal-kpi"><div class="mk-label">Growth / Degrowth</div><div class="mk-value green">'+fmtN(s.growth||0)+'</div></div>'+
    '</div>';

  var tableHTML='<div class="table-wrap" style="max-height:400px;overflow-y:auto;">'+
    '<table class="tbl"><thead><tr>'+
    '<th>Partner</th><th>City/State</th><th>MTD</th><th>LMTD</th><th>Target</th>'+
    '<th>Growth</th><th>Status</th><th>Calls</th><th>Visits</th><th>Action</th>'+
    '</tr></thead><tbody id="tmPartnerBody">'+
    partners.map(function(p){
      return '<tr>'+
        '<td class="name-cell"><div class="p-name">'+safe(p.name)+'</div><div class="p-gid">'+safe(p.gid)+'</div></td>'+
        '<td style="color:var(--text2)">'+safe(p.city)+'<br><span style="font-size:11px;color:var(--text3)">'+safe(p.state)+'</span></td>'+
        '<td class="val-amber">'+fmt(p.mtd)+'</td>'+
        '<td class="val-dim">'+fmt(p.lmtd)+'</td>'+
        '<td class="val-dim">'+fmt(p.target)+'</td>'+
        '<td>'+growthPill(p.growth)+'</td>'+
        '<td>'+statusPill(p.active)+'</td>'+
        '<td class="val-green">'+fmtN(p.calls)+'</td>'+
        '<td class="val-dim">'+fmtN(p.visits)+'</td>'+
        '<td><button class="btn-view" data-gid="'+safe(p.gid)+'" data-name="'+safe(p.name)+'">View</button></td>'+
        '</tr>';
    }).join('')+
    '</tbody></table></div>';

  $('tmModalBody').innerHTML=kpis+tableHTML;
  attachViewButtons($('tmModalBody'));
  $('teamModal').classList.add('open');
}

$('tmModalClose')&&$('tmModalClose').addEventListener('click',function(){
  $('teamModal').classList.remove('open');
});
$('teamModal')&&$('teamModal').addEventListener('click',function(e){
  if(e.target===$('teamModal')) $('teamModal').classList.remove('open');
});

// ── VIEW MODAL (Partner Detail) ──────────────────────────────
function attachViewButtons(container){
  container.querySelectorAll('.btn-view').forEach(function(btn){
    btn.addEventListener('click',function(e){
      e.stopPropagation();
      openPartnerModal(this.dataset.gid, this.dataset.name);
    });
  });
}

function openPartnerModal(gid, name){
  $('modalName').textContent=name||gid;
  $('modalGID').textContent=gid;
  $('modalBody').innerHTML='<div class="spinner" style="margin:40px auto;width:36px;height:36px;"></div>';
  $('partnerModal').classList.add('open');

  // First try local data
  var local=null;
  ALL_PARTNERS.forEach(function(p){ if(p.gid===gid) local=p; });

  if(local){
    buildPartnerModal(local);
  } else {
    callApi('getPartner',{gid:gid},function(err,res){
      if(err||!res||!res.success){
        $('modalBody').innerHTML='<div class="empty-state"><p>Partner data not found.</p></div>';
        return;
      }
      buildPartnerModal(res.partner);
    });
  }
}

function buildPartnerModal(p){
  var mom=0;
  if(p.lmtd>0) mom=Math.round((p.mtd-p.lmtd)*100/p.lmtd);
  else if(p.mtd>0) mom=100;

  var months=p.months||{};
  var monthVals=MONTH_KEYS.map(function(k){ return months[k]||0; });
  var maxVal=Math.max.apply(null,monthVals)||1;

  // KPI row
  var kpis='<div class="modal-kpi-row">'+
    '<div class="modal-kpi"><div class="mk-label">MTD (May)</div><div class="mk-value '+(p.mtd>0?'green':'')+'">'+fmt(p.mtd)+'</div></div>'+
    '<div class="modal-kpi"><div class="mk-label">LMTD (Apr)</div><div class="mk-value">'+fmt(p.lmtd)+'</div></div>'+
    '<div class="modal-kpi"><div class="mk-label">MoM</div><div class="mk-value '+(mom>=0?'green':'red')+'">'+(mom>=0?'+':'')+mom+'%</div></div>'+
    '<div class="modal-kpi"><div class="mk-label">Target</div><div class="mk-value">'+fmt(p.target)+'</div></div>'+
    '<div class="modal-kpi"><div class="mk-label">Max Potential</div><div class="mk-value amber">'+fmt(p.maxPot)+'</div></div>'+
    '<div class="modal-kpi"><div class="mk-label">Overall Pot.</div><div class="mk-value amber">'+fmt(p.oPot)+'</div></div>'+
    '<div class="modal-kpi"><div class="mk-label">Net Combined</div><div class="mk-value">'+fmt(p.net)+'</div></div>'+
    '<div class="modal-kpi"><div class="mk-label">Avg Monthly</div><div class="mk-value">'+fmt(p.avg)+'</div></div>'+
    '</div>';

  // 14-month bar chart
  var barHTML='<div class="modal-chart-wrap">'+
    '<div class="modal-chart-title">14-Month Business Trend</div>'+
    '<div class="bar-chart">';

  monthVals.forEach(function(v,i){
    var h=Math.max(2,Math.round((v/maxVal)*110));
    barHTML+='<div class="bar-col">'+
      '<div class="b-val">'+fmtShort(v)+'</div>'+
      '<div class="b-bar" style="height:'+h+'px"></div>'+
      '<div class="b-label">'+MONTHS[i]+'</div>'+
      '</div>';
  });
  barHTML+='</div></div>';

  // Info grid
  var info='<div class="modal-info-grid">'+
    '<div class="modal-info-item"><div class="mi-label">Owner</div><div class="mi-value">'+safe(p.oName)+' ('+safe(p.oRole)+')</div></div>'+
    '<div class="modal-info-item"><div class="mi-label">Zone / State</div><div class="mi-value">'+safe(p.zone)+' · '+safe(p.state)+'</div></div>'+
    '<div class="modal-info-item"><div class="mi-label">City</div><div class="mi-value">'+safe(p.city)+'</div></div>'+
    '<div class="modal-info-item"><div class="mi-label">Months Active</div><div class="mi-value">'+safe(p.mAct)+' months</div></div>'+
    '<div class="modal-info-item"><div class="mi-label">Calls / Visits</div><div class="mi-value">'+fmtN(p.calls)+' / '+fmtN(p.visits)+'</div></div>'+
    '<div class="modal-info-item"><div class="mi-label">Status</div><div class="mi-value">'+statusPill(p.active)+'</div></div>'+
    '<div class="modal-info-item"><div class="mi-label">Growth Trend</div><div class="mi-value">'+growthPill(p.growth)+'</div></div>'+
    '<div class="modal-info-item"><div class="mi-label">FTD</div><div class="mi-value">'+fmt(p.ftd)+'</div></div>'+
    '</div>';

  // Remarks
  var rmk='';
  if(p.rmkS||p.rmkP){
    rmk='<div class="modal-remark">'+
      '<div class="mr-title">📝 Remarks</div>'+
      (p.rmkS?'<div class="mr-text" style="margin-bottom:6px;"><strong>Sheet:</strong> '+safe(p.rmkS)+'</div>':'')+
      (p.rmkP?'<div class="mr-text"><strong>Partner:</strong> '+safe(p.rmkP)+'</div>':'')+
      '</div>';
  }

  $('modalBody').innerHTML=kpis+barHTML+info+rmk;
}

function fmtShort(v){
  if(!v||v===0) return '0';
  if(v>=10000000) return (v/10000000).toFixed(1)+'Cr';
  if(v>=100000)   return (v/100000).toFixed(1)+'L';
  if(v>=1000)     return (v/1000).toFixed(0)+'K';
  return String(Math.round(v));
}

$('modalClose')&&$('modalClose').addEventListener('click',function(){
  $('partnerModal').classList.remove('open');
});
$('partnerModal')&&$('partnerModal').addEventListener('click',function(e){
  if(e.target===$('partnerModal')) $('partnerModal').classList.remove('open');
});

// ── Tele-RM Tab ──────────────────────────────────────────────
function renderTeleRM(){
  // Check if user is Tele-RM ZH (Ayush Gupta) — they get a full dashboard
  // For others, this tab is hidden
  var telePart = DATA.tele ? (DATA.tele.partners||[]) : [];
  var teleSum  = DATA.tele ? (DATA.tele.summary||{}) : (DATA.summary||{});
  var teleTeam = DATA.tele ? (DATA.tele.team||[]) : (DATA.team||[]);

  if(DATA.summary&&!DATA.tele){
    // This is Tele-RM ZH's own data
    telePart = DATA.partners||[];
    teleSum  = DATA.summary||{};
    teleTeam = DATA.team||[];
  }

  var ov=$('teleOverview');
  ov.innerHTML=
    '<div class="metric-card" style="border-left:3px solid var(--id-red);">'+
      '<div class="mc-label">Total Tele-RM Partners</div>'+
      '<div class="mc-value">'+fmtN(teleSum.total||0)+'</div>'+
      '<div class="mc-sub"><span class="badge badge-green">Active: '+fmtN(teleSum.active||0)+'</span> <span class="badge badge-red">Inactive: '+fmtN(teleSum.inactive||0)+'</span></div>'+
    '</div>'+
    '<div class="metric-card" style="border-left:3px solid var(--green);">'+
      '<div class="mc-label">MTD Business</div>'+
      '<div class="mc-value rupee">'+fmt(teleSum.mtd||0).replace('₹','')+'</div>'+
    '</div>'+
    '<div class="metric-card" style="border-left:3px solid var(--amber);">'+
      '<div class="mc-label">Calls / Visits</div>'+
      '<div class="mc-value">'+fmtN(teleSum.calls||0)+' / '+fmtN(teleSum.visits||0)+'</div>'+
    '</div>';

  var grid=$('teleTeamGrid');
  if(teleTeam.length===0){
    grid.innerHTML='<div class="empty-state"><div class="es-icon">📞</div><p>No Tele-RM team data.</p></div>';
    return;
  }
  grid.innerHTML=teleTeam.map(function(o){ return teamCardHTML(o); }).join('');
  grid.querySelectorAll('.team-card').forEach(function(card,i){
    card.addEventListener('click',function(){ openTeamModal(teleTeam[i]); });
  });
}

// ── Daily Run Rate ────────────────────────────────────────────
function renderDailyRR(){
  var team=DATA.team||[];
  var dayOfMonth=new Date().getDate();
  var daysInMonth=new Date(2026,4,0).getDate(); // May 2026

  if(team.length===0){
    $('drrGrid').innerHTML='<div class="empty-state"><div class="es-icon">📊</div><p>No run rate data.</p></div>';
    return;
  }

  $('drrGrid').innerHTML=team.map(function(o){
    var s=o.summary||{};
    var target=s.target||0;
    var mtd=s.mtd||0;
    var runRate=dayOfMonth>0?Math.round(mtd/dayOfMonth):0;
    var projected=runRate*daysInMonth;
    var ach=target>0?Math.round(mtd*100/target):0;
    var barColor=ach>=80?'var(--green)':ach>=50?'var(--amber)':'var(--red)';

    return '<div class="drr-card">'+
      '<div class="dc-owner">'+safe(o.name)+'</div>'+
      '<div class="dc-sub">('+safe(o.role)+') · '+fmtN(o.count||0)+' partners</div>'+
      '<div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text2);margin-bottom:4px;">'+
        '<span>MTD</span><strong style="color:var(--amber)">'+fmt(mtd)+'</strong>'+
      '</div>'+
      '<div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text2);margin-bottom:4px;">'+
        '<span>Target</span><strong>'+fmt(target)+'</strong>'+
      '</div>'+
      '<div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text2);margin-bottom:4px;">'+
        '<span>Daily Rate</span><strong>'+fmt(runRate)+'/day</strong>'+
      '</div>'+
      '<div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text2);margin-bottom:8px;">'+
        '<span>Projected</span><strong class="'+(projected>=target?'up':'down')+'">'+fmt(projected)+'</strong>'+
      '</div>'+
      '<div class="drr-bar-wrap">'+
        '<div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text2);margin-bottom:4px;">'+
          '<span>Ach: '+ach+'%</span><span>Day '+dayOfMonth+'/'+daysInMonth+'</span>'+
        '</div>'+
        '<div class="drr-bar-bg"><div class="drr-bar-fill" style="width:'+Math.min(ach,100)+'%;background:'+barColor+'"></div></div>'+
      '</div>'+
    '</div>';
  }).join('');
}

// ── CSV Export ───────────────────────────────────────────────
function exportCSV(){
  var filtered=applyFilters(ALL_PARTNERS);
  var headers=['GID','Name','City','State','Zone','Owner','Role','Max Pot','Overall Pot','Target','MTD','LMTD','MoM%','Growth','Status','Calls','Visits'];
  var rows=[headers.join(',')];
  filtered.forEach(function(p){
    var mom=p.lmtd>0?Math.round((p.mtd-p.lmtd)*100/p.lmtd):(p.mtd>0?100:0);
    rows.push([
      p.gid,p.name,p.city,p.state,p.zone,p.oName,p.oRole,
      p.maxPot,p.oPot,p.target,p.mtd,p.lmtd,mom+'%',
      p.growth,p.active,p.calls,p.visits
    ].map(function(v){ return '"'+String(v||'').replace(/"/g,'""')+'"'; }).join(','));
  });
  var blob=new Blob([rows.join('\n')],{type:'text/csv'});
  var url=URL.createObjectURL(blob);
  var a=document.createElement('a');
  a.href=url; a.download='partners_export.csv'; a.click();
  URL.revokeObjectURL(url);
}

// ── Summarize a partner list ─────────────────────────────────
function summarizeList(partners){
  var s={total:partners.length,mtd:0,lmtd:0,ftd:0,calls:0,visits:0,
         maxPot:0,oPot:0,target:0,active:0,inactive:0,
         connected:0,notConn:0,growth:0,degrowth:0,mom:0};
  partners.forEach(function(p){
    s.mtd+=p.mtd||0; s.lmtd+=p.lmtd||0; s.ftd+=p.ftd||0;
    s.calls+=p.calls||0; s.visits+=p.visits||0;
    s.maxPot+=p.maxPot||0; s.oPot+=p.oPot||0; s.target+=p.target||0;
    var a=String(p.active||'').toLowerCase();
    if(a==='active'||a==='1'||a==='yes'||Number(p.active)>0) s.active++; else s.inactive++;
    if(p.calls>0||p.visits>0) s.connected++; else s.notConn++;
    var g=String(p.growth||'').toLowerCase();
    if(g.indexOf('degrowth')>=0) s.degrowth++;
    else if(g.indexOf('growth')>=0||parseFloat(String(p.growth||''))>0) s.growth++;
  });
  s.mom=s.lmtd>0?Math.round((s.mtd-s.lmtd)*100/s.lmtd):0;
  return s;
}

// ── Session restore ──────────────────────────────────────────
function tryRestore(){
  var saved=localStorage.getItem('pe_user');
  if(saved){
    try{
      USER=JSON.parse(saved);
      loadDashboard();
      return;
    }catch(e){ localStorage.removeItem('pe_user'); }
  }
  initLogin();
}

// ── Boot ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded',function(){
  tryRestore();
  $('partnerModal')&&$('partnerModal').addEventListener('click',function(e){
    if(e.target===$('partnerModal')) $('partnerModal').classList.remove('open');
  });
});

})();
