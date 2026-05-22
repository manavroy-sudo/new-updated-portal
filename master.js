// ====================================================================
// master.js v14 — InsuranceDekho Master Dashboard
// Changes v14:
//  1. Zone tabs: North/South/East&Central/West/RON — each shows
//     full ZH-style view: KPIs + Team (ZH→AM) with filters + partner table
//  2. VIEW button on every partner row → View modal with 14-month chart
//  3. % values: use pre-formatted growthFmt / targetAchFmt from server
//  4. AM Performance tab REMOVED
//  5. Daily Run Rate tab REMOVED
//  6. Team Performance shows all heads ZH→AM with filter bar
// ====================================================================
(function(){
'use strict';

// ── Session ──────────────────────────────────────────────────────────
var peUser=JSON.parse(sessionStorage.getItem('peUser')||'null');
if(!peUser){location.href='index.html';return;}
if(peUser.role.toUpperCase()!=='MASTER'){
  alert('Master access only.');
  location.href='dashboard.html';return;
}

// ── State ─────────────────────────────────────────────────────────────
var MDATA     = null;
var AP_FILTERED = [];
var AP_PAGE   = 1;
var PAGE_SIZE = 50;
var vmChart   = null;

var MONTH_LABELS=["Apr'25","May'25","Jun'25","Jul'25","Aug'25","Sep'25",
                  "Oct'25","Nov'25","Dec'25","Jan'26","Feb'26","Mar'26","Apr'26","May'26"];

var ZONE_TAB_MAP={
  'north':'North',
  'south':'South',
  'east':'East & Central',
  'west':'West',
  'ron':'RON'
};

// ── Helpers ───────────────────────────────────────────────────────────
var $=function(id){return document.getElementById(id);};
function fmtINR(n){
  if(!n||!isFinite(n)||n===0)return '₹0';
  if(n>=1e7)return '₹'+(n/1e7).toFixed(2)+' Cr';
  if(n>=1e5)return '₹'+(n/1e5).toFixed(2)+'L';
  if(n>=1e3)return '₹'+(n/1e3).toFixed(1)+'K';
  return '₹'+Math.round(n).toLocaleString('en-IN');
}
function fmtShort(n){
  if(!n||!isFinite(n)||n===0)return '0';
  if(n>=1e7)return (n/1e7).toFixed(1)+'Cr';
  if(n>=1e5)return (n/1e5).toFixed(1)+'L';
  if(n>=1e3)return (n/1e3).toFixed(0)+'K';
  return Math.round(n)+'';
}
function safe(s){return String(s==null?'':s);}
function esc(s){return safe(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function growthPill(fmt){
  var n=parseFloat(fmt)||0;
  var cls=n>0?'pill-up':n<0?'pill-dn':'pill-flat';
  return '<span class="pill '+cls+'">'+(n>0?'+':'')+fmt+'</span>';
}
function achColor(ach){
  if(ach>=100)return 'val-green';
  if(ach>=50) return 'val-amber';
  return 'val-red';
}
function momPct(mtd,lmtd){
  if(!lmtd)return mtd>0?'+100%':'—';
  var p=Math.round((mtd-lmtd)/lmtd*100);
  return (p>=0?'+':'')+p+'%';
}
function uniq(arr){
  var seen={},out=[];
  arr.forEach(function(v){var s=safe(v).trim();if(s&&!seen[s]){seen[s]=true;out.push(s);}});
  return out.sort();
}
function populateSel(id,vals){
  var el=$(id);if(!el)return;
  var first=el.options[0].textContent;
  el.innerHTML='<option value="">'+first+'</option>'+
    vals.filter(Boolean).sort().map(function(v){return '<option>'+esc(v)+'</option>';}).join('');
}

// ── Status ────────────────────────────────────────────────────────────
function status(msg,type){
  var sb=$('statusBar');
  sb.className='status-bar '+(type||'loading');
  sb.innerHTML=(type==='loading'?'<div class="spinner"></div>':'')+msg;
}
function hideStatus(){$('statusBar').className='status-bar hidden';}

function callApi(action,payload,cb){
  google.script.run
    .withSuccessHandler(function(r){cb(null,r);})
    .withFailureHandler(function(e){cb(e.message||'Error',null);})
    .callServer(action,payload);
}

// ── Init ──────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded',function(){
  $('userName').textContent=peUser.name||'Master Admin';
  $('userRole').textContent='MASTER';

  document.querySelectorAll('.tab').forEach(function(btn){
    btn.addEventListener('click',function(){
      document.querySelectorAll('.tab').forEach(function(b){b.classList.remove('active');});
      document.querySelectorAll('.tab-pane').forEach(function(p){p.classList.remove('active');});
      btn.classList.add('active');
      var tab=btn.dataset.tab;
      var pane=$('pane-'+tab);
      if(pane) pane.classList.add('active');
      // Lazy-load logins on first click
      if(tab==='logins'&&!loginsLoaded) loadLogins();
    });
  });

  $('btnLogout').addEventListener('click',function(){
    sessionStorage.clear();location.href='index.html';
  });
  $('viewModal').addEventListener('click',function(e){if(e.target===$('viewModal'))closeViewModal();});
  $('drillModal').addEventListener('click',function(e){if(e.target===$('drillModal'))closeDrillModal();});

  loadMasterData();
});

var loginsLoaded=false;

// ── Load Master Data ──────────────────────────────────────────────────
function loadMasterData(){
  status('Loading pan-India data…','loading');
  callApi('masterData',{user:peUser},function(err,res){
    if(err||!res||!res.success){
      status('Error: '+(err||res&&res.message),'error');return;
    }
    MDATA=res;
    hideStatus();
    renderOverview(res);
    buildAPFilters(res.partners);
    apFilter();
    // Render each zone tab
    res.zones.forEach(function(z){
      var key=Object.keys(ZONE_TAB_MAP).find(function(k){return ZONE_TAB_MAP[k]===z.zone;})||
              z.zone.toLowerCase().replace(/[^a-z]/g,'');
      var cid='zone-'+key+'-content';
      var el=$(cid);
      if(el) renderZoneSection(el,z);
    });
    // Tele-RM
    renderTele(res.tele);
  });
}

// ── Overview ──────────────────────────────────────────────────────────
function renderOverview(data){
  var s=data.summary;
  // Zone summary cards
  var zoneCards=data.zones.map(function(z){
    var s2=z.summary;
    var ach=s2.targetAch||0;
    var barW=Math.min(100,ach);
    var barColor=ach>=100?'#4ade80':ach>=50?'#fbbf24':'#f87171';
    return '<div class="zone-card" onclick="goTab(\''+zoneKeyOf(z.zone)+'\')">'+
      '<div class="zone-card-header">'+
        '<div class="zone-card-name">'+esc(z.zone)+'</div>'+
        '<div class="zone-card-ach" style="color:'+barColor+'">'+s2.targetAchFmt+'</div>'+
      '</div>'+
      '<div class="zone-stats">'+
        '<div class="zone-stat-item"><div class="zone-stat-label">Partners</div><div class="zone-stat-val">'+s2.total+'</div></div>'+
        '<div class="zone-stat-item"><div class="zone-stat-label">Active</div><div class="zone-stat-val" style="color:#4ade80">'+s2.active+'</div></div>'+
        '<div class="zone-stat-item"><div class="zone-stat-label">MTD</div><div class="zone-stat-val">'+fmtINR(s2.mtd)+'</div></div>'+
        '<div class="zone-stat-item"><div class="zone-stat-label">Target</div><div class="zone-stat-val">'+fmtINR(s2.target)+'</div></div>'+
      '</div>'+
      '<div class="tc-progress" style="margin-top:12px"><div class="tc-progress-bar" style="width:'+barW+'%;background:'+barColor+'"></div></div>'+
    '</div>';
  }).join('');

  var html=
    '<div class="kpi-grid" style="margin-bottom:24px;">'+
      '<div class="kpi-card"><div class="kpi-label">Total Partners</div><div class="kpi-value">'+s.total+'</div></div>'+
      '<div class="kpi-card"><div class="kpi-label">Active</div><div class="kpi-value green">'+s.active+'</div></div>'+
      '<div class="kpi-card"><div class="kpi-label">Inactive</div><div class="kpi-value red">'+s.inactive+'</div></div>'+
      '<div class="kpi-card"><div class="kpi-label">MTD</div><div class="kpi-value">'+fmtINR(s.mtd)+'</div></div>'+
      '<div class="kpi-card"><div class="kpi-label">LMTD</div><div class="kpi-value">'+fmtINR(s.lmtd)+'</div></div>'+
      '<div class="kpi-card"><div class="kpi-label">Target</div><div class="kpi-value">'+fmtINR(s.target)+'</div></div>'+
      '<div class="kpi-card"><div class="kpi-label">Achievement</div><div class="kpi-value '+achColor(s.targetAch)+'">'+s.targetAchFmt+'</div></div>'+
      '<div class="kpi-card"><div class="kpi-label">MoM Growth</div><div class="kpi-value '+(s.mom>=0?'green':'red')+'">'+s.momFmt+'</div></div>'+
    '</div>'+
    '<h3 style="font-size:15px;font-weight:700;color:#e2e8f0;margin-bottom:14px;">Zone Summary — Click a zone card to drill in</h3>'+
    '<div class="zone-grid">'+zoneCards+'</div>'+
    '<h3 style="font-size:15px;font-weight:700;color:#e2e8f0;margin:20px 0 12px;">Top Team Heads (All Zones)</h3>'+
    renderTeamGridHTML(data.team.slice(0,12));

  $('overviewContent').innerHTML=html;
}

function zoneKeyOf(zone){
  return Object.keys(ZONE_TAB_MAP).find(function(k){return ZONE_TAB_MAP[k]===zone;})||
         zone.toLowerCase().replace(/[^a-z]/g,'');
}

function goTab(key){
  var btn=document.querySelector('.tab[data-tab="'+key+'"]');
  if(btn) btn.click();
}

// ── Zone Section ──────────────────────────────────────────────────────
function renderZoneSection(el,zoneData){
  var s=zoneData.summary;
  var zoneName=zoneData.zone;
  var zid='z'+zoneName.replace(/[^a-z0-9]/gi,'').toLowerCase();

  el.innerHTML=
    // Zone KPIs
    '<div class="kpi-grid" style="margin-bottom:20px;">'+
      '<div class="kpi-card"><div class="kpi-label">Partners</div><div class="kpi-value">'+s.total+'</div></div>'+
      '<div class="kpi-card"><div class="kpi-label">Active</div><div class="kpi-value green">'+s.active+'</div></div>'+
      '<div class="kpi-card"><div class="kpi-label">MTD</div><div class="kpi-value">'+fmtINR(s.mtd)+'</div></div>'+
      '<div class="kpi-card"><div class="kpi-label">Target</div><div class="kpi-value">'+fmtINR(s.target)+'</div></div>'+
      '<div class="kpi-card"><div class="kpi-label">Achievement</div><div class="kpi-value '+achColor(s.targetAch)+'">'+s.targetAchFmt+'</div></div>'+
      '<div class="kpi-card"><div class="kpi-label">MoM</div><div class="kpi-value '+(s.mom>=0?'green':'red')+'">'+s.momFmt+'</div></div>'+
    '</div>'+

    // Team Performance (all heads ZH→AM) with filters
    '<h3 style="font-size:14px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px;margin-bottom:12px;">'+
      'Team Heads ('+zoneName+') — ZH → AM</h3>'+
    '<div class="filter-bar" style="margin-bottom:14px;">'+
      '<input type="text" id="'+zid+'tSearch" placeholder="Search owner name…" oninput="zoneTeamFilter(\''+zid+'\')"/>'+
      '<select id="'+zid+'tState" onchange="zoneTeamFilter(\''+zid+'\')"><option value="">All States</option></select>'+
      '<select id="'+zid+'tRole" onchange="zoneTeamFilter(\''+zid+'\')">'+
        '<option value="">All Roles (ZH→AM)</option>'+
        '<option>ZH</option><option>RH</option><option>SH</option><option>RM</option><option>AM</option>'+
      '</select>'+
      '<button class="btn-clear" onclick="zoneTeamClear(\''+zid+'\')">Clear</button>'+
    '</div>'+
    '<div id="'+zid+'tGrid" class="team-grid" style="margin-bottom:24px;">'+
      renderTeamGridHTML(zoneData.team)+
    '</div>'+

    // Partner table
    '<h3 style="font-size:14px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px;margin-bottom:12px;">'+
      'All Partners ('+zoneName+')</h3>'+
    '<div class="filter-bar" style="margin-bottom:10px;">'+
      '<input type="text" id="'+zid+'pSearch" placeholder="Search partner…" oninput="zonePFilter(\''+zid+'\')"/>'+
      '<select id="'+zid+'pState" onchange="zonePFilter(\''+zid+'\')"><option value="">All States</option></select>'+
      '<select id="'+zid+'pOwner" onchange="zonePFilter(\''+zid+'\')"><option value="">All Owners</option></select>'+
      '<select id="'+zid+'pStatus" onchange="zonePFilter(\''+zid+'\')"><option value="">All Status</option><option>Active</option><option>Inactive</option></select>'+
      '<button class="btn-clear" onclick="zonePClear(\''+zid+'\')">Clear</button>'+
    '</div>'+
    '<div class="table-wrap">'+
      '<table class="ptable" id="'+zid+'pTable">'+
        '<thead><tr><th>View</th><th>GID</th><th>Partner Name</th><th>City</th><th>State</th>'+
        '<th>Owner (AM)</th><th>Max Pot</th><th>Overall Pot</th><th>Target</th>'+
        '<th>MTD</th><th>LMTD</th><th>MoM%</th><th>Growth%</th><th>Ach%</th><th>Status</th></tr></thead>'+
        '<tbody id="'+zid+'pTbody"></tbody>'+
      '</table>'+
    '</div>'+
    '<div id="'+zid+'pPagination" class="pg-wrap"></div>';

  // Populate selects & render table
  populateSel(zid+'tState', uniq(zoneData.team.map(function(t){return t.state;})));
  populateSel(zid+'pState', uniq(zoneData.partners.map(function(p){return p.state;})));
  populateSel(zid+'pOwner', uniq(zoneData.partners.map(function(p){return p.oName;})));

  // Store zone partners on element for filtering
  el._data = {team:zoneData.team, partners:zoneData.partners};
  zoneRenderPartners(zid, zoneData.partners);
  zoneTeamFilter(zid);
}

// Zone team filter
window.zoneTeamFilter=function(zid){
  var el=document.querySelector('[id="'+zid+'tGrid"]');
  if(!el) return;
  var pane=el.closest('.tab-pane')||el.parentElement;
  // Find the stored zone data
  var content=el.closest('[id$="-content"]');
  if(!content||!content._data) return;
  var team=content._data.team;
  var q=($(zid+'tSearch')||{value:''}).value.toLowerCase();
  var state=($(zid+'tState')||{value:''}).value;
  var role=($(zid+'tRole')||{value:''}).value;
  var f=team.filter(function(t){
    if(q&&!t.name.toLowerCase().includes(q)) return false;
    if(state&&t.state!==state) return false;
    if(role&&(t.role||'').toUpperCase()!==role) return false;
    return true;
  });
  $(zid+'tGrid').innerHTML=renderTeamGridHTML(f);
};
window.zoneTeamClear=function(zid){
  var s=$(zid+'tSearch');if(s)s.value='';
  var st=$(zid+'tState');if(st)st.value='';
  var r=$(zid+'tRole');if(r)r.value='';
  zoneTeamFilter(zid);
};

// Zone partner filter
window.zonePFilter=function(zid){
  var content=document.querySelector('[id$="-content"]');
  // Walk through all zone contents to find the right one
  var allContents=document.querySelectorAll('[id$="-content"]');
  var zoneContent=null;
  allContents.forEach(function(c){if(c._data&&$(zid+'pTbody')&&c.contains($(zid+'pTbody')))zoneContent=c;});
  if(!zoneContent||!zoneContent._data) return;
  var partners=zoneContent._data.partners;
  var q=($(zid+'pSearch')||{value:''}).value.toLowerCase();
  var state=($(zid+'pState')||{value:''}).value;
  var owner=($(zid+'pOwner')||{value:''}).value;
  var st=($(zid+'pStatus')||{value:''}).value;
  var f=partners.filter(function(p){
    if(q&&!((p.name+p.gid+p.city+p.oName).toLowerCase().includes(q)))return false;
    if(state&&p.state!==state)return false;
    if(owner&&p.oName!==owner)return false;
    if(st&&!(p.active||'').toLowerCase().includes(st.toLowerCase()))return false;
    return true;
  });
  zoneRenderPartners(zid,f);
};
window.zonePClear=function(zid){
  ['pSearch','pState','pOwner','pStatus'].forEach(function(s){var e=$(zid+s);if(e)e.value='';});
  zonePFilter(zid);
};

function zoneRenderPartners(zid,list){
  if(!$(zid+'pTbody')) return;
  var PAGE=50,page=1;
  function render(){
    var s=(page-1)*PAGE,e=Math.min(s+PAGE,list.length);
    $(zid+'pTbody').innerHTML=list.slice(s,e).map(function(p){return zonePartnerRow(p);}).join('');
    renderPagination(zid+'pPagination',page,Math.ceil(list.length/PAGE),function(pg){
      page=pg;render();
    });
  }
  render();
}

function zonePartnerRow(p){
  var isActive=p.active&&p.active.toLowerCase().includes('active');
  var mom=momPct(p.mtd,p.lmtd);
  var momCls=mom.startsWith('+')?'val-green':mom.startsWith('-')?'val-red':'';
  var mtdCls=p.mtd>p.lmtd?'val-green':p.mtd<p.lmtd?'val-red':'val-amber';
  return '<tr>'+
    '<td><button class="btn-view" onclick="openViewModal(\''+esc(p.gid)+'\')">View</button></td>'+
    '<td>'+esc(p.gid)+'</td>'+
    '<td class="name-cell">'+esc(p.name)+'</td>'+
    '<td>'+esc(p.city)+'</td><td>'+esc(p.state)+'</td>'+
    '<td>'+esc(p.oName)+'</td>'+
    '<td>'+fmtINR(p.maxPot)+'</td>'+
    '<td>'+fmtINR(p.oPot)+'</td>'+
    '<td>'+(p.target>0?fmtINR(p.target):'<span style="color:#64748b">—</span>')+'</td>'+
    '<td class="'+mtdCls+'">'+fmtINR(p.mtd)+'</td>'+
    '<td>'+fmtINR(p.lmtd)+'</td>'+
    '<td class="'+momCls+'">'+mom+'</td>'+
    '<td>'+growthPill(p.growthFmt)+'</td>'+
    '<td class="'+achColor(p.targetAch)+'">'+p.targetAchFmt+'</td>'+
    '<td>'+(isActive?'<span class="badge-active">Active</span>':'<span class="badge-inactive">Inactive</span>')+'</td>'+
  '</tr>';
}

// ── All Partners (master-level) ───────────────────────────────────────
function buildAPFilters(partners){
  populateSel('apZone',  uniq(partners.map(function(p){return p.zone;})));
  populateSel('apState', uniq(partners.map(function(p){return p.state;})));
  populateSel('apOwner', uniq(partners.map(function(p){return p.oName;})));
}

window.apFilter=function(){
  if(!MDATA) return;
  var q=($('apSearch')||{value:''}).value.toLowerCase();
  var zone=($('apZone')||{value:''}).value;
  var state=($('apState')||{value:''}).value;
  var owner=($('apOwner')||{value:''}).value;
  var st=($('apStatus')||{value:''}).value;
  AP_FILTERED=MDATA.partners.filter(function(p){
    if(q&&!((p.name+p.gid+p.city+p.oName).toLowerCase().includes(q)))return false;
    if(zone&&p.zone!==zone)return false;
    if(state&&p.state!==state)return false;
    if(owner&&p.oName!==owner)return false;
    if(st&&!(p.active||'').toLowerCase().includes(st.toLowerCase()))return false;
    return true;
  });
  AP_PAGE=1;renderAPTable();
};

window.apClear=function(){
  ['apSearch','apZone','apState','apOwner','apStatus'].forEach(function(id){var e=$(id);if(e)e.value='';});
  apFilter();
};

function renderAPTable(){
  var s=(AP_PAGE-1)*PAGE_SIZE,e=Math.min(s+PAGE_SIZE,AP_FILTERED.length);
  var slice=AP_FILTERED.slice(s,e);
  $('apTbody').innerHTML=slice.map(function(p){
    var isActive=p.active&&p.active.toLowerCase().includes('active');
    var mom=momPct(p.mtd,p.lmtd);
    var momCls=mom.startsWith('+')?'val-green':mom.startsWith('-')?'val-red':'';
    var mtdCls=p.mtd>p.lmtd?'val-green':p.mtd<p.lmtd?'val-red':'val-amber';
    return '<tr>'+
      '<td><button class="btn-view" onclick="openViewModal(\''+esc(p.gid)+'\')">View</button></td>'+
      '<td>'+esc(p.gid)+'</td>'+
      '<td class="name-cell">'+esc(p.name)+'</td>'+
      '<td>'+esc(p.city)+'</td><td>'+esc(p.state)+'</td>'+
      '<td>'+esc(p.zone)+'</td>'+
      '<td>'+esc(p.oName)+'</td><td>'+esc(p.oRole)+'</td>'+
      '<td>'+fmtINR(p.maxPot)+'</td><td>'+fmtINR(p.oPot)+'</td>'+
      '<td>'+(p.target>0?fmtINR(p.target):'<span style="color:#64748b">—</span>')+'</td>'+
      '<td class="'+mtdCls+'">'+fmtINR(p.mtd)+'</td>'+
      '<td>'+fmtINR(p.lmtd)+'</td>'+
      '<td class="'+momCls+'">'+mom+'</td>'+
      '<td>'+growthPill(p.growthFmt)+'</td>'+
      '<td class="'+achColor(p.targetAch)+'">'+p.targetAchFmt+'</td>'+
      '<td>'+(isActive?'<span class="badge-active">Active</span>':'<span class="badge-inactive">Inactive</span>')+'</td>'+
      '<td>'+p.calls+'</td><td>'+p.visits+'</td>'+
    '</tr>';
  }).join('');
  renderPagination('apPagination',AP_PAGE,Math.ceil(AP_FILTERED.length/PAGE_SIZE),function(pg){
    AP_PAGE=pg;renderAPTable();
  });
}

// ── Tele-RM ───────────────────────────────────────────────────────────
function renderTele(tele){
  var s=tele.summary;
  var html=
    '<div class="kpi-grid" style="margin-bottom:20px;">'+
      '<div class="kpi-card"><div class="kpi-label">Tele Partners</div><div class="kpi-value">'+s.total+'</div></div>'+
      '<div class="kpi-card"><div class="kpi-label">Active</div><div class="kpi-value green">'+s.active+'</div></div>'+
      '<div class="kpi-card"><div class="kpi-label">MTD</div><div class="kpi-value">'+fmtINR(s.mtd)+'</div></div>'+
      '<div class="kpi-card"><div class="kpi-label">Target</div><div class="kpi-value">'+fmtINR(s.target)+'</div></div>'+
      '<div class="kpi-card"><div class="kpi-label">Achievement</div><div class="kpi-value '+achColor(s.targetAch)+'">'+s.targetAchFmt+'</div></div>'+
    '</div>'+
    '<h3 style="font-size:14px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px;margin-bottom:12px;">Tele-RM Team</h3>'+
    renderTeamGridHTML(tele.team)+
    '<h3 style="font-size:14px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px;margin:20px 0 12px;">Tele-RM Partners</h3>'+
    '<div class="table-wrap"><table class="ptable"><thead><tr>'+
    '<th>View</th><th>GID</th><th>Partner Name</th><th>City</th><th>State</th><th>Owner</th>'+
    '<th>MTD</th><th>Ach%</th><th>Status</th></tr></thead>'+
    '<tbody>'+tele.partners.slice(0,200).map(function(p){
      return '<tr>'+
        '<td><button class="btn-view" onclick="openViewModal(\''+esc(p.gid)+'\')">View</button></td>'+
        '<td>'+esc(p.gid)+'</td>'+
        '<td class="name-cell">'+esc(p.name)+'</td>'+
        '<td>'+esc(p.city)+'</td><td>'+esc(p.state)+'</td>'+
        '<td>'+esc(p.oName)+'</td>'+
        '<td class="'+(p.mtd>p.lmtd?'val-green':'val-red')+'">'+fmtINR(p.mtd)+'</td>'+
        '<td class="'+achColor(p.targetAch)+'">'+p.targetAchFmt+'</td>'+
        '<td>'+(p.active&&p.active.toLowerCase().includes('active')?'<span class="badge-active">Active</span>':'<span class="badge-inactive">Inactive</span>')+'</td>'+
      '</tr>';
    }).join('')+
    '</tbody></table></div>';
  $('teleContent').innerHTML=html;
}

// ── Login Activity ────────────────────────────────────────────────────
function loadLogins(){
  loginsLoaded=true;
  $('loginsContent').innerHTML='<div class="empty-state"><div class="spinner"></div><div class="es-msg">Loading…</div></div>';
  callApi('loginStats',{user:peUser},function(err,res){
    if(err||!res||!res.success){
      $('loginsContent').innerHTML='<div class="empty-state"><div class="es-icon">⚠️</div><div class="es-msg">Could not load login data.</div></div>';
      return;
    }
    if(!res.logs||!res.logs.length){
      $('loginsContent').innerHTML='<div class="empty-state"><div class="es-icon">📋</div><div class="es-msg">No logins recorded yet.</div></div>';
      return;
    }
    var html='<div class="table-wrap"><table class="login-table">'+
      '<thead><tr><th>Timestamp</th><th>GID</th><th>Name</th><th>Role</th></tr></thead>'+
      '<tbody>'+res.logs.map(function(l){
        return '<tr><td>'+esc(l.ts)+'</td><td>'+esc(l.gid)+'</td>'+
               '<td>'+esc(l.name)+'</td><td>'+esc(l.role)+'</td></tr>';
      }).join('')+'</tbody></table></div>';
    $('loginsContent').innerHTML=html;
  });
}

// ── Team Grid HTML (shared renderer) ─────────────────────────────────
function renderTeamGridHTML(team){
  if(!team||!team.length) return '<div class="empty-state"><div class="es-icon">👥</div><div class="es-msg">No team data</div></div>';
  return '<div class="team-grid">'+team.map(function(t){
    var av=(t.name||'?').charAt(0).toUpperCase();
    var ach=t.targetAch||0;
    var barW=Math.min(100,ach);
    var barColor=ach>=100?'#4ade80':ach>=50?'#fbbf24':'#f87171';
    return '<div class="team-card">'+
      '<div class="tc-header">'+
        '<div class="tc-avatar">'+av+'</div>'+
        '<div>'+
          '<div class="tc-name">'+esc(t.name)+'</div>'+
          '<div class="tc-meta">'+esc(t.zone)+(t.state?' · '+esc(t.state):'')+'</div>'+
        '</div>'+
        '<div class="tc-role-badge">'+esc(t.role)+'</div>'+
      '</div>'+
      '<div class="tc-stats">'+
        '<div class="tc-stat"><div class="tc-stat-label">MTD</div><div class="tc-stat-val">'+fmtINR(t.mtd)+'</div></div>'+
        '<div class="tc-stat"><div class="tc-stat-label">Partners</div><div class="tc-stat-val">'+t.count+'</div></div>'+
        '<div class="tc-stat"><div class="tc-stat-label">Active</div><div class="tc-stat-val" style="color:#4ade80">'+t.active+'</div></div>'+
      '</div>'+
      '<div class="tc-progress"><div class="tc-progress-bar" style="width:'+barW+'%;background:'+barColor+'"></div></div>'+
      '<div class="tc-progress-label">Target: '+fmtINR(t.target)+' · Ach: '+t.targetAchFmt+'</div>'+
      '<button class="btn-tc-details" onclick="openDrillByOwner(\''+esc(t.name)+'\')">📋 View Partners</button>'+
    '</div>';
  }).join('')+'</div>';
}

// ── Drill: Team member → partners ─────────────────────────────────────
window.openDrillByOwner=function(ownerName){
  if(!MDATA) return;
  var all=MDATA.partners.concat(MDATA.tele&&MDATA.tele.partners?MDATA.tele.partners:[]);
  var pts=all.filter(function(p){return (p.oName||'').toLowerCase()===ownerName.toLowerCase();});
  $('drillTitle').textContent=ownerName;
  $('drillMeta').textContent=pts.length+' partner(s)';
  $('drillBody').innerHTML='<div class="table-wrap"><table class="ptable">'+
    '<thead><tr><th>View</th><th>GID</th><th>Partner</th><th>City</th><th>State</th>'+
    '<th>Zone</th><th>MTD</th><th>LMTD</th><th>Ach%</th><th>Status</th></tr></thead>'+
    '<tbody>'+pts.map(function(p){
      return '<tr>'+
        '<td><button class="btn-view" onclick="openViewModal(\''+esc(p.gid)+'\')">View</button></td>'+
        '<td>'+esc(p.gid)+'</td>'+
        '<td class="name-cell">'+esc(p.name)+'</td>'+
        '<td>'+esc(p.city)+'</td><td>'+esc(p.state)+'</td>'+
        '<td>'+esc(p.zone)+'</td>'+
        '<td class="'+(p.mtd>p.lmtd?'val-green':'val-red')+'">'+fmtINR(p.mtd)+'</td>'+
        '<td>'+fmtINR(p.lmtd)+'</td>'+
        '<td class="'+achColor(p.targetAch)+'">'+p.targetAchFmt+'</td>'+
        '<td>'+(p.active&&p.active.toLowerCase().includes('active')?'<span class="badge-active">Active</span>':'<span class="badge-inactive">Inactive</span>')+'</td>'+
      '</tr>';
    }).join('')+'</tbody></table></div>';
  $('drillModal').classList.remove('hidden');
};
window.closeDrillModal=function(){$('drillModal').classList.add('hidden');};

// ── VIEW MODAL ────────────────────────────────────────────────────────
window.openViewModal=function(gid){
  var all=(MDATA?MDATA.partners:[]).concat(MDATA&&MDATA.tele?MDATA.tele.partners:[]);
  var local=all.find(function(p){return p.gid===gid;})||null;
  if(local){buildViewModal(local);}
  else{
    callApi('getPartner',{gid:gid,user:peUser},function(err,res){
      if(err||!res||!res.success){alert('Partner not found.');return;}
      buildViewModal(res.partner);
    });
  }
};

function buildViewModal(p){
  var vals=p.monthlyData||[];
  var bestMonth=p.bestMonth||Math.max.apply(null,vals.concat([0]));
  var targetAch=p.targetAch||0;
  var achFmt=p.targetAchFmt||(targetAch+'%');
  var achCls=targetAch>=100?'green':targetAch>=50?'amber':'red';

  $('vmName').textContent=p.name||'—';
  $('vmMeta').textContent='GID: '+p.gid+' · '+p.city+', '+p.state+' · '+p.zone+' · AM: '+p.oName;

  $('vmBody').innerHTML=
    '<div class="vm-kpi-row">'+
      '<div class="vm-kpi"><div class="vm-kpi-label">Overall Potential</div><div class="vm-kpi-val">'+fmtINR(p.oPot)+'</div></div>'+
      '<div class="vm-kpi"><div class="vm-kpi-label">May Target</div><div class="vm-kpi-val">'+(p.target>0?fmtINR(p.target):'—')+'</div></div>'+
      '<div class="vm-kpi"><div class="vm-kpi-label">MTD (May\'26)</div><div class="vm-kpi-val green">'+fmtINR(p.mtd)+'</div></div>'+
      '<div class="vm-kpi"><div class="vm-kpi-label">Best Month</div><div class="vm-kpi-val">'+fmtINR(bestMonth)+'</div></div>'+
    '</div>'+
    '<div class="vm-highlight">'+
      '<div class="vm-hl-item"><div class="vm-hl-label">MAX POTENTIAL</div><div class="vm-hl-val">'+fmtINR(p.maxPot)+'</div></div>'+
      '<div class="vm-hl-item"><div class="vm-hl-label">MAY TARGET</div><div class="vm-hl-val">'+(p.target>0?fmtINR(p.target):'Not set')+'</div></div>'+
      '<div class="vm-hl-item"><div class="vm-hl-label">MTD VS LMTD</div><div class="vm-hl-val">'+fmtINR(p.mtd)+' / '+fmtINR(p.lmtd)+'</div></div>'+
      '<div class="vm-hl-item"><div class="vm-hl-label">TARGET ACHIEVEMENT</div><div class="vm-hl-val '+achCls+'">'+achFmt+'</div></div>'+
    '</div>'+
    '<div class="vm-trend-title">14-MONTH TREND</div>'+
    '<div class="vm-chart-wrap"><canvas id="vmCanvas" class="vm-chart-canvas"></canvas></div>';

  $('viewModal').classList.remove('hidden');

  setTimeout(function(){
    var canvas=$('vmCanvas');if(!canvas)return;
    if(vmChart){vmChart.destroy();vmChart=null;}
    vmChart=new Chart(canvas,{
      type:'line',
      data:{
        labels:MONTH_LABELS.slice(0,vals.length),
        datasets:[{
          data:vals,
          borderColor:'#c8102e',
          backgroundColor:'rgba(200,16,46,0.15)',
          fill:true,tension:0.4,
          pointBackgroundColor:'#c8102e',
          pointRadius:4,pointHoverRadius:6,borderWidth:2
        }]
      },
      options:{
        responsive:true,
        plugins:{legend:{display:false},tooltip:{callbacks:{label:function(ctx){return fmtINR(ctx.parsed.y);}}}},
        scales:{
          x:{grid:{color:'rgba(255,255,255,0.05)'},ticks:{color:'#64748b',font:{size:10}}},
          y:{grid:{color:'rgba(255,255,255,0.05)'},ticks:{color:'#64748b',font:{size:10},
             callback:function(v){return fmtShort(v);}}}
        }
      }
    });
  },50);
}

window.closeViewModal=function(){
  $('viewModal').classList.add('hidden');
  if(vmChart){vmChart.destroy();vmChart=null;}
};

// ── Pagination ────────────────────────────────────────────────────────
function renderPagination(id,current,total,onPage){
  var el=$(id);if(!el)return;
  if(total<=1){el.innerHTML='';return;}
  var html='<span class="pg-info">Page '+current+' of '+total+'</span>';
  html+='<button class="pg-btn" '+(current===1?'disabled':'')+' data-pg="'+(current-1)+'">‹</button>';
  var s=Math.max(1,current-2),e=Math.min(total,current+2);
  for(var i=s;i<=e;i++){html+='<button class="pg-btn'+(i===current?' active':'')+'" data-pg="'+i+'">'+i+'</button>';}
  html+='<button class="pg-btn" '+(current===total?'disabled':'')+' data-pg="'+(current+1)+'">›</button>';
  el.innerHTML=html;
  el.querySelectorAll('.pg-btn:not([disabled])').forEach(function(btn){
    btn.addEventListener('click',function(){onPage(parseInt(this.dataset.pg));});
  });
}

// ── CSV Export ────────────────────────────────────────────────────────
window.exportAll=function(){
  if(!AP_FILTERED||!AP_FILTERED.length){alert('Nothing to export.');return;}
  var h=['GID','Name','City','State','Zone','Owner','Role','MaxPot','OverallPot','Target','MTD','LMTD','Growth%','Ach%','Status'];
  var rows=[h.join(',')];
  AP_FILTERED.forEach(function(p){
    rows.push([p.gid,p.name,p.city,p.state,p.zone,p.oName,p.oRole,
               p.maxPot,p.oPot,p.target,p.mtd,p.lmtd,p.growthFmt,p.targetAchFmt,p.active]
      .map(function(v){return '"'+String(v||'').replace(/"/g,'""')+'"';}).join(','));
  });
  var blob=new Blob([rows.join('\n')],{type:'text/csv'});
  var url=URL.createObjectURL(blob);
  var a=document.createElement('a');a.href=url;a.download='master_all_partners.csv';a.click();
  URL.revokeObjectURL(url);
};

})();
