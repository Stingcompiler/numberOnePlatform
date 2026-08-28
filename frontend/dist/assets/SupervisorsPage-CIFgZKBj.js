import{f as re,r,a as P,j as e,d as T,U as H,S as B,X,g as A,P as oe,h as de,o as ce,k as O,l as q,T as xe,F as me}from"./index-MPy5ukR-.js";import{f as he}from"./fetchAll-kK4eP05T.js";import{P as G}from"./plus-C-mvA2Vc.js";import{C as pe,a as be,b as ge}from"./chevrons-right-DY-hyaLK.js";import{P as J}from"./pen-EirGc_-4.js";import{T as ue}from"./trash-2-DpleRalQ.js";import{C as je}from"./calendar-DV7D_LwH.js";import{P as fe}from"./printer-rfNUa3Ne.js";import{F as we}from"./filter-nHTDxT7B.js";const K=["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"],Q=new Date().getFullYear(),Ne=Array.from({length:6},(s,i)=>Q-i);function ve({supervisor:s,onClose:i,onSaved:h}){const l=!!(s!=null&&s.id),[d,b]=r.useState({name:(s==null?void 0:s.name)||"",phone:(s==null?void 0:s.phone)||"",address:(s==null?void 0:s.address)||"",notes:(s==null?void 0:s.notes)||"",is_active:(s==null?void 0:s.is_active)??!0}),[f,j]=r.useState(!1),[o,g]=r.useState(""),u=a=>{const c=a.target.type==="checkbox"?a.target.checked:a.target.value;g(""),b(N=>({...N,[a.target.name]:c}))},_=async a=>{var c;a.preventDefault(),j(!0);try{l?await P.patch(`/supervisors/${s.id}/`,d):await P.post("/supervisors/",d),h(),i()}catch(N){const C=(c=N.response)==null?void 0:c.data;g(typeof C=="object"?Object.values(C).flat().join(" "):"حدث خطأ.")}finally{j(!1)}};return e.jsx("div",{className:"fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark-900/80 backdrop-blur-sm",children:e.jsxs("div",{className:"glass-card-strong w-full max-w-lg p-6 animate-slide-up",children:[e.jsxs("div",{className:"flex items-center justify-between mb-5",children:[e.jsxs("h2",{className:"font-cairo font-bold text-white text-lg flex items-center gap-2",children:[l?e.jsx(J,{size:18,className:"text-brand-blue"}):e.jsx(G,{size:18,className:"text-brand-blue"}),l?"تعديل بيانات المشرفة":"مشرفة جديدة"]}),e.jsx("button",{onClick:i,className:"btn-ghost p-1.5",children:e.jsx(X,{size:18})})]}),e.jsxs("form",{onSubmit:_,className:"space-y-4",children:[e.jsxs("div",{className:"grid sm:grid-cols-2 gap-4",children:[e.jsxs("div",{children:[e.jsx("label",{className:"text-white/50 text-xs mb-1 block",children:"الاسم الكامل *"}),e.jsx("input",{name:"name",value:d.name,onChange:u,required:!0,placeholder:"اسم المشرفة",className:"input-glass"})]}),e.jsxs("div",{children:[e.jsx("label",{className:"text-white/50 text-xs mb-1 block",children:"رقم الهاتف"}),e.jsx("input",{name:"phone",value:d.phone,onChange:u,placeholder:"+249...",className:"input-glass",dir:"ltr"})]})]}),e.jsxs("div",{children:[e.jsx("label",{className:"text-white/50 text-xs mb-1 block",children:"السكن / العنوان"}),e.jsx("input",{name:"address",value:d.address,onChange:u,placeholder:"المدينة / الحي",className:"input-glass"})]}),e.jsxs("div",{children:[e.jsx("label",{className:"text-white/50 text-xs mb-1 block",children:"ملاحظات"}),e.jsx("textarea",{name:"notes",value:d.notes,onChange:u,rows:2,placeholder:"ملاحظات اختيارية...",className:"input-glass resize-none"})]}),e.jsxs("label",{className:"flex items-center gap-2 cursor-pointer",children:[e.jsx("input",{name:"is_active",type:"checkbox",checked:d.is_active,onChange:u,className:"w-4 h-4 accent-brand-blue"}),e.jsx("span",{className:"text-white/60 text-sm",children:"مشرفة نشطة"})]}),o&&e.jsx("p",{className:"text-brand-red text-xs bg-brand-red/10 rounded-xl p-3",children:o}),e.jsxs("div",{className:"flex gap-3 pt-1",children:[e.jsxs("button",{type:"submit",disabled:f,className:"btn-primary flex-1 justify-center",children:[f?e.jsx(A,{size:16,className:"animate-spin"}):null,f?"جاري الحفظ...":"حفظ"]}),e.jsx("button",{type:"button",onClick:i,className:"btn-secondary px-6",children:"إلغاء"})]})]})]})})}function ye(s,i,h){const l=new Date().toLocaleDateString("ar-SA",{year:"numeric",month:"long",day:"numeric"}),d=i.length>0?`<div class="summary-box">
        <p class="summary-title">ملخص المشرفات:</p>
        <div class="summary-chips">
          ${i.map(o=>`<span class="chip">${o.name}: <strong>${o.count}</strong> طالب</span>`).join("")}
        </div>
      </div>`:"",b=s.length>0?s.map((o,g)=>{const u=o.enrolled_grade_level&&o.enrolled_grade_level!=="—"?`<span class="grade-level">${o.enrolled_grade_level}</span>`:"";return`
          <tr class="${g%2===0?"row-even":"row-odd"}">
            <td class="td-num">${g+1}</td>
            <td class="td-name">${o.student_name||""}</td>
            <td class="td-ltr">${o.phone||""}</td>
            <td class="td-sup">${o.supervisor_name||""}</td>
            <td>${o.enrolled_grade||""}${u}</td>
            <td><span class="badge">${o.system_type||""}</span></td>
            <td class="td-ltr">${o.registered_at||""}</td>
          </tr>`}).join(""):'<tr><td colspan="7" class="empty-row">لا يوجد بيانات</td></tr>',f=`<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>تقرير المشرفات — ${h}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap" rel="stylesheet" />
  <style>
    /* ── Reset ── */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    /* ── Page setup: zero margin removes browser URL/date headers ── */
    @page {
      size: A4 portrait;
      margin: 0;
    }

    body {
      font-family: 'Cairo', Arial, sans-serif;
      background: #fff;
      color: #111;
      direction: rtl;
      /* Manual page margin replaces @page margin */
      padding: 14mm 16mm 14mm 16mm;
      font-size: 11pt;
      font-weight: 500;
      line-height: 1.55;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    /* ── Header ── */
    .doc-header {
      text-align: center;
      border-bottom: 2.5px solid #888;
      padding-bottom: 13px;
      margin-bottom: 18px;
    }
    .doc-header h1 {
      font-size: 20pt;
      font-weight: 800;
      color: #000;
      letter-spacing: -0.3px;
      margin-bottom: 5px;
    }
    .doc-header .subtitle {
      font-size: 11pt;
      font-weight: 700;
      color: #222;
      margin-bottom: 3px;
    }
    .doc-header .date {
      font-size: 9.5pt;
      font-weight: 500;
      color: #555;
    }

    /* ── Summary box ── */
    .summary-box {
      margin-bottom: 16px;
      padding: 9px 12px;
      background: #f0f4f8;
      border: 1px solid #bbc8d8;
      border-radius: 6px;
    }
    .summary-title {
      font-size: 10pt;
      font-weight: 800;
      color: #111;
      margin-bottom: 7px;
    }
    .summary-chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .chip {
      font-size: 9.5pt;
      font-weight: 600;
      padding: 3px 11px;
      border: 1.5px solid #999;
      border-radius: 20px;
      color: #111;
      background: #fff;
    }

    /* ── Table ── */
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10.5pt;
      margin-bottom: 14px;
    }
    thead tr { background: #222; }
    th {
      border: 1px solid #333;
      padding: 7px 9px;
      text-align: right;
      font-weight: 800;
      color: #fff;
      white-space: nowrap;
      font-size: 10.5pt;
    }
    td {
      border: 1px solid #bbb;
      padding: 6px 9px;
      color: #111;
      font-weight: 500;
      vertical-align: top;
    }
    .row-even td { background: #fff; }
    .row-odd  td { background: #f2f2f2; }
    tr { page-break-inside: avoid; }

    .td-num  { color: #444; font-weight: 700; text-align: center; width: 32px; }
    .td-name { font-weight: 700; color: #000; }
    .td-ltr  { direction: ltr; text-align: left; color: #222; font-weight: 600; }
    .td-sup  { color: #1a4fa0; font-weight: 700; }
    .grade-level { display: block; font-size: 9pt; font-weight: 600; color: #555; margin-top: 2px; }
    .badge {
      display: inline-block;
      padding: 2px 8px;
      border: 1.5px solid #666;
      border-radius: 4px;
      font-size: 9.5pt;
      font-weight: 700;
      color: #111;
    }
    .empty-row { text-align: center; padding: 20px; color: #777; font-weight: 600; }

    /* ── Footer ── */
    .doc-total {
      font-size: 11pt;
      font-weight: 800;
      color: #000;
      margin-bottom: 14px;
    }
    .doc-footer {
      border-top: 1px solid #bbb;
      padding-top: 9px;
      font-size: 8.5pt;
      font-weight: 600;
      color: #666;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="doc-header">
    <h1>مدارس ومعاهد نمبر ون</h1>
    <p class="subtitle">تقرير طلاب المشرفات — ${h}</p>
    <p class="date">${l}</p>
  </div>

  ${d}

  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>اسم الطالب</th>
        <th>الهاتف</th>
        <th>المشرفة</th>
        <th>الفصل / المرحلة</th>
        <th>النظام</th>
        <th>تاريخ التسجيل</th>
      </tr>
    </thead>
    <tbody>
      ${b}
    </tbody>
  </table>

  <p class="doc-total">الإجمالي: ${s.length} طالب</p>

  <div class="doc-footer">
    نظام مدارس ومعاهد نمبر ون — تقرير مولَّد بتاريخ ${l}
  </div>

  <script>
    window.onload = function () {
      window.print();
      window.onafterprint = function () { window.close(); };
    };
  <\/script>
</body>
</html>`,j=window.open("","_blank","width=900,height=700,scrollbars=yes");if(!j){alert("يُرجى السماح بالنوافذ المنبثقة لطباعة التقرير.");return}j.document.open(),j.document.write(f),j.document.close()}function ze({filters:s,onChange:i,onApply:h,loading:l,supervisors:d}){const{filterType:b,year:f,month:j,day:o,dateFrom:g,dateTo:u,supervisorId:_}=s;return e.jsxs("div",{className:"glass-card p-5 space-y-4",children:[e.jsxs("div",{className:"flex items-center gap-2 mb-1",children:[e.jsx(we,{size:15,className:"text-brand-blue"}),e.jsx("h3",{className:"font-cairo font-semibold text-white text-sm",children:"فلترة التقرير"})]}),e.jsx("div",{className:"flex flex-wrap gap-2",children:[{id:"all",label:"الكل"},{id:"yearly",label:"سنوي"},{id:"monthly",label:"شهري"},{id:"day",label:"يوم محدد"},{id:"range",label:"نطاق تاريخ"}].map(({id:a,label:c})=>e.jsx("button",{onClick:()=>i({...s,filterType:a}),className:`px-4 py-1.5 rounded-xl text-sm font-medium transition-all ${b===a?"bg-brand-blue text-white shadow-neon":"bg-white/5 text-white/50 hover:bg-white/10 hover:text-white"}`,children:c},a))}),e.jsxs("div",{children:[e.jsx("label",{className:"text-white/40 text-xs mb-1 block",children:"تصفية بمشرفة"}),e.jsxs("select",{value:_,onChange:a=>i({...s,supervisorId:a.target.value}),className:"input-glass text-sm",children:[e.jsx("option",{value:"",children:"كل المشرفات"}),d.map(a=>e.jsx("option",{value:a.id,children:a.name},a.id))]})]}),(b==="yearly"||b==="monthly")&&e.jsxs("div",{className:"grid grid-cols-2 gap-3",children:[e.jsxs("div",{children:[e.jsx("label",{className:"text-white/40 text-xs mb-1 block",children:"السنة"}),e.jsxs("select",{value:f,onChange:a=>i({...s,year:a.target.value}),className:"input-glass text-sm",children:[e.jsx("option",{value:"",children:"كل السنوات"}),Ne.map(a=>e.jsx("option",{value:a,children:a},a))]})]}),b==="monthly"&&e.jsxs("div",{children:[e.jsx("label",{className:"text-white/40 text-xs mb-1 block",children:"الشهر"}),e.jsxs("select",{value:j,onChange:a=>i({...s,month:a.target.value}),className:"input-glass text-sm",children:[e.jsx("option",{value:"",children:"كل الشهور"}),K.map((a,c)=>e.jsx("option",{value:c+1,children:a},c+1))]})]})]}),b==="day"&&e.jsxs("div",{children:[e.jsx("label",{className:"text-white/40 text-xs mb-1 block",children:"اختر يوماً"}),e.jsx("input",{type:"date",value:o,onChange:a=>i({...s,day:a.target.value}),className:"input-glass text-sm"})]}),b==="range"&&e.jsxs("div",{className:"grid grid-cols-2 gap-3",children:[e.jsxs("div",{children:[e.jsx("label",{className:"text-white/40 text-xs mb-1 block",children:"من تاريخ"}),e.jsx("input",{type:"date",value:g,onChange:a=>i({...s,dateFrom:a.target.value}),className:"input-glass text-sm"})]}),e.jsxs("div",{children:[e.jsx("label",{className:"text-white/40 text-xs mb-1 block",children:"إلى تاريخ"}),e.jsx("input",{type:"date",value:u,onChange:a=>i({...s,dateTo:a.target.value}),className:"input-glass text-sm"})]})]}),e.jsxs("button",{onClick:h,disabled:l,className:"btn-primary w-full justify-center",children:[l?e.jsx(A,{size:15,className:"animate-spin"}):e.jsx(B,{size:15}),l?"جاري التحميل...":"تطبيق الفلتر"]})]})}function ke({students:s,loading:i,summary:h}){return i?e.jsxs("div",{className:"py-16 text-center",children:[e.jsx(A,{size:28,className:"animate-spin text-brand-blue mx-auto mb-3"}),e.jsx("p",{className:"text-white/40 text-sm",children:"جاري تحميل التقرير..."})]}):s.length?e.jsxs(e.Fragment,{children:[(h==null?void 0:h.length)>0&&e.jsx("div",{className:"px-5 py-3 border-b border-white/05 flex flex-wrap gap-2",children:h.map((l,d)=>e.jsxs("span",{className:"inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white/5 text-xs text-white/70",children:[e.jsx(T,{size:11,className:"text-brand-blue"}),l.name,e.jsx("span",{className:"text-brand-blue font-bold",children:l.count})]},d))}),e.jsx("div",{className:"overflow-x-auto",children:e.jsxs("table",{className:"w-full text-sm",children:[e.jsx("thead",{children:e.jsx("tr",{className:"border-b border-white/08",children:["#","اسم الطالب","الهاتف","المشرفة","الفصل","النظام","تاريخ التسجيل"].map(l=>e.jsx("th",{className:"text-right text-white/40 font-medium py-3 px-4 text-xs",children:l},l))})}),e.jsx("tbody",{className:"divide-y divide-white/05",children:s.map((l,d)=>e.jsxs("tr",{className:"hover:bg-white/3 transition-colors",children:[e.jsx("td",{className:"py-3 px-4 text-white/30 text-xs",children:d+1}),e.jsx("td",{className:"py-3 px-4 text-white font-medium",children:l.student_name}),e.jsx("td",{className:"py-3 px-4 text-white/60 text-xs",dir:"ltr",children:l.phone}),e.jsx("td",{className:"py-3 px-4",children:e.jsx("span",{className:"text-brand-blue text-xs",children:l.supervisor_name})}),e.jsxs("td",{className:"py-3 px-4",children:[e.jsx("div",{className:"text-white/70 text-xs",children:l.enrolled_grade}),l.enrolled_grade_level&&l.enrolled_grade_level!=="—"&&e.jsx("div",{className:"text-white/35 text-xs",children:l.enrolled_grade_level})]}),e.jsx("td",{className:"py-3 px-4",children:e.jsx("span",{className:`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-medium ${l.system_type==="أونلاين"?"bg-brand-blue/15 text-brand-blue":"bg-brand-red/15 text-brand-red"}`,children:l.system_type})}),e.jsx("td",{className:"py-3 px-4 text-white/40 text-xs",dir:"ltr",children:l.registered_at})]},d))})]})})]}):e.jsxs("div",{className:"py-16 text-center",children:[e.jsx(me,{size:40,className:"mx-auto mb-3 text-white/15"}),e.jsx("p",{className:"text-white/40",children:"لا توجد بيانات للفترة المحددة."})]})}function Ee(){const s=re(),[i,h]=r.useState("list"),[l,d]=r.useState([]),[b,f]=r.useState([]),[j,o]=r.useState(!0),[g,u]=r.useState(""),[_,a]=r.useState(null),[c,N]=r.useState(1),[C,V]=r.useState(0),W=10,[v,Z]=r.useState(null),[S,I]=r.useState(!1),[y,ee]=r.useState({filterType:"all",year:String(Q),month:"",day:"",dateFrom:"",dateTo:"",supervisorId:""}),[x,z]=r.useState(1),[w,te]=r.useState(20),[F,se]=r.useState({total:0,total_pages:1}),R=r.useCallback(()=>{o(!0),P.get("/supervisors/",{params:{page:c,search:g}}).then(({data:t})=>{d(t.results||t),V(t.count||(t.results?t.count:t.length))}).catch(console.error).finally(()=>o(!1))},[c,g]);r.useEffect(()=>{R()},[R]),r.useEffect(()=>{he("/supervisors/").then(f).catch(()=>{})},[]);const ae=async t=>{window.confirm("هل أنت متأكد من حذف هذه المشرفة؟")&&(await P.delete(`/supervisors/${t}/`),R())},le=(t,p=x,$=w)=>{const m={page:p,page_size:$};return t.filterType!=="all"&&(m.filter_type=t.filterType),(t.filterType==="yearly"||t.filterType==="monthly")&&(t.year&&(m.year=t.year),t.month&&(m.month=t.month)),t.filterType==="day"&&t.day&&(m.day=t.day),t.filterType==="range"&&(t.dateFrom&&(m.date_from=t.dateFrom),t.dateTo&&(m.date_to=t.dateTo)),t.supervisorId&&(m.supervisor=t.supervisorId),m},E=r.useCallback((t=y,p=x,$=w)=>{I(!0),P.get("/supervisors/report/all/",{params:le(t,p,$)}).then(({data:m})=>{Z(m),se({total:m.total,total_pages:m.total_pages})}).catch(()=>alert("تعذّر تحميل التقرير.")).finally(()=>I(!1))},[y,x,w]);r.useEffect(()=>{i==="reports"&&E(y,1,w)},[i]),r.useEffect(()=>{i==="reports"&&v!==null&&E(y,x,w)},[x]);const L=Math.ceil(C/W),M=()=>{const t=y;return t.filterType==="yearly"?`السنة ${t.year||"الكاملة"}`:t.filterType==="monthly"?`${t.month?K[Number(t.month)-1]:"كل الشهور"} ${t.year||""}`:t.filterType==="day"?t.day?`يوم ${t.day}`:"يوم محدد":t.filterType==="range"?`${t.dateFrom||"—"} إلى ${t.dateTo||"—"}`:"جميع الفترات"},U=(v==null?void 0:v.students)||[],D=(v==null?void 0:v.summary)||[],ie=()=>{const{total:t,total_pages:p}=F;if(p<=1)return null;const $=(x-1)*w+1,m=Math.min(x*w,t);return e.jsxs("div",{className:"flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-3 border-t border-white/08",children:[e.jsxs("p",{className:"text-white/40 text-xs",children:["عرض ",e.jsxs("span",{className:"text-white",children:[$,"–",m]})," من ",e.jsx("span",{className:"text-brand-blue font-semibold",children:t})," طالب"]}),e.jsxs("div",{className:"flex items-center gap-1",children:[e.jsx("button",{disabled:x===1,onClick:()=>z(1),className:"btn-ghost p-1.5 disabled:opacity-30",title:"الأولى",children:e.jsx(be,{size:15})}),e.jsx("button",{disabled:x===1,onClick:()=>z(n=>n-1),className:"btn-ghost p-1.5 disabled:opacity-30",title:"السابق",children:e.jsx(O,{size:15})}),Array.from({length:p},(n,k)=>k+1).filter(n=>n===1||n===p||Math.abs(n-x)<=1).reduce((n,k,Y,ne)=>(Y>0&&ne[Y-1]!==k-1&&n.push("..."),n.push(k),n),[]).map((n,k)=>n==="..."?e.jsx("span",{className:"text-white/30 text-xs px-1",children:"…"},k):e.jsx("button",{onClick:()=>z(n),className:`w-7 h-7 rounded-lg text-xs font-medium transition-all ${n===x?"bg-brand-blue text-white":"text-white/50 hover:bg-white/10 hover:text-white"}`,children:n},k)),e.jsx("button",{disabled:x===p,onClick:()=>z(n=>n+1),className:"btn-ghost p-1.5 disabled:opacity-30",title:"التالي",children:e.jsx(q,{size:15})}),e.jsx("button",{disabled:x===p,onClick:()=>z(p),className:"btn-ghost p-1.5 disabled:opacity-30",title:"الأخيرة",children:e.jsx(ge,{size:15})})]}),e.jsx("select",{value:w,onChange:n=>{te(Number(n.target.value)),z(1)},className:"input-glass text-xs py-1.5 px-3 w-auto",children:[10,20,50,100].map(n=>e.jsxs("option",{value:n,children:[n," بالصفحة"]},n))})]})};return e.jsxs("div",{className:"space-y-5 animate-fade-in",children:[e.jsxs("div",{className:"flex items-center justify-between flex-wrap gap-3",children:[e.jsxs("div",{children:[e.jsxs("h1",{className:"font-cairo font-bold text-white text-xl flex items-center gap-2",children:[e.jsx(T,{size:20,className:"text-brand-blue"})," إدارة المشرفات"]}),e.jsxs("p",{className:"text-white/40 text-sm mt-0.5",children:["إجمالي: ",e.jsx("span",{className:"text-brand-blue font-medium",children:C})," مشرفة"]})]}),e.jsxs("button",{onClick:()=>a({}),className:"btn-primary",children:[e.jsx(G,{size:16})," مشرفة جديدة"]})]}),e.jsx("div",{className:"flex gap-1 p-1 bg-white/5 rounded-xl w-fit",children:[{id:"list",icon:e.jsx(H,{size:14}),label:"قائمة المشرفات"},{id:"reports",icon:e.jsx(pe,{size:14}),label:"التقارير الشاملة"}].map(t=>e.jsxs("button",{onClick:()=>h(t.id),className:`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${i===t.id?"bg-brand-blue text-white shadow-neon":"text-white/50 hover:text-white"}`,children:[t.icon," ",t.label]},t.id))}),i==="list"&&e.jsxs(e.Fragment,{children:[e.jsxs("div",{className:"relative max-w-sm",children:[e.jsx(B,{size:16,className:"absolute right-3 top-1/2 -translate-y-1/2 text-white/30"}),e.jsx("input",{value:g,onChange:t=>{u(t.target.value),N(1)},placeholder:"ابحث بالاسم...",className:"input-glass pr-10"}),g&&e.jsx("button",{onClick:()=>u(""),className:"absolute left-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white",children:e.jsx(X,{size:14})})]}),e.jsxs("div",{className:"glass-card overflow-hidden",children:[j?e.jsx("div",{className:"p-12 text-center",children:e.jsx(A,{size:28,className:"animate-spin text-brand-blue mx-auto"})}):l.length===0?e.jsxs("div",{className:"p-12 text-center text-white/40",children:[e.jsx(T,{size:40,className:"mx-auto mb-3 opacity-30"}),e.jsx("p",{children:"لا توجد مشرفات. أضف المشرفة الأولى!"})]}):e.jsx("div",{className:"divide-y divide-white/05",children:l.map(t=>e.jsxs("div",{className:`flex items-center gap-4 p-4 hover:bg-white/3 transition-colors ${t.is_active?"":"opacity-50"}`,children:[e.jsx("div",{className:"w-10 h-10 rounded-xl bg-brand-blue/10 flex items-center justify-center shrink-0",children:e.jsx(T,{size:18,className:"text-brand-blue"})}),e.jsxs("div",{className:"flex-1 min-w-0",children:[e.jsxs("div",{className:"flex items-center gap-2 flex-wrap",children:[e.jsx("h3",{className:"font-cairo font-semibold text-white",children:t.name}),!t.is_active&&e.jsx("span",{className:"badge badge-red text-xs",children:"موقوفة"}),e.jsxs("span",{className:"text-white/25 text-xs flex items-center gap-1",children:[e.jsx(H,{size:10})," ",t.student_count," طالب"]})]}),e.jsxs("div",{className:"flex items-center gap-4 mt-1 flex-wrap",children:[t.phone&&e.jsxs("span",{className:"text-white/40 text-xs flex items-center gap-1",dir:"ltr",children:[e.jsx(oe,{size:10})," ",t.phone]}),t.address&&e.jsxs("span",{className:"text-white/40 text-xs flex items-center gap-1",children:[e.jsx(de,{size:10})," ",t.address]})]})]}),e.jsxs("div",{className:"flex items-center gap-2 shrink-0",children:[e.jsx("button",{onClick:()=>s(`/dashboard/supervisors/${t.id}`),title:"عرض التفاصيل والتقارير",className:"btn-ghost p-2 text-white/40 hover:text-neon-cyan",children:e.jsx(ce,{size:15})}),e.jsx("button",{onClick:()=>a({supervisor:t}),className:"btn-ghost p-2 text-brand-blue",title:"تعديل",children:e.jsx(J,{size:15})}),e.jsx("button",{onClick:()=>ae(t.id),className:"btn-ghost p-2 text-brand-red/40 hover:text-brand-red",title:"حذف",children:e.jsx(ue,{size:15})})]})]},t.id))}),L>1&&e.jsxs("div",{className:"flex items-center justify-between px-4 py-3 border-t border-white/05",children:[e.jsxs("p",{className:"text-white/40 text-xs",children:["صفحة ",c," من ",L]}),e.jsxs("div",{className:"flex gap-2",children:[e.jsx("button",{disabled:c===1,onClick:()=>N(t=>t-1),className:"btn-ghost p-1.5 disabled:opacity-30",children:e.jsx(O,{size:16})}),e.jsx("button",{disabled:c===L,onClick:()=>N(t=>t+1),className:"btn-ghost p-1.5 disabled:opacity-30",children:e.jsx(q,{size:16})})]})]})]})]}),i==="reports"&&e.jsxs("div",{className:"space-y-5",children:[e.jsx("div",{className:"grid grid-cols-2 md:grid-cols-4 gap-4",children:[{label:"إجمالي المشرفات",value:C,icon:e.jsx(T,{size:18,className:"text-brand-blue"}),color:"text-brand-blue"},{label:"إجمالي الطلاب في التقرير",value:S?"...":F.total,icon:e.jsx(H,{size:18,className:"text-neon-cyan"}),color:"text-neon-cyan"},{label:"الفترة المحددة",value:M(),icon:e.jsx(je,{size:18,className:"text-purple-400"}),color:"text-purple-400",small:!0},{label:"المشرفات الفعّالة",value:l.filter(t=>t.is_active).length,icon:e.jsx(xe,{size:18,className:"text-green-400"}),color:"text-green-400"}].map((t,p)=>e.jsx("div",{className:"glass-card p-4",children:e.jsxs("div",{className:"flex items-center gap-3",children:[e.jsx("div",{className:"w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center shrink-0",children:t.icon}),e.jsxs("div",{className:"min-w-0",children:[e.jsx("p",{className:"text-white/40 text-xs",children:t.label}),e.jsx("p",{className:`font-bold mt-0.5 ${t.color} ${t.small?"text-sm":"text-lg"} truncate`,children:t.value})]})]})},p))}),e.jsxs("div",{className:"grid lg:grid-cols-[280px_1fr] gap-5 items-start",children:[e.jsx(ze,{filters:y,onChange:ee,onApply:()=>{z(1),E(y,1,w)},loading:S,supervisors:b}),e.jsxs("div",{className:"glass-card overflow-hidden",children:[e.jsxs("div",{className:"flex items-center justify-between px-5 py-4 border-b border-white/08",children:[e.jsxs("div",{children:[e.jsx("p",{className:"text-white font-semibold text-sm",children:M()}),e.jsx("p",{className:"text-white/40 text-xs mt-0.5",children:S?"جاري التحميل...":`${F.total} طالب • صفحة ${x} من ${F.total_pages}`})]}),!S&&U.length>0&&e.jsx("button",{onClick:()=>ye(U,D,M()),className:"btn-ghost p-2 text-white/40 hover:text-white",title:"طباعة / PDF",children:e.jsx(fe,{size:16})})]}),e.jsx(ke,{students:U,loading:S,summary:D}),e.jsx(ie,{})]})]})]}),_!==null&&e.jsx(ve,{supervisor:_.supervisor,onClose:()=>a(null),onSaved:R})]})}export{Ee as default};
