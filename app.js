// ====================================================================
// app.js v14 — InsuranceDekho ZH/SH/RM/AM Dashboard
// Changes v14:
//  1. VIEW button on every partner row → opens View modal with
//     14-month chart, KPI tiles, highlight box (matching Pic 3)
//  2. % values: use pre-formatted growthFmt / targetAchFmt from server
//  3. Team Performance tab replaces AM Performance — shows ALL heads
//     ZH→AM with filter bar (name, zone, state, role)
//  4. Daily Run Rate tab REMOVED
//  5. AM Performance tab REMOVED
// ====================================================================
(function(){
'use strict';

// ── Session ──────────────────────────────────────────────────────────
var peUser = JSON.parse(sessionStorage.getItem('peUser')||'null');
if(!peUser){location.href='index.html';return;}

// ── State ─────────────────────────────────────────────────────────────
var DASH        = null; // full dashboard payload
var AP_FILTERED = [];
var MP_FILTERED = [];
var TP_ALL      = [];
var AP_PAGE     = 1;
var MP_PAGE     = 1;
var PAGE_SIZE   = 50;
var vmChart     = null;

var MONTH_LABELS = ["Apr'25","May'25","Jun'25","Jul'25","Aug'25","Sep'25",
                    "Oct'25","Nov'25","Dec'25","Jan'26","Feb'26","Mar'26","Apr'26","May'26"];

// ── Helpers ───────────────────────────────────────────────────────────
var $ = function(id){return document.getElementById(id);};
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

// ── Status Bar ────────────────────────────────────────────────────────
function status(msg,type){
  var sb=$('statusBar');
  sb.className='status-bar '+(type||'loading');
  sb.innerHTML=(type==='loading'?'<div class="spinner"></div>':'')+msg;
}
function hideStatus(){$('statusBar').className='status-bar hidden';}

// ── API Call ──────────────────────────────────────────────────────────
function callApi(action, payload, cb){
  google.script.run
    .withSuccessHandler(function(r){cb(null,r);})
    .withFailureHandler(function(e){cb(e.message||'Error',null);})
    .callServer(action, payload);
}

// ── Init ──────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded',function(){
  $('userName').textContent = peUser.name||'—';
  $('userRole').textContent = peUser.role||'—';

  // Role-based tab visibility
  var role=(peUser.role||'').toUpperCase();
  if(role==='AM'){
    var m=$('tabMine');
    if(m){m.style.display='none';}// AM's partners = All Partners
  }

  // Tab switching
  document.querySelectorAll('.tab').forEach(function(btn){
    btn.addEventListener('click',function(){
      document.querySelectorAll('.tab').forEach(function(b){b.classList.remove('active');});
      document.querySelectorAll('.tab-pane').forEach(function(p){p.classList.remove('active');});
      btn.classList.add('active');
      var pane=$('pane-'+btn.dataset.tab);
      if(pane) pane.classList.add('active');
    });
  });

  // Logout
  $('btnLogout').addEventListener('click',function(){
    sessionStorage.clear();location.href='index.html';
  });

  // Close modals on backdrop click
  $('viewModal').addEventListener('click',function(e){
    if(e.target===$('viewModal')) closeViewModal();
  });
  $('drillModal').addEventListener('click',function(e){
    if(e.target===$('drillModal')) closeDrillModal();
  });

  loadDashboard();
});

// ── Load Data ─────────────────────────────────────────────────────────
function loadDashboard(){
  status('Loading dashboard data…','loading');
  callApi('dashboard',{user:peUser},function(err,res){
    if(err||!res||!res.success){
      status('Error loading data: '+(err||res&&res.message),'error');
      return;
    }
    DASH = res;
    hideStatus();
    renderOverview(res);
    buildAllPartnersFilters(res.partners);
    buildMyPartnersFilters(res.partners);
    buildTeamFilters(res.team);
    apply();
  });
}

// ── Overview ──────────────────────────────────────────────────────────
function renderOverview(data){
  var s = data.summary;
  var role=(peUser.role||'').toUpperCase();
  var html='<div class="kpi-grid">';
  html+='<div class="kpi-card"><div class="kpi-label">Total Partners</div><div class="kpi-value">'+s.total+'</div></div>';
  html+='<div class="kpi-card"><div class="kpi-label">Active</div><div class="kpi-value green">'+s.active+'</div></div>';
  html+='<div class="kpi-card"><div class="kpi-label">Inactive</div><div class="kpi-value red">'+s.inactive+'</div></div>';
  html+='<div class="kpi-card"><div class="kpi-label">MTD</div><div class="kpi-value">'+fmtINR(s.mtd)+'</div></div>';
  html+='<div class="kpi-card"><div class="kpi-label">LMTD</div><div class="kpi-value">'+fmtINR(s.lmtd)+'</div></div>';
  html+='<div class="kpi-card"><div class="kpi-label">Target</div><div class="kpi-value">'+fmtINR(s.target)+'</div></div>';
  html+='<div class="kpi-card"><div class="kpi-label">Achievement</div><div class="kpi-value '+achColor(s.targetAch)+'">'+s.targetAchFmt+'</div></div>';
  html+='<div class="kpi-card"><div class="kpi-label">MoM Growth</div><div class="kpi-value '+(s.mom>=0?'green':'red')+'">'+s.momFmt+'</div></div>';
  html+='</div>';
  $('overviewContent').innerHTML=html;
}

// ── All Partners ──────────────────────────────────────────────────────
function buildAllPartnersFilters(partners){
  populateSelect('apZone',  uniq(partners.map(function(p){return p.zone;})));
  populateSelect('apState', uniq(partners.map(function(p){return p.state;})));
  populateSelect('apOwner', uniq(partners.map(function(p){return p.oName;})));
}

function apFilter(){
  if(!DASH) return;
  var q=($('apSearch').value||'').toLowerCase();
  var zone=$('apZone').value, state=$('apState').value;
  var status=$('apStatus').value, owner=$('apOwner').value;
  AP_FILTERED=DASH.partners.filter(function(p){
    if(q&&!((p.name+p.gid+p.city+p.oName).toLowerCase().includes(q))) return false;
    if(zone&&p.zone!==zone) return false;
    if(state&&p.state!==state) return false;
    if(status&&!(p.active||'').toLowerCase().includes(status.toLowerCase())) return false;
    if(owner&&p.oName!==owner) return false;
    return true;
  });
  AP_PAGE=1;
  renderAPTable();
}

function apClear(){
  $('apSearch').value='';$('apZone').value='';
  $('apState').value='';$('apStatus').value='';$('apOwner').value='';
  apFilter();
}

function renderAPTable(){
  var total=AP_FILTERED.length;
  var start=(AP_PAGE-1)*PAGE_SIZE, end=Math.min(start+PAGE_SIZE,total);
  var slice=AP_FILTERED.slice(start,end);
  $('apTbody').innerHTML=slice.map(function(p){return partnerRow(p,true);}).join('');
  renderPagination('apPagination',AP_PAGE,Math.ceil(total/PAGE_SIZE),function(pg){
    AP_PAGE=pg;renderAPTable();
  });
}

// ── My Partners ───────────────────────────────────────────────────────
function buildMyPartnersFilters(partners){
  var role=(peUser.role||'').toUpperCase();
  var mine=partners.filter(function(p){
    if(role==='AM') return (p.oName||'').toLowerCase()===(peUser.name||'').toLowerCase()||
                           (p.empId||'').toLowerCase()===(peUser.gid||'').toLowerCase();
    return true;
  });
  MP_FILTERED=mine;
  populateSelect('mpState',uniq(mine.map(function(p){return p.state;})));
  renderMPTable();
}

function mpFilter(){
  if(!DASH) return;
  var q=($('mpSearch').value||'').toLowerCase();
  var state=$('mpState').value, status=$('mpStatus').value;
  var role=(peUser.role||'').toUpperCase();
  var base=DASH.partners.filter(function(p){
    if(role==='AM') return (p.oName||'').toLowerCase()===(peUser.name||'').toLowerCase()||
                           (p.empId||'').toLowerCase()===(peUser.gid||'').toLowerCase();
    return true;
  });
  MP_FILTERED=base.filter(function(p){
    if(q&&!((p.name+p.gid+p.city).toLowerCase().includes(q))) return false;
    if(state&&p.state!==state) return false;
    if(status&&!(p.active||'').toLowerCase().includes(status.toLowerCase())) return false;
    return true;
  });
  MP_PAGE=1;renderMPTable();
}

function mpClear(){$('mpSearch').value='';$('mpState').value='';$('mpStatus').value='';mpFilter();}

function renderMPTable(){
  var total=MP_FILTERED.length;
  var start=(MP_PAGE-1)*PAGE_SIZE, end=Math.min(start+PAGE_SIZE,total);
  var slice=MP_FILTERED.slice(start,end);
  $('mpTbody').innerHTML=slice.map(function(p){return partnerRow(p,false);}).join('');
  renderPagination('mpPagination',MP_PAGE,Math.ceil(total/PAGE_SIZE),function(pg){
    MP_PAGE=pg;renderMPTable();
  });
}

// ── Team Performance ──────────────────────────────────────────────────
function buildTeamFilters(team){
  TP_ALL=team;
  populateSelect('tpZone',  uniq(team.map(function(t){return t.zone;})));
  populateSelect('tpState', uniq(team.map(function(t){return t.state;})));
  tpFilter();
}

function tpFilter(){
  var q=($('tpSearch').value||'').toLowerCase();
  var zone=$('tpZone').value, state=$('tpState').value, role=$('tpRole').value;
  var filtered=TP_ALL.filter(function(t){
    if(q&&!t.name.toLowerCase().includes(q)) return false;
    if(zone&&t.zone!==zone) return false;
    if(state&&t.state!==state) return false;
    if(role&&(t.role||'').toUpperCase()!==role) return false;
    return true;
  });
  renderTeamGrid(filtered);
}

function tpClear(){
  $('tpSearch').value='';$('tpZone').value='';$('tpState').value='';$('tpRole').value='';
  tpFilter();
}

function renderTeamGrid(team){
  if(!team.length){
    $('tpGrid').innerHTML='<div class="empty-state"><div class="es-icon">🔍</div><div class="es-msg">No team members found</div></div>';
    return;
  }
  $('tpGrid').innerHTML=team.map(function(t){
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
  }).join('');
}

// ── Drill: Team member → their partners ───────────────────────────────
function openDrillByOwner(ownerName){
  if(!DASH) return;
  var pts=DASH.partners.filter(function(p){
    return (p.oName||'').toLowerCase()===ownerName.toLowerCase();
  });
  $('drillTitle').textContent=ownerName;
  $('drillMeta').textContent=pts.length+' partner(s)';
  $('drillBody').innerHTML='<div class="table-wrap"><table class="ptable">'+
    '<thead><tr><th>View</th><th>GID</th><th>Partner</th><th>City</th><th>State</th>'+
    '<th>MTD</th><th>LMTD</th><th>Ach%</th><th>Status</th></tr></thead>'+
    '<tbody>'+pts.map(function(p){
      return '<tr>'+
        '<td><button class="btn-view" onclick="openViewModal(\''+esc(p.gid)+'\')">View</button></td>'+
        '<td>'+esc(p.gid)+'</td>'+
        '<td class="name-cell">'+esc(p.name)+'</td>'+
        '<td>'+esc(p.city)+'</td><td>'+esc(p.state)+'</td>'+
        '<td class="val-green">'+fmtINR(p.mtd)+'</td>'+
        '<td>'+fmtINR(p.lmtd)+'</td>'+
        '<td class="'+achColor(p.targetAch)+'">'+p.targetAchFmt+'</td>'+
        '<td>'+(p.active&&p.active.toLowerCase().includes('active')?'<span class="badge-active">Active</span>':'<span class="badge-inactive">Inactive</span>')+'</td>'+
      '</tr>';
    }).join('')+
    '</tbody></table></div>';
  $('drillModal').classList.remove('hidden');
}

function closeDrillModal(){$('drillModal').classList.add('hidden');}

// ── VIEW MODAL ────────────────────────────────────────────────────────
window.openViewModal = function(gid){
  var local = null;
  if(DASH&&DASH.partners){
    local=DASH.partners.find(function(p){return p.gid===gid;})||null;
  }
  if(local){
    buildViewModal(local);
  } else {
    status('Loading partner…','loading');
    callApi('getPartner',{gid:gid,user:peUser},function(err,res){
      hideStatus();
      if(err||!res||!res.success){
        alert('Could not load partner data.');return;
      }
      buildViewModal(res.partner);
    });
  }
};

function buildViewModal(p){
  var months=MONTH_LABELS;
  var vals=p.monthlyData||[];
  var bestMonth=p.bestMonth||Math.max.apply(null,vals.concat([0]));
  var targetAch=p.targetAch||0;
  var achFmt=p.targetAchFmt||(targetAch+'%');
  var achCls=targetAch>=100?'green':targetAch>=50?'amber':'red';

  $('vmName').textContent=p.name||'—';
  $('vmMeta').textContent='GID: '+p.gid+' · '+p.city+', '+p.state+' · '+p.zone+' · AM: '+p.oName;

  $('vmBody').innerHTML=
    // KPI row (4 tiles)
    '<div class="vm-kpi-row">'+
      '<div class="vm-kpi"><div class="vm-kpi-label">Overall Potential</div><div class="vm-kpi-val">'+fmtINR(p.oPot)+'</div></div>'+
      '<div class="vm-kpi"><div class="vm-kpi-label">May Target</div><div class="vm-kpi-val">'+(p.target>0?fmtINR(p.target):'—')+'</div></div>'+
      '<div class="vm-kpi"><div class="vm-kpi-label">MTD (May\'26)</div><div class="vm-kpi-val green">'+fmtINR(p.mtd)+'</div></div>'+
      '<div class="vm-kpi"><div class="vm-kpi-label">Best Month</div><div class="vm-kpi-val">'+fmtINR(bestMonth)+'</div></div>'+
    '</div>'+
    // Highlight box (yellow border)
    '<div class="vm-highlight">'+
      '<div class="vm-hl-item"><div class="vm-hl-label">MAX POTENTIAL</div><div class="vm-hl-val">'+fmtINR(p.maxPot)+'</div></div>'+
      '<div class="vm-hl-item"><div class="vm-hl-label">MAY TARGET</div><div class="vm-hl-val">'+(p.target>0?fmtINR(p.target):'Not set')+'</div></div>'+
      '<div class="vm-hl-item"><div class="vm-hl-label">MTD VS LMTD</div><div class="vm-hl-val">'+fmtINR(p.mtd)+' / '+fmtINR(p.lmtd)+'</div></div>'+
      '<div class="vm-hl-item"><div class="vm-hl-label">TARGET ACHIEVEMENT</div><div class="vm-hl-val '+achCls+'">'+achFmt+'</div></div>'+
    '</div>'+
    // Trend chart
    '<div class="vm-trend-title">14-MONTH TREND</div>'+
    '<div class="vm-chart-wrap"><canvas id="vmCanvas" class="vm-chart-canvas"></canvas></div>';

  $('viewModal').classList.remove('hidden');

  // Render Chart.js line chart
  setTimeout(function(){
    var canvas=$('vmCanvas');
    if(!canvas) return;
    if(vmChart){vmChart.destroy();vmChart=null;}
    var maxV=Math.max.apply(null,vals.concat([1]));
    vmChart=new Chart(canvas,{
      type:'line',
      data:{
        labels:months.slice(0,vals.length),
        datasets:[{
          data:vals,
          borderColor:'#c8102e',
          backgroundColor:'rgba(200,16,46,0.15)',
          fill:true,
          tension:0.4,
          pointBackgroundColor:'#c8102e',
          pointRadius:4,
          pointHoverRadius:6,
          borderWidth:2
        }]
      },
      options:{
        responsive:true,
        plugins:{legend:{display:false},tooltip:{
          callbacks:{label:function(ctx){return fmtINR(ctx.parsed.y);}}
        }},
        scales:{
          x:{grid:{color:'rgba(255,255,255,0.05)'},ticks:{color:'#64748b',font:{size:10}}},
          y:{grid:{color:'rgba(255,255,255,0.05)'},ticks:{color:'#64748b',font:{size:10},
             callback:function(v){return fmtShort(v);}}}
        }
      }
    });
  },50);
}

function closeViewModal(){
  $('viewModal').classList.add('hidden');
  if(vmChart){vmChart.destroy();vmChart=null;}
}

// ── Partner Row HTML ──────────────────────────────────────────────────
function partnerRow(p, showZone){
  var isActive=p.active&&p.active.toLowerCase().includes('active');
  var mom=momPct(p.mtd,p.lmtd);
  var momCls=mom.startsWith('+')?'val-green':mom.startsWith('-')?'val-red':'';
  var mtdCls=p.mtd>p.lmtd?'val-green':p.mtd<p.lmtd?'val-red':'val-amber';

  var row='<tr>'+
    '<td><button class="btn-view" onclick="openViewModal(\''+esc(p.gid)+'\')">View</button></td>'+
    '<td>'+esc(p.gid)+'</td>'+
    '<td class="name-cell">'+esc(p.name)+'</td>'+
    '<td>'+esc(p.city)+'</td>'+
    '<td>'+esc(p.state)+'</td>';
  if(showZone) row+='<td>'+esc(p.zone)+'</td>';
  if(showZone) row+='<td>'+esc(p.oName)+'</td><td>'+esc(p.oRole)+'</td>';
  row+=
    '<td>'+fmtINR(p.maxPot)+'</td>'+
    '<td>'+fmtINR(p.oPot)+'</td>'+
    '<td>'+(p.target>0?fmtINR(p.target):'<span style="color:#64748b">—</span>')+'</td>'+
    '<td class="'+mtdCls+'">'+fmtINR(p.mtd)+'</td>'+
    '<td>'+fmtINR(p.lmtd)+'</td>'+
    '<td class="'+momCls+'">'+mom+'</td>'+
    '<td>'+growthPill(p.growthFmt)+'</td>'+
    '<td class="'+achColor(p.targetAch)+'">'+p.targetAchFmt+'</td>'+
    '<td>'+(isActive?'<span class="badge-active">Active</span>':'<span class="badge-inactive">Inactive</span>')+'</td>'+
    '<td>'+p.calls+'</td>'+
    '<td>'+p.visits+'</td>'+
  '</tr>';
  return row;
}

// ── Pagination ────────────────────────────────────────────────────────
function renderPagination(id,current,total,onPage){
  if(total<=1){$(id).innerHTML='';return;}
  var html='<span class="pg-info">Page '+current+' of '+total+'</span>';
  html+='<button class="pg-btn" '+(current===1?'disabled':'')+' data-pg="'+(current-1)+'">‹</button>';
  var s=Math.max(1,current-2),e=Math.min(total,current+2);
  for(var i=s;i<=e;i++){
    html+='<button class="pg-btn'+(i===current?' active':'')+'" data-pg="'+i+'">'+i+'</button>';
  }
  html+='<button class="pg-btn" '+(current===total?'disabled':'')+' data-pg="'+(current+1)+'">›</button>';
  $(id).innerHTML=html;
  $(id).querySelectorAll('.pg-btn:not([disabled])').forEach(function(btn){
    btn.addEventListener('click',function(){onPage(parseInt(this.dataset.pg));});
  });
}

// ── Select Helpers ────────────────────────────────────────────────────
function populateSelect(id,vals){
  var el=$(id); if(!el) return;
  var first=el.options[0].textContent;
  el.innerHTML='<option value="">'+first+'</option>'+
    vals.filter(Boolean).sort().map(function(v){return '<option>'+esc(v)+'</option>';}).join('');
}
function uniq(arr){
  var seen={},out=[];
  arr.forEach(function(v){var s=String(v||'').trim();if(s&&!seen[s]){seen[s]=true;out.push(s);}});
  return out.sort();
}

// ── CSV Export ────────────────────────────────────────────────────────
window.exportCSV=function(which){
  var list=which==='mine'?MP_FILTERED:AP_FILTERED;
  if(!list||!list.length){alert('Nothing to export.');return;}
  var h=['GID','Name','City','State','Zone','Owner','Role','MaxPot','OverallPot','Target','MTD','LMTD','MoM%','Growth%','Ach%','Status','Calls','Visits'];
  var rows=[h.join(',')];
  list.forEach(function(p){
    rows.push([p.gid,p.name,p.city,p.state,p.zone,p.oName,p.oRole,
               p.maxPot,p.oPot,p.target,p.mtd,p.lmtd,momPct(p.mtd,p.lmtd),
               p.growthFmt,p.targetAchFmt,p.active,p.calls,p.visits]
      .map(function(v){return '"'+String(v||'').replace(/"/g,'""')+'"';}).join(','));
  });
  var blob=new Blob([rows.join('\n')],{type:'text/csv'});
  var url=URL.createObjectURL(blob);
  var a=document.createElement('a');a.href=url;a.download='partners.csv';a.click();
  URL.revokeObjectURL(url);
};

// ── Trigger initial filter ────────────────────────────────────────────
function apply(){apFilter();mpFilter();tpFilter();}

})();
