/* ============================================================
   Partner Engage Portal — master.js v13
   Master dashboard: all zones, Tele-RM, AM grid,
   unconnected list, login activity, partner View modal
   ============================================================ */
(function(){
'use strict';

var API=(typeof API_URL!=='undefined')?API_URL:'';
var DATA=null,USER=null;
var ALL_PARTNERS=[],TELE_PARTNERS=[];
var M_AP_PAGE=1,M_UNCONN_PAGE=1;
var ITEMS=100;

var MONTHS=["Apr'25","May'25","Jun'25","Jul'25","Aug'25","Sep'25",
            "Oct'25","Nov'25","Dec'25","Jan'26","Feb'26","Mar'26","Apr'26"];
var MONTH_KEYS=['apr25','may25','jun25','jul25','aug25','sep25',
               'oct25','nov25','dec25','jan26','feb26','mar26','apr26'];

// ── Helpers ──────────────────────────────────────────────────
function $(id){return document.getElementById(id);}
function safe(v){return(v===null||v===undefined)?'':String(v);}
function fmt(v){
  v=Number(v)||0;
  if(v===0)return'₹0';
  if(Math.abs(v)>=10000000)return'₹'+(v/10000000).toFixed(2)+' Cr';
  if(Math.abs(v)>=100000)return'₹'+(v/100000).toFixed(2)+' L';
  if(Math.abs(v)>=1000)return'₹'+(v/1000).toFixed(1)+' K';
  return'₹'+Math.round(v).toLocaleString('en-IN');
}
function fmtShort(v){
  if(!v||v===0)return'0';
  if(v>=10000000)return(v/10000000).toFixed(1)+'Cr';
  if(v>=100000)return(v/100000).toFixed(1)+'L';
  if(v>=1000)return(v/1000).toFixed(0)+'K';
  return String(Math.round(v));
}
function fmtN(v){return(Number(v)||0).toLocaleString('en-IN');}

function statusPill(a){
  var s=String(a||'').toLowerCase().trim();
  var ok=s==='active'||s==='1'||s==='yes';
  return ok
    ?'<span class="pill pill-active">● Active</span>'
    :'<span class="pill pill-inactive">○ Inactive</span>';
}
function growthPill(g){
  var s=String(g||'').toLowerCase();
  if(s==='growth')return'<span class="pill pill-growth">▲ Growth</span>';
  if(s==='degrowth')return'<span class="pill pill-degrowth">▼ Degrowth</span>';
  var pv=parseFloat(String(g).replace(/%/g,'').trim())||0;
  if(pv>0)return'<span class="pill pill-growth">▲ '+g+'</span>';
  if(pv<0)return'<span class="pill pill-degrowth">▼ '+g+'</span>';
  return'<span class="pill pill-inactive">— Flat</span>';
}

// ── API call via JSONP ────────────────────────────────────────
function callApi(action,params,cb){
  var url=API+'?action='+encodeURIComponent(action);
  if(params)Object.keys(params).forEach(function(k){
    url+='&'+encodeURIComponent(k)+'='+encodeURIComponent(params[k]);
  });
  var cbN='cb_'+Date.now()+'_'+Math.floor(Math.random()*9999);
  window[cbN]=function(d){
    delete window[cbN];
    var s=document.getElementById('jsonp_'+cbN);
    if(s)s.remove();
    cb(null,d);
  };
  url+='&callback='+cbN;
  var s=document.createElement('script');
  s.id='jsonp_'+cbN;s.src=url;
  s.onerror=function(){cb(new Error('Network error'));};
  document.head.appendChild(s);
}

function setLoading(show,msg){
  $('loadingScreen').style.display=show?'flex':'none';
  if(msg)$('loadingMsg').textContent=msg;
}

// ── Summarise a partner list ──────────────────────────────────
function summarizeList(partners){
  var s={total:partners.length,mtd:0,lmtd:0,ftd:0,calls:0,visits:0,
         maxPot:0,oPot:0,target:0,active:0,inactive:0,
         connected:0,notConn:0,growth:0,degrowth:0,mom:0,ach:0};
  partners.forEach(function(p){
    s.mtd    +=p.mtd||0;    s.lmtd   +=p.lmtd||0;
    s.ftd    +=p.ftd||0;    s.calls  +=p.calls||0;
    s.visits +=p.visits||0; s.maxPot +=p.maxPot||0;
    s.oPot   +=p.oPot||0;   s.target +=p.target||0;
    if(String(p.active||'').toLowerCase()==='active')s.active++;else s.inactive++;
    if(p.calls>0||p.visits>0)s.connected++;else s.notConn++;
    if(p.growthClass){
      if(p.growthClass==='growth')s.growth++;
      else if(p.growthClass==='degrowth')s.degrowth++;
    } else {
      var gv=parseFloat(String(p.growth||'').replace(/%/g,'').trim())||0;
      if(gv>0)s.growth++; else if(gv<0)s.degrowth++;
    }
  });
  s.mom=s.lmtd>0?Math.round((s.mtd-s.lmtd)*100/s.lmtd):0;
  s.ach=s.target>0?Math.round(s.mtd*100/s.target):0;
  return s;
}

// ── Boot ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded',function(){
  var saved=localStorage.getItem('pe_user');
  if(!saved){window.location.href='index.html';return;}
  try{USER=JSON.parse(saved);}catch(e){window.location.href='index.html';return;}
  if(!USER||USER.role!=='MASTER'){window.location.href='dashboard.html';return;}

  setLoading(true,'Loading master data…');
  callApi('getMaster',{uid:USER.gid},function(err,res){
    setLoading(false);
    if(err||!res||!res.success){
      alert('Failed to load: '+(res&&res.message||'Unknown error'));
      return;
    }
    DATA=res;
    ALL_PARTNERS =(DATA.main&&DATA.main.partners)||[];
    TELE_PARTNERS=(DATA.tele&&DATA.tele.partners)||[];

    $('appShell').style.display='block';
    $('hdrName').textContent=USER.name||'Master';
    $('btnLogout').addEventListener('click',function(){
      localStorage.removeItem('pe_user');
      window.location.href='index.html';
    });

    setupNav();
    buildOverview();
    populateFilters();
  });
});

// ── Nav ───────────────────────────────────────────────────────
function setupNav(){
  document.querySelectorAll('.nav-tab').forEach(function(btn){
    btn.addEventListener('click',function(){showTab(this.dataset.tab);});
  });
}
function showTab(tab){
  document.querySelectorAll('.nav-tab').forEach(function(b){
    b.classList.toggle('active',b.dataset.tab===tab);
  });
  document.querySelectorAll('.page').forEach(function(p){
    p.classList.toggle('active',p.id==='page-'+tab);
  });
  if(tab==='zones')         renderZones();
  if(tab==='allPartners')   renderAllPartners();
  if(tab==='amPerf')        renderAMPerf();
  if(tab==='teleRM')        renderTeleRM();
  if(tab==='unconnected')   renderUnconnected();
  if(tab==='loginActivity') renderLoginActivity();
}

// ── Donut chart builder ───────────────────────────────────────
function buildDonut(id,values,labels,colors){
  var el=$(id);if(!el)return;
  var total=values.reduce(function(a,b){return a+b;},0)||1;
  var r=50,cx=60,cy=60,sw=16,circ=2*Math.PI*r,offset=circ*0.25,svg='';
  values.forEach(function(v,i){
    var slice=(v/total)*circ;
    svg+='<circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="none" stroke="'+colors[i]+'"'+
         ' stroke-width="'+sw+'" stroke-dasharray="'+slice+' '+(circ-slice)+'"'+
         ' stroke-dashoffset="'+offset+'" stroke-linecap="butt"/>';
    offset-=slice;
  });
  var inner='<svg class="donut-svg" viewBox="0 0 120 120" width="100" height="100">'+
    '<circle cx="60" cy="60" r="50" fill="none" stroke="var(--border)" stroke-width="16"/>'+svg+
    '<text x="60" y="56" text-anchor="middle" fill="var(--text)" font-size="14" font-weight="700"'+
    ' font-family="DM Sans,sans-serif">'+fmtN(values[0])+'</text>'+
    '<text x="60" y="70" text-anchor="middle" fill="var(--text2)" font-size="9"'+
    ' font-family="DM Sans,sans-serif">'+labels[0]+'</text></svg>';
  var legend='<div class="donut-legend">'+values.map(function(v,i){
    var p=total>0?Math.round(v*100/total):0;
    return'<div class="donut-legend-item">'+
      '<div class="donut-legend-label">'+
        '<div class="donut-legend-dot" style="background:'+colors[i]+'"></div>'+
        '<span>'+labels[i]+'</span>'+
      '</div>'+
      '<div><span class="donut-legend-val" style="color:'+colors[i]+'">'+fmtN(v)+'</span>'+
      ' <span style="color:var(--text3);font-size:11px;">('+p+'%)</span></div>'+
      '</div>';
  }).join('')+'</div>';
  el.innerHTML=inner+legend;
}

// ── Overview ──────────────────────────────────────────────────
function buildOverview(){
  var s=(DATA.main&&DATA.main.summary)||{};
  $('m_total').textContent   =fmtN(s.total||0);
  $('m_active').textContent  ='Active: '+fmtN(s.active||0);
  $('m_inactive').textContent='Inactive: '+fmtN(s.inactive||0);
  $('m_mtd').textContent     =fmt(s.mtd||0).replace('₹','');
  $('m_mom').textContent     ='MoM: '+(s.mom>=0?'+':'')+fmtN(s.mom||0)+'%';
  $('m_ach').textContent     ='Ach: '+fmtN(s.ach||0)+'%';
  $('m_eng').textContent     =fmtN(s.connected||0)+'/'+fmtN(s.total||0);
  $('m_conn').textContent    ='Connected: '+fmtN(s.connected||0);
  $('m_notconn').textContent ='Not: '+fmtN(s.notConn||0);
  $('m_maxpot').textContent  =fmt(s.maxPot||0).replace('₹','');
  $('m_opot').textContent    =fmt(s.oPot||0).replace('₹','');
  $('m_target').textContent  =fmt(s.target||0).replace('₹','');
  $('m_calls').textContent   =fmtN(s.calls||0);
  $('m_visits').textContent  =fmtN(s.visits||0);
  $('m_gd').textContent      =fmtN(s.growth||0)+' / '+fmtN(s.degrowth||0);

  buildDonut('m_chartActive', [s.active||0,  s.inactive||0], ['Active','Inactive'],          ['var(--green)','var(--text3)']);
  buildDonut('m_chartConn',   [s.connected||0,s.notConn||0], ['Connected','Not Connected'],   ['var(--blue)', 'var(--amber)']);
  buildDonut('m_chartGrowth', [s.growth||0,  s.degrowth||0], ['Growth','Degrowth'],           ['var(--green)','var(--red)']);
}

// ── Populate filter dropdowns ─────────────────────────────────
function populateFilters(){
  var zones={},states={},owners={};
  ALL_PARTNERS.forEach(function(p){
    if(p.zone)  zones[p.zone]=1;
    if(p.state) states[p.state]=1;
    if(p.oName) owners[p.oName]=p.oRole||'';
  });

  ['m_apZone','m_amZone'].forEach(function(id){
    var el=$(id);if(!el)return;
    Object.keys(zones).sort().forEach(function(z){
      var o=document.createElement('option');o.value=z;o.textContent=z;el.appendChild(o);
    });
  });

  var stEl=$('m_apState');
  if(stEl) Object.keys(states).sort().forEach(function(s){
    var o=document.createElement('option');o.value=s;o.textContent=s;stEl.appendChild(o);
  });

  var owEl=$('m_apOwner');
  if(owEl) Object.keys(owners).sort().forEach(function(n){
    var o=document.createElement('option');o.value=n;o.textContent=n+' ('+owners[n]+')';owEl.appendChild(o);
  });

  // Filter listeners — All Partners
  ['m_apSearch','m_apZone','m_apState','m_apOwner','m_apStatus','m_apTrend'].forEach(function(id){
    var el=$(id);if(el)el.addEventListener('input',function(){M_AP_PAGE=1;renderAllPartners();});
  });
  $('m_apClear')&&$('m_apClear').addEventListener('click',function(){
    ['m_apSearch','m_apZone','m_apState','m_apOwner','m_apStatus','m_apTrend']
      .forEach(function(id){var el=$(id);if(el)el.value='';});
    M_AP_PAGE=1;renderAllPartners();
  });
  $('m_apExport')&&$('m_apExport').addEventListener('click',exportCSV);

  // AM perf listeners
  ['m_amSearch','m_amZone','m_amSort'].forEach(function(id){
    var el=$(id);if(el)el.addEventListener('input',renderAMPerf);
  });

  // Modal close
  $('modalClose')&&$('modalClose').addEventListener('click',function(){
    $('partnerModal').classList.remove('open');
  });
  $('partnerModal')&&$('partnerModal').addEventListener('click',function(e){
    if(e.target===$('partnerModal'))$('partnerModal').classList.remove('open');
  });
  $('tmModalClose')&&$('tmModalClose').addEventListener('click',function(){
    $('teamModal').classList.remove('open');
  });
  $('teamModal')&&$('teamModal').addEventListener('click',function(e){
    if(e.target===$('teamModal'))$('teamModal').classList.remove('open');
  });
}

// ── Zone Summary ──────────────────────────────────────────────
function renderZones(){
  var zones=DATA.zones||[];
  var COLS=['#e53935','#00c853','#448aff','#ff9800','#9c27b0'];
  $('m_zoneGrid').innerHTML=zones.map(function(z,i){
    var s=z.summary||{};
    var ach=s.target>0?Math.round(s.mtd*100/s.target):0;
    var col=COLS[i%COLS.length];
    return'<div class="team-card" data-zone="'+safe(z.zone)+'">'+
      '<div class="tc-header">'+
        '<div>'+
          '<div class="tc-name">'+safe(z.zone)+' Zone</div>'+
          '<div style="font-size:11px;color:var(--text2);margin-top:3px;">'+fmtN(z.count)+' partners</div>'+
        '</div>'+
        '<div class="tc-role" style="background:'+col+'22;color:'+col+'">ZH</div>'+
      '</div>'+
      '<div class="tc-metrics">'+
        '<div><div class="tc-m-label">MTD</div><div class="tc-m-value amber">'+fmt(s.mtd||0)+'</div></div>'+
        '<div><div class="tc-m-label">LMTD</div><div class="tc-m-value dim">'+fmt(s.lmtd||0)+'</div></div>'+
        '<div><div class="tc-m-label">Target</div><div class="tc-m-value dim">'+fmt(s.target||0)+'</div></div>'+
        '<div><div class="tc-m-label">Calls</div><div class="tc-m-value green">'+fmtN(s.calls||0)+'</div></div>'+
        '<div><div class="tc-m-label">Visits</div><div class="tc-m-value red">'+fmtN(s.visits||0)+'</div></div>'+
        '<div><div class="tc-m-label">Ach%</div><div class="tc-m-value '+(ach>=80?'green':ach>=50?'amber':'red')+'">'+ach+'%</div></div>'+
      '</div>'+
      '<div class="tc-bar"><div class="tc-bar-fill" style="width:'+Math.min(ach,100)+'%;background:'+col+'"></div></div>'+
      '<div class="tc-footer">'+
        '<span>Active: <strong class="up">'+fmtN(s.active||0)+'</strong></span>'+
        '<span>Connected: '+fmtN(s.connected||0)+'/'+fmtN(z.count)+'</span>'+
      '</div>'+
    '</div>';
  }).join('');

  $('m_zoneGrid').querySelectorAll('.team-card').forEach(function(card){
    card.addEventListener('click',function(){
      var zn=this.dataset.zone;
      var zp=ALL_PARTNERS.filter(function(p){return p.zone===zn;});
      openTeamModal({name:zn+' Zone',role:'Zone',count:zp.length,summary:summarizeList(zp),partners:zp});
    });
  });
}

// ── All Partners ──────────────────────────────────────────────
function applyAPFilters(list){
  var search=($('m_apSearch')&&$('m_apSearch').value||'').toLowerCase().trim();
  var zone  =($('m_apZone')  &&$('m_apZone').value  ||'');
  var state =($('m_apState') &&$('m_apState').value ||'');
  var owner =($('m_apOwner') &&$('m_apOwner').value ||'');
  var status=($('m_apStatus')&&$('m_apStatus').value||'');
  var trend =($('m_apTrend') &&$('m_apTrend').value ||'');

  return list.filter(function(p){
    if(search&&!(p.name||'').toLowerCase().includes(search)
             &&!(p.gid||'').toLowerCase().includes(search)
             &&!(p.city||'').toLowerCase().includes(search)) return false;
    if(zone  &&p.zone!==zone)   return false;
    if(state &&p.state!==state) return false;
    if(owner &&p.oName!==owner) return false;
    if(status){
      var a=String(p.active||'').toLowerCase();
      var ok=a==='active'||a==='1'||a==='yes'||Number(p.active)>0;
      if(status==='active'&&!ok)  return false;
      if(status==='inactive'&&ok) return false;
    }
    if(trend){
      var g=String(p.growth||'').toLowerCase();
      if(trend==='growth'  &&g.indexOf('degrowth')>=0) return false;
      if(trend==='degrowth'&&g.indexOf('degrowth')<0)  return false;
    }
    return true;
  });
}

function renderAllPartners(){
  var filtered=applyAPFilters(ALL_PARTNERS);
  $('m_apCount').textContent=fmtN(filtered.length)+' of '+fmtN(ALL_PARTNERS.length)+' partners';

  var totalPages=Math.max(1,Math.ceil(filtered.length/ITEMS));
  if(M_AP_PAGE>totalPages)M_AP_PAGE=1;
  var page=filtered.slice((M_AP_PAGE-1)*ITEMS,M_AP_PAGE*ITEMS);

  var body=$('m_apBody');
  body.innerHTML=page.map(function(p){
    var mom=p.lmtd>0?Math.round((p.mtd-p.lmtd)*100/p.lmtd):(p.mtd>0?100:0);
    return'<tr>'+
      '<td class="name-cell"><div class="p-name">'+safe(p.name)+'</div><div class="p-gid">'+safe(p.gid)+'</div></td>'+
      '<td style="color:var(--text2)">'+safe(p.city)+'<br><span style="font-size:11px;color:var(--text3)">'+safe(p.state)+'</span></td>'+
      '<td><span class="badge badge-grey">'+safe(p.zone)+'</span></td>'+
      '<td style="color:var(--text2)">'+safe(p.oName)+'<br><span style="font-size:11px;color:var(--text3)">'+safe(p.oRole)+'</span></td>'+
      '<td class="val-dim">'+fmt(p.maxPot)+'</td>'+
      '<td class="val-amber">'+fmt(p.oPot)+'</td>'+
      '<td class="val-dim">'+fmt(p.target)+'</td>'+
      '<td class="'+(p.mtd>p.lmtd?'val-green':p.mtd<p.lmtd?'val-red':'val-amber')+'">'+fmt(p.mtd)+'</td>'+
      '<td class="val-dim">'+fmt(p.lmtd)+'</td>'+
      '<td class="'+(mom>=0?'val-green':'val-red')+'">'+(mom>=0?'+':'')+mom+'%</td>'+
      '<td>'+growthPill(p.growth)+'</td>'+
      '<td>'+statusPill(p.active)+'</td>'+
      '<td class="val-green">'+fmtN(p.calls)+'</td>'+
      '<td class="val-dim">'+fmtN(p.visits)+'</td>'+
      '<td><button class="btn-view" data-gid="'+safe(p.gid)+'" data-name="'+safe(p.name)+'">View</button></td>'+
      '</tr>';
  }).join('');

  renderPagination('m_apPagination',M_AP_PAGE,totalPages,function(pg){M_AP_PAGE=pg;renderAllPartners();});
  attachViewButtons(body);
}

// ── AM Performance ────────────────────────────────────────────
function renderAMPerf(){
  var search=($('m_amSearch')&&$('m_amSearch').value||'').toLowerCase();
  var zone  =($('m_amZone')  &&$('m_amZone').value  ||'');
  var sort  =($('m_amSort')  &&$('m_amSort').value  ||'mtd_desc');

  var owners={};
  ALL_PARTNERS.forEach(function(p){
    var role=(p.oRole||'').toUpperCase().replace(':','').trim();
    if(role!=='AM'&&role!=='RM') return;
    if(zone&&p.zone!==zone)      return;
    if(!owners[p.oName]) owners[p.oName]={name:p.oName,role:p.oRole,zone:p.zone,partners:[]};
    owners[p.oName].partners.push(p);
  });

  var list=Object.values(owners).map(function(o){
    return{name:o.name,role:o.role,zone:o.zone,count:o.partners.length,
           summary:summarizeList(o.partners),partners:o.partners};
  });

  if(search) list=list.filter(function(o){return o.name.toLowerCase().indexOf(search)>=0;});

  list.sort(function(a,b){
    if(sort==='name_asc')   return a.name.localeCompare(b.name);
    if(sort==='count_desc') return b.count-a.count;
    return b.summary.mtd-a.summary.mtd;
  });

  var grid=$('m_amGrid');
  if(list.length===0){
    grid.innerHTML='<div class="empty-state"><div class="es-icon">👥</div><p>No AMs match.</p></div>';
    return;
  }

  grid.innerHTML=list.map(function(o){
    var s=o.summary;
    var ach=s.target>0?Math.round(s.mtd*100/s.target):0;
    return'<div class="team-card">'+
      '<div class="tc-header">'+
        '<div>'+
          '<div class="tc-name">'+safe(o.name)+'</div>'+
          '<div style="font-size:11px;color:var(--text2);margin-top:3px;">'+safe(o.zone)+' · '+fmtN(o.count)+' partners</div>'+
        '</div>'+
        '<div class="tc-role">'+safe(o.role)+'</div>'+
      '</div>'+
      '<div class="tc-metrics">'+
        '<div><div class="tc-m-label">MTD</div><div class="tc-m-value amber">'+fmt(s.mtd)+'</div></div>'+
        '<div><div class="tc-m-label">LMTD</div><div class="tc-m-value dim">'+fmt(s.lmtd)+'</div></div>'+
        '<div><div class="tc-m-label">Calls</div><div class="tc-m-value green">'+fmtN(s.calls)+'</div></div>'+
        '<div><div class="tc-m-label">Visits</div><div class="tc-m-value red">'+fmtN(s.visits)+'</div></div>'+
        '<div><div class="tc-m-label">Connected</div><div class="tc-m-value">'+fmtN(s.connected)+'/'+fmtN(o.count)+'</div></div>'+
        '<div><div class="tc-m-label">Ach%</div><div class="tc-m-value '+(ach>=80?'green':ach>=50?'amber':'red')+'">'+ach+'%</div></div>'+
      '</div>'+
      '<div class="tc-bar"><div class="tc-bar-fill" style="width:'+Math.min(ach,100)+'%"></div></div>'+
      '<div class="tc-footer">'+
        '<span>MoM: <strong class="'+(s.mom>=0?'up':'down')+'">'+(s.mom>=0?'+':'')+s.mom+'%</strong></span>'+
        '<span>Partners: '+fmtN(o.count)+'</span>'+
      '</div>'+
    '</div>';
  }).join('');

  grid.querySelectorAll('.team-card').forEach(function(card,i){
    card.addEventListener('click',function(){openTeamModal(list[i]);});
  });
}

// ── Tele-RM ───────────────────────────────────────────────────
function renderTeleRM(){
  var ts=(DATA.tele&&DATA.tele.summary)||{};
  var team=(DATA.tele&&DATA.tele.team)||[];

  $('m_teleMetrics').innerHTML=
    '<div class="metric-card" style="border-left:3px solid var(--id-red);">'+
      '<div class="mc-label">Tele-RM Partners</div>'+
      '<div class="mc-value">'+fmtN(ts.total||0)+'</div>'+
      '<div class="mc-sub">'+
        '<span class="badge badge-green">Active: '+fmtN(ts.active||0)+'</span> '+
        '<span class="badge badge-red">Inactive: '+fmtN(ts.inactive||0)+'</span>'+
      '</div>'+
    '</div>'+
    '<div class="metric-card">'+
      '<div class="mc-label">MTD Business</div>'+
      '<div class="mc-value rupee">'+fmt(ts.mtd||0).replace('₹','')+'</div>'+
    '</div>'+
    '<div class="metric-card">'+
      '<div class="mc-label">Calls / Visits</div>'+
      '<div class="mc-value" style="color:var(--green)">'+fmtN(ts.calls||0)+' / '+fmtN(ts.visits||0)+'</div>'+
    '</div>';

  $('m_teleTeam').innerHTML=team.length===0
    ?'<div class="empty-state"><div class="es-icon">📞</div><p>No Tele-RM team data.</p></div>'
    :team.map(function(o){
      var s=o.summary||{};
      return'<div class="team-card">'+
        '<div class="tc-header">'+
          '<div>'+
            '<div class="tc-name">'+safe(o.name)+'</div>'+
            '<div style="font-size:11px;color:var(--text2);margin-top:3px;">Tele-RM · '+fmtN(o.count)+' partners</div>'+
          '</div>'+
          '<div class="tc-role" style="background:rgba(68,138,255,.15);color:var(--blue)">'+safe(o.role)+'</div>'+
        '</div>'+
        '<div class="tc-metrics">'+
          '<div><div class="tc-m-label">MTD</div><div class="tc-m-value amber">'+fmt(s.mtd||0)+'</div></div>'+
          '<div><div class="tc-m-label">Calls</div><div class="tc-m-value green">'+fmtN(s.calls||0)+'</div></div>'+
          '<div><div class="tc-m-label">Partners</div><div class="tc-m-value dim">'+fmtN(o.count)+'</div></div>'+
        '</div>'+
      '</div>';
    }).join('');

  team.forEach(function(o,i){
    $('m_teleTeam').querySelectorAll('.team-card')[i]&&
    $('m_teleTeam').querySelectorAll('.team-card')[i].addEventListener('click',function(){
      openTeamModal(team[i]);
    });
  });

  // Tele-RM partner table (first 200)
  var rows=TELE_PARTNERS.slice(0,200).map(function(p){
    return'<tr>'+
      '<td class="name-cell"><div class="p-name">'+safe(p.name)+'</div><div class="p-gid">'+safe(p.gid)+'</div></td>'+
      '<td>'+safe(p.city)+'<br><span style="font-size:11px;color:var(--text3)">'+safe(p.state)+'</span></td>'+
      '<td style="color:var(--text2)">'+safe(p.oName)+'<br><span style="font-size:11px;color:var(--text3)">'+safe(p.oRole)+'</span></td>'+
      '<td class="val-amber">'+fmt(p.mtd)+'</td>'+
      '<td>'+statusPill(p.active)+'</td>'+
      '<td class="val-green">'+fmtN(p.calls)+'</td>'+
      '<td class="val-dim">'+fmtN(p.visits)+'</td>'+
      '<td><button class="btn-view" data-gid="'+safe(p.gid)+'" data-name="'+safe(p.name)+'">View</button></td>'+
      '</tr>';
  }).join('');

  $('m_teleTableWrap').innerHTML=rows
    ?'<div style="font-size:12px;font-weight:600;color:var(--text2);letter-spacing:.06em;text-transform:uppercase;margin:16px 0 8px;">Partner List</div>'+
      '<div class="table-wrap"><table class="tbl"><thead><tr>'+
      '<th>Partner</th><th>City/State</th><th>Owner</th><th>MTD</th><th>Status</th><th>Calls</th><th>Visits</th><th>Action</th>'+
      '</tr></thead><tbody>'+rows+'</tbody></table></div>'
    :'';
  if($('m_teleTableWrap').innerHTML) attachViewButtons($('m_teleTableWrap'));
}

// ── Unconnected ───────────────────────────────────────────────
function renderUnconnected(){
  var unconn=ALL_PARTNERS
    .filter(function(p){return p.calls===0&&p.visits===0;})
    .sort(function(a,b){return(b.oPot||0)-(a.oPot||0);});

  var totalPages=Math.max(1,Math.ceil(unconn.length/ITEMS));
  if(M_UNCONN_PAGE>totalPages)M_UNCONN_PAGE=1;
  var page=unconn.slice((M_UNCONN_PAGE-1)*ITEMS,M_UNCONN_PAGE*ITEMS);

  $('m_unconnBody').innerHTML=page.map(function(p){
    return'<tr>'+
      '<td class="name-cell"><div class="p-name">'+safe(p.name)+'</div><div class="p-gid">'+safe(p.gid)+'</div></td>'+
      '<td>'+safe(p.city)+'<br><span style="font-size:11px;color:var(--text3)">'+safe(p.state)+'</span></td>'+
      '<td><span class="badge badge-grey">'+safe(p.zone)+'</span></td>'+
      '<td style="color:var(--text2)">'+safe(p.oName)+'</td>'+
      '<td class="val-amber">'+fmt(p.oPot)+'</td>'+
      '<td class="val-dim">'+fmt(p.maxPot)+'</td>'+
      '<td class="val-amber">'+fmt(p.mtd)+'</td>'+
      '<td>'+statusPill(p.active)+'</td>'+
      '</tr>';
  }).join('');

  renderPagination('m_unconnPagination',M_UNCONN_PAGE,totalPages,
    function(pg){M_UNCONN_PAGE=pg;renderUnconnected();});
}

// ── Login Activity ────────────────────────────────────────────
function renderLoginActivity(){
  $('m_loginUsers').innerHTML ='<tr><td colspan="4" style="color:var(--text3);text-align:center;padding:20px;">Loading…</td></tr>';
  $('m_loginRecent').innerHTML='<tr><td colspan="4" style="color:var(--text3);text-align:center;padding:20px;">Loading…</td></tr>';

  callApi('getLoginStats',{},function(err,res){
    if(err||!res||!res.success){
      $('m_loginUsers').innerHTML='<tr><td colspan="4" style="color:var(--text3);text-align:center;">No login data available.</td></tr>';
      return;
    }
    $('m_loginUsers').innerHTML=(res.users||[]).slice(0,30).map(function(u){
      return'<tr>'+
        '<td class="fw600">'+safe(u.name)+'</td>'+
        '<td><span class="badge badge-grey">'+safe(u.role)+'</span></td>'+
        '<td class="val-green fw600">'+fmtN(u.count)+'</td>'+
        '<td class="text-dim">'+safe(u.last)+'</td>'+
        '</tr>';
    }).join('')||'<tr><td colspan="4" style="color:var(--text3);text-align:center;">No logins recorded yet.</td></tr>';

    $('m_loginRecent').innerHTML=(res.logins||[]).slice(0,50).map(function(l){
      return'<tr>'+
        '<td class="text-dim fs12">'+safe(l.date)+'</td>'+
        '<td class="fw600">'+safe(l.name)+'</td>'+
        '<td class="mono" style="font-size:11px;color:var(--text3)">'+safe(l.gid)+'</td>'+
        '<td><span class="badge badge-grey">'+safe(l.role)+'</span></td>'+
        '</tr>';
    }).join('')||'<tr><td colspan="4" style="color:var(--text3);text-align:center;">No recent activity.</td></tr>';
  });
}

// ── View Buttons ──────────────────────────────────────────────
function attachViewButtons(container){
  container.querySelectorAll('.btn-view').forEach(function(btn){
    btn.addEventListener('click',function(e){
      e.stopPropagation();
      openPartnerModal(this.dataset.gid,this.dataset.name);
    });
  });
}

function openPartnerModal(gid,name){
  $('modalName').textContent=name||gid;
  $('modalGID').textContent=gid;
  $('modalBody').innerHTML='<div class="spinner" style="margin:40px auto;width:36px;height:36px;"></div>';
  $('partnerModal').classList.add('open');

  var local=null;
  ALL_PARTNERS.concat(TELE_PARTNERS).forEach(function(p){if(p.gid===gid)local=p;});

  if(local){buildPartnerModal(local);}
  else{
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
  var mom=p.lmtd>0?Math.round((p.mtd-p.lmtd)*100/p.lmtd):(p.mtd>0?100:0);
  var months=p.months||{};
  var vals=MONTH_KEYS.map(function(k){return months[k]||0;});
  var maxV=Math.max.apply(null,vals)||1;

  // KPI Row
  var kpis='<div class="modal-kpi-row">'+
    '<div class="modal-kpi"><div class="mk-label">MTD (May\'26)</div><div class="mk-value '+(p.mtd>0?'green':'')+'">'+fmt(p.mtd)+'</div></div>'+
    '<div class="modal-kpi"><div class="mk-label">LMTD (Apr\'26)</div><div class="mk-value">'+fmt(p.lmtd)+'</div></div>'+
    '<div class="modal-kpi"><div class="mk-label">MoM</div><div class="mk-value '+(mom>=0?'green':'red')+'">'+(mom>=0?'+':'')+mom+'%</div></div>'+
    '<div class="modal-kpi"><div class="mk-label">Target</div><div class="mk-value">'+fmt(p.target)+'</div></div>'+
    '<div class="modal-kpi"><div class="mk-label">Max Potential</div><div class="mk-value amber">'+fmt(p.maxPot)+'</div></div>'+
    '<div class="modal-kpi"><div class="mk-label">Overall Pot.</div><div class="mk-value amber">'+fmt(p.oPot)+'</div></div>'+
    '<div class="modal-kpi"><div class="mk-label">Net Combined</div><div class="mk-value">'+fmt(p.net)+'</div></div>'+
    '<div class="modal-kpi"><div class="mk-label">Avg Monthly</div><div class="mk-value">'+fmt(p.avg)+'</div></div>'+
    '</div>';

  // 14-month bar chart
  var bars='<div class="modal-chart-wrap">'+
    '<div class="modal-chart-title">14-Month Business Trend (Apr\'25 → Apr\'26)</div>'+
    '<div class="bar-chart">';
  vals.forEach(function(v,i){
    var h=Math.max(2,Math.round((v/maxV)*110));
    bars+='<div class="bar-col">'+
      '<div class="b-val">'+fmtShort(v)+'</div>'+
      '<div class="b-bar" style="height:'+h+'px"></div>'+
      '<div class="b-label">'+MONTHS[i]+'</div>'+
      '</div>';
  });
  bars+='</div></div>';

  // Info grid
  var info='<div class="modal-info-grid">'+
    '<div class="modal-info-item"><div class="mi-label">Owner</div><div class="mi-value">'+safe(p.oName)+' ('+safe(p.oRole)+')</div></div>'+
    '<div class="modal-info-item"><div class="mi-label">Zone</div><div class="mi-value">'+safe(p.zone)+'</div></div>'+
    '<div class="modal-info-item"><div class="mi-label">State / City</div><div class="mi-value">'+safe(p.state)+' · '+safe(p.city)+'</div></div>'+
    '<div class="modal-info-item"><div class="mi-label">Months Active</div><div class="mi-value">'+fmtN(p.mAct)+' months</div></div>'+
    '<div class="modal-info-item"><div class="mi-label">Calls / Visits</div><div class="mi-value">'+fmtN(p.calls)+' / '+fmtN(p.visits)+'</div></div>'+
    '<div class="modal-info-item"><div class="mi-label">Status</div><div class="mi-value">'+statusPill(p.active)+'</div></div>'+
    '<div class="modal-info-item"><div class="mi-label">Growth Trend</div><div class="mi-value">'+growthPill(p.growth)+'</div></div>'+
    '<div class="modal-info-item"><div class="mi-label">FTD</div><div class="mi-value">'+fmt(p.ftd)+'</div></div>'+
    '</div>';

  var rmk='';
  if(p.rmkS||p.rmkP){
    rmk='<div class="modal-remark">'+
      '<div class="mr-title">📝 Remarks</div>'+
      (p.rmkS?'<div class="mr-text"><strong>Sheet:</strong> '+safe(p.rmkS)+'</div>':'')+
      (p.rmkP?'<div class="mr-text" style="margin-top:4px;"><strong>Partner:</strong> '+safe(p.rmkP)+'</div>':'')+
      '</div>';
  }

  $('modalBody').innerHTML=kpis+bars+info+rmk;
}

// ── Team / Zone Drill Modal ───────────────────────────────────
function openTeamModal(o){
  $('tmModalName').textContent=o.name||'—';
  $('tmModalSub').textContent=(o.role||'')+(o.count?' · '+fmtN(o.count)+' partners':'');

  var s=o.summary||{};
  var kpis='<div class="modal-kpi-row">'+
    '<div class="modal-kpi"><div class="mk-label">MTD</div><div class="mk-value amber">'+fmt(s.mtd||0)+'</div></div>'+
    '<div class="modal-kpi"><div class="mk-label">LMTD</div><div class="mk-value">'+fmt(s.lmtd||0)+'</div></div>'+
    '<div class="modal-kpi"><div class="mk-label">Target</div><div class="mk-value">'+fmt(s.target||0)+'</div></div>'+
    '<div class="modal-kpi"><div class="mk-label">Ach%</div><div class="mk-value '+(s.ach>=80?'green':s.ach>=50?'amber':'red')+'">'+fmtN(s.ach||0)+'%</div></div>'+
    '<div class="modal-kpi"><div class="mk-label">Calls/Visits</div><div class="mk-value green">'+fmtN(s.calls||0)+'/'+fmtN(s.visits||0)+'</div></div>'+
    '<div class="modal-kpi"><div class="mk-label">Connected</div><div class="mk-value">'+fmtN(s.connected||0)+'/'+fmtN(o.count||0)+'</div></div>'+
    '</div>';

  var rows=(o.partners||[]).slice(0,300).map(function(p){
    return'<tr>'+
      '<td class="name-cell"><div class="p-name">'+safe(p.name)+'</div><div class="p-gid">'+safe(p.gid)+'</div></td>'+
      '<td>'+safe(p.city)+'<br><span style="font-size:11px;color:var(--text3)">'+safe(p.state)+'</span></td>'+
      '<td class="val-amber">'+fmt(p.mtd)+'</td>'+
      '<td class="val-dim">'+fmt(p.lmtd)+'</td>'+
      '<td class="val-dim">'+fmt(p.target)+'</td>'+
      '<td>'+growthPill(p.growth)+'</td>'+
      '<td>'+statusPill(p.active)+'</td>'+
      '<td class="val-green">'+fmtN(p.calls)+'</td>'+
      '<td class="val-dim">'+fmtN(p.visits)+'</td>'+
      '<td><button class="btn-view" data-gid="'+safe(p.gid)+'" data-name="'+safe(p.name)+'">View</button></td>'+
      '</tr>';
  }).join('');

  $('tmModalBody').innerHTML=kpis+
    '<div class="table-wrap" style="max-height:420px;overflow-y:auto;">'+
    '<table class="tbl"><thead><tr>'+
    '<th>Partner</th><th>City/State</th><th>MTD</th><th>LMTD</th><th>Target</th>'+
    '<th>Growth</th><th>Status</th><th>Calls</th><th>Visits</th><th>Action</th>'+
    '</tr></thead><tbody>'+rows+'</tbody></table></div>';

  attachViewButtons($('tmModalBody'));
  $('teamModal').classList.add('open');
}

// ── Pagination ────────────────────────────────────────────────
function renderPagination(containerId,current,total,onPage){
  var el=$(containerId);
  if(!el||total<=1){if(el)el.innerHTML='';return;}
  var html='<div style="color:var(--text2)">Page '+current+' of '+total+'</div><div class="pg-btns">';
  html+='<button class="pg-btn" '+(current===1?'disabled':'')+' data-pg="'+(current-1)+'">‹ Prev</button>';
  var start=Math.max(1,current-2),end=Math.min(total,current+2);
  for(var i=start;i<=end;i++){
    html+='<button class="pg-btn'+(i===current?' active':'')+'" data-pg="'+i+'">'+i+'</button>';
  }
  html+='<button class="pg-btn" '+(current===total?'disabled':'')+' data-pg="'+(current+1)+'">Next ›</button>';
  html+='</div>';
  el.innerHTML=html;
  el.querySelectorAll('.pg-btn:not([disabled])').forEach(function(btn){
    btn.addEventListener('click',function(){onPage(parseInt(this.dataset.pg));});
  });
}

// ── CSV Export ────────────────────────────────────────────────
function exportCSV(){
  var filtered=applyAPFilters(ALL_PARTNERS);
  var headers=['GID','Name','City','State','Zone','Owner','Role',
               'Max Pot','Overall Pot','Target','MTD','LMTD','MoM%',
               'Growth','Status','Calls','Visits'];
  var rows=[headers.join(',')];
  filtered.forEach(function(p){
    var mom=p.lmtd>0?Math.round((p.mtd-p.lmtd)*100/p.lmtd):(p.mtd>0?100:0);
    rows.push([p.gid,p.name,p.city,p.state,p.zone,p.oName,p.oRole,
               p.maxPot,p.oPot,p.target,p.mtd,p.lmtd,mom+'%',
               p.growth,p.active,p.calls,p.visits]
      .map(function(v){return'"'+String(v||'').replace(/"/g,'""')+'"';}).join(','));
  });
  var blob=new Blob([rows.join('\n')],{type:'text/csv'});
  var url=URL.createObjectURL(blob);
  var a=document.createElement('a');
  a.href=url;a.download='master_export.csv';a.click();
  URL.revokeObjectURL(url);
}

})();
