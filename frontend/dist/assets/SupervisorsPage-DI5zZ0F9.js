import{e as ie,f as ne,r,a as T,j as e,d as S,U as I,X as B,g as M,P as re,h as de,i as Y,k as O,T as oe,F as ce}from"./index-DMDvNqTb.js";import{P as V}from"./plus-z6kFEJBx.js";import{C as xe,a as he,b as me}from"./chevrons-right-DPDwpDfm.js";import{S as X}from"./search-ClKewCfy.js";import{P as G}from"./pen-fYFybRyT.js";import{T as pe}from"./trash-2-DPQ3igBi.js";import{C as be}from"./calendar-CSgZ3uRc.js";import{P as ge}from"./printer-Bh_RWqGw.js";import{F as ue}from"./filter-DVUwJxmY.js";/**
 * @license lucide-react v0.441.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const je=ie("ExternalLink",[["path",{d:"M15 3h6v6",key:"1q9fwt"}],["path",{d:"M10 14 21 3",key:"gplh6r"}],["path",{d:"M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6",key:"a6xqqp"}]]),J=["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"],K=new Date().getFullYear(),fe=Array.from({length:6},(s,i)=>K-i);function we({supervisor:s,onClose:i,onSaved:m}){const l=!!(s!=null&&s.id),[o,u]=r.useState({name:(s==null?void 0:s.name)||"",phone:(s==null?void 0:s.phone)||"",address:(s==null?void 0:s.address)||"",notes:(s==null?void 0:s.notes)||"",is_active:(s==null?void 0:s.is_active)??!0}),[j,c]=r.useState(!1),[d,f]=r.useState(""),p=a=>{const b=a.target.type==="checkbox"?a.target.checked:a.target.value;f(""),u(_=>({..._,[a.target.name]:b}))},w=async a=>{var b;a.preventDefault(),c(!0);try{l?await T.patch(`/supervisors/${s.id}/`,o):await T.post("/supervisors/",o),m(),i()}catch(_){const P=(b=_.response)==null?void 0:b.data;f(typeof P=="object"?Object.values(P).flat().join(" "):"حدث خطأ.")}finally{c(!1)}};return e.jsx("div",{className:"fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark-900/80 backdrop-blur-sm",children:e.jsxs("div",{className:"glass-card-strong w-full max-w-lg p-6 animate-slide-up",children:[e.jsxs("div",{className:"flex items-center justify-between mb-5",children:[e.jsxs("h2",{className:"font-cairo font-bold text-white text-lg flex items-center gap-2",children:[l?e.jsx(G,{size:18,className:"text-brand-blue"}):e.jsx(V,{size:18,className:"text-brand-blue"}),l?"تعديل بيانات المشرفة":"مشرفة جديدة"]}),e.jsx("button",{onClick:i,className:"btn-ghost p-1.5",children:e.jsx(B,{size:18})})]}),e.jsxs("form",{onSubmit:w,className:"space-y-4",children:[e.jsxs("div",{className:"grid sm:grid-cols-2 gap-4",children:[e.jsxs("div",{children:[e.jsx("label",{className:"text-white/50 text-xs mb-1 block",children:"الاسم الكامل *"}),e.jsx("input",{name:"name",value:o.name,onChange:p,required:!0,placeholder:"اسم المشرفة",className:"input-glass"})]}),e.jsxs("div",{children:[e.jsx("label",{className:"text-white/50 text-xs mb-1 block",children:"رقم الهاتف"}),e.jsx("input",{name:"phone",value:o.phone,onChange:p,placeholder:"+249...",className:"input-glass",dir:"ltr"})]})]}),e.jsxs("div",{children:[e.jsx("label",{className:"text-white/50 text-xs mb-1 block",children:"السكن / العنوان"}),e.jsx("input",{name:"address",value:o.address,onChange:p,placeholder:"المدينة / الحي",className:"input-glass"})]}),e.jsxs("div",{children:[e.jsx("label",{className:"text-white/50 text-xs mb-1 block",children:"ملاحظات"}),e.jsx("textarea",{name:"notes",value:o.notes,onChange:p,rows:2,placeholder:"ملاحظات اختيارية...",className:"input-glass resize-none"})]}),e.jsxs("label",{className:"flex items-center gap-2 cursor-pointer",children:[e.jsx("input",{name:"is_active",type:"checkbox",checked:o.is_active,onChange:p,className:"w-4 h-4 accent-brand-blue"}),e.jsx("span",{className:"text-white/60 text-sm",children:"مشرفة نشطة"})]}),d&&e.jsx("p",{className:"text-brand-red text-xs bg-brand-red/10 rounded-xl p-3",children:d}),e.jsxs("div",{className:"flex gap-3 pt-1",children:[e.jsxs("button",{type:"submit",disabled:j,className:"btn-primary flex-1 justify-center",children:[j?e.jsx(M,{size:16,className:"animate-spin"}):null,j?"جاري الحفظ...":"حفظ"]}),e.jsx("button",{type:"button",onClick:i,className:"btn-secondary px-6",children:"إلغاء"})]})]})]})})}function ye(s,i,m){const l=new Date().toLocaleDateString("ar-SA",{year:"numeric",month:"long",day:"numeric"}),o=i.length>0?`<div class="summary-box">
        <p class="summary-title">ملخص المشرفات:</p>
        <div class="summary-chips">
          ${i.map(d=>`<span class="chip">${d.name}: <strong>${d.count}</strong> طالب</span>`).join("")}
        </div>
      </div>`:"",u=s.length>0?s.map((d,f)=>{const p=d.enrolled_grade_level&&d.enrolled_grade_level!=="—"?`<span class="grade-level">${d.enrolled_grade_level}</span>`:"";return`
          <tr class="${f%2===0?"row-even":"row-odd"}">
            <td class="td-num">${f+1}</td>
            <td class="td-name">${d.student_name||""}</td>
            <td class="td-ltr">${d.phone||""}</td>
            <td class="td-sup">${d.supervisor_name||""}</td>
            <td>${d.enrolled_grade||""}${p}</td>
            <td><span class="badge">${d.system_type||""}</span></td>
            <td class="td-ltr">${d.registered_at||""}</td>
          </tr>`}).join(""):'<tr><td colspan="7" class="empty-row">لا يوجد بيانات</td></tr>',j=`<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>تقرير المشرفات — ${m}</title>
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
    <p class="subtitle">تقرير طلاب المشرفات — ${m}</p>
    <p class="date">${l}</p>
  </div>

  ${o}

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
      ${u}
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
</html>`,c=window.open("","_blank","width=900,height=700,scrollbars=yes");if(!c){alert("يُرجى السماح بالنوافذ المنبثقة لطباعة التقرير.");return}c.document.open(),c.document.write(j),c.document.close()}function Ne({filters:s,onChange:i,onApply:m,loading:l,supervisors:o}){const{filterType:u,year:j,month:c,day:d,dateFrom:f,dateTo:p,supervisorId:w}=s;return e.jsxs("div",{className:"glass-card p-5 space-y-4",children:[e.jsxs("div",{className:"flex items-center gap-2 mb-1",children:[e.jsx(ue,{size:15,className:"text-brand-blue"}),e.jsx("h3",{className:"font-cairo font-semibold text-white text-sm",children:"فلترة التقرير"})]}),e.jsx("div",{className:"flex flex-wrap gap-2",children:[{id:"all",label:"الكل"},{id:"yearly",label:"سنوي"},{id:"monthly",label:"شهري"},{id:"day",label:"يوم محدد"},{id:"range",label:"نطاق تاريخ"}].map(({id:a,label:b})=>e.jsx("button",{onClick:()=>i({...s,filterType:a}),className:`px-4 py-1.5 rounded-xl text-sm font-medium transition-all ${u===a?"bg-brand-blue text-white shadow-neon":"bg-white/5 text-white/50 hover:bg-white/10 hover:text-white"}`,children:b},a))}),e.jsxs("div",{children:[e.jsx("label",{className:"text-white/40 text-xs mb-1 block",children:"تصفية بمشرفة"}),e.jsxs("select",{value:w,onChange:a=>i({...s,supervisorId:a.target.value}),className:"input-glass text-sm",children:[e.jsx("option",{value:"",children:"كل المشرفات"}),o.map(a=>e.jsx("option",{value:a.id,children:a.name},a.id))]})]}),(u==="yearly"||u==="monthly")&&e.jsxs("div",{className:"grid grid-cols-2 gap-3",children:[e.jsxs("div",{children:[e.jsx("label",{className:"text-white/40 text-xs mb-1 block",children:"السنة"}),e.jsxs("select",{value:j,onChange:a=>i({...s,year:a.target.value}),className:"input-glass text-sm",children:[e.jsx("option",{value:"",children:"كل السنوات"}),fe.map(a=>e.jsx("option",{value:a,children:a},a))]})]}),u==="monthly"&&e.jsxs("div",{children:[e.jsx("label",{className:"text-white/40 text-xs mb-1 block",children:"الشهر"}),e.jsxs("select",{value:c,onChange:a=>i({...s,month:a.target.value}),className:"input-glass text-sm",children:[e.jsx("option",{value:"",children:"كل الشهور"}),J.map((a,b)=>e.jsx("option",{value:b+1,children:a},b+1))]})]})]}),u==="day"&&e.jsxs("div",{children:[e.jsx("label",{className:"text-white/40 text-xs mb-1 block",children:"اختر يوماً"}),e.jsx("input",{type:"date",value:d,onChange:a=>i({...s,day:a.target.value}),className:"input-glass text-sm"})]}),u==="range"&&e.jsxs("div",{className:"grid grid-cols-2 gap-3",children:[e.jsxs("div",{children:[e.jsx("label",{className:"text-white/40 text-xs mb-1 block",children:"من تاريخ"}),e.jsx("input",{type:"date",value:f,onChange:a=>i({...s,dateFrom:a.target.value}),className:"input-glass text-sm"})]}),e.jsxs("div",{children:[e.jsx("label",{className:"text-white/40 text-xs mb-1 block",children:"إلى تاريخ"}),e.jsx("input",{type:"date",value:p,onChange:a=>i({...s,dateTo:a.target.value}),className:"input-glass text-sm"})]})]}),e.jsxs("button",{onClick:m,disabled:l,className:"btn-primary w-full justify-center",children:[l?e.jsx(M,{size:15,className:"animate-spin"}):e.jsx(X,{size:15}),l?"جاري التحميل...":"تطبيق الفلتر"]})]})}function ve({students:s,loading:i,summary:m}){return i?e.jsxs("div",{className:"py-16 text-center",children:[e.jsx(M,{size:28,className:"animate-spin text-brand-blue mx-auto mb-3"}),e.jsx("p",{className:"text-white/40 text-sm",children:"جاري تحميل التقرير..."})]}):s.length?e.jsxs(e.Fragment,{children:[(m==null?void 0:m.length)>0&&e.jsx("div",{className:"px-5 py-3 border-b border-white/05 flex flex-wrap gap-2",children:m.map((l,o)=>e.jsxs("span",{className:"inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white/5 text-xs text-white/70",children:[e.jsx(S,{size:11,className:"text-brand-blue"}),l.name,e.jsx("span",{className:"text-brand-blue font-bold",children:l.count})]},o))}),e.jsx("div",{className:"overflow-x-auto",children:e.jsxs("table",{className:"w-full text-sm",children:[e.jsx("thead",{children:e.jsx("tr",{className:"border-b border-white/08",children:["#","اسم الطالب","الهاتف","المشرفة","الفصل","النظام","تاريخ التسجيل"].map(l=>e.jsx("th",{className:"text-right text-white/40 font-medium py-3 px-4 text-xs",children:l},l))})}),e.jsx("tbody",{className:"divide-y divide-white/05",children:s.map((l,o)=>e.jsxs("tr",{className:"hover:bg-white/3 transition-colors",children:[e.jsx("td",{className:"py-3 px-4 text-white/30 text-xs",children:o+1}),e.jsx("td",{className:"py-3 px-4 text-white font-medium",children:l.student_name}),e.jsx("td",{className:"py-3 px-4 text-white/60 text-xs",dir:"ltr",children:l.phone}),e.jsx("td",{className:"py-3 px-4",children:e.jsx("span",{className:"text-brand-blue text-xs",children:l.supervisor_name})}),e.jsxs("td",{className:"py-3 px-4",children:[e.jsx("div",{className:"text-white/70 text-xs",children:l.enrolled_grade}),l.enrolled_grade_level&&l.enrolled_grade_level!=="—"&&e.jsx("div",{className:"text-white/35 text-xs",children:l.enrolled_grade_level})]}),e.jsx("td",{className:"py-3 px-4",children:e.jsx("span",{className:`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-medium ${l.system_type==="أونلاين"?"bg-brand-blue/15 text-brand-blue":"bg-brand-red/15 text-brand-red"}`,children:l.system_type})}),e.jsx("td",{className:"py-3 px-4 text-white/40 text-xs",dir:"ltr",children:l.registered_at})]},o))})]})})]}):e.jsxs("div",{className:"py-16 text-center",children:[e.jsx(ce,{size:40,className:"mx-auto mb-3 text-white/15"}),e.jsx("p",{className:"text-white/40",children:"لا توجد بيانات للفترة المحددة."})]})}function Re(){const s=ne(),[i,m]=r.useState("list"),[l,o]=r.useState([]),[u,j]=r.useState(!0),[c,d]=r.useState(""),[f,p]=r.useState(null),[w,a]=r.useState(1),[b,_]=r.useState(0),P=10,[N,Q]=r.useState(null),[C,U]=r.useState(!1),[v,W]=r.useState({filterType:"all",year:String(K),month:"",day:"",dateFrom:"",dateTo:"",supervisorId:""}),[x,k]=r.useState(1),[y,Z]=r.useState(20),[F,ee]=r.useState({total:0,total_pages:1}),R=r.useCallback(()=>{j(!0),T.get("/supervisors/",{params:{page:w,search:c}}).then(({data:t})=>{o(t.results||t),_(t.count||(t.results?t.count:t.length))}).catch(console.error).finally(()=>j(!1))},[w,c]);r.useEffect(()=>{R()},[R]);const te=async t=>{window.confirm("هل أنت متأكد من حذف هذه المشرفة؟")&&(await T.delete(`/supervisors/${t}/`),R())},se=(t,g=x,$=y)=>{const h={page:g,page_size:$};return t.filterType!=="all"&&(h.filter_type=t.filterType),(t.filterType==="yearly"||t.filterType==="monthly")&&(t.year&&(h.year=t.year),t.month&&(h.month=t.month)),t.filterType==="day"&&t.day&&(h.day=t.day),t.filterType==="range"&&(t.dateFrom&&(h.date_from=t.dateFrom),t.dateTo&&(h.date_to=t.dateTo)),t.supervisorId&&(h.supervisor=t.supervisorId),h},L=r.useCallback((t=v,g=x,$=y)=>{U(!0),T.get("/supervisors/report/all/",{params:se(t,g,$)}).then(({data:h})=>{Q(h),ee({total:h.total,total_pages:h.total_pages})}).catch(()=>alert("تعذّر تحميل التقرير.")).finally(()=>U(!1))},[v,x,y]);r.useEffect(()=>{i==="reports"&&L(v,1,y)},[i]),r.useEffect(()=>{i==="reports"&&N!==null&&L(v,x,y)},[x]);const E=Math.ceil(b/P),A=()=>{const t=v;return t.filterType==="yearly"?`السنة ${t.year||"الكاملة"}`:t.filterType==="monthly"?`${t.month?J[Number(t.month)-1]:"كل الشهور"} ${t.year||""}`:t.filterType==="day"?t.day?`يوم ${t.day}`:"يوم محدد":t.filterType==="range"?`${t.dateFrom||"—"} إلى ${t.dateTo||"—"}`:"جميع الفترات"},H=(N==null?void 0:N.students)||[],q=(N==null?void 0:N.summary)||[],ae=()=>{const{total:t,total_pages:g}=F;if(g<=1)return null;const $=(x-1)*y+1,h=Math.min(x*y,t);return e.jsxs("div",{className:"flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-3 border-t border-white/08",children:[e.jsxs("p",{className:"text-white/40 text-xs",children:["عرض ",e.jsxs("span",{className:"text-white",children:[$,"–",h]})," من ",e.jsx("span",{className:"text-brand-blue font-semibold",children:t})," طالب"]}),e.jsxs("div",{className:"flex items-center gap-1",children:[e.jsx("button",{disabled:x===1,onClick:()=>k(1),className:"btn-ghost p-1.5 disabled:opacity-30",title:"الأولى",children:e.jsx(he,{size:15})}),e.jsx("button",{disabled:x===1,onClick:()=>k(n=>n-1),className:"btn-ghost p-1.5 disabled:opacity-30",title:"السابق",children:e.jsx(Y,{size:15})}),Array.from({length:g},(n,z)=>z+1).filter(n=>n===1||n===g||Math.abs(n-x)<=1).reduce((n,z,D,le)=>(D>0&&le[D-1]!==z-1&&n.push("..."),n.push(z),n),[]).map((n,z)=>n==="..."?e.jsx("span",{className:"text-white/30 text-xs px-1",children:"…"},z):e.jsx("button",{onClick:()=>k(n),className:`w-7 h-7 rounded-lg text-xs font-medium transition-all ${n===x?"bg-brand-blue text-white":"text-white/50 hover:bg-white/10 hover:text-white"}`,children:n},z)),e.jsx("button",{disabled:x===g,onClick:()=>k(n=>n+1),className:"btn-ghost p-1.5 disabled:opacity-30",title:"التالي",children:e.jsx(O,{size:15})}),e.jsx("button",{disabled:x===g,onClick:()=>k(g),className:"btn-ghost p-1.5 disabled:opacity-30",title:"الأخيرة",children:e.jsx(me,{size:15})})]}),e.jsx("select",{value:y,onChange:n=>{Z(Number(n.target.value)),k(1)},className:"input-glass text-xs py-1.5 px-3 w-auto",children:[10,20,50,100].map(n=>e.jsxs("option",{value:n,children:[n," بالصفحة"]},n))})]})};return e.jsxs("div",{className:"space-y-5 animate-fade-in",children:[e.jsxs("div",{className:"flex items-center justify-between flex-wrap gap-3",children:[e.jsxs("div",{children:[e.jsxs("h1",{className:"font-cairo font-bold text-white text-xl flex items-center gap-2",children:[e.jsx(S,{size:20,className:"text-brand-blue"})," إدارة المشرفات"]}),e.jsxs("p",{className:"text-white/40 text-sm mt-0.5",children:["إجمالي: ",e.jsx("span",{className:"text-brand-blue font-medium",children:b})," مشرفة"]})]}),e.jsxs("button",{onClick:()=>p({}),className:"btn-primary",children:[e.jsx(V,{size:16})," مشرفة جديدة"]})]}),e.jsx("div",{className:"flex gap-1 p-1 bg-white/5 rounded-xl w-fit",children:[{id:"list",icon:e.jsx(I,{size:14}),label:"قائمة المشرفات"},{id:"reports",icon:e.jsx(xe,{size:14}),label:"التقارير الشاملة"}].map(t=>e.jsxs("button",{onClick:()=>m(t.id),className:`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${i===t.id?"bg-brand-blue text-white shadow-neon":"text-white/50 hover:text-white"}`,children:[t.icon," ",t.label]},t.id))}),i==="list"&&e.jsxs(e.Fragment,{children:[e.jsxs("div",{className:"relative max-w-sm",children:[e.jsx(X,{size:16,className:"absolute right-3 top-1/2 -translate-y-1/2 text-white/30"}),e.jsx("input",{value:c,onChange:t=>{d(t.target.value),a(1)},placeholder:"ابحث بالاسم...",className:"input-glass pr-10"}),c&&e.jsx("button",{onClick:()=>d(""),className:"absolute left-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white",children:e.jsx(B,{size:14})})]}),e.jsxs("div",{className:"glass-card overflow-hidden",children:[u?e.jsx("div",{className:"p-12 text-center",children:e.jsx(M,{size:28,className:"animate-spin text-brand-blue mx-auto"})}):l.length===0?e.jsxs("div",{className:"p-12 text-center text-white/40",children:[e.jsx(S,{size:40,className:"mx-auto mb-3 opacity-30"}),e.jsx("p",{children:"لا توجد مشرفات. أضف المشرفة الأولى!"})]}):e.jsx("div",{className:"divide-y divide-white/05",children:l.map(t=>e.jsxs("div",{className:`flex items-center gap-4 p-4 hover:bg-white/3 transition-colors ${t.is_active?"":"opacity-50"}`,children:[e.jsx("div",{className:"w-10 h-10 rounded-xl bg-brand-blue/10 flex items-center justify-center shrink-0",children:e.jsx(S,{size:18,className:"text-brand-blue"})}),e.jsxs("div",{className:"flex-1 min-w-0",children:[e.jsxs("div",{className:"flex items-center gap-2 flex-wrap",children:[e.jsx("h3",{className:"font-cairo font-semibold text-white",children:t.name}),!t.is_active&&e.jsx("span",{className:"badge badge-red text-xs",children:"موقوفة"}),e.jsxs("span",{className:"text-white/25 text-xs flex items-center gap-1",children:[e.jsx(I,{size:10})," ",t.student_count," طالب"]})]}),e.jsxs("div",{className:"flex items-center gap-4 mt-1 flex-wrap",children:[t.phone&&e.jsxs("span",{className:"text-white/40 text-xs flex items-center gap-1",dir:"ltr",children:[e.jsx(re,{size:10})," ",t.phone]}),t.address&&e.jsxs("span",{className:"text-white/40 text-xs flex items-center gap-1",children:[e.jsx(de,{size:10})," ",t.address]})]})]}),e.jsxs("div",{className:"flex items-center gap-2 shrink-0",children:[e.jsx("button",{onClick:()=>s(`/dashboard/supervisors/${t.id}`),title:"عرض التفاصيل والتقارير",className:"btn-ghost p-2 text-white/40 hover:text-neon-cyan",children:e.jsx(je,{size:15})}),e.jsx("button",{onClick:()=>p({supervisor:t}),className:"btn-ghost p-2 text-brand-blue",title:"تعديل",children:e.jsx(G,{size:15})}),e.jsx("button",{onClick:()=>te(t.id),className:"btn-ghost p-2 text-brand-red/40 hover:text-brand-red",title:"حذف",children:e.jsx(pe,{size:15})})]})]},t.id))}),E>1&&e.jsxs("div",{className:"flex items-center justify-between px-4 py-3 border-t border-white/05",children:[e.jsxs("p",{className:"text-white/40 text-xs",children:["صفحة ",w," من ",E]}),e.jsxs("div",{className:"flex gap-2",children:[e.jsx("button",{disabled:w===1,onClick:()=>a(t=>t-1),className:"btn-ghost p-1.5 disabled:opacity-30",children:e.jsx(Y,{size:16})}),e.jsx("button",{disabled:w===E,onClick:()=>a(t=>t+1),className:"btn-ghost p-1.5 disabled:opacity-30",children:e.jsx(O,{size:16})})]})]})]})]}),i==="reports"&&e.jsxs("div",{className:"space-y-5",children:[e.jsx("div",{className:"grid grid-cols-2 md:grid-cols-4 gap-4",children:[{label:"إجمالي المشرفات",value:b,icon:e.jsx(S,{size:18,className:"text-brand-blue"}),color:"text-brand-blue"},{label:"إجمالي الطلاب في التقرير",value:C?"...":F.total,icon:e.jsx(I,{size:18,className:"text-neon-cyan"}),color:"text-neon-cyan"},{label:"الفترة المحددة",value:A(),icon:e.jsx(be,{size:18,className:"text-purple-400"}),color:"text-purple-400",small:!0},{label:"المشرفات الفعّالة",value:l.filter(t=>t.is_active).length,icon:e.jsx(oe,{size:18,className:"text-green-400"}),color:"text-green-400"}].map((t,g)=>e.jsx("div",{className:"glass-card p-4",children:e.jsxs("div",{className:"flex items-center gap-3",children:[e.jsx("div",{className:"w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center shrink-0",children:t.icon}),e.jsxs("div",{className:"min-w-0",children:[e.jsx("p",{className:"text-white/40 text-xs",children:t.label}),e.jsx("p",{className:`font-bold mt-0.5 ${t.color} ${t.small?"text-sm":"text-lg"} truncate`,children:t.value})]})]})},g))}),e.jsxs("div",{className:"grid lg:grid-cols-[280px_1fr] gap-5 items-start",children:[e.jsx(Ne,{filters:v,onChange:W,onApply:()=>{k(1),L(v,1,y)},loading:C,supervisors:l}),e.jsxs("div",{className:"glass-card overflow-hidden",children:[e.jsxs("div",{className:"flex items-center justify-between px-5 py-4 border-b border-white/08",children:[e.jsxs("div",{children:[e.jsx("p",{className:"text-white font-semibold text-sm",children:A()}),e.jsx("p",{className:"text-white/40 text-xs mt-0.5",children:C?"جاري التحميل...":`${F.total} طالب • صفحة ${x} من ${F.total_pages}`})]}),!C&&H.length>0&&e.jsx("button",{onClick:()=>ye(H,q,A()),className:"btn-ghost p-2 text-white/40 hover:text-white",title:"طباعة / PDF",children:e.jsx(ge,{size:16})})]}),e.jsx(ve,{students:H,loading:C,summary:q}),e.jsx(ae,{})]})]})]}),f!==null&&e.jsx(we,{supervisor:f.supervisor,onClose:()=>p(null),onSaved:R})]})}export{Re as default};
