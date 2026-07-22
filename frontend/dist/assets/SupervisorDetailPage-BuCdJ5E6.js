import{n as B,f as G,r as p,a as C,j as e,g as _,d as H,P as q,h as I,U as J,F,T as K,i as Q,k as V}from"./index-JmZmwAGH.js";import{A as X}from"./arrow-right-D2e5PSDh.js";import{P as Z}from"./printer-DeqCFv_g.js";import{C as ee,a as te,b as se}from"./chevrons-right-CPW7Lg2K.js";import{F as ae}from"./filter-dWg7LmYN.js";import{S as le}from"./search-5J6lfjwE.js";const L=["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"],A=new Date().getFullYear(),ie=Array.from({length:6},(t,r)=>A-r);function ne({filters:t,onChange:r,onApply:a,loading:d}){const{filterType:x,year:v,month:f,day:b,dateFrom:o,dateTo:u}=t;return e.jsxs("div",{className:"glass-card p-5 space-y-4",children:[e.jsxs("div",{className:"flex items-center gap-2 mb-1",children:[e.jsx(ae,{size:16,className:"text-brand-blue"}),e.jsx("h3",{className:"font-cairo font-semibold text-white text-sm",children:"فلترة التقرير"})]}),e.jsx("div",{className:"flex flex-wrap gap-2",children:[{id:"all",label:"الكل"},{id:"yearly",label:"سنوي"},{id:"monthly",label:"شهري"},{id:"day",label:"يوم محدد"},{id:"range",label:"نطاق تاريخ"}].map(({id:l,label:j})=>e.jsx("button",{onClick:()=>r({...t,filterType:l}),className:`px-4 py-1.5 rounded-xl text-sm font-medium transition-all ${x===l?"bg-brand-blue text-white shadow-neon":"bg-white/5 text-white/50 hover:bg-white/10 hover:text-white"}`,children:j},l))}),(x==="yearly"||x==="monthly")&&e.jsxs("div",{className:"grid grid-cols-2 gap-3",children:[e.jsxs("div",{children:[e.jsx("label",{className:"text-white/40 text-xs mb-1 block",children:"السنة"}),e.jsxs("select",{value:v,onChange:l=>r({...t,year:l.target.value}),className:"input-glass text-sm",children:[e.jsx("option",{value:"",children:"كل السنوات"}),ie.map(l=>e.jsx("option",{value:l,children:l},l))]})]}),x==="monthly"&&e.jsxs("div",{children:[e.jsx("label",{className:"text-white/40 text-xs mb-1 block",children:"الشهر"}),e.jsxs("select",{value:f,onChange:l=>r({...t,month:l.target.value}),className:"input-glass text-sm",children:[e.jsx("option",{value:"",children:"كل الشهور"}),L.map((l,j)=>e.jsx("option",{value:j+1,children:l},j+1))]})]})]}),x==="day"&&e.jsxs("div",{children:[e.jsx("label",{className:"text-white/40 text-xs mb-1 block",children:"اختر يوماً"}),e.jsx("input",{type:"date",value:b,onChange:l=>r({...t,day:l.target.value}),className:"input-glass text-sm"})]}),x==="range"&&e.jsxs("div",{className:"grid grid-cols-2 gap-3",children:[e.jsxs("div",{children:[e.jsx("label",{className:"text-white/40 text-xs mb-1 block",children:"من تاريخ"}),e.jsx("input",{type:"date",value:o,onChange:l=>r({...t,dateFrom:l.target.value}),className:"input-glass text-sm"})]}),e.jsxs("div",{children:[e.jsx("label",{className:"text-white/40 text-xs mb-1 block",children:"إلى تاريخ"}),e.jsx("input",{type:"date",value:u,onChange:l=>r({...t,dateTo:l.target.value}),className:"input-glass text-sm"})]})]}),e.jsxs("button",{onClick:a,disabled:d,className:"btn-primary w-full justify-center",children:[d?e.jsx(_,{size:15,className:"animate-spin"}):e.jsx(le,{size:15}),d?"جاري التحميل...":"تطبيق الفلتر"]})]})}function re({students:t,loading:r,offset:a=0}){return r?e.jsxs("div",{className:"py-16 text-center",children:[e.jsx(_,{size:30,className:"animate-spin text-brand-blue mx-auto mb-3"}),e.jsx("p",{className:"text-white/40 text-sm",children:"جاري تحميل التقرير..."})]}):t.length?e.jsx("div",{className:"overflow-x-auto",children:e.jsxs("table",{className:"w-full text-sm",children:[e.jsx("thead",{children:e.jsxs("tr",{className:"border-b border-white/08",children:[e.jsx("th",{className:"text-right text-white/40 font-medium py-3 px-4 text-xs",children:"#"}),e.jsx("th",{className:"text-right text-white/40 font-medium py-3 px-4 text-xs",children:"اسم الطالب"}),e.jsx("th",{className:"text-right text-white/40 font-medium py-3 px-4 text-xs",children:"رقم الهاتف"}),e.jsx("th",{className:"text-right text-white/40 font-medium py-3 px-4 text-xs",children:"الفصل / المرحلة"}),e.jsx("th",{className:"text-right text-white/40 font-medium py-3 px-4 text-xs",children:"النظام"}),e.jsx("th",{className:"text-right text-white/40 font-medium py-3 px-4 text-xs",children:"تاريخ التسجيل"})]})}),e.jsx("tbody",{className:"divide-y divide-white/05",children:t.map((d,x)=>e.jsxs("tr",{className:"hover:bg-white/3 transition-colors group",children:[e.jsx("td",{className:"py-3 px-4 text-white/30 text-xs",children:a+x+1}),e.jsx("td",{className:"py-3 px-4",children:e.jsx("span",{className:"text-white font-medium",children:d.student_name})}),e.jsx("td",{className:"py-3 px-4",dir:"ltr",children:e.jsx("span",{className:"text-white/60 text-xs",children:d.phone})}),e.jsxs("td",{className:"py-3 px-4",children:[e.jsx("div",{className:"text-white/70 text-xs",children:d.enrolled_grade}),d.enrolled_grade_level&&d.enrolled_grade_level!=="—"&&e.jsx("div",{className:"text-white/35 text-xs mt-0.5",children:d.enrolled_grade_level})]}),e.jsx("td",{className:"py-3 px-4",children:e.jsx("span",{className:`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-medium ${d.system_type==="أونلاين"?"bg-brand-blue/15 text-brand-blue":"bg-brand-red/15 text-brand-red"}`,children:d.system_type})}),e.jsx("td",{className:"py-3 px-4 text-white/40 text-xs",dir:"ltr",children:d.registered_at})]},x))})]})}):e.jsxs("div",{className:"py-16 text-center",children:[e.jsx(F,{size:40,className:"mx-auto mb-3 text-white/15"}),e.jsx("p",{className:"text-white/40",children:"لا توجد بيانات للفترة المحددة."})]})}const N="border:1px solid #bbb;padding:6px 10px;text-align:right;vertical-align:middle;color:#111;font-weight:500;";function de(t,r,a){const d=new Date().toLocaleDateString("ar-SA",{year:"numeric",month:"long",day:"numeric"}),x=r.map((o,u)=>`
    <tr style="background:${u%2===0?"#fff":"#f2f2f2"}">
      <td style="${N}color:#555;font-weight:700;text-align:center">${u+1}</td>
      <td style="${N}font-weight:700;color:#000">${o.student_name||"—"}</td>
      <td style="${N}direction:ltr;text-align:left;font-weight:600;color:#222">${o.phone||"—"}</td>
      <td style="${N}font-weight:600">${o.enrolled_grade||"—"}</td>
      <td style="${N}color:#444;font-weight:600">${o.enrolled_grade_level||"—"}</td>
      <td style="${N}">
        <span style="padding:2px 8px;border-radius:4px;border:1.5px solid #666;font-size:9.5pt;font-weight:700;color:#111;display:inline-block">${o.system_type||"—"}</span>
      </td>
      <td style="${N}direction:ltr;text-align:left;color:#333;font-weight:600">${o.registered_at||"—"}</td>
    </tr>`).join(""),v=r.length===0?'<tr><td colspan="7" style="text-align:center;padding:24px;color:#aaa">لا يوجد طلاب</td></tr>':"",f=`<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8" />
  <title>تقرير المشرفة — ${(t==null?void 0:t.name)||""}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap" rel="stylesheet">
  <style>
    /* Suppress browser URL/date header+footer */
    @page {
      size: A4;
      margin: 14mm 12mm 14mm 12mm;
    }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Cairo', Tahoma, Arial, sans-serif;
      font-size: 11pt;
      font-weight: 500;
      line-height: 1.55;
      color: #111;
      background: #fff;
      direction: rtl;
    }
    .report-header {
      text-align: center;
      border-bottom: 2.5px solid #1a5fa8;
      padding-bottom: 14px;
      margin-bottom: 20px;
    }
    .report-header h1 {
      font-size: 22pt;
      font-weight: 800;
      color: #000;
      letter-spacing: -0.5px;
    }
    .report-header .subtitle {
      font-size: 12pt;
      color: #222;
      margin-top: 6px;
      font-weight: 700;
    }
    .report-header .date {
      font-size: 9.5pt;
      font-weight: 500;
      color: #555;
      margin-top: 3px;
    }
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px 16px;
      background: #eef3fa;
      border: 1px solid #b8cde0;
      border-radius: 6px;
      padding: 12px 16px;
      margin-bottom: 20px;
      font-size: 10.5pt;
    }
    .info-grid .label { color: #444; font-weight: 600; }
    .info-grid .value { font-weight: 800; color: #000; }
    .info-grid .value.blue { color: #1a4fa0; }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10.5pt;
    }
    thead tr {
      background: #1a2e4a;
      color: #fff;
    }
    thead th {
      padding: 8px 10px;
      text-align: right;
      font-weight: 800;
      font-size: 10.5pt;
      border: 1px solid #1a2e4a;
    }
    tbody td {
      padding: 7px 10px;
      border: 1px solid #bbb;
      text-align: right;
      vertical-align: middle;
      color: #111;
      font-weight: 500;
    }
    tbody tr:nth-child(even) td { background: #f2f2f2; }
    tbody tr:nth-child(odd)  td { background: #fff; }
    .badge {
      padding: 2px 8px;
      border-radius: 4px;
      border: 1.5px solid #666;
      font-size: 9.5pt;
      font-weight: 700;
      display: inline-block;
      color: #111;
    }
    .report-footer {
      margin-top: 22px;
      padding-top: 10px;
      border-top: 1px solid #bbb;
      font-size: 8.5pt;
      font-weight: 600;
      color: #555;
      text-align: center;
    }
    /* Repeat header on each printed page */
    thead { display: table-header-group; }
    tfoot { display: table-footer-group; }
  </style>
</head>
<body>

  <div class="report-header">
    <h1>مدارس ومعاهد نمبر ون</h1>
    <p class="subtitle">تقرير طلاب المشرفة — ${a}</p>
    <p class="date">${d}</p>
  </div>

  <div class="info-grid">
    <div><span class="label">المشرفة: </span><span class="value">${(t==null?void 0:t.name)||"—"}</span></div>
    <div><span class="label">الهاتف: </span><span class="value" dir="ltr">${(t==null?void 0:t.phone)||"—"}</span></div>
    <div><span class="label">العنوان: </span><span class="value">${(t==null?void 0:t.address)||"—"}</span></div>
    <div><span class="label">إجمالي الطلاب: </span><span class="value blue">${r.length}</span></div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:38px">#</th>
        <th>اسم الطالب</th>
        <th style="width:130px;direction:ltr;text-align:left">الهاتف</th>
        <th>الفصل</th>
        <th>المرحلة</th>
        <th style="width:80px">النظام</th>
        <th style="width:110px;direction:ltr;text-align:left">تاريخ التسجيل</th>
      </tr>
    </thead>
    <tbody>
      ${x}
      ${v}
    </tbody>
  </table>

  <div class="report-footer">
    نظام مدارس ومعاهد نمبر ون &mdash; تقرير مولَّد بتاريخ ${d} &mdash; عدد السجلات: ${r.length}
  </div>

  <script>
    // Wait for Google Font then print
    window.addEventListener('load', function () {
      setTimeout(function () { window.print(); window.close(); }, 600);
    });
  <\/script>
</body>
</html>`,b=window.open("","_blank","width=900,height=700");if(!b){alert("يرجى السماح بالنوافذ المنبثقة لهذا الموقع لطباعة التقرير.");return}b.document.open(),b.document.write(f),b.document.close()}function ge(){const{id:t}=B(),r=G(),[a,d]=p.useState(null),[x,v]=p.useState(!0),[f,b]=p.useState(null),[o,u]=p.useState(!1),[l,j]=p.useState(!1),[c,y]=p.useState(1),[g,E]=p.useState(20),[$,D]=p.useState({total:0,total_pages:1}),[n,M]=p.useState({filterType:"all",year:String(A),month:"",day:"",dateFrom:"",dateTo:""});p.useEffect(()=>{v(!0),C.get(`/supervisors/${t}/`).then(({data:s})=>d(s)).catch(()=>r("/dashboard/supervisors",{replace:!0})).finally(()=>v(!1))},[t]);const S=(s,m=c,z=g)=>{const h={page:m,page_size:z};return s.filterType!=="all"&&(h.filter_type=s.filterType),(s.filterType==="yearly"||s.filterType==="monthly")&&(s.year&&(h.year=s.year),s.month&&(h.month=s.month)),s.filterType==="day"&&s.day&&(h.day=s.day),s.filterType==="range"&&(s.dateFrom&&(h.date_from=s.dateFrom),s.dateTo&&(h.date_to=s.dateTo)),h},k=p.useCallback((s=n,m=c,z=g)=>{u(!0),C.get(`/supervisors/${t}/report/`,{params:S(s,m,z)}).then(({data:h})=>{b(h),D({total:h.total,total_pages:h.total_pages})}).catch(()=>alert("تعذّر تحميل التقرير.")).finally(()=>u(!1))},[t,n,c,g]);p.useEffect(()=>{t&&k(n,1,g)},[t]),p.useEffect(()=>{f!==null&&k(n,c,g)},[c]);const P=()=>n.filterType==="yearly"?`السنة ${n.year||"الكاملة"}`:n.filterType==="monthly"?`${n.month?L[Number(n.month)-1]:"كل الشهور"} ${n.year||""}`:n.filterType==="day"?n.day?`يوم ${n.day}`:"يوم محدد":n.filterType==="range"?`${n.dateFrom||"—"} إلى ${n.dateTo||"—"}`:"جميع الفترات",U=()=>{j(!0);const s=S(n,1,1e4);s.page_size=1e4,s.page=1,C.get(`/supervisors/${t}/report/`,{params:s}).then(({data:m})=>{de(a,m.students||[],P())}).catch(()=>alert("تعذّر تحميل بيانات الطباعة.")).finally(()=>j(!1))};if(x)return e.jsx("div",{className:"flex-1 flex items-center justify-center min-h-64",children:e.jsx(_,{size:30,className:"animate-spin text-brand-blue"})});const T=(f==null?void 0:f.students)||[],Y=()=>{const{total:s,total_pages:m}=$;if(m<=1)return null;const h=(c-1)*g+1,O=Math.min(c*g,s);return e.jsxs("div",{className:"flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-3 border-t border-white/08",children:[e.jsxs("p",{className:"text-white/40 text-xs",children:["عرض ",e.jsxs("span",{className:"text-white",children:[h,"–",O]})," من ",e.jsx("span",{className:"text-brand-blue font-semibold",children:s})," طالب"]}),e.jsxs("div",{className:"flex items-center gap-1",children:[e.jsx("button",{disabled:c===1,onClick:()=>y(1),className:"btn-ghost p-1.5 disabled:opacity-30",title:"الأولى",children:e.jsx(te,{size:15})}),e.jsx("button",{disabled:c===1,onClick:()=>y(i=>i-1),className:"btn-ghost p-1.5 disabled:opacity-30",title:"السابق",children:e.jsx(Q,{size:15})}),Array.from({length:m},(i,w)=>w+1).filter(i=>i===1||i===m||Math.abs(i-c)<=1).reduce((i,w,R,W)=>(R>0&&W[R-1]!==w-1&&i.push("..."),i.push(w),i),[]).map((i,w)=>i==="..."?e.jsx("span",{className:"text-white/30 text-xs px-1",children:"…"},w):e.jsx("button",{onClick:()=>y(i),className:`w-7 h-7 rounded-lg text-xs font-medium transition-all ${i===c?"bg-brand-blue text-white":"text-white/50 hover:bg-white/10 hover:text-white"}`,children:i},w)),e.jsx("button",{disabled:c===m,onClick:()=>y(i=>i+1),className:"btn-ghost p-1.5 disabled:opacity-30",title:"التالي",children:e.jsx(V,{size:15})}),e.jsx("button",{disabled:c===m,onClick:()=>y(m),className:"btn-ghost p-1.5 disabled:opacity-30",title:"الأخيرة",children:e.jsx(se,{size:15})})]}),e.jsx("select",{value:g,onChange:i=>{E(Number(i.target.value)),y(1)},className:"input-glass text-xs py-1.5 px-3 w-auto",children:[10,20,50,100].map(i=>e.jsxs("option",{value:i,children:[i," بالصفحة"]},i))})]})};return e.jsxs("div",{className:"space-y-6 animate-fade-in",children:[e.jsxs("div",{className:"flex items-start justify-between flex-wrap gap-3",children:[e.jsxs("div",{className:"flex items-center gap-3",children:[e.jsx("button",{onClick:()=>r("/dashboard/supervisors"),className:"btn-ghost p-2 text-white/50 hover:text-white",title:"العودة",children:e.jsx(X,{size:18})}),e.jsxs("div",{children:[e.jsxs("h1",{className:"font-cairo font-bold text-white text-xl flex items-center gap-2",children:[e.jsx(H,{size:20,className:"text-brand-blue"}),a==null?void 0:a.name]}),e.jsx("p",{className:"text-white/40 text-sm mt-0.5",children:"ملف وتقارير المشرفة"})]})]}),e.jsx("div",{className:"flex gap-2",children:e.jsxs("button",{onClick:U,disabled:!f||o||l,className:"btn-secondary flex items-center gap-2",children:[l?e.jsx(_,{size:15,className:"animate-spin"}):e.jsx(Z,{size:15}),l?"جاري التحضير...":"طباعة التقرير"]})})]}),e.jsxs("div",{className:"glass-card p-5",children:[e.jsxs("div",{className:"grid grid-cols-2 md:grid-cols-4 gap-4 text-sm",children:[e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsx(q,{size:14,className:"text-brand-blue shrink-0"}),e.jsxs("div",{children:[e.jsx("div",{className:"text-white/40 text-xs",children:"الهاتف"}),e.jsx("div",{className:"text-white",dir:"ltr",children:(a==null?void 0:a.phone)||"—"})]})]}),e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsx(I,{size:14,className:"text-brand-blue shrink-0"}),e.jsxs("div",{children:[e.jsx("div",{className:"text-white/40 text-xs",children:"العنوان"}),e.jsx("div",{className:"text-white",children:(a==null?void 0:a.address)||"—"})]})]}),e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsx(J,{size:14,className:"text-neon-cyan shrink-0"}),e.jsxs("div",{children:[e.jsx("div",{className:"text-white/40 text-xs",children:"إجمالي الطلاب"}),e.jsx("div",{className:"text-neon-cyan font-bold text-lg",children:(a==null?void 0:a.student_count)??"—"})]})]}),e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsx(ee,{size:14,className:"text-brand-blue shrink-0"}),e.jsxs("div",{children:[e.jsx("div",{className:"text-white/40 text-xs",children:"نتائج التقرير"}),e.jsx("div",{className:"text-white font-bold text-lg",children:o?"...":$.total})]})]})]}),(a==null?void 0:a.notes)&&e.jsx("div",{className:"mt-4 pt-4 border-t border-white/05 text-white/50 text-sm",children:a.notes})]}),e.jsxs("div",{children:[e.jsxs("h2",{className:"font-cairo font-bold text-white text-base flex items-center gap-2 mb-4",children:[e.jsx(F,{size:16,className:"text-brand-blue"}),"تقارير الطلاب"]}),e.jsxs("div",{className:"grid lg:grid-cols-[280px_1fr] gap-5 items-start",children:[e.jsx(ne,{filters:n,onChange:M,onApply:()=>{y(1),k(n,1,g)},loading:o}),e.jsxs("div",{className:"glass-card overflow-hidden",children:[e.jsxs("div",{className:"flex items-center justify-between px-5 py-4 border-b border-white/08",children:[e.jsxs("div",{children:[e.jsx("p",{className:"text-white font-semibold text-sm",children:P()}),e.jsx("p",{className:"text-white/40 text-xs mt-0.5",children:o?"جاري التحميل...":`${$.total} طالب • صفحة ${c} من ${$.total_pages}`})]}),!o&&T.length>0&&e.jsxs("div",{className:"flex items-center gap-1.5 text-xs text-white/40",children:[e.jsx(K,{size:12,className:"text-neon-cyan"}),e.jsx("span",{className:"text-neon-cyan font-medium",children:T.length})," سجل"]})]}),e.jsx(re,{students:T,loading:o,offset:(c-1)*g}),e.jsx(Y,{})]})]})]})]})}export{ge as default};
