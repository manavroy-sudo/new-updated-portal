/* ============================================================
   Partner Engage Portal — app.js v12
   For: ZH / SH / RH / RM / AM users
   Light theme | Tele-RM tab | Fixed charts | Fixed login
   ============================================================ */
(function(){
'use strict';

var API_URL = window.API_URL||(window.CONFIG&&CONFIG.API_URL)||'';
var session = JSON.parse(sessionStorage.getItem('pe_session')||'{}');
if(!session.empId){ window.location.href='index.html'; return; }

var state = {
  data:null, loading:false, activeTab:'overview',
  partnerSearch:'', partnerStatusFilter:'', stateTab:'field',
  teleSearch:'', teleStatus:''
};

// ── Helpers ─────────────────────────────────────────────────
function $(id){ return document.getElementById(id); }
function fmt(v,cr){
  if(v===undefined||v===null||isNaN(v)) return '—';
  var abs=Math.abs(v), pref=v<0?'-':'', s='';
  if(cr){
    if(abs>=10000000) s=(abs/10000000).toFixed(2)+' Cr';
    else if(abs>=100000) s=(abs/100000).toFixed(2)+' L';
    else if(abs>=1000) s=(abs/1000).toFixed(1)+' K';
    else s=abs.toLocaleString('en-IN');
    return '₹'+pref+s;
  }
  return pref+(abs>=10000000?(abs/10000000).toFixed(2)+' Cr':abs>=100000?(abs/100000).toFixed(2)+' L':abs.toLocaleString('en-IN'));
}
function fmtPct(v){ if(v===undefined||v===null||isNaN(v)) return '—'; return (v>0?'+':'')+v.toFixed(1)+'%'; }
function fmtN(v){ return (v||0).toLocaleString('en-IN'); }
function clr(v){ return v>=0?'green':'red'; }
function mtdClr(mtd,lmtd){ return mtd>=lmtd?'green':'red'; }
function showLoading(show){ var el=$('loadingBar'); if(el) el.style.display=show?'block':'none'; }
function safe(s){ return String(s||'').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function debounce(fn,ms){ var t; return function(){clearTimeout(t);t=setTimeout(fn,ms);}; }

// ── API ──────────────────────────────────────────────────────
function apiFetch(params,cb){
  var url=API_URL+'?'+Object.entries(params).map(function(kv){return encodeURIComponent(kv[0])+'='+encodeURIComponent(kv[1]);}).join('&');
  var cbName='cb_'+Date.now()+'_'+Math.random().toString(36).slice(2);
  window[cbName]=function(data){
    try{delete window[cbName];}catch(e){}
    var s=document.getElementById('_jsonp_'+cbName);
    if(s) s.parentNode.removeChild(s);
    cb(null,data);
  };
  var s=document.createElement('script');
  s.id='_jsonp_'+cbName;
  s.src=url+'&callback='+cbName;
  s.onerror=function(){cb(new Error('API error — check network or redeploy Apps Script'));};
  document.head.appendChild(s);
}

function loadData(){
  if(state.loading) return;
  state.loading=true; showLoading(true);
  apiFetch({action:'getData',uid:session.empId},function(err,data){
    state.loading=false; showLoading(false);
    if(err||!data||!data.success){ showError(err?err.message:data&&data.message||'Load failed'); return; }
    state.data=data;
    renderAll();
  });
}

function showError(msg){ var el=$('errorBanner'); if(el){el.textContent=msg;el.style.display='block';setTimeout(function(){el.style.display='none';},8000);} }

// ── Setup header ─────────────────────────────────────────────
(function initHeader(){
  var n=$('headerName'), r=$('headerRole'), z=$('dashZone');
  if(n) n.textContent=session.name||session.empId||'—';
  if(r) r.textContent=(session.role||'')+(session.zone?' · '+session.zone:'');
  if(z) z.textContent=(session.zone||'')+(session.role?' — '+session.role:'');
  var dt=$('dashTitle'); if(dt) dt.textContent='Partner Engage Portal';
})();

// ── Render all ───────────────────────────────────────────────
function renderAll(){
  renderKPIStrip();
  renderTab(state.activeTab);
}

function renderKPIStrip(){
  var d=state.data; if(!d) return;
  var op=d.overallProject||{};
  var mClr=mtdClr(op.businessGenerated,op.lmtd);
  var sets=[
    {id:'hFTD',    val:fmt(op.ftd,true),              cls:'blue'},
    {id:'hMTD',    val:fmt(op.businessGenerated,true), cls:mClr},
    {id:'hLMTD',   val:fmt(op.lmtd,true),             cls:'muted'},
    {id:'hActive', val:fmtN(op.activePartners),        cls:'green'},
    {id:'hConnected',val:fmtN(op.connectedPartners),   cls:'blue'},
    {id:'hCalls',  val:fmtN(op.totalCalls),            cls:''},
    {id:'hVisits', val:fmtN(op.totalVisits),           cls:''}
  ];
  sets.forEach(function(s){
    var el=$(s.id); if(!el) return;
    el.className='kpi-val'+( s.cls?' '+s.cls:'');
    el.textContent=s.val;
  });
}

// ── Tab routing ──────────────────────────────────────────────
function renderTab(tab){
  state.activeTab=tab;
  document.querySelectorAll('.nav-tab').forEach(function(el){
    el.classList.toggle('active',el.dataset.tab===tab);
  });
  var views=['overview','stateRank','rolePerf','myPartners','teleRM','cities','loginActivity'];
  views.forEach(function(v){ var el=$(v+'View'); if(el) el.style.display=v===tab?'block':'none'; });
  switch(tab){
    case 'overview':      renderOverview(); break;
    case 'stateRank':     renderStateRank(); break;
    case 'rolePerf':      renderRolePerf(); break;
    case 'myPartners':    renderMyPartners(); break;
    case 'teleRM':        renderTeleRM(); break;
    case 'cities':        renderCities(); break;
    case 'loginActivity': renderLoginActivity(); break;
  }
}

// ── Overview ─────────────────────────────────────────────────
function renderOverview(){
  var d=state.data; if(!d) return;
  renderCharts();
  renderOwnerCards('zhCards',  d.zhPerf,  'ZH',  false);
  renderOwnerCards('shCards',  d.shPerf,  'SH',  false);
  renderOwnerCards('rhCards',  d.rhPerf,  'RH',  false);
  renderOwnerCards('rmCards',  d.rmPerf,  'RM',  false);
  renderOwnerCards('amCards',  d.amPerf,  'AM',  false);
  // Hide sections with no data
  ['zh','sh','rh','rm','am'].forEach(function(role){
    var arr=d[role+'Perf']; var sec=$(role+'Section');
    if(sec) sec.style.display=(arr&&arr.length)?'block':'none';
  });
}

function renderOwnerCards(containerId,perf,role,isTele){
  var el=$(containerId); if(!el) return;
  if(!perf||!perf.length){ el.innerHTML='<div class="empty-state"><div class="empty-state-text">No '+role+' data for your scope</div></div>'; return; }
  var html='';
  perf.slice(0,30).forEach(function(o){
    var mClr=mtdClr(o.mtd,o.lmtd);
    var achClr=o.achPct>=100?'green':o.achPct>=50?'amber':'red';
    html+='<div class="card'+(isTele?' tele-card':'')+'" onclick="openOwnerDrill(\''+safe(o.empId)+'\')">';
    html+='<div class="card-name">'+safe(o.name)+'</div>';
    html+='<div class="card-sub">'+safe(role)+' · '+safe(o.zone)+(o.state?' · '+safe(o.state):'')+' &nbsp;<small style="color:var(--text-muted)">'+safe(o.empId)+'</small></div>';
    html+='<div class="card-metrics">';
    html+='<div class="card-metric"><div class="card-metric-label">FTD</div><div class="card-metric-val blue">'+fmt(o.ftd,true)+'</div></div>';
    html+='<div class="card-metric"><div class="card-metric-label">MTD</div><div class="card-metric-val '+mClr+'">'+fmt(o.mtd,true)+'</div></div>';
    html+='<div class="card-metric"><div class="card-metric-label">LMTD</div><div class="card-metric-val muted">'+fmt(o.lmtd,true)+'</div></div>';
    html+='<div class="card-metric"><div class="card-metric-label">MoM%</div><div class="card-metric-val '+clr(o.momPct||0)+'">'+fmtPct(o.momPct||0)+'</div></div>';
    html+='<div class="card-metric"><div class="card-metric-label">Ach%</div><div class="card-metric-val '+achClr+'">'+Math.round(o.achPct||0)+'%</div></div>';
    html+='<div class="card-metric"><div class="card-metric-label">Max Pot.</div><div class="card-metric-val">'+fmt(o.maxPot,true)+'</div></div>';
    html+='</div>';
    html+='<div class="card-footer">';
    html+='<span style="font-size:0.7rem">Active: <b class="green">'+fmtN(o.active)+'</b> · Inactive: <b class="red">'+fmtN(o.inactive)+'</b> · Connected: <b class="blue">'+fmtN(o.connected)+'</b> · Partners: <b>'+fmtN(o.partners)+'</b></span>';
    html+='<span style="font-size:0.7rem">📞 '+fmtN(o.calls)+' / 🚶 '+fmtN(o.visits)+'</span>';
    html+='</div></div>';
  });
  el.innerHTML='<div class="cards-grid">'+html+'</div>';
}

// ── Owner drill-down modal ─────────────────────────────────────
window.openOwnerDrill=function(empId){
  var d=state.data; if(!d) return;
  var owner=null;
  [d.zhPerf,d.shPerf,d.rhPerf,d.rmPerf,d.amPerf,d.teleRMPerf].forEach(function(arr){
    if(arr) arr.forEach(function(o){ if(o.empId===empId) owner=o; });
  });
  var partners=(d.partners||[]).filter(function(p){ return p.ownerEmpId===empId; });
  openDrillModal(owner,partners);
};

function openDrillModal(owner,partners){
  var el=$('ownerModal'); if(!el) return;
  var o=owner||{};
  var mClr=mtdClr(o.mtd,o.lmtd);
  var html='<div class="modal-kpis">';
  [{l:'FTD',v:fmt(o.ftd,true),c:'blue'},{l:'MTD',v:fmt(o.mtd,true),c:mClr},
   {l:'LMTD',v:fmt(o.lmtd,true),c:'muted'},{l:'MoM%',v:fmtPct(o.momPct||0),c:clr(o.momPct||0)},
   {l:'Ach%',v:Math.round(o.achPct||0)+'%',c:o.achPct>=100?'green':o.achPct>=50?'amber':'red'},
   {l:'Calls',v:fmtN(o.calls),c:'blue'},{l:'Visits',v:fmtN(o.visits),c:'blue'},
   {l:'Partners',v:fmtN(o.partners),c:''},{l:'Active',v:fmtN(o.active),c:'green'},
   {l:'Max Pot.',v:fmt(o.maxPot,true),c:''}
  ].forEach(function(k){ html+='<div class="modal-kpi"><div class="modal-kpi-label">'+k.l+'</div><div class="modal-kpi-val '+k.c+'">'+k.v+'</div></div>'; });
  html+='</div>';
  // Partner list
  html+='<div class="section-title" style="margin:14px 0 8px">Assigned Partners ('+partners.length+')</div>';
  html+='<div style="overflow-x:auto"><table><thead><tr>';
  html+='<th>Partner</th><th>State</th><th>Zone</th><th>FTD</th><th>MTD</th><th>LMTD</th><th>Overall Pot.</th><th>Calls</th><th>Visits</th><th>Status</th><th>Connect</th><th></th>';
  html+='</tr></thead><tbody>';
  if(!partners.length){ html+='<tr><td colspan="12" style="text-align:center;padding:20px;color:var(--text-muted)">No partners assigned</td></tr>'; }
  partners.slice(0,100).forEach(function(p){
    var mc=mtdClr(p.mtd,p.lmtd);
    html+='<tr>';
    html+='<td><div class="partner-name">'+safe(p.name)+'</div><div class="partner-gid">'+safe(p.gid)+'</div></td>';
    html+='<td class="muted">'+safe(p.state)+'</td>';
    html+='<td class="muted">'+safe(p.zone)+'</td>';
    html+='<td class="blue">'+fmt(p.ftd,true)+'</td>';
    html+='<td class="'+mc+'">'+fmt(p.mtd,true)+'</td>';
    html+='<td class="muted">'+fmt(p.lmtd,true)+'</td>';
    html+='<td>'+fmt(p.overallPot,true)+'</td>';
    html+='<td>'+fmtN(p.calls)+'</td>';
    html+='<td>'+fmtN(p.visits)+'</td>';
    html+='<td><span class="card-badge '+(p.active?'badge-green':'badge-gray')+'">'+(p.active?'Active':'Inactive')+'</span></td>';
    html+='<td><span class="card-badge '+(p.connected?'badge-blue':'badge-gray')+'">'+(p.connected?'Connected':'Not')+'</span></td>';
    html+='<td><button class="btn btn-view" onclick="openPartnerView(\''+safe(p.gid)+'\')">VIEW</button></td>';
    html+='</tr>';
  });
  html+='</tbody></table></div>';
  $('ownerModalTitle').textContent=(o.name||'Owner')+' — '+(o.role||'')+(o.zone?' · '+o.zone:'');
  $('ownerModalBody').innerHTML=html;
  el.classList.add('open');
}

// ── State Rankings ────────────────────────────────────────────
function renderStateRank(){
  var d=state.data; if(!d) return;
  renderStateTable('stateRankTable',d.stateSummaries||[],false);
  var teleEl=$('teleStateSection');
  if(teleEl&&d.teleStateSummaries&&d.teleStateSummaries.length){
    teleEl.style.display='block';
    renderStateTable('teleStateRankTable',d.teleStateSummaries,true);
  }
}

function renderStateTable(tableId,states){
  var el=$(tableId); if(!el) return;
  var sorted=(states||[]).slice().sort(function(a,b){return b.mtd-a.mtd;});
  var html='';
  sorted.forEach(function(sm,i){
    var mClr=mtdClr(sm.mtd,sm.lmtd);
    var achPct=sm.achPct||0;
    html+='<tr>';
    html+='<td style="font-weight:700;color:var(--text-muted)">#'+(i+1)+'</td>';
    html+='<td class="partner-name">'+safe(sm.state)+'</td>';
    html+='<td class="muted">'+safe(sm.zone)+'</td>';
    html+='<td>'+fmtN(sm.partners)+'</td>';
    html+='<td>'+fmt(sm.maxPot,true)+'</td>';
    html+='<td>'+fmt(sm.overallPot,true)+'</td>';
    html+='<td class="'+mClr+'" style="font-weight:700">'+fmt(sm.mtd,true)+'</td>';
    html+='<td class="muted">'+fmt(sm.lmtd,true)+'</td>';
    html+='<td class="'+clr(sm.momPct||0)+'">'+fmtPct(sm.momPct||0)+'</td>';
    html+='<td class="'+(achPct>=100?'green':achPct>=50?'amber':'red')+'">'+achPct.toFixed(0)+'%</td>';
    html+='<td class="green">'+fmtN(sm.active)+'</td>';
    html+='<td class="blue">'+fmtN(sm.connected)+'</td>';
    html+='<td>'+Math.round(sm.engPct||0)+'%</td>';
    html+='<td>'+fmtN(sm.calls)+'</td>';
    html+='<td>'+fmtN(sm.visits)+'</td>';
    html+='<td><button class="btn btn-view" onclick="filterPartnersByState(\''+safe(sm.state)+'\')">Partners</button></td>';
    html+='</tr>';
  });
  el.querySelector('tbody').innerHTML=html||'<tr><td colspan="16" style="text-align:center;padding:24px;color:var(--text-muted)">No data</td></tr>';
}

// ── Role Performance tab ───────────────────────────────────────
function renderRolePerf(){
  var d=state.data; if(!d) return;
  renderOwnerCards('zhCardsRolePerf',d.zhPerf,'ZH',false);
  var shrh=(d.shPerf||[]).concat(d.rhPerf||[]).sort(function(a,b){return b.mtd-a.mtd;});
  renderOwnerCards('shrhCardsRolePerf',shrh,'SH/RH',false);
  renderOwnerCards('amCardsRolePerf',d.amPerf,'AM',false);
}

// ── My Partners tab ────────────────────────────────────────────
function renderMyPartners(){
  var d=state.data; if(!d) return;
  var partners=(d.partners||[]).filter(function(p){ return !p.isTele; });
  var search=($('myPartnerSearch')||{}).value||'';
  var sf=($('myPartnerStatus')||{}).value||'';
  var filtered=partners.filter(function(p){
    if(search&&!(p.name||'').toLowerCase().includes(search.toLowerCase())&&!(p.gid||'').toLowerCase().includes(search.toLowerCase())) return false;
    if(sf==='active'&&!p.active) return false;
    if(sf==='inactive'&&p.active) return false;
    if(sf==='connected'&&!p.connected) return false;
    if(sf==='notconnected'&&p.connected) return false;
    return true;
  });
  var cnt=$('myPartnersCount'); if(cnt) cnt.textContent=filtered.length+' partners';
  renderPartnerRows('myPartnersTable',filtered);
}

function renderPartnerRows(tableId,list){
  var el=$(tableId); if(!el) return;
  var html='';
  list.slice(0,300).forEach(function(p){
    var mc=mtdClr(p.mtd,p.lmtd);
    html+='<tr>';
    html+='<td><div class="partner-name">'+safe(p.name)+'</div><div class="partner-gid">'+safe(p.gid)+(p.isTele?' <span class="tele-badge">TELE</span>':'')+'</div></td>';
    html+='<td class="muted">'+safe(p.city)+'</td>';
    html+='<td class="muted">'+safe(p.state)+'</td>';
    html+='<td class="muted">'+safe(p.zone)+'</td>';
    html+='<td class="muted">'+safe(p.ownerName)+'</td>';
    html+='<td class="blue">'+fmt(p.ftd,true)+'</td>';
    html+='<td class="'+mc+'" style="font-weight:700">'+fmt(p.mtd,true)+'</td>';
    html+='<td class="muted">'+fmt(p.lmtd,true)+'</td>';
    html+='<td>'+fmt(p.overallPot,true)+'</td>';
    html+='<td>'+fmt(p.projection,true)+'</td>';
    html+='<td>'+fmtN(p.calls)+'</td>';
    html+='<td>'+fmtN(p.visits)+'</td>';
    html+='<td>'+fmtN(p.monthsActive)+'</td>';
    html+='<td>'+fmt(p.avgMonthly,true)+'</td>';
    html+='<td><span class="card-badge '+(p.active?'badge-green':'badge-gray')+'">'+(p.active?'Active':'Inactive')+'</span></td>';
    html+='<td><span class="card-badge '+(p.connected?'badge-blue':'badge-gray')+'">'+(p.connected?'Connected':'Not')+'</span></td>';
    html+='<td><button class="btn btn-view" onclick="openPartnerView(\''+safe(p.gid)+'\')">VIEW</button></td>';
    html+='</tr>';
  });
  el.querySelector('tbody').innerHTML=html||'<tr><td colspan="17" style="text-align:center;padding:24px;color:var(--text-muted)">No partners found</td></tr>';
}

// ── Tele-RM tab ────────────────────────────────────────────────
function renderTeleRM(){
  var d=state.data; if(!d) return;
  var teleSum=d.teleRMSummary;

  // KPI strip
  var kpiEl=$('teleKpiStrip');
  if(kpiEl&&teleSum){
    var mClr=mtdClr(teleSum.mtd,teleSum.lmtd);
    kpiEl.innerHTML='<div class="tele-summary-card">'
      +'<div style="display:flex;align-items:center;justify-content:space-between">'
      +'<div><div class="tele-section-title">📞 Tele-RM Channel Summary</div>'
      +'<div class="tele-section-sub">'+fmtN(teleSum.partners)+' total partners · Separate from field zones</div></div>'
      +'<div style="text-align:right"><div style="font-size:1.4rem;font-weight:800;color:var(--blue)">'+fmt(teleSum.mtd,true)+'</div><div style="font-size:0.7rem;color:#3b82f6">MTD ('+mClr+')</div></div>'
      +'</div>'
      +'<div class="tele-summary-grid">'
      +'<div class="tele-kpi-box"><div class="tele-kpi-label">FTD</div><div class="tele-kpi-val">'+fmt(teleSum.ftd,true)+'</div></div>'
      +'<div class="tele-kpi-box"><div class="tele-kpi-label">MTD</div><div class="tele-kpi-val '+mClr+'">'+fmt(teleSum.mtd,true)+'</div></div>'
      +'<div class="tele-kpi-box"><div class="tele-kpi-label">LMTD</div><div class="tele-kpi-val">'+fmt(teleSum.lmtd,true)+'</div></div>'
      +'<div class="tele-kpi-box"><div class="tele-kpi-label">Max Pot.</div><div class="tele-kpi-val">'+fmt(teleSum.maxPot,true)+'</div></div>'
      +'<div class="tele-kpi-box"><div class="tele-kpi-label">Overall Pot.</div><div class="tele-kpi-val">'+fmt(teleSum.overallPot,true)+'</div></div>'
      +'<div class="tele-kpi-box"><div class="tele-kpi-label">Calls</div><div class="tele-kpi-val">'+fmtN(teleSum.calls)+'</div></div>'
      +'<div class="tele-kpi-box"><div class="tele-kpi-label">Visits</div><div class="tele-kpi-val">'+fmtN(teleSum.visits)+'</div></div>'
      +'<div class="tele-kpi-box"><div class="tele-kpi-label">Active</div><div class="tele-kpi-val green">'+fmtN(teleSum.active)+'</div></div>'
      +'<div class="tele-kpi-box"><div class="tele-kpi-label">Connected</div><div class="tele-kpi-val blue">'+fmtN(teleSum.connected)+'</div></div>'
      +'<div class="tele-kpi-box"><div class="tele-kpi-label">MoM%</div><div class="tele-kpi-val '+clr(teleSum.momPct||0)+'">'+fmtPct(teleSum.momPct||0)+'</div></div>'
      +'</div></div>';
  } else if(kpiEl){
    kpiEl.innerHTML='<div class="alert alert-info">No Tele-RM data in your scope.</div>';
  }

  // Owner cards
  renderOwnerCards('teleRMCards',d.teleRMPerf,'RM',true);

  // State table
  var tstates=d.teleStateSummaries||[];
  var tel=$('teleStateTable'); if(tel){
    var html='';
    tstates.sort(function(a,b){return b.mtd-a.mtd;}).forEach(function(sm,i){
      var mc=mtdClr(sm.mtd,sm.lmtd);
      html+='<tr><td style="font-weight:700;color:var(--text-muted)">#'+(i+1)+'</td>';
      html+='<td class="partner-name">'+safe(sm.state)+'</td>';
      html+='<td>'+fmtN(sm.partners)+'</td>';
      html+='<td>'+fmt(sm.maxPot,true)+'</td>';
      html+='<td>'+fmt(sm.overallPot,true)+'</td>';
      html+='<td class="'+mc+'" style="font-weight:700">'+fmt(sm.mtd,true)+'</td>';
      html+='<td class="muted">'+fmt(sm.lmtd,true)+'</td>';
      html+='<td class="'+clr(sm.momPct||0)+'">'+fmtPct(sm.momPct||0)+'</td>';
      html+='<td>'+Math.round(sm.achPct||0)+'%</td>';
      html+='<td class="green">'+fmtN(sm.active)+'</td>';
      html+='<td class="blue">'+fmtN(sm.connected)+'</td>';
      html+='<td>'+fmtN(sm.calls)+'</td>';
      html+='<td>'+fmtN(sm.visits)+'</td></tr>';
    });
    tel.querySelector('tbody').innerHTML=html||'<tr><td colspan="13" style="text-align:center;padding:20px;color:var(--text-muted)">No Tele-RM state data</td></tr>';
  }

  // Partner list
  renderTelePartners();
}

function renderTelePartners(){
  var d=state.data; if(!d) return;
  var partners=(d.partners||[]).filter(function(p){return p.isTele;});
  var search=state.teleSearch.toLowerCase();
  var sf=state.teleStatus;
  var filtered=partners.filter(function(p){
    if(search&&!(p.name||'').toLowerCase().includes(search)&&!(p.gid||'').toLowerCase().includes(search)) return false;
    if(sf==='active'&&!p.active) return false;
    if(sf==='inactive'&&p.active) return false;
    if(sf==='connected'&&!p.connected) return false;
    if(sf==='notconnected'&&p.connected) return false;
    return true;
  });
  var cnt=$('telePartnerCount'); if(cnt) cnt.textContent=filtered.length+' Tele-RM partners';
  var el=$('telePartnerTable'); if(!el) return;
  var html='';
  filtered.slice(0,300).forEach(function(p){
    var mc=mtdClr(p.mtd,p.lmtd);
    html+='<tr>';
    html+='<td><div class="partner-name">'+safe(p.name)+'</div><div class="partner-gid">'+safe(p.gid)+'</div></td>';
    html+='<td class="muted">'+safe(p.city)+'</td>';
    html+='<td class="muted">'+safe(p.state)+'</td>';
    html+='<td class="muted">'+safe(p.ownerName)+'</td>';
    html+='<td class="blue">'+fmt(p.ftd,true)+'</td>';
    html+='<td class="'+mc+'" style="font-weight:700">'+fmt(p.mtd,true)+'</td>';
    html+='<td class="muted">'+fmt(p.lmtd,true)+'</td>';
    html+='<td>'+fmt(p.overallPot,true)+'</td>';
    html+='<td>'+fmt(p.projection,true)+'</td>';
    html+='<td>'+fmtN(p.calls)+'</td>';
    html+='<td>'+fmtN(p.visits)+'</td>';
    html+='<td><span class="card-badge '+(p.active?'badge-green':'badge-gray')+'">'+(p.active?'Active':'Inactive')+'</span></td>';
    html+='<td><span class="card-badge '+(p.connected?'badge-blue':'badge-gray')+'">'+(p.connected?'Connected':'Not')+'</span></td>';
    html+='<td><button class="btn btn-view" onclick="openPartnerView(\''+safe(p.gid)+'\')">VIEW</button></td>';
    html+='</tr>';
  });
  el.querySelector('tbody').innerHTML=html||'<tr><td colspan="14" style="text-align:center;padding:20px;color:var(--text-muted)">No Tele-RM partners found</td></tr>';
}

// ── Cities tab ────────────────────────────────────────────────
function renderCities(){
  var d=state.data; if(!d||!d.geoAnalytics) return;
  renderCityTable('topCitiesTable',d.geoAnalytics.top10||[],true);
  renderCityTable('worstCitiesTable',d.geoAnalytics.worst10||[],false);
}

function renderCityTable(tableId,cities,isTop){
  var el=$(tableId); if(!el) return;
  var html='';
  cities.forEach(function(c,i){
    var mc=mtdClr(c.mtd,c.lmtd);
    var pct=c.potAchPct||0;
    var barW=Math.min(pct,400); // cap bar at 400%
    var barClr=pct>=100?'':'red';
    html+='<tr>';
    html+='<td style="font-weight:700;color:'+(isTop?'var(--green)':'var(--red)')+'">'+( isTop?'▲ ':'▼ ')+'#'+(i+1)+'</td>';
    html+='<td class="partner-name">'+safe(c.city)+'</td>';
    html+='<td class="muted">'+safe(c.state)+'</td>';
    html+='<td class="muted">'+safe(c.zone)+'</td>';
    html+='<td>'+fmtN(c.partners)+'</td>';
    html+='<td>'+fmt(c.overallPot,true)+'</td>';
    html+='<td class="'+mc+'" style="font-weight:700">'+fmt(c.mtd,true)+'</td>';
    html+='<td class="muted">'+fmt(c.lmtd,true)+'</td>';
    html+='<td><div class="progress-wrap"><div class="progress-bar-bg"><div class="progress-bar-fill '+barClr+'" style="width:'+Math.min(barW/4,100)+'%"></div></div><b style="white-space:nowrap">'+pct.toFixed(0)+'%</b></div></td>';
    html+='<td class="green">'+fmtN(c.active)+'</td>';
    html+='<td>'+fmtN(c.calls)+'</td>';
    html+='<td>'+fmtN(c.visits)+'</td>';
    html+='<td><button class="btn btn-view" onclick="openCityPartners(\''+safe(c.city)+'\',\''+safe(c.state)+'\')">Partners</button></td>';
    html+='</tr>';
  });
  el.querySelector('tbody').innerHTML=html||'<tr><td colspan="13" style="text-align:center;padding:20px;color:var(--text-muted)">No data</td></tr>';
}

window.openCityPartners=function(city,stateName){
  var d=state.data; if(!d) return;
  var plist=(d.partners||[]).filter(function(p){ return p.city===city&&p.state===stateName; });
  var el=$('cityPartnerSection'); if(!el) return;
  el.style.display='block';
  var ttl=$('cityPartnerTitle'); if(ttl) ttl.textContent='Partners in '+city+', '+stateName+' ('+plist.length+')';
  var tbl=$('cityPartnerTable'); if(!tbl) return;
  var html='';
  plist.forEach(function(p){
    var mc=mtdClr(p.mtd,p.lmtd);
    html+='<tr>';
    html+='<td><div class="partner-name">'+safe(p.name)+'</div><div class="partner-gid">'+safe(p.gid)+'</div></td>';
    html+='<td class="muted">'+safe(p.state)+'</td>';
    html+='<td class="muted">'+safe(p.zone)+'</td>';
    html+='<td class="muted">'+safe(p.ownerName)+'</td>';
    html+='<td class="blue">'+fmt(p.ftd,true)+'</td>';
    html+='<td class="'+mc+'" style="font-weight:700">'+fmt(p.mtd,true)+'</td>';
    html+='<td class="muted">'+fmt(p.lmtd,true)+'</td>';
    html+='<td>'+fmt(p.overallPot,true)+'</td>';
    html+='<td>'+fmtN(p.calls)+'</td>';
    html+='<td>'+fmtN(p.visits)+'</td>';
    html+='<td><span class="card-badge '+(p.active?'badge-green':'badge-gray')+'">'+(p.active?'Active':'Inactive')+'</span></td>';
    html+='<td><button class="btn btn-view" onclick="openPartnerView(\''+safe(p.gid)+'\')">VIEW</button></td>';
    html+='</tr>';
  });
  tbl.querySelector('tbody').innerHTML=html||'<tr><td colspan="12" style="text-align:center;padding:20px;color:var(--text-muted)">No partners in '+city+'</td></tr>';
  el.scrollIntoView({behavior:'smooth',block:'start'});
};

// ── Login Activity tab ─────────────────────────────────────────
function renderLoginActivity(){
  var el=$('loginTableBody'); if(el) el.innerHTML='<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--text-muted)">Loading…</td></tr>';
  apiFetch({action:'getLoginStats'},function(err,data){
    if(err||!data||!data.success){
      if(el) el.innerHTML='<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--red)">Could not load login data. Ensure Login_Tracker sheet exists.</td></tr>';
      return;
    }
    window._loginLogs=data.logs||[];
    window._loginByUser=data.byUser||[];
    var lt=$('loginTotal'), lu=$('loginUnique');
    if(lt) lt.textContent=data.totalLogins||0;
    if(lu) lu.textContent=data.uniqueUsers||0;
    renderLoginByUser(data.byUser||[]);
    renderLoginTable(data.logs||[]);
  });
}

function renderLoginByUser(users){
  var el=$('loginByUserTable'); if(!el) return;
  var search=(($('loginSearch')||{}).value||'').toLowerCase();
  var zf=($('loginZoneFilter')||{}).value||'';
  var filtered=users.filter(function(u){
    if(search&&!(u.name||'').toLowerCase().includes(search)&&!(u.uid||'').toLowerCase().includes(search)) return false;
    if(zf&&u.zone!==zf) return false;
    return true;
  });
  var html='';
  filtered.forEach(function(u){
    var dt=u.lastLogin?new Date(u.lastLogin).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'}):'—';
    html+='<tr><td class="partner-name">'+safe(u.name||'—')+'</td><td class="muted">'+safe(u.uid)+'</td>';
    html+='<td><span class="card-badge badge-blue">'+safe(u.role||'—')+'</span></td>';
    html+='<td class="muted">'+safe(u.zone||'—')+'</td>';
    html+='<td style="font-weight:700;color:var(--red)">'+fmtN(u.count)+'</td>';
    html+='<td class="muted">'+dt+'</td></tr>';
  });
  el.querySelector('tbody').innerHTML=html||'<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--text-muted)">No login records yet</td></tr>';
}

function renderLoginTable(logs){
  var el=$('loginTableBody'); if(!el) return;
  var search=(($('loginSearch')||{}).value||'').toLowerCase();
  var zf=($('loginZoneFilter')||{}).value||'';
  var df=($('loginDateFilter')||{}).value||'';
  var filtered=logs.filter(function(l){
    if(search&&!(l.name||'').toLowerCase().includes(search)&&!(l.uid||'').toLowerCase().includes(search)) return false;
    if(zf&&l.zone!==zf) return false;
    if(df&&!l.ts.startsWith(df)) return false;
    return true;
  });
  var html='';
  filtered.slice(0,200).forEach(function(l){
    var dt=l.ts?new Date(l.ts).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'}):'—';
    html+='<tr><td class="partner-name">'+safe(l.name||'—')+'</td><td class="muted">'+safe(l.uid)+'</td>';
    html+='<td><span class="card-badge badge-blue">'+safe(l.role||'—')+'</span></td>';
    html+='<td class="muted">'+safe(l.zone||'—')+'</td><td class="muted">'+dt+'</td></tr>';
  });
  el.innerHTML=html||'<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--text-muted)">No login records</td></tr>';
}

// ── Partner VIEW modal ─────────────────────────────────────────
window.openPartnerView=function(gid){
  var d=state.data; if(!d) return;
  var p=(d.partners||[]).find(function(x){return x.gid===gid;});
  if(!p){ showError('Partner not found: '+gid); return; }
  var el=$('partnerModal'); if(!el) return;
  $('partnerModalTitle').textContent=safe(p.name)+' · '+safe(p.gid);
  var mc=mtdClr(p.mtd,p.lmtd);
  var html='<div class="modal-kpis">';
  [{l:'FTD',v:fmt(p.ftd,true),c:'blue'},{l:'MTD',v:fmt(p.mtd,true),c:mc},
   {l:'LMTD',v:fmt(p.lmtd,true),c:'muted'},{l:'Overall Pot.',v:fmt(p.overallPot,true),c:''},
   {l:'Projection',v:fmt(p.projection,true),c:''},{l:'Calls',v:fmtN(p.calls),c:'blue'},
   {l:'Visits',v:fmtN(p.visits),c:'blue'},{l:'Months Active',v:fmtN(p.monthsActive),c:''},
   {l:'Avg Monthly',v:fmt(p.avgMonthly,true),c:''},{l:'Max Pot.',v:fmt(p.bizPot,true),c:''}
  ].forEach(function(k){ html+='<div class="modal-kpi"><div class="modal-kpi-label">'+k.l+'</div><div class="modal-kpi-val '+k.c+'">'+k.v+'</div></div>'; });
  html+='</div>';
  html+='<div style="background:var(--bg);border-radius:8px;padding:10px 14px;margin-bottom:12px;font-size:0.78rem;line-height:1.8">';
  html+='<b>State:</b> '+safe(p.state)+' &nbsp;·&nbsp; <b>City:</b> '+safe(p.city)+' &nbsp;·&nbsp; <b>Zone:</b> '+safe(p.zone)+'<br>';
  html+='<b>Owner:</b> '+safe(p.ownerName)+' ('+safe(p.ownerRole)+') &nbsp;·&nbsp; <b>Status:</b> '+(p.active?'<span class="green">Active</span>':'<span class="red">Inactive</span>')+' &nbsp;·&nbsp; <b>Connected:</b> '+(p.connected?'<span class="blue">Yes</span>':'<span class="red">No</span>');
  html+='</div>';
  if(p.remark){ html+='<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:6px;padding:8px 12px;font-size:0.75rem;margin-bottom:12px;color:#92400e">💬 '+safe(p.remark)+'</div>'; }
  html+='<div class="chart-title">📈 14-Month Business Trend</div>';
  html+='<canvas id="partnerTrendChart" height="160"></canvas>';
  $('partnerModalBody').innerHTML=html;
  el.classList.add('open');
  setTimeout(function(){ renderPartnerTrend(p); },60);
};

function renderPartnerTrend(p){
  var canvas=$('partnerTrendChart'); if(!canvas) return;
  var months=p.months||[];
  var labels=p.monthLabels||MONTH_LABELS;
  if(window.partnerTrendChartInst) window.partnerTrendChartInst.destroy();
  window.partnerTrendChartInst=new Chart(canvas,{
    type:'bar',
    data:{
      labels:labels,
      datasets:[{
        label:'Business (₹)',
        data:months,
        backgroundColor:months.map(function(v,i){
          return i===months.length-1?'rgba(216,31,42,0.8)':i===months.length-2?'rgba(37,99,235,0.7)':'rgba(37,99,235,0.4)';
        }),
        borderRadius:3, barPercentage:0.6
      }]
    },
    options:{
      responsive:true,
      plugins:{legend:{display:false},tooltip:{callbacks:{label:function(ctx){return '₹'+ctx.parsed.y.toLocaleString('en-IN');}}}},
      scales:{
        y:{ticks:{callback:function(v){return v>=100000?'₹'+(v/100000).toFixed(0)+'L':v>=1000?'₹'+(v/1000).toFixed(0)+'K':'₹'+v;}},grid:{color:'#f3f4f6'}},
        x:{grid:{display:false}}
      }
    }
  });
}

var MONTH_LABELS=["Apr'25","May'25","Jun'25","Jul'25","Aug'25","Sep'25","Oct'25","Nov'25","Dec'25","Jan'26","Feb'26","Mar'26","Apr'26","May'26"];

// ── Charts ────────────────────────────────────────────────────
function renderCharts(){
  var d=state.data; if(!d) return;
  var allOwners=[];
  [d.zhPerf,d.shPerf,d.rhPerf,d.rmPerf,d.amPerf].forEach(function(arr){if(arr) allOwners=allOwners.concat(arr);});

  // Chart 1: Calls & Visits by top owners
  (function(){
    var canvas=$('connectVisitChart'); if(!canvas) return;
    var top10=allOwners.filter(function(o){return o.calls>0||o.visits>0;}).sort(function(a,b){return (b.calls+b.visits)-(a.calls+a.visits);}).slice(0,10);
    if(!top10.length) top10=allOwners.slice(0,8);
    if(window.cvChart) window.cvChart.destroy();
    window.cvChart=new Chart(canvas,{
      type:'bar',
      data:{
        labels:top10.map(function(o){return o.name.split(' ')[0];}),
        datasets:[
          {label:'Calls',data:top10.map(function(o){return o.calls;}),backgroundColor:'rgba(37,99,235,0.75)',borderRadius:4,barPercentage:0.7},
          {label:'Visits',data:top10.map(function(o){return o.visits;}),backgroundColor:'rgba(22,163,74,0.75)',borderRadius:4,barPercentage:0.7}
        ]
      },
      options:{responsive:true,plugins:{legend:{position:'top'}},scales:{y:{beginAtZero:true,grid:{color:'#f3f4f6'}},x:{grid:{display:false}}}}
    });
  })();

  // Chart 2: MTD vs LMTD by AM (top 8)
  (function(){
    var canvas=$('mtdByOwnerChart'); if(!canvas) return;
    var top8=(d.amPerf||[]).slice(0,8);
    if(window.mtdChart) window.mtdChart.destroy();
    window.mtdChart=new Chart(canvas,{
      type:'bar',
      data:{
        labels:top8.map(function(o){return o.name.split(' ')[0];}),
        datasets:[
          {label:'MTD',data:top8.map(function(o){return o.mtd;}),backgroundColor:'rgba(216,31,42,0.75)',borderRadius:4,barPercentage:0.7},
          {label:'LMTD',data:top8.map(function(o){return o.lmtd;}),backgroundColor:'rgba(148,163,184,0.55)',borderRadius:4,barPercentage:0.7}
        ]
      },
      options:{
        responsive:true,
        plugins:{legend:{position:'top'},tooltip:{callbacks:{label:function(ctx){return '₹'+(ctx.parsed.y/100000).toFixed(1)+'L';}}}},
        scales:{y:{beginAtZero:true,ticks:{callback:function(v){return '₹'+(v/100000).toFixed(0)+'L';}},grid:{color:'#f3f4f6'}},x:{grid:{display:false}}}
      }
    });
  })();

  // Chart 3: Partner status donut
  (function(){
    var canvas=$('statusDonutChart'); if(!canvas) return;
    var op=d.overallProject||{};
    var active=op.activePartners||0, inactive=op.inactivePartners||0;
    var connected=op.connectedPartners||0;
    var notConn=(op.totalPartners||0)-connected;
    if(window.donutChart) window.donutChart.destroy();
    window.donutChart=new Chart(canvas,{
      type:'doughnut',
      data:{
        labels:['Active','Inactive','Connected','Not Connected'],
        datasets:[{
          data:[active,inactive,connected,notConn],
          backgroundColor:['rgba(22,163,74,0.8)','rgba(216,31,42,0.7)','rgba(37,99,235,0.8)','rgba(148,163,184,0.5)'],
          borderWidth:2, borderColor:'#fff'
        }]
      },
      options:{responsive:true,plugins:{legend:{position:'bottom'},cutout:'60%'}}
    });
  })();

  // Chart 4: Zone MTD vs LMTD
  (function(){
    var canvas=$('zoneMtdChart'); if(!canvas) return;
    var zones=d.zoneSummaries||[];
    if(window.zoneChart) window.zoneChart.destroy();
    window.zoneChart=new Chart(canvas,{
      type:'bar',
      data:{
        labels:zones.map(function(z){return z.zone;}),
        datasets:[
          {label:'MTD',data:zones.map(function(z){return z.mtd;}),backgroundColor:'rgba(216,31,42,0.75)',borderRadius:4,barPercentage:0.6},
          {label:'LMTD',data:zones.map(function(z){return z.lmtd;}),backgroundColor:'rgba(148,163,184,0.5)',borderRadius:4,barPercentage:0.6}
        ]
      },
      options:{
        responsive:true,
        plugins:{legend:{position:'top'},tooltip:{callbacks:{label:function(ctx){return '₹'+(ctx.parsed.y/10000000).toFixed(2)+'Cr';}}}},
        scales:{y:{beginAtZero:true,ticks:{callback:function(v){return '₹'+(v/10000000).toFixed(1)+'Cr';}},grid:{color:'#f3f4f6'}},x:{grid:{display:false}}}
      }
    });
  })();
}

// ── Filter helpers ─────────────────────────────────────────────
window.filterPartnersByState=function(stateName){
  state.activeTab='myPartners';
  renderTab('myPartners');
};
window.closeOwnerModal  =function(){ var el=$('ownerModal');  if(el) el.classList.remove('open'); };
window.closePartnerModal=function(){ var el=$('partnerModal'); if(el) el.classList.remove('open'); };

// ── Event listeners ────────────────────────────────────────────
document.addEventListener('DOMContentLoaded',function(){
  document.querySelectorAll('.nav-tab').forEach(function(tab){
    tab.addEventListener('click',function(){ renderTab(tab.dataset.tab); });
  });
  var ms=$('myPartnerSearch');
  if(ms) ms.addEventListener('input',debounce(function(){renderMyPartners();},300));
  var mst=$('myPartnerStatus');
  if(mst) mst.addEventListener('change',function(){renderMyPartners();});

  // Tele filters
  var ts=$('telePartnerSearch'), tst=$('telePartnerStatus');
  if(ts) ts.addEventListener('input',debounce(function(){state.teleSearch=ts.value;renderTelePartners();},300));
  if(tst) tst.addEventListener('change',function(){state.teleStatus=tst.value;renderTelePartners();});

  // Login filters
  ['loginSearch','loginZoneFilter','loginDateFilter'].forEach(function(id){
    var el=$(id); if(!el) return;
    el.addEventListener('change',function(){
      renderLoginByUser(window._loginByUser||[]);
      renderLoginTable(window._loginLogs||[]);
    });
    el.addEventListener('input',debounce(function(){
      renderLoginByUser(window._loginByUser||[]);
      renderLoginTable(window._loginLogs||[]);
    },300));
  });
  var lrb=$('loginRefreshBtn'); if(lrb) lrb.addEventListener('click',renderLoginActivity);

  // Modal close on backdrop
  ['ownerModal','partnerModal'].forEach(function(id){
    var el=$(id); if(!el) return;
    el.addEventListener('click',function(e){ if(e.target===el) el.classList.remove('open'); });
  });
  var logoutBtn=$('logoutBtn'); if(logoutBtn) logoutBtn.addEventListener('click',function(){sessionStorage.clear();window.location.href='index.html';});
  var refreshBtn=$('refreshBtn'); if(refreshBtn) refreshBtn.addEventListener('click',loadData);
  loadData();
});
})();
