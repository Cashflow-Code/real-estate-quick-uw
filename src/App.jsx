import { useState, useEffect, useRef, useMemo } from "react";

// ─── Theme ────────────────────────────────────────────────────────────────────
const G="#18c97a", Y="#e9a030", R="#e05555", DIM="#3a6080";

// ─── Market data ──────────────────────────────────────────────────────────────
const MARKET_GROUPS=[
  {region:"Dominican Republic",markets:[
    {name:"Jarabacoa",   icon:"🏔",adr:193,occ:35,pm:22,rent:900, build:825,land:42, horiz:30,note:"Mountain eco-tourism · 683 active listings"},
    {name:"Punta Cana",  icon:"🏖",adr:118,occ:49,pm:25,rent:1800,build:850,land:80, horiz:25,note:"High-volume beach · Cap Cana / Bávaro"},
    {name:"Las Terrenas",icon:"🌴",adr:110,occ:52,pm:25,rent:1500,build:875,land:68, horiz:28,note:"Best occupancy in DR · strong EU demand"},
    {name:"Santo Domingo",icon:"🏙",adr:85,occ:45,pm:20,rent:1400,build:900,land:120,horiz:20,note:"Business/urban · Piantini · Naco"},
    {name:"Santiago",    icon:"🏛",adr:75, occ:40,pm:18,rent:1100,build:855,land:90, horiz:20,note:"DR 2nd city · business + local residential"},
    {name:"Puerto Plata",icon:"⚓",adr:95, occ:44,pm:22,rent:1100,build:800,land:50, horiz:25,note:"North coast · cruise + resort demand"},
    {name:"Juan Dolio",  icon:"🌊",adr:92, occ:42,pm:22,rent:1100,build:790,land:55, horiz:28,note:"Weekend beach · emerging · east of SD"},
    {name:"Boca Chica",  icon:"🏝",adr:74, occ:31,pm:20,rent:800, build:775,land:80, horiz:20,note:"Beach suburb · 12 min from SDQ airport"},
  ]},
  {region:"US – Sunbelt",markets:[
    {name:"Nashville, TN",  icon:"🎸",adr:195,occ:58,pm:25,rent:1800,build:1200,land:180,horiz:0,note:"Music City · strong events demand · avg 213 nights/yr"},
    {name:"Scottsdale, AZ", icon:"🌵",adr:245,occ:54,pm:28,rent:2200,build:1100,land:220,horiz:0,note:"Luxury desert resort market · golf + spring training"},
    {name:"Gatlinburg, TN", icon:"🏕",adr:215,occ:63,pm:25,rent:1500,build:950, land:120,horiz:0,note:"Smokies cabin market · high occupancy year-round"},
    {name:"Miami Beach, FL",icon:"🌊",adr:290,occ:67,pm:30,rent:3000,build:1600,land:400,horiz:0,note:"Highest ADR in Sunbelt · seasonal + international"},
    {name:"Austin, TX",     icon:"🤠",adr:175,occ:57,pm:25,rent:1900,build:1100,land:200,horiz:0,note:"Tech hub · ACL/SXSW events boost"},
    {name:"New Orleans, LA",icon:"🎷",adr:185,occ:60,pm:28,rent:1600,build:1050,land:160,horiz:0,note:"Event-heavy · Mardi Gras + Jazz Fest premium"},
  ]},
  {region:"US – Midwest",markets:[
    {name:"Chicago, IL",     icon:"🍕",adr:175,occ:54,pm:28,rent:2100,build:1400,land:300,horiz:0,note:"Urban market · strong biz demand · seasonal swing"},
    {name:"Indianapolis, IN",icon:"🏁",adr:130,occ:50,pm:25,rent:1400,build:950, land:130,horiz:0,note:"Race events + B2B · lower entry price"},
    {name:"Kansas City, MO", icon:"🥩",adr:140,occ:52,pm:25,rent:1400,build:1000,land:140,horiz:0,note:"Central hub · consistent mid-market demand"},
    {name:"Cincinnati, OH",  icon:"⚾",adr:128,occ:49,pm:25,rent:1300,build:950, land:120,horiz:0,note:"River city · sports + convention demand"},
    {name:"Detroit, MI",     icon:"🚗",adr:115,occ:47,pm:25,rent:1200,build:900, land:100,horiz:0,note:"Affordable entry · resurgent urban core"},
  ]},
  {region:"Custom",markets:[
    {name:"Custom",icon:"✏️",adr:100,occ:45,pm:20,rent:1200,build:825,land:70,horiz:25,note:"Custom market — adjust all inputs manually"},
  ]},
];
const MARKETS=Object.fromEntries(MARKET_GROUPS.flatMap(g=>g.markets.map(m=>[m.name,m])));

// ─── Helpers ──────────────────────────────────────────────────────────────────
const f$=v=>{if(v==null||isNaN(v))return"—";const a=Math.abs(Math.round(v));return(v<0?"−$":"$")+a.toLocaleString("en-US");};
const fp=v=>(v==null||isNaN(v))?"—":(v*100).toFixed(1)+"%";
const chk=(v,p,w)=>v>=p?"pass":v>=w?"warn":"fail";
const gc=g=>g==="pass"?G:g==="warn"?Y:R;

function calcIRR(cfs){
  let r=0.1;
  for(let i=0;i<60;i++){
    let npv=0,d=0;
    cfs.forEach((c,t)=>{const f=Math.pow(1+r,t);npv+=c/f;d-=t*c/Math.pow(1+r,t+1);});
    if(Math.abs(d)<1e-12)break;
    const delta=npv/d; r-=delta;
    if(Math.abs(delta)<1e-8)break;
  }
  return isFinite(r)&&r>-1&&r<10?r:null;
}

function mortgageAnn(principal,annualRate,years){
  if(!principal||!annualRate)return 0;
  const mo=annualRate/100/12,n=years*12;
  return principal*mo*Math.pow(1+mo,n)/(Math.pow(1+mo,n)-1)*12;
}

// ─── Responsive hook ──────────────────────────────────────────────────────────
function useIsMobile(){
  const [m,setM]=useState(()=>typeof window!=="undefined"&&window.innerWidth<680);
  useEffect(()=>{
    const h=()=>setM(window.innerWidth<680);
    window.addEventListener("resize",h,{passive:true});
    return()=>window.removeEventListener("resize",h);
  },[]);
  return m;
}

// ─── Global styles ────────────────────────────────────────────────────────────
const CSS=`
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;700;800&family=IBM+Plex+Mono:wght@600&display=swap');
  html,body{margin:0;padding:0;overflow-x:hidden;-webkit-text-size-adjust:100%;text-size-adjust:100%;}
  *,*::before,*::after{box-sizing:border-box;}
  input{font-size:16px !important;}
  input[type=number]{-moz-appearance:textfield;-webkit-appearance:none;appearance:none;}
  input[type=number]::-webkit-inner-spin-button,
  input[type=number]::-webkit-outer-spin-button{-webkit-appearance:none;margin:0;}
  input:focus{outline:none;border-color:#1a3a52 !important;}
  button{-webkit-tap-highlight-color:transparent;touch-action:manipulation;}
  ::-webkit-scrollbar{width:4px;height:4px;}
  ::-webkit-scrollbar-track{background:#040b12;}
  ::-webkit-scrollbar-thumb{background:#172030;border-radius:2px;}
`;

// ─── Base styles ──────────────────────────────────────────────────────────────
const labelSt={fontSize:9,fontWeight:800,color:DIM,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:4,display:"block"};
const sectionSt={fontSize:9,fontWeight:800,color:"#2d5a7a",textTransform:"uppercase",letterSpacing:"0.1em",paddingBottom:5,borderBottom:"1px solid #0c1a26",marginTop:14,marginBottom:8};
const inputSt={
  display:"block",width:"100%",minWidth:0,
  background:"#040b12",border:"1px solid #172030",borderRadius:7,
  color:"#b8d0e8",padding:"10px 10px",fontSize:16,lineHeight:1,
  fontFamily:"inherit",boxSizing:"border-box",WebkitAppearance:"none",appearance:"none",
};
const SS_INPUT={
  width:46,background:"#040b12",border:"1px solid #172030",borderRadius:4,
  color:"#6a9ab8",padding:"2px 4px",fontSize:11,
  fontFamily:"'IBM Plex Mono',monospace",textAlign:"center",
  boxSizing:"border-box",WebkitAppearance:"none",appearance:"none",
};

// ─── Num input — comma formatting for $ amounts ───────────────────────────────
function Num({label,value,onChange,pre="$",suf="",step=1000,min=0}){
  const isDollar=pre==="$";
  const fmt=v=>isDollar?Math.round(v).toLocaleString("en-US"):String(v);
  const parse=s=>parseFloat(String(s).replace(/,/g,""));

  const [raw,setRaw]=useState(()=>fmt(value));
  const [focused,setFocused]=useState(false);
  const prevVal=useRef(value);

  useEffect(()=>{
    if(prevVal.current!==value){
      prevVal.current=value;
      setRaw(fmt(value));
    }
  },[value]); // eslint-disable-line

  const commit=s=>{
    const n=parse(s);
    if(!isNaN(n)&&n>=min){onChange(n);prevVal.current=n;setRaw(fmt(n));}
    else setRaw(fmt(prevVal.current));
  };

  const handleFocus=()=>{
    setFocused(true);
    setRaw(String(prevVal.current));
  };

  const handleBlur=e=>{
    setFocused(false);
    commit(e.target.value);
  };

  const handleKeyDown=e=>{
    if(e.key==="ArrowUp"||e.key==="ArrowDown"){
      e.preventDefault();
      const cur=parse(raw)||prevVal.current||0;
      const next=e.key==="ArrowUp"?cur+step:Math.max(min,cur-step);
      onChange(next);prevVal.current=next;
      setRaw(focused?String(next):fmt(next));
    }
  };

  return(
    <div style={{marginBottom:8,minWidth:0,width:"100%"}}>
      {label&&<label style={labelSt}>{label}</label>}
      <div style={{position:"relative",minWidth:0}}>
        {pre&&<span style={{position:"absolute",left:9,top:"50%",transform:"translateY(-50%)",color:"#3a5060",fontSize:13,pointerEvents:"none",zIndex:1,lineHeight:1}}>{pre}</span>}
        <input
          type="text"
          inputMode={isDollar?"numeric":"decimal"}
          value={raw}
          onChange={e=>setRaw(e.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          style={{...inputSt,paddingLeft:pre?26:10,paddingRight:suf?40:10}}
        />
        {suf&&<span style={{position:"absolute",right:9,top:"50%",transform:"translateY(-50%)",color:"#3a5060",fontSize:11,pointerEvents:"none",lineHeight:1}}>{suf}</span>}
      </div>
    </div>
  );
}

// Responsive grid helpers
function G2({children,mob}){return<div style={{display:"grid",gridTemplateColumns:mob?"1fr":"1fr 1fr",gap:8,minWidth:0}}>{children}</div>;}
function G3({children,mob}){return<div style={{display:"grid",gridTemplateColumns:mob?"1fr 1fr":"1fr 1fr 1fr",gap:7,minWidth:0}}>{children}</div>;}

function Toggle({label,value,onChange}){
  return(
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10,gap:8}}>
      <span style={{fontSize:10,color:"#3a5570",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em"}}>{label}</span>
      <div onClick={()=>onChange(!value)} style={{width:38,height:22,borderRadius:11,background:value?G:"#172030",cursor:"pointer",position:"relative",transition:"background .2s",flexShrink:0}}>
        <div style={{width:16,height:16,borderRadius:"50%",background:"#c8ddf0",position:"absolute",top:3,left:value?19:3,transition:"left .2s"}}/>
      </div>
    </div>
  );
}

function Presets({selected,onSelect,mob}){
  return(
    <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
      <span style={{fontSize:9,fontWeight:800,color:DIM,textTransform:"uppercase",letterSpacing:"0.08em",whiteSpace:"nowrap"}}>Market</span>
      <select
        value={selected}
        onChange={e=>{const m=MARKETS[e.target.value];if(m)onSelect(e.target.value,m);}}
        style={{
          background:"#040b12",border:"1px solid #172030",borderRadius:6,
          color:"#c8ddf0",fontSize:10,padding:"4px 8px",fontFamily:"inherit",
          cursor:"pointer",outline:"none",maxWidth:mob?160:220,
        }}
      >
        {MARKET_GROUPS.map(g=>(
          <optgroup key={g.region} label={g.region}>
            {g.markets.map(m=>(
              <option key={m.name} value={m.name}>{m.icon} {m.name}</option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  );
}

// ─── HealthCheck — improved cards ─────────────────────────────────────────────
function HealthCheck({label,value,grade,sub}){
  const col=gc(grade);
  return(
    <div style={{
      padding:"10px 14px",marginBottom:6,borderRadius:8,
      background:grade==="pass"?"#040e09":grade==="warn"?"#0e0a02":"#0e0404",
      border:`1px solid ${col}38`,
    }}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{display:"flex",alignItems:"center",gap:8,minWidth:0}}>
          <span style={{color:col,fontWeight:900,fontSize:14,lineHeight:1,flexShrink:0}}>{grade==="pass"?"✓":grade==="warn"?"⚠":"✗"}</span>
          <span style={{fontSize:12,color:"#4a6a80",fontWeight:600}}>{label}</span>
        </div>
        <span style={{fontSize:15,fontWeight:800,color:col,fontFamily:"'IBM Plex Mono',monospace",flexShrink:0,marginLeft:12,whiteSpace:"nowrap"}}>{value}</span>
      </div>
      {sub&&<div style={{fontSize:9,color:DIM,marginTop:4,paddingLeft:22}}>{sub}</div>}
    </div>
  );
}

// ─── DealScore — visual redesign ──────────────────────────────────────────────
function DealScore({checks}){
  const pts=checks.reduce((a,c)=>a+(c.grade==="pass"?2:c.grade==="warn"?1:0),0);
  const max=checks.length*2,ratio=pts/max;
  const label=ratio>=0.8?"Strong Deal":ratio>=0.6?"Acceptable":ratio>=0.4?"Marginal":"Needs Work";
  const col=ratio>=0.8?G:ratio>=0.6?Y:ratio>=0.4?"#c47a30":R;
  return(
    <div style={{
      background:"#040b12",border:`1px solid ${col}30`,borderRadius:10,
      padding:"14px 16px",marginBottom:14,
    }}>
      <div style={{fontSize:8,fontWeight:800,color:DIM,textTransform:"uppercase",letterSpacing:"0.12em",marginBottom:8}}>Deal Score</div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginBottom:10}}>
        <div style={{fontSize:22,fontWeight:900,color:col,fontFamily:"'IBM Plex Mono',monospace",lineHeight:1}}>{label}</div>
        <div style={{fontSize:13,fontWeight:800,color:`${col}cc`,fontFamily:"'IBM Plex Mono',monospace"}}>
          {pts}/{max}<span style={{fontSize:9,fontWeight:400,color:DIM}}> pts</span>
        </div>
      </div>
      <div style={{background:"#0a1828",borderRadius:4,height:5,marginBottom:10,overflow:"hidden"}}>
        <div style={{width:`${ratio*100}%`,height:"100%",background:col,borderRadius:4,transition:"width .4s ease"}}/>
      </div>
      <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
        {checks.map((c,i)=>(
          <div key={i} title={c.label} style={{
            width:11,height:11,borderRadius:"50%",background:gc(c.grade),
            boxShadow:`0 0 5px ${gc(c.grade)}50`,
          }}/>
        ))}
      </div>
    </div>
  );
}

function KPIGrid({items}){
  return(
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:10}}>
      {items.map(({label,val,sub,hi},i)=>(
        <div key={i} style={{background:"#040b12",borderRadius:8,padding:"9px 10px",border:`1px solid ${hi?"#18c97a22":"#0f1e2c"}`,minWidth:0,overflow:"hidden"}}>
          <div style={{fontSize:8,fontWeight:800,color:DIM,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:2}}>{label}</div>
          <div style={{fontSize:14,fontWeight:800,color:hi?"#18c97a":"#8ab0cc",fontFamily:"'IBM Plex Mono',monospace",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{val}</div>
          {sub&&<div style={{fontSize:9,color:"#2d5a7a",marginTop:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{sub}</div>}
        </div>
      ))}
    </div>
  );
}

// ─── Projection Table ─────────────────────────────────────────────────────────
function ProjTable({rows,years,mob}){
  const [view,setView]=useState("unlev");
  const ncol=years.length;

  if(mob){
    const data=rows.map(r=>({...r,vals:view==="lev"?(r.lev||r.unlev):r.unlev}));
    return(
      <div style={{marginTop:16}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <div style={{fontSize:9,fontWeight:800,color:"#2d5a7a",textTransform:"uppercase",letterSpacing:"0.09em"}}>Projection</div>
          <div style={{display:"flex",background:"#040b12",borderRadius:6,border:"1px solid #172030",overflow:"hidden"}}>
            {[["unlev","Unlevered"],["lev","Levered"]].map(([v,lbl])=>(
              <button key={v} onClick={()=>setView(v)} style={{
                background:view===v?"#172030":"transparent",border:"none",
                padding:"5px 12px",fontSize:10,color:view===v?"#c8ddf0":DIM,
                cursor:"pointer",fontFamily:"inherit",fontWeight:700,
              }}>{lbl}</button>
            ))}
          </div>
        </div>
        <div style={{width:"100%",overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
          <table style={{borderCollapse:"collapse",fontSize:10,fontFamily:"'IBM Plex Mono',monospace",width:"100%",tableLayout:"fixed",minWidth:Math.max(320,ncol*90)}}>
            <colgroup>
              <col style={{width:"38%"}}/>
              {years.map((_,i)=><col key={i} style={{width:`${62/ncol}%`}}/>)}
            </colgroup>
            <thead>
              <tr>
                <th style={{textAlign:"left",padding:"6px 10px",color:view==="lev"?"#1a4a38":"#2a5070",fontWeight:800,borderBottom:"1px solid #0c1a26",fontSize:9,textTransform:"uppercase"}}>{view==="lev"?"Levered":"Unlevered"}</th>
                {years.map((y,i)=>(
                  <th key={i} style={{textAlign:"right",padding:"6px 10px",color:DIM,fontWeight:800,borderBottom:"1px solid #0c1a26",fontSize:9}}>{y}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((row,i)=>{
                const isT=row.type==="total",isDivider=row.type==="divider";
                return(
                  <tr key={i} style={{background:isT?"#060f18":isDivider?"#04090f":"transparent",borderTop:(isT||isDivider)?"1px solid #0c1a26":"none"}}>
                    <td style={{padding:"8px 10px",color:isT?"#6a9ab8":isDivider?"#2d4060":"#4a7090",fontWeight:isT?700:400,fontSize:10}}>{row.label}</td>
                    {(row.vals||[]).map((v,j)=>{
                      const num=typeof v==="number";
                      const col=isT?(num&&v<0?"#d46060":"#1edd96"):num?(v<0?"#6a3a3a":"#4a7090"):"#2d4060";
                      return<td key={j} style={{textAlign:"right",padding:"8px 10px",color:col,fontWeight:isT?700:400,fontSize:11,whiteSpace:"nowrap"}}>{num?f$(v):v}</td>;
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // Desktop: side-by-side Unlev | Lev
  return(
    <div style={{marginTop:16}}>
      <div style={{fontSize:9,fontWeight:800,color:"#2d5a7a",textTransform:"uppercase",letterSpacing:"0.09em",marginBottom:7}}>{years.length}-Year Projection — Unlevered vs Levered</div>
      <div style={{width:"100%",overflowX:"auto"}}>
        <table style={{borderCollapse:"collapse",fontSize:11,fontFamily:"'IBM Plex Mono',monospace",width:"100%",tableLayout:"fixed",minWidth:520}}>
          <colgroup>
            <col style={{width:"20%"}}/>
            {years.flatMap((_,i)=>[
              <col key={`ca${i}`} style={{width:`${80/ncol/2}%`}}/>,
              <col key={`cb${i}`} style={{width:`${80/ncol/2}%`}}/>,
            ])}
          </colgroup>
          <thead>
            <tr>
              <th style={{padding:"5px 8px",borderBottom:"1px solid #0c1a26"}}></th>
              {years.map((y,i)=>(
                <th key={i} colSpan={2} style={{textAlign:"center",padding:"5px 8px",color:i%2===0?"#2a5070":"#1a4a38",fontWeight:800,fontSize:9,textTransform:"uppercase",borderBottom:"1px solid #0c1a26",borderLeft:"1px solid #0c1a26"}}>{y}</th>
              ))}
            </tr>
            <tr>
              <th style={{borderBottom:"1px solid #0c1a26",padding:"3px 8px"}}></th>
              {years.flatMap((_,i)=>[
                <th key={`ha${i}`} style={{textAlign:"right",padding:"3px 8px",color:"#2a5070",fontWeight:700,fontSize:8,borderBottom:"1px solid #0c1a26",borderLeft:"1px solid #0c1a26"}}>Unlev</th>,
                <th key={`hb${i}`} style={{textAlign:"right",padding:"3px 8px",color:"#1a4a38",fontWeight:700,fontSize:8,borderBottom:"1px solid #0c1a26"}}>Lev</th>,
              ])}
            </tr>
          </thead>
          <tbody>
            {rows.map((row,i)=>{
              const isT=row.type==="total",isDivider=row.type==="divider";
              return(
                <tr key={i} style={{background:isT?"#060f18":isDivider?"#04090f":"transparent",borderTop:(isT||isDivider)?"1px solid #0c1a26":"none"}}>
                  <td style={{padding:"5px 8px",color:isT?"#6a9ab8":isDivider?"#2d4060":"#4a7090",fontWeight:isT?700:400,fontSize:11}}>{row.label}</td>
                  {(row.unlev||[]).flatMap((uv,j)=>{
                    const lv=(row.lev||row.unlev)[j];
                    const numU=typeof uv==="number",numL=typeof lv==="number";
                    const cu=isT?(numU&&uv<0?"#d46060":"#1edd96"):numU?(uv<0?"#6a3a3a":"#4a7090"):"#2d4060";
                    const cl=isT?(numL&&lv<0?"#d46060":"#18c97a"):numL?(lv<0?"#6a3a3a":"#1a5040"):"#2d4060";
                    return[
                      <td key={`ua${j}`} style={{textAlign:"right",padding:"5px 8px",color:cu,fontWeight:isT?700:400,whiteSpace:"nowrap",borderLeft:"1px solid #0c1a26"}}>{numU?f$(uv):uv}</td>,
                      <td key={`ub${j}`} style={{textAlign:"right",padding:"5px 8px",color:cl,fontWeight:isT?700:400,whiteSpace:"nowrap"}}>{numL?f$(lv):lv}</td>,
                    ];
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Score Settings ───────────────────────────────────────────────────────────
function ScoreSettings({show,onToggle,rows}){
  return(
    <div style={{marginTop:14}}>
      <button onClick={onToggle} style={{
        background:"none",border:"none",cursor:"pointer",padding:0,
        fontSize:9,fontWeight:800,color:DIM,textTransform:"uppercase",
        letterSpacing:"0.08em",display:"flex",alignItems:"center",gap:4,
        fontFamily:"inherit",
      }}>
        <span style={{fontSize:8}}>{show?"▾":"▸"}</span> Score Settings
      </button>
      {show&&(
        <div style={{marginTop:8,background:"#040b12",border:"1px solid #0c1a26",borderRadius:8,padding:"10px 12px"}}>
          <div style={{fontSize:8,color:DIM,marginBottom:8}}>Adjust pass/warn thresholds</div>
          {rows.map(({label,passKey,warnKey,unit,settings,setSettings})=>(
            <div key={label} style={{display:"flex",alignItems:"center",gap:5,marginBottom:7,flexWrap:"wrap"}}>
              <span style={{fontSize:9,color:"#2a4055",width:72,flexShrink:0,whiteSpace:"nowrap"}}>{label}</span>
              <span style={{fontSize:8,color:G,fontWeight:800}}>P</span>
              <input type="text" inputMode="decimal" value={settings[passKey]}
                onChange={e=>{const v=parseFloat(e.target.value);if(!isNaN(v))setSettings(s=>({...s,[passKey]:v}));}}
                style={SS_INPUT}/>
              <span style={{fontSize:8,color:DIM}}>{unit}</span>
              <span style={{fontSize:8,color:Y,fontWeight:800}}>W</span>
              <input type="text" inputMode="decimal" value={settings[warnKey]}
                onChange={e=>{const v=parseFloat(e.target.value);if(!isNaN(v))setSettings(s=>({...s,[warnKey]:v}));}}
                style={SS_INPUT}/>
              <span style={{fontSize:8,color:DIM}}>{unit}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── STR ──────────────────────────────────────────────────────────────────────
function STR({mob}){
  const [mkt,setMkt]=useState("Jarabacoa");
  const [price,setPrice]=useState(185000);
  const [furnish,setFurnish]=useState(15000);
  const [closePct,setClosePct]=useState(7);
  const [adr,setAdr]=useState(118);
  const [occ,setOcc]=useState(49);
  const [pmPct,setPmPct]=useState(25);
  const [hoaAmt,setHoaAmt]=useState(1800);
  const [utilitiesAmt,setUtilitiesAmt]=useState(1200);
  const [insuranceAmt,setInsuranceAmt]=useState(600);
  const [confotur,setConfotur]=useState(false);
  const [taxesAmt,setTaxesAmt]=useState(0);
  const [showConfotur,setShowConfotur]=useState(false);
  const [downPct,setDownPct]=useState(30);
  const [intRate,setIntRate]=useState(9);
  const [termYrs,setTermYrs]=useState(15);
  const [numYears,setNumYears]=useState(5);
  const [showSettings,setShowSettings]=useState(false);
  const [ss,setSS]=useState({
    revYieldPass:8,revYieldWarn:6,
    uccPass:5,uccWarn:3,
    lcocPass:7,lcocWarn:4,
    expRatioPass:60,expRatioWarn:75,
    beBufferPass:15,beBufferWarn:8,
  });

  const onMkt=(n,d)=>{setMkt(n);setAdr(d.adr);setOcc(d.occ);setPmPct(d.pm);};

  const conSave=confotur?price*0.03:0;
  const closing=price*closePct/100;
  const totalIn=price+closing-conSave+furnish;
  const loan=price*(1-downPct/100);
  const annDebt=mortgageAnn(loan,intRate,termYrs);
  const equity=price*(downPct/100)+closing-conSave+furnish;
  const autoIpi=Math.max(0,(price-177000)*0.01);
  const effectiveTaxes=confotur?0:(taxesAmt>0?taxesAmt:autoIpi);

  const calcYr=y=>{
    const occR=y===1?occ*0.85/100:occ/100;
    const rg=Math.pow(1.03,y-1), eg=Math.pow(1.04,y-1);
    const nights=Math.round(365*occR);
    const gross=adr*nights*rg;
    const pm=gross*pmPct/100;
    const maint=gross*0.06;
    const fixedGrown=(hoaAmt+utilitiesAmt+insuranceAmt+furnish/5+effectiveTaxes)*eg;
    const exp=pm+maint+fixedGrown;
    const noi=gross-exp;
    return{nights,gross,exp,noi,cfLev:noi-annDebt};
  };
  const yrs=Array.from({length:numYears},(_,i)=>calcYr(i+1));
  const y1=yrs[0];

  const varRate=pmPct/100+0.06;
  const fixedBase=hoaAmt+utilitiesAmt+insuranceAmt+furnish/5+effectiveTaxes;
  const beU=fixedBase/(adr*365*(1-varRate));
  const beL=(fixedBase+annDebt)/(adr*365*(1-varRate));

  const nococ=y1.noi/totalIn, lcoc=y1.cfLev/equity;
  const irr_u=calcIRR([-totalIn,...yrs.map(y=>y.noi)]);
  const irr_l=calcIRR([-equity,...yrs.map(y=>y.cfLev)]);
  const expRatio=y1.gross>0?y1.exp/y1.gross:1;

  const checks=[
    {label:"Revenue Yield",value:fp(y1.gross/totalIn),grade:chk(y1.gross/totalIn,ss.revYieldPass/100,ss.revYieldWarn/100),sub:`≥${ss.revYieldPass}% ✓  ${ss.revYieldWarn}–${ss.revYieldPass}% ⚠`},
    {label:"Unlevered CoC Y1",value:fp(nococ),grade:chk(nococ,ss.uccPass/100,ss.uccWarn/100),sub:`≥${ss.uccPass}% ✓  ${ss.uccWarn}–${ss.uccPass}% ⚠`},
    {label:"Levered CoC Y1",value:fp(lcoc),grade:chk(lcoc,ss.lcocPass/100,ss.lcocWarn/100),sub:`≥${ss.lcocPass}% ✓  ${ss.lcocWarn}–${ss.lcocPass}% ⚠`},
    {label:"Expense Ratio",value:fp(expRatio),grade:expRatio<ss.expRatioPass/100?"pass":expRatio<ss.expRatioWarn/100?"warn":"fail",sub:`<${ss.expRatioPass}% ✓  ${ss.expRatioPass}–${ss.expRatioWarn}% ⚠`},
    {label:"Break-even Occ (Unlev)",value:fp(beU),grade:chk(occ/100-beU,ss.beBufferPass/100,ss.beBufferWarn/100),sub:`Buffer: ${fp(occ/100-beU)} above floor`},
  ];

  const rows=[
    {label:"Gross Revenue",unlev:yrs.map(y=>y.gross),lev:yrs.map(y=>y.gross),type:"total"},
    {label:"Expenses",unlev:yrs.map(y=>-y.exp),lev:yrs.map(y=>-y.exp)},
    {label:"NOI",unlev:yrs.map(y=>y.noi),lev:yrs.map(y=>y.noi),type:"divider"},
    {label:"Debt Service",unlev:yrs.map(_=>"—"),lev:yrs.map(_=>-annDebt)},
    {label:"Cash Flow",unlev:yrs.map(y=>y.noi),lev:yrs.map(y=>y.cfLev),type:"total"},
    {label:"CoC Return",unlev:yrs.map(y=>fp(y.noi/totalIn)),lev:yrs.map(y=>fp(y.cfLev/equity))},
    {label:"Break-even Occ",unlev:yrs.map(_=>fp(beU)),lev:yrs.map(_=>fp(beL))},
  ];

  const strYears=Array.from({length:numYears},(_,i)=>`Y${i+1}`);

  return(
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,flexWrap:"wrap",gap:8}}>
        <Presets selected={mkt} onSelect={onMkt} mob={mob}/>
        <div style={{display:"flex",gap:4,alignItems:"center"}}>
          <span style={{fontSize:9,fontWeight:800,color:DIM,textTransform:"uppercase",letterSpacing:"0.07em",marginRight:4}}>Projection</span>
          {[3,4,5].map(y=>(
            <button key={y} onClick={()=>setNumYears(y)} style={{
              background:numYears===y?"#0a1828":"#040b12",
              border:`1px solid ${numYears===y?"#2a5a9a":"#172030"}`,
              borderRadius:6,padding:"4px 9px",fontSize:10,
              color:numYears===y?"#7ab0e8":DIM,cursor:"pointer",
              fontFamily:"inherit",fontWeight:numYears===y?700:400,
            }}>{y}yr</button>
          ))}
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:mob?"1fr":"285px 1fr",gap:20,minWidth:0}}>
        <div style={{minWidth:0}}>
          <div style={sectionSt}>Acquisition</div>
          <Num label="Purchase Price" value={price} onChange={setPrice} step={5000}/>
          <G2 mob={mob}>
            <Num label="Furnishing (cash)" value={furnish} onChange={setFurnish} step={500}/>
            <Num label="Closing Costs" value={closePct} onChange={setClosePct} pre="" suf="%" step={0.5}/>
          </G2>

          <div style={sectionSt}>Revenue</div>
          <G2 mob={mob}>
            <Num label="Nightly Rate (ADR)" value={adr} onChange={setAdr} step={5}/>
            <Num label="Occupancy" value={occ} onChange={setOcc} pre="" suf="%" step={1}/>
          </G2>

          <div style={sectionSt}>Expenses</div>
          <G2 mob={mob}>
            <Num label="Management % Rev" value={pmPct} onChange={setPmPct} pre="" suf="%" step={1}/>
            <Num label="HOA $/yr" value={hoaAmt} onChange={setHoaAmt} step={100}/>
          </G2>
          <G2 mob={mob}>
            <Num label="Utilities $/yr" value={utilitiesAmt} onChange={setUtilitiesAmt} step={100}/>
            <Num label="Insurance $/yr" value={insuranceAmt} onChange={setInsuranceAmt} step={100}/>
          </G2>
          <Num label="Taxes $/yr" value={taxesAmt} onChange={setTaxesAmt} step={100}/>
          {taxesAmt===0&&!confotur&&autoIpi>0&&<div style={{fontSize:9,color:DIM,marginTop:-4,marginBottom:4}}>Auto IPI: {f$(autoIpi)}/yr · Set above to override</div>}
          {confotur&&<div style={{fontSize:9,color:G,marginTop:-4,marginBottom:4}}>✓ IPI waived via CONFOTUR · {f$(conSave)} saved on purchase</div>}
          <button onClick={()=>setShowConfotur(v=>!v)} style={{background:"none",border:"none",padding:"2px 0",marginBottom:8,cursor:"pointer",display:"flex",alignItems:"center",gap:4,fontFamily:"inherit"}}>
            <span style={{fontSize:9,color:DIM,fontWeight:700}}>{showConfotur?"▾":"▸"} Advanced: CONFOTUR</span>
            <span title="CONFOTUR (Law 158-01): 15-year tax exemption for tourism-eligible properties in the Dominican Republic. Typically saves 3% of purchase price in transfer taxes + waives annual IPI property tax." style={{fontSize:10,color:DIM,cursor:"help"}}>ⓘ</span>
          </button>
          {showConfotur&&<div style={{background:"#040b12",border:"1px solid #0c1a26",borderRadius:8,padding:"8px 12px",marginBottom:8,marginTop:-4}}>
            <Toggle label="CONFOTUR Property?" value={confotur} onChange={v=>{setConfotur(v);if(v)setTaxesAmt(0);}}/>
          </div>}
          <div style={{fontSize:9,color:DIM,marginTop:-4,marginBottom:8,lineHeight:1.5}}>
            Maintenance 6% rev + furnishing amort auto-added · Fixed costs +4%/yr
          </div>

          <div style={sectionSt}>Leverage</div>
          <G3 mob={mob}>
            <Num label="Down %" value={downPct} onChange={setDownPct} pre="" suf="%" step={5}/>
            <Num label="Rate (USD)" value={intRate} onChange={setIntRate} pre="" suf="%" step={0.25}/>
            <Num label="Term (yr)" value={termYrs} onChange={setTermYrs} pre="" suf="yr" step={5}/>
          </G3>
          <ScoreSettings show={showSettings} onToggle={()=>setShowSettings(v=>!v)} rows={[
            {label:"Rev Yield",passKey:"revYieldPass",warnKey:"revYieldWarn",unit:"%",settings:ss,setSettings:setSS},
            {label:"Unlev CoC",passKey:"uccPass",warnKey:"uccWarn",unit:"%",settings:ss,setSettings:setSS},
            {label:"Lev CoC",passKey:"lcocPass",warnKey:"lcocWarn",unit:"%",settings:ss,setSettings:setSS},
            {label:"Exp Ratio",passKey:"expRatioPass",warnKey:"expRatioWarn",unit:"%",settings:ss,setSettings:setSS},
            {label:"BE Buffer",passKey:"beBufferPass",warnKey:"beBufferWarn",unit:"%",settings:ss,setSettings:setSS},
          ]}/>
        </div>

        <div style={{minWidth:0}}>
          <DealScore checks={checks}/>
          <div style={sectionSt}>Deal Metrics</div>
          {checks.map((c,i)=><HealthCheck key={i} {...c}/>)}

          <div style={sectionSt}>Year 1 Snapshot</div>
          <KPIGrid items={[
            {label:"Cash In (Unlev)",val:f$(totalIn)},
            {label:"Equity In (Lev)",val:f$(equity),sub:`Loan ${f$(loan)}`},
            {label:"Gross Rev Y1",val:f$(y1.gross),sub:`${y1.nights} nights`},
            {label:"NOI Y1",val:f$(y1.noi)},
            {label:"Levered CF Y1",val:f$(y1.cfLev),hi:true},
            {label:"Lev Spread",val:fp(lcoc-nococ),sub:"Lev − Unlev CoC"},
            {label:`${numYears}yr IRR (Unlev)`,val:irr_u?fp(irr_u):"—"},
            {label:`${numYears}yr IRR (Lev)`,val:irr_l?fp(irr_l):"—",hi:true},
          ]}/>
          <div style={{fontSize:9,color:DIM,background:"#040b12",borderRadius:6,padding:"5px 10px",marginTop:-6,lineHeight:1.6}}>
            Y1 occ = {Math.round(occ*0.85)}% (new listing penalty) · Rev +3%/yr
          </div>
        </div>
      </div>
      <ProjTable rows={rows} years={strYears} mob={mob}/>
    </div>
  );
}

// ─── LTR ──────────────────────────────────────────────────────────────────────
function LTR({mob}){
  const [mkt,setMkt]=useState("Jarabacoa");
  const [price,setPrice]=useState(220000);
  const [closePct,setClosePct]=useState(7);
  const [rent,setRent]=useState(1400);
  const [vacPct,setVacPct]=useState(8);
  const [mgmtPct,setMgmtPct]=useState(10);
  const [maintPct,setMaintPct]=useState(5);
  const [utilitiesAmt,setUtilitiesAmt]=useState(600);
  const [insuranceAmt,setInsuranceAmt]=useState(500);
  const [confotur,setConfotur]=useState(false);
  const [taxesAmt,setTaxesAmt]=useState(0);
  const [showConfotur,setShowConfotur]=useState(false);
  const [downPct,setDownPct]=useState(30);
  const [intRate,setIntRate]=useState(9);
  const [termYrs,setTermYrs]=useState(15);
  const [numYears,setNumYears]=useState(5);
  const [showSettings,setShowSettings]=useState(false);
  const [ss,setSS]=useState({
    grossYieldPass:7,grossYieldWarn:5.5,
    capRatePass:5.5,capRateWarn:4,
    uccPass:4,uccWarn:2.5,
    lcocPass:5,lcocWarn:3,
    dscrPass:1.25,dscrWarn:1.0,
  });

  const onMkt=(n,d)=>{setMkt(n);setRent(d.rent);};

  const conSave=confotur?price*0.03:0;
  const closing=price*closePct/100;
  const totalIn=price+closing-conSave;
  const loan=price*(1-downPct/100);
  const annDebt=mortgageAnn(loan,intRate,termYrs);
  const equity=price*(downPct/100)+closing-conSave;
  const autoIpi=Math.max(0,(price-177000)*0.01);
  const effectiveTaxes=confotur?0:(taxesAmt>0?taxesAmt:autoIpi);

  const calcYr=y=>{
    const rg=Math.pow(1.03,y-1), eg=Math.pow(1.04,y-1);
    const gross=rent*12*rg*(y===1?.88:1);
    const vac=gross*vacPct/100;
    const coll=gross-vac;
    const mgmt=coll*mgmtPct/100;
    const maint=gross*maintPct/100;
    const fixedGrown=(effectiveTaxes+utilitiesAmt+insuranceAmt)*eg;
    const exp=vac+mgmt+maint+fixedGrown;
    const noi=gross-exp;
    return{gross,exp,noi,cfLev:noi-annDebt,capRate:noi/totalIn};
  };
  const yrs=Array.from({length:numYears},(_,i)=>calcYr(i+1));
  const y1=yrs[0];

  const grossYield=rent*12/totalIn, nococ=y1.noi/totalIn, lcoc=y1.cfLev/equity;
  const dscr=annDebt>0?y1.noi/annDebt:Infinity;
  const irr_u=calcIRR([-totalIn,...yrs.map(y=>y.noi)]);
  const irr_l=calcIRR([-equity,...yrs.map(y=>y.cfLev)]);

  const checks=[
    {label:"Gross Yield",value:fp(grossYield),grade:chk(grossYield,ss.grossYieldPass/100,ss.grossYieldWarn/100),sub:"SD avg 7.9% · PC avg 7.0%"},
    {label:"Cap Rate Y1",value:fp(y1.capRate),grade:chk(y1.capRate,ss.capRatePass/100,ss.capRateWarn/100),sub:`≥${ss.capRatePass}% ✓  ${ss.capRateWarn}–${ss.capRatePass}% ⚠`},
    {label:"Unlevered CoC Y1",value:fp(nococ),grade:chk(nococ,ss.uccPass/100,ss.uccWarn/100),sub:`≥${ss.uccPass}% ✓  ${ss.uccWarn}–${ss.uccPass}% ⚠`},
    {label:"Levered CoC Y1",value:fp(lcoc),grade:chk(lcoc,ss.lcocPass/100,ss.lcocWarn/100),sub:`≥${ss.lcocPass}% ✓  ${ss.lcocWarn}–${ss.lcocPass}% ⚠`},
    {label:"DSCR",value:isFinite(dscr)?dscr.toFixed(2)+"x":"—",grade:chk(dscr,ss.dscrPass,ss.dscrWarn),sub:`Target ≥${ss.dscrPass}x · Lenders need ≥1.15x`},
  ];

  const rows=[
    {label:"Gross Rent",unlev:yrs.map(y=>y.gross),lev:yrs.map(y=>y.gross),type:"total"},
    {label:"Expenses",unlev:yrs.map(y=>-y.exp),lev:yrs.map(y=>-y.exp)},
    {label:"NOI",unlev:yrs.map(y=>y.noi),lev:yrs.map(y=>y.noi),type:"divider"},
    {label:"Debt Service",unlev:yrs.map(_=>"—"),lev:yrs.map(_=>-annDebt)},
    {label:"Cash Flow",unlev:yrs.map(y=>y.noi),lev:yrs.map(y=>y.cfLev),type:"total"},
    {label:"Cap Rate",unlev:yrs.map(y=>fp(y.capRate)),lev:yrs.map(y=>fp(y.capRate))},
    {label:"CoC Return",unlev:yrs.map(y=>fp(y.noi/totalIn)),lev:yrs.map(y=>fp(y.cfLev/equity))},
    {label:"DSCR",unlev:yrs.map(_=>"—"),lev:yrs.map(y=>{const d=y.noi/annDebt;return isFinite(d)?d.toFixed(2)+"x":"—";})},
  ];

  const ltrYears=Array.from({length:numYears},(_,i)=>`Y${i+1}`);

  return(
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,flexWrap:"wrap",gap:8}}>
        <Presets selected={mkt} onSelect={onMkt} mob={mob}/>
        <div style={{display:"flex",gap:4,alignItems:"center"}}>
          <span style={{fontSize:9,fontWeight:800,color:DIM,textTransform:"uppercase",letterSpacing:"0.07em",marginRight:4}}>Projection</span>
          {[3,4,5].map(y=>(
            <button key={y} onClick={()=>setNumYears(y)} style={{
              background:numYears===y?"#0a1828":"#040b12",
              border:`1px solid ${numYears===y?"#2a5a9a":"#172030"}`,
              borderRadius:6,padding:"4px 9px",fontSize:10,
              color:numYears===y?"#7ab0e8":DIM,cursor:"pointer",
              fontFamily:"inherit",fontWeight:numYears===y?700:400,
            }}>{y}yr</button>
          ))}
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:mob?"1fr":"285px 1fr",gap:20,minWidth:0}}>
        <div style={{minWidth:0}}>
          <div style={sectionSt}>Acquisition</div>
          <Num label="Purchase Price" value={price} onChange={setPrice} step={5000}/>
          <Num label="Closing Costs" value={closePct} onChange={setClosePct} pre="" suf="%" step={0.5}/>

          <div style={sectionSt}>Revenue</div>
          <Num label="Monthly Rent (USD)" value={rent} onChange={setRent} step={50}/>

          <div style={sectionSt}>Expenses</div>
          <G3 mob={mob}>
            <Num label="Vacancy %" value={vacPct} onChange={setVacPct} pre="" suf="%" step={1}/>
            <Num label="Management %" value={mgmtPct} onChange={setMgmtPct} pre="" suf="%" step={1}/>
            <Num label="Maintenance %" value={maintPct} onChange={setMaintPct} pre="" suf="%" step={1}/>
          </G3>
          <G2 mob={mob}>
            <Num label="Utilities $/yr" value={utilitiesAmt} onChange={setUtilitiesAmt} step={100}/>
            <Num label="Insurance $/yr" value={insuranceAmt} onChange={setInsuranceAmt} step={100}/>
          </G2>
          <Num label="Taxes $/yr" value={taxesAmt} onChange={setTaxesAmt} step={100}/>
          {taxesAmt===0&&!confotur&&autoIpi>0&&<div style={{fontSize:9,color:DIM,marginTop:-4,marginBottom:4}}>Auto IPI: {f$(autoIpi)}/yr · Set above to override</div>}
          {confotur&&<div style={{fontSize:9,color:G,marginTop:-4,marginBottom:4}}>✓ IPI waived via CONFOTUR · {f$(conSave)} saved on purchase</div>}
          <button onClick={()=>setShowConfotur(v=>!v)} style={{background:"none",border:"none",padding:"2px 0",marginBottom:8,cursor:"pointer",display:"flex",alignItems:"center",gap:4,fontFamily:"inherit"}}>
            <span style={{fontSize:9,color:DIM,fontWeight:700}}>{showConfotur?"▾":"▸"} Advanced: CONFOTUR</span>
            <span title="CONFOTUR (Law 158-01): 15-year tax exemption for tourism-eligible properties in the Dominican Republic. Typically saves 3% of purchase price in transfer taxes + waives annual IPI property tax." style={{fontSize:10,color:DIM,cursor:"help"}}>ⓘ</span>
          </button>
          {showConfotur&&<div style={{background:"#040b12",border:"1px solid #0c1a26",borderRadius:8,padding:"8px 12px",marginBottom:8,marginTop:-4}}>
            <Toggle label="CONFOTUR Property?" value={confotur} onChange={v=>{setConfotur(v);if(v)setTaxesAmt(0);}}/>
          </div>}
          <div style={{fontSize:9,color:DIM,marginBottom:8,lineHeight:1.5}}>Fixed costs +4%/yr</div>

          <div style={sectionSt}>Leverage</div>
          <G3 mob={mob}>
            <Num label="Down %" value={downPct} onChange={setDownPct} pre="" suf="%" step={5}/>
            <Num label="Rate (USD)" value={intRate} onChange={setIntRate} pre="" suf="%" step={0.25}/>
            <Num label="Term (yr)" value={termYrs} onChange={setTermYrs} pre="" suf="yr" step={5}/>
          </G3>

          <ScoreSettings show={showSettings} onToggle={()=>setShowSettings(v=>!v)} rows={[
            {label:"Gross Yield",passKey:"grossYieldPass",warnKey:"grossYieldWarn",unit:"%",settings:ss,setSettings:setSS},
            {label:"Cap Rate",passKey:"capRatePass",warnKey:"capRateWarn",unit:"%",settings:ss,setSettings:setSS},
            {label:"Unlev CoC",passKey:"uccPass",warnKey:"uccWarn",unit:"%",settings:ss,setSettings:setSS},
            {label:"Lev CoC",passKey:"lcocPass",warnKey:"lcocWarn",unit:"%",settings:ss,setSettings:setSS},
            {label:"DSCR",passKey:"dscrPass",warnKey:"dscrWarn",unit:"x",settings:ss,setSettings:setSS},
          ]}/>
        </div>

        <div style={{minWidth:0}}>
          <DealScore checks={checks}/>
          <div style={sectionSt}>Deal Metrics</div>
          {checks.map((c,i)=><HealthCheck key={i} {...c}/>)}
          <div style={sectionSt}>Snapshot</div>
          <KPIGrid items={[
            {label:"Cash In (Unlev)",val:f$(totalIn)},
            {label:"Equity In (Lev)",val:f$(equity),sub:`Loan ${f$(loan)}`},
            {label:"Annual Rent",val:f$(rent*12)},
            {label:"NOI Y1",val:f$(y1.noi)},
            {label:"Levered CF Y1",val:f$(y1.cfLev),hi:true},
            {label:"DSCR Y1",val:isFinite(dscr)?dscr.toFixed(2)+"x":"—"},
            {label:`${numYears}yr IRR (Unlev)`,val:irr_u?fp(irr_u):"—"},
            {label:`${numYears}yr IRR (Lev)`,val:irr_l?fp(irr_l):"—",hi:true},
          ]}/>
        </div>
      </div>
      <ProjTable rows={rows} years={ltrYears} mob={mob}/>
      <div style={{fontSize:9,color:DIM,marginTop:8,lineHeight:1.5}}>Y1 rent = 88% of annual (6-week vacancy) · Rent +3%/yr · Fixed costs +4%/yr</div>
    </div>
  );
}

// ─── Development ──────────────────────────────────────────────────────────────
function Dev({mob}){
  const [mkt,setMkt]=useState("Jarabacoa");
  const [devType,setDevType]=useState("villa");
  const [dur,setDur]=useState(3);
  const [landSqm,setLandSqm]=useState(800);
  const [landPsm,setLandPsm]=useState(80);
  const [buildSqm,setBuildSqm]=useState(185);
  const [buildPsm,setBuildPsm]=useState(850);
  const [numUnits,setNumUnits]=useState(1);
  const [horizSqm,setHorizSqm]=useState(500);
  const [horizPsm,setHorizPsm]=useState(25);
  const [extras,setExtras]=useState(29000);
  const [softPct,setSoftPct]=useState(9);
  const [contPct,setContPct]=useState(20);
  const [salePer,setSalePer]=useState(340000);
  const [presalePct,setPresalePct]=useState(40);
  const [lSqm,setLSqm]=useState(2000);
  const [lPsm,setLPsm]=useState(60);
  const [exitPsm,setExitPsm]=useState(100);
  const [carryPct,setCarryPct]=useState(3);
  const [showSettings,setShowSettings]=useState(false);
  const [ss,setSS]=useState({
    marginPass:20,marginWarn:15,
    rocPass:25,rocWarn:15,
    annRoiPass:9,annRoiWarn:6,
    totalRoiPass:25,totalRoiWarn:15,
  });

  const onMkt=(n,d)=>{setMkt(n);setLandPsm(d.land);setBuildPsm(d.build);setHorizPsm(d.horiz);};

  const isComInd=devType==="com"||devType==="ind";

  const handleTypeChange=(t)=>{
    setDevType(t);
    if(t==="com"){setBuildPsm(700);setExtras(25000);setNumUnits(1);setBuildSqm(500);}
    else if(t==="ind"){setBuildPsm(500);setExtras(15000);setNumUnits(1);setBuildSqm(1000);}
    else if(t==="villa"){setBuildPsm(850);setExtras(29000);setBuildSqm(185);}
    else if(t==="multi"){setBuildPsm(850);setExtras(20000);setBuildSqm(120);}
  };

  const cSplit={2:[.55,.45],3:[.40,.40,.20],4:[.30,.35,.25,.10],5:[.25,.25,.20,.20,.10]};
  const rSplit={
    2:[presalePct/100,1-presalePct/100],
    3:[presalePct*.4/100,presalePct*.6/100,1-presalePct/100],
    4:[presalePct*.3/100,presalePct*.3/100,presalePct*.4/100,1-presalePct/100],
    5:[presalePct*.2/100,presalePct*.2/100,presalePct*.3/100,presalePct*.3/100,1-presalePct/100],
  };

  const r=useMemo(()=>{
    const comInd=devType==="com"||devType==="ind";
    if(devType==="land"){
      const acq=lSqm*lPsm, cl=acq*.05, inv=acq+cl, ac=inv*carryPct/100;
      const tc=inv+ac*dur, ev=lSqm*exitPsm, pr=ev-tc;
      const roi=pr/tc, ann=Math.pow(1+roi,1/dur)-1;
      return{t:"land",acq,cl,inv,ac,tc,ev,pr,roi,ann};
    }
    const land=landSqm*landPsm;
    const horiz=devType==="multi"?horizSqm*horizPsm:0;
    const con=buildSqm*buildPsm*(comInd?1:numUnits);
    const hard=land+con+horiz+extras;
    const soft=hard*softPct/100, cont=(hard+soft)*contPct/100, tc=hard+soft+cont;
    const rev=comInd?salePer:salePer*numUnits;
    const pr=rev-tc;
    return{
      t:devType,land,horiz,con,extras,hard,soft,cont,tc,rev,pr,
      margin:rev>0?pr/rev:0, roc:tc>0?pr/tc:0,
      cpu:comInd?(buildSqm>0?tc/buildSqm:0):(numUnits>0?tc/numUnits:0),
    };
  },[devType,dur,landSqm,landPsm,buildSqm,buildPsm,numUnits,horizSqm,horizPsm,extras,softPct,contPct,salePer,presalePct,lSqm,lPsm,exitPsm,carryPct]);

  const durCols=Array.from({length:dur},(_,i)=>`Y${i+1}`);
  const cs=cSplit[dur], rs=rSplit[dur];
  let checks=[], rows=[];

  if(r.t==="land"){
    checks=[
      {label:"Annualized ROI",value:fp(r.ann),grade:chk(r.ann,ss.annRoiPass/100,ss.annRoiWarn/100),sub:`Over ${dur}yr · DR prime: 9–13%/yr`},
      {label:"Total ROI",value:fp(r.roi),grade:chk(r.roi,ss.totalRoiPass/100,ss.totalRoiWarn/100),sub:`Target ≥${ss.totalRoiPass}% total`},
      {label:"Exit Cover",value:(r.ev/r.tc).toFixed(2)+"x",grade:chk(r.ev/r.tc-1,ss.totalRoiPass/100,ss.totalRoiWarn/100)},
    ];
    const ys=Array.from({length:dur},(_,i)=>i+1);
    const cashOut=ys.map(y=>y===1?-(r.acq+r.cl):-r.ac);
    rows=[
      {label:"Cash Out",unlev:cashOut,lev:cashOut},
      {label:"Cum. Invested",unlev:ys.map(y=>-(r.inv+r.ac*(y-1))),lev:ys.map(y=>-(r.inv+r.ac*(y-1)))},
      {label:`Exit (Y${dur})`,unlev:ys.map(y=>y===dur?r.ev:"—"),lev:ys.map(y=>y===dur?r.ev:"—")},
      {label:"Net Profit",unlev:ys.map(y=>y===dur?r.pr:"—"),lev:ys.map(y=>y===dur?r.pr:"—"),type:"total"},
    ];
  } else {
    checks=[
      {label:"Gross Margin",value:fp(r.margin),grade:chk(r.margin,ss.marginPass/100,ss.marginWarn/100),sub:`Profit ÷ Revenue · target ≥${ss.marginPass}%`},
      {label:"Return on Cost",value:fp(r.roc),grade:chk(r.roc,ss.rocPass/100,ss.rocWarn/100),sub:`Profit ÷ Dev Cost · target ≥${ss.rocPass}%`},
      {label:"Revenue Cover",value:(r.rev/r.tc).toFixed(2)+"x",grade:chk(r.rev/r.tc-1,ss.marginPass/100,ss.marginWarn/100)},
      ...(devType==="multi"?[{label:"Margin per Unit",value:f$(r.pr/numUnits),grade:chk(r.pr/numUnits,salePer*.2,salePer*.1),sub:`Cost/unit ${f$(r.cpu)}`}]:[]),
      ...(isComInd?[{label:"Margin $/sqm",value:f$(buildSqm>0?r.pr/buildSqm:0),grade:chk(buildSqm>0?r.pr/buildSqm:0,buildSqm>0?salePer/buildSqm*.2:0,buildSqm>0?salePer/buildSqm*.1:0),sub:`Cost/sqm ${f$(r.cpu)}`}]:[]),
    ];
    const yCosts=cs.map(p=>r.tc*p);
    // com/ind: all revenue at completion; villa/multi: presale distribution
    const yRevs=isComInd
      ? cs.map((_,i)=>i===cs.length-1?r.rev:0)
      : rs.map(p=>r.rev*p);
    const cumPL=cs.map((_,i)=>yRevs.slice(0,i+1).reduce((a,b)=>a+b,0)-yCosts.slice(0,i+1).reduce((a,b)=>a+b,0));
    rows=[
      {label:"Build Costs",unlev:yCosts.map(v=>-v),lev:yCosts.map(v=>-v)},
      {label:"Sales Revenue",unlev:yRevs,lev:yRevs},
      {label:"Net CF",unlev:cs.map((_,i)=>yRevs[i]-yCosts[i]),lev:cs.map((_,i)=>yRevs[i]-yCosts[i])},
      {label:"Cum. P&L",unlev:cumPL,lev:cumPL,type:"total"},
    ];
  }

  // Bidirectional: salePer is primary; salePsm is derived + editable
  const salePsm=buildSqm>0?Math.round(salePer/buildSqm):0;
  const handleSalePsm=v=>setSalePer(Math.round(v*buildSqm));

  const typeButtons=[
    ["villa","🏡 Villa"],["multi","🏢 Multi"],["land","🌿 Land"],
    ["com","🏬 Commercial"],["ind","🏭 Industrial"],
  ];

  return(
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10,flexWrap:"wrap",gap:8}}>
        <Presets selected={mkt} onSelect={onMkt} mob={mob}/>
        <div style={{display:"flex",gap:4,alignItems:"center"}}>
          <span style={{fontSize:9,fontWeight:800,color:DIM,textTransform:"uppercase",letterSpacing:"0.07em",marginRight:4}}>Timeline</span>
          {[2,3,4,5].map(y=>(
            <button key={y} onClick={()=>setDur(y)} style={{
              background:dur===y?"#0a1828":"#040b12",
              border:`1px solid ${dur===y?"#2a5a9a":"#172030"}`,
              borderRadius:6,padding:"4px 9px",fontSize:10,
              color:dur===y?"#7ab0e8":DIM,
              cursor:"pointer",fontFamily:"inherit",fontWeight:dur===y?700:400,
            }}>{y}yr</button>
          ))}
        </div>
      </div>
      <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:14}}>
        {typeButtons.map(([id,lbl])=>(
          <button key={id} onClick={()=>handleTypeChange(id)} style={{
            background:devType===id?"#0a1828":"#040b12",
            border:`1px solid ${devType===id?"#2a5a9a":"#172030"}`,
            borderRadius:8,padding:"5px 10px",fontSize:11,
            color:devType===id?"#7ab0e8":DIM,
            cursor:"pointer",fontFamily:"inherit",fontWeight:devType===id?700:400,
          }}>{lbl}</button>
        ))}
      </div>

      <div style={{display:"grid",gridTemplateColumns:mob?"1fr":"285px 1fr",gap:20,minWidth:0}}>
        <div style={{minWidth:0}}>
          {devType!=="land"&&<>
            <div style={sectionSt}>Land</div>
            <G2 mob={mob}>
              <Num label="Area (sqm)" value={landSqm} onChange={setLandSqm} pre="" step={50}/>
              <Num label="$/sqm" value={landPsm} onChange={setLandPsm} step={5}/>
            </G2>
            {devType==="multi"&&<>
              <div style={sectionSt}>Horizontal Infrastructure</div>
              <G2 mob={mob}>
                <Num label="Infra (sqm)" value={horizSqm} onChange={setHorizSqm} pre="" step={50}/>
                <Num label="$/sqm ($20–35)" value={horizPsm} onChange={setHorizPsm} step={1}/>
              </G2>
              <div style={{fontSize:9,color:DIM,marginTop:-4,marginBottom:8}}>Roads, drainage, utilities, lighting</div>
            </>}
            <div style={sectionSt}>Construction</div>
            <G2 mob={mob}>
              <Num
                label={isComInd?"Total Build (sqm)":devType==="multi"?"sqm/unit":"Build (sqm)"}
                value={buildSqm} onChange={setBuildSqm} pre="" step={10}/>
              <Num label="$/sqm" value={buildPsm} onChange={setBuildPsm} step={25}/>
            </G2>
            {devType==="multi"&&<Num label="Number of Units" value={numUnits} onChange={setNumUnits} pre="" step={1} min={1}/>}
            <Num
              label={isComInd?"Fit-out + Parking + Extras":devType==="villa"?"Pool + Landscape + Extras":"Common Areas + Extras"}
              value={extras} onChange={setExtras} step={1000}/>
            <G2 mob={mob}>
              <Num label="Soft Costs" value={softPct} onChange={setSoftPct} pre="" suf="% hard" step={1}/>
              <Num label="Contingency" value={contPct} onChange={setContPct} pre="" suf="% total" step={5}/>
            </G2>
            <div style={sectionSt}>Exit — {isComInd?"Sale Price":"Sell by Unit (DR Model)"}</div>
            <G2 mob={mob}>
              <Num
                label={isComInd?"Total Sale Price":"Sale Price/Unit"}
                value={salePer} onChange={setSalePer} step={5000}/>
              <Num label="Sale $/sqm" value={salePsm} onChange={handleSalePsm} step={10}/>
            </G2>
            {!isComInd&&(
              <G2 mob={mob}>
                <Num label="Pre-Sale %" value={presalePct} onChange={setPresalePct} pre="" suf="%" step={5}/>
                <div/>
              </G2>
            )}
          </>}
          {devType==="land"&&<>
            <div style={sectionSt}>Land Acquisition</div>
            <G2 mob={mob}>
              <Num label="Area (sqm)" value={lSqm} onChange={setLSqm} pre="" step={100}/>
              <Num label="Buy $/sqm" value={lPsm} onChange={setLPsm} step={5}/>
            </G2>
            <Num label="Annual Carry Cost" value={carryPct} onChange={setCarryPct} pre="" suf="% invested" step={0.5}/>
            <div style={sectionSt}>Exit</div>
            <Num label="Exit $/sqm" value={exitPsm} onChange={setExitPsm} step={5}/>
          </>}

          <ScoreSettings show={showSettings} onToggle={()=>setShowSettings(v=>!v)} rows={
            devType==="land"?[
              {label:"Ann. ROI",passKey:"annRoiPass",warnKey:"annRoiWarn",unit:"%",settings:ss,setSettings:setSS},
              {label:"Total ROI",passKey:"totalRoiPass",warnKey:"totalRoiWarn",unit:"%",settings:ss,setSettings:setSS},
            ]:[
              {label:"Gross Margin",passKey:"marginPass",warnKey:"marginWarn",unit:"%",settings:ss,setSettings:setSS},
              {label:"Return/Cost",passKey:"rocPass",warnKey:"rocWarn",unit:"%",settings:ss,setSettings:setSS},
            ]
          }/>
        </div>

        <div style={{minWidth:0}}>
          <DealScore checks={checks}/>
          <div style={sectionSt}>Deal Metrics</div>
          {checks.map((c,i)=><HealthCheck key={i} {...c}/>)}
          <div style={sectionSt}>Budget Summary</div>
          {r.t!=="land"?(
            <>
              <KPIGrid items={[
                {label:"Total Dev Cost",val:f$(r.tc)},
                {label:"Total Revenue",val:f$(r.rev)},
                {label:"Developer Profit",val:f$(r.pr),hi:true},
                {label:"Return on Cost",val:fp(r.roc)},
              ]}/>
              <div style={{fontSize:9,color:DIM,background:"#040b12",borderRadius:6,padding:"5px 10px",lineHeight:1.8,marginTop:-6,wordBreak:"break-word"}}>
                {[
                  "Land: "+f$(r.land),
                  devType==="multi"?"Infra: "+f$(r.horiz):null,
                  "Build: "+f$(r.con),
                  r.extras>0?"Extras: "+f$(r.extras):null,
                  "Soft: "+f$(r.soft),
                  "Cont: "+f$(r.cont),
                ].filter(Boolean).join(" · ")}
              </div>
            </>
          ):(
            <KPIGrid items={[
              {label:"Total Cost",val:f$(r.tc),sub:f$(Math.round(r.tc/lSqm))+"/sqm"},
              {label:"Exit Value",val:f$(r.ev),sub:f$(exitPsm)+"/sqm"},
              {label:"Gross Profit",val:f$(r.pr),hi:true},
              {label:"Ann. ROI",val:fp(r.ann)},
            ]}/>
          )}
        </div>
      </div>
      <ProjTable rows={rows} years={durCols} mob={mob}/>
      <div style={{fontSize:9,color:DIM,marginTop:8,lineHeight:1.5}}>
        {devType==="multi"?"🇩🇴 DR Multi-family: sell-by-unit model · Pre-sales fund construction cash flow":
         devType==="villa"?"⚠ Real contingency is 20–25% min · Budget access road + clearing separately":
         devType==="com"?"🏬 Commercial: revenue recognized at completion · Tenant pre-commitment reduces risk":
         devType==="ind"?"🏭 Industrial: DR Free Trade Zone adjacency adds premium · 8m+ clear height standard":
         "⚠ Land: no cash flow during hold · entitlement timeline is the #1 risk"}
      </div>
    </div>
  );
}

// ─── Commercial ───────────────────────────────────────────────────────────────
function Commercial({mob}){
  const [comType,setComType]=useState("com");
  const [mkt,setMkt]=useState("Jarabacoa");
  const [price,setPrice]=useState(500000);
  const [closePct,setClosePct]=useState(6);
  const [monthRent,setMonthRent]=useState(4500);
  const [vacPct,setVacPct]=useState(5);
  const [mgmtPct,setMgmtPct]=useState(8);
  const [maintPct,setMaintPct]=useState(5);
  const [utilitiesAmt,setUtilitiesAmt]=useState(2400);
  const [insuranceAmt,setInsuranceAmt]=useState(1200);
  const [taxesAmt,setTaxesAmt]=useState(0);
  const [confotur,setConfotur]=useState(false);
  const [showConfotur,setShowConfotur]=useState(false);
  const [rentGrow,setRentGrow]=useState(3);
  const [exitCap,setExitCap]=useState(8.5);
  const [downPct,setDownPct]=useState(35);
  const [intRate,setIntRate]=useState(9.5);
  const [termYrs,setTermYrs]=useState(15);
  const [numYears,setNumYears]=useState(5);
  const [showSettings,setShowSettings]=useState(false);
  const [ss,setSS]=useState({
    capRatePass:8,capRateWarn:6,
    uccPass:6,uccWarn:4,
    lcocPass:8,lcocWarn:5,
    dscrPass:1.25,dscrWarn:1.0,
    exitCoverPass:1.3,exitCoverWarn:1.1,
  });

  const onMkt=(n,d)=>{setMkt(n);setMonthRent(Math.round(d.rent*2.8));};

  const handleTypeChange=(t)=>{
    setComType(t);
    if(t==="ind"){
      setSS(s=>({...s,capRatePass:9,capRateWarn:7,uccPass:7,uccWarn:5,lcocPass:9,lcocWarn:6}));
      setVacPct(8);setMgmtPct(6);setMaintPct(4);
    } else {
      setSS(s=>({...s,capRatePass:8,capRateWarn:6,uccPass:6,uccWarn:4,lcocPass:8,lcocWarn:5}));
      setVacPct(5);setMgmtPct(8);setMaintPct(5);
    }
  };

  const conSave=confotur?price*0.03:0;
  const closing=price*closePct/100, totalIn=price+closing-conSave;
  const loan=price*(1-downPct/100), annDebt=mortgageAnn(loan,intRate,termYrs);
  const equity=price*(downPct/100)+closing-conSave;
  const ipi=Math.max(0,(price-177000)*0.01);
  const effectiveTaxes=confotur?0:(taxesAmt>0?taxesAmt:ipi);

  const calcYr=y=>{
    const rg=Math.pow(1+rentGrow/100,y-1), eg=Math.pow(1.04,y-1);
    const gross=monthRent*12*rg;
    const vac=gross*vacPct/100, egi=gross-vac;
    const varExp=egi*(mgmtPct+maintPct)/100;
    const fixedExp=(utilitiesAmt+insuranceAmt+effectiveTaxes)*eg;
    const noi=egi-varExp-fixedExp;
    const cfLev=noi-annDebt;
    const exitVal=y===numYears?noi/(exitCap/100):null;
    return{gross,vac,varExp,fixedExp,noi,cfLev,exitVal,capRate:noi/totalIn,dscr:annDebt>0?noi/annDebt:Infinity};
  };
  const yrs=Array.from({length:numYears},(_,i)=>calcYr(i+1));
  const y1=yrs[0], yLast=yrs[numYears-1];

  const irr_u=calcIRR([-totalIn,...yrs.map((y,i)=>i===numYears-1?y.noi+(yLast.exitVal||0):y.noi)]);
  const irr_l=calcIRR([-equity,...yrs.map((y,i)=>i===numYears-1?y.cfLev+(yLast.exitVal||0)-loan:y.cfLev)]);

  const checks=[
    {label:"Going-in Cap Rate",value:fp(y1.capRate),grade:chk(y1.capRate,ss.capRatePass/100,ss.capRateWarn/100),sub:`DR ${comType==="ind"?"industrial":"commercial"} target: ${ss.capRateWarn}–${ss.capRatePass+2}%`},
    {label:"Unlevered CoC Y1",value:fp(y1.noi/totalIn),grade:chk(y1.noi/totalIn,ss.uccPass/100,ss.uccWarn/100),sub:`≥${ss.uccPass}% ✓  ${ss.uccWarn}–${ss.uccPass}% ⚠`},
    {label:"Levered CoC Y1",value:fp(y1.cfLev/equity),grade:chk(y1.cfLev/equity,ss.lcocPass/100,ss.lcocWarn/100),sub:`≥${ss.lcocPass}% ✓  ${ss.lcocWarn}–${ss.lcocPass}% ⚠`},
    {label:"DSCR Y1",value:isFinite(y1.dscr)?y1.dscr.toFixed(2)+"x":"—",grade:chk(y1.dscr,ss.dscrPass,ss.dscrWarn),sub:`Target ≥${ss.dscrPass}x`},
    {label:`Y${numYears} Exit Cover`,value:((yLast.exitVal||0)/totalIn).toFixed(2)+"x",grade:chk((yLast.exitVal||0)/totalIn,ss.exitCoverPass,ss.exitCoverWarn),sub:`@ ${exitCap}% cap`},
  ];

  const rows=[
    {label:"Gross Revenue",unlev:yrs.map(y=>y.gross),lev:yrs.map(y=>y.gross),type:"total"},
    {label:"Vacancy",unlev:yrs.map(y=>-y.vac),lev:yrs.map(y=>-y.vac)},
    {label:"Mgmt + Maint",unlev:yrs.map(y=>-y.varExp),lev:yrs.map(y=>-y.varExp)},
    {label:"Fixed Expenses",unlev:yrs.map(y=>-y.fixedExp),lev:yrs.map(y=>-y.fixedExp)},
    {label:"NOI",unlev:yrs.map(y=>y.noi),lev:yrs.map(y=>y.noi),type:"divider"},
    {label:"Debt Service",unlev:yrs.map(_=>"—"),lev:yrs.map(_=>-annDebt)},
    {label:"Cash Flow",unlev:yrs.map(y=>y.noi),lev:yrs.map(y=>y.cfLev),type:"total"},
    {label:"Cap Rate",unlev:yrs.map(y=>fp(y.capRate)),lev:yrs.map(y=>fp(y.capRate))},
    {label:"CoC Return",unlev:yrs.map(y=>fp(y.noi/totalIn)),lev:yrs.map(y=>fp(y.cfLev/equity))},
    {label:"DSCR",unlev:yrs.map(_=>"—"),lev:yrs.map(y=>isFinite(y.dscr)?y.dscr.toFixed(2)+"x":"—")},
    {label:`Exit Value Y${numYears}`,unlev:yrs.map(y=>y.exitVal||"—"),lev:yrs.map(y=>y.exitVal||"—")},
  ];

  const comYears=Array.from({length:numYears},(_,i)=>`Y${i+1}`);

  return(
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10,flexWrap:"wrap",gap:8}}>
        <Presets selected={mkt} onSelect={onMkt} mob={mob}/>
        <div style={{display:"flex",gap:4,alignItems:"center"}}>
          <span style={{fontSize:9,fontWeight:800,color:DIM,textTransform:"uppercase",letterSpacing:"0.07em",marginRight:4}}>Projection</span>
          {[3,4,5].map(y=>(
            <button key={y} onClick={()=>setNumYears(y)} style={{
              background:numYears===y?"#0a1828":"#040b12",
              border:`1px solid ${numYears===y?"#2a5a9a":"#172030"}`,
              borderRadius:6,padding:"4px 9px",fontSize:10,
              color:numYears===y?"#7ab0e8":DIM,cursor:"pointer",
              fontFamily:"inherit",fontWeight:numYears===y?700:400,
            }}>{y}yr</button>
          ))}
        </div>
      </div>
      <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:14}}>
        {[["com","🏬 Commercial"],["ind","🏭 Industrial"]].map(([id,lbl])=>(
          <button key={id} onClick={()=>handleTypeChange(id)} style={{
            background:comType===id?"#0a1828":"#040b12",
            border:`1px solid ${comType===id?"#2a5a9a":"#172030"}`,
            borderRadius:8,padding:"5px 14px",fontSize:11,
            color:comType===id?"#7ab0e8":DIM,
            cursor:"pointer",fontFamily:"inherit",fontWeight:comType===id?700:400,
          }}>{lbl}</button>
        ))}
      </div>
      <div style={{fontSize:9,color:DIM,marginBottom:14}}>
        {comType==="ind"
          ?"🏭 Industrial / warehouse · Adjust rent and vacancy to match asset · DR Free Trade Zone adjacency adds premium"
          :"🏬 Market preset anchors a reference rent. Adjust monthly rent below to match your actual deal."}
      </div>
      <div style={{display:"grid",gridTemplateColumns:mob?"1fr":"285px 1fr",gap:20,minWidth:0}}>
        <div style={{minWidth:0}}>
          <div style={sectionSt}>Acquisition</div>
          <Num label="Purchase Price" value={price} onChange={setPrice} step={10000}/>
          <Num label="Closing Costs" value={closePct} onChange={setClosePct} pre="" suf="%" step={0.5}/>

          <div style={sectionSt}>Lease / Revenue</div>
          <Num label="Monthly Rent (USD)" value={monthRent} onChange={setMonthRent} step={100}/>
          <Num label="Annual Rent Growth" value={rentGrow} onChange={setRentGrow} pre="" suf="%" step={0.5}/>

          <div style={sectionSt}>Expenses</div>
          <G3 mob={mob}>
            <Num label="Vacancy %" value={vacPct} onChange={setVacPct} pre="" suf="%" step={1}/>
            <Num label="Mgmt % EGI" value={mgmtPct} onChange={setMgmtPct} pre="" suf="%" step={1}/>
            <Num label="Maint % EGI" value={maintPct} onChange={setMaintPct} pre="" suf="%" step={1}/>
          </G3>
          <G2 mob={mob}>
            <Num label="Utilities $/yr" value={utilitiesAmt} onChange={setUtilitiesAmt} step={200}/>
            <Num label="Insurance $/yr" value={insuranceAmt} onChange={setInsuranceAmt} step={200}/>
          </G2>
          <Num label="Taxes $/yr" value={taxesAmt} onChange={setTaxesAmt} step={200}/>
          {taxesAmt===0&&!confotur&&<div style={{fontSize:9,color:DIM,marginTop:-4,marginBottom:4}}>Auto IPI: {f$(ipi)}/yr · Set above to override</div>}
          {confotur&&<div style={{fontSize:9,color:G,marginTop:-4,marginBottom:4}}>✓ IPI waived via CONFOTUR · {f$(conSave)} saved on purchase</div>}
          <button onClick={()=>setShowConfotur(v=>!v)} style={{background:"none",border:"none",padding:"2px 0",marginBottom:8,cursor:"pointer",display:"flex",alignItems:"center",gap:4,fontFamily:"inherit"}}>
            <span style={{fontSize:9,color:DIM,fontWeight:700}}>{showConfotur?"▾":"▸"} Advanced: CONFOTUR</span>
            <span title="CONFOTUR (Law 158-01): 15-year tax exemption for tourism-eligible properties in the Dominican Republic. Typically saves 3% of purchase price in transfer taxes + waives annual IPI property tax." style={{fontSize:10,color:DIM,cursor:"help"}}>ⓘ</span>
          </button>
          {showConfotur&&<div style={{background:"#040b12",border:"1px solid #0c1a26",borderRadius:8,padding:"8px 12px",marginBottom:8,marginTop:-4}}>
            <Toggle label="CONFOTUR Property?" value={confotur} onChange={v=>{setConfotur(v);if(v)setTaxesAmt(0);}}/>
          </div>}

          <div style={sectionSt}>Exit (Year {numYears})</div>
          <Num label="Exit Cap Rate" value={exitCap} onChange={setExitCap} pre="" suf="%" step={0.25}/>

          <div style={sectionSt}>Leverage</div>
          <G3 mob={mob}>
            <Num label="Down %" value={downPct} onChange={setDownPct} pre="" suf="%" step={5}/>
            <Num label="Rate" value={intRate} onChange={setIntRate} pre="" suf="%" step={0.25}/>
            <Num label="Term (yr)" value={termYrs} onChange={setTermYrs} pre="" suf="yr" step={5}/>
          </G3>

          <ScoreSettings show={showSettings} onToggle={()=>setShowSettings(v=>!v)} rows={[
            {label:"Cap Rate",passKey:"capRatePass",warnKey:"capRateWarn",unit:"%",settings:ss,setSettings:setSS},
            {label:"Unlev CoC",passKey:"uccPass",warnKey:"uccWarn",unit:"%",settings:ss,setSettings:setSS},
            {label:"Lev CoC",passKey:"lcocPass",warnKey:"lcocWarn",unit:"%",settings:ss,setSettings:setSS},
            {label:"DSCR",passKey:"dscrPass",warnKey:"dscrWarn",unit:"x",settings:ss,setSettings:setSS},
            {label:"Exit Cover",passKey:"exitCoverPass",warnKey:"exitCoverWarn",unit:"x",settings:ss,setSettings:setSS},
          ]}/>
        </div>

        <div style={{minWidth:0}}>
          <DealScore checks={checks}/>
          <div style={sectionSt}>Deal Metrics</div>
          {checks.map((c,i)=><HealthCheck key={i} {...c}/>)}

          <div style={sectionSt}>{numYears}-Year Snapshot</div>
          <KPIGrid items={[
            {label:"Cash In (Unlev)",val:f$(totalIn)},
            {label:"Equity In (Lev)",val:f$(equity),sub:`Loan ${f$(loan)}`},
            {label:"NOI Y1",val:f$(y1.noi)},
            {label:"Lev CF Y1",val:f$(y1.cfLev),hi:true},
            {label:`Exit Value Y${numYears}`,val:f$(yLast.exitVal),sub:`@ ${exitCap}% cap`},
            {label:`${numYears}yr NOI Total`,val:f$(yrs.reduce((a,y)=>a+y.noi,0))},
            {label:"IRR (Unlev+exit)",val:irr_u?fp(irr_u):"—"},
            {label:"IRR (Lev+exit)",val:irr_l?fp(irr_l):"—",hi:true},
          ]}/>
          <div style={{fontSize:9,color:DIM,lineHeight:1.5}}>
            {comType==="ind"
              ?"🏭 Industrial: NOI-based valuation · SD logistics corridor · Free Trade Zone adjacency"
              :"🏬 Commercial: NOI-based valuation (cap rate model) · SD: BPO + tourism supply chain demand"}
          </div>
        </div>
      </div>
      <ProjTable rows={rows} years={comYears} mob={mob}/>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
const TABS=[
  {id:"str",label:"Short-Term Rental",short:"STR",icon:"🏖"},
  {id:"ltr",label:"Long-Term Rental", short:"LTR",icon:"🏘"},
  {id:"dev",label:"Development",      short:"Dev",icon:"🏗"},
  {id:"com",label:"Commercial",       short:"Com",icon:"🏬"},
];

export default function App(){
  const [tab,setTab]=useState("str");
  const mob=useIsMobile();

  return(
    <div style={{
      background:"#030910",minHeight:"100vh",
      fontFamily:"'DM Sans','Segoe UI',sans-serif",color:"#c8ddf0",
      padding:mob?"12px 10px":"24px 22px",
      width:"100%",maxWidth:"100%",overflowX:"hidden",boxSizing:"border-box",
    }}>
      <style>{CSS}</style>

      <div style={{marginBottom:14}}>
        <div style={{fontSize:9,fontWeight:800,letterSpacing:"0.15em",color:G,textTransform:"uppercase",marginBottom:4}}>Cashflow Code</div>
        <h1 style={{fontSize:mob?17:22,fontWeight:800,margin:0,color:"#d8eaf8",letterSpacing:"-0.02em",lineHeight:1.2}}>Quick Deal Underwriting</h1>
        {!mob&&<div style={{fontSize:10,color:DIM,marginTop:4}}>Revenue · Expenses · Levered & Unlevered Returns</div>}
      </div>

      <div style={{display:"flex",borderBottom:"1px solid #0c1a26",marginBottom:0,
        overflowX:"auto",WebkitOverflowScrolling:"touch",msOverflowStyle:"none",scrollbarWidth:"none"}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{
            background:"transparent",border:"none",
            borderBottom:`2px solid ${tab===t.id?G:"transparent"}`,
            padding:mob?"10px 14px":"8px 18px",fontSize:12,
            color:tab===t.id?"#c8ddf0":DIM,
            cursor:"pointer",fontFamily:"inherit",fontWeight:tab===t.id?700:400,
            transition:"color .15s",marginBottom:-1,whiteSpace:"nowrap",flexShrink:0,
          }}>{t.icon} {mob?t.short:t.label}</button>
        ))}
      </div>

      <div style={{background:"#05101a",borderRadius:"0 0 12px 12px",border:"1px solid #0c1a26",borderTop:"none",
        padding:mob?"12px 10px":"22px 20px",minWidth:0,overflowX:"hidden"}}>
        {tab==="str"&&<STR mob={mob}/>}
        {tab==="ltr"&&<LTR mob={mob}/>}
        {tab==="dev"&&<Dev mob={mob}/>}
        {tab==="com"&&<Commercial mob={mob}/>}
      </div>

    </div>
  );
}
