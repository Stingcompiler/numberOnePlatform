import re

with open("FinancePage.jsx", "r") as f:
    content = f.read()

# Replace the table headers for payments tab
old_thead = """              <tr>
                <th>الطالب</th>
                <th>التاريخ</th>
                <th>المبلغ</th>
                <th>الريال (﷼)</th>
                <th>طريقة الدفع</th>
                <th>المعاملة / الإيصال</th>
              </tr>"""
new_thead = """              <tr>
                <th>الطالب</th>
                <th>المطلوب</th>
                <th>المتبقي</th>
                <th>التاريخ</th>
                <th>المبلغ</th>
                <th>الريال (﷼)</th>
                <th>طريقة الدفع</th>
                <th>المعاملة / الإيصال</th>
              </tr>"""
content = content.replace(old_thead, new_thead)

# Replace the row mapping
old_row = """                <tr key={p.id}>
                  <td className="font-medium text-white">{p.financial_file?.student?.user?.full_name || 'غير معروف'}</td>
                  <td className="text-white/70 text-sm" dir="ltr">{p.payment_date}</td>
                  <td className="text-neon-cyan font-medium">{Number(p.amount_sdg).toLocaleString()} ج.س</td>"""
new_row = """                <tr key={p.id}>
                  <td className="font-medium text-white">{p.financial_file?.student?.user?.full_name || 'غير معروف'}</td>
                  <td className="text-white/70 text-sm">{Number(p.student_total_required).toLocaleString()} ج.س</td>
                  <td className="text-brand-red font-bold">{Number(p.student_balance).toLocaleString()} ج.س</td>
                  <td className="text-white/70 text-sm" dir="ltr">{p.payment_date}</td>
                  <td className="text-neon-cyan font-medium">{Number(p.amount_sdg).toLocaleString()} ج.س</td>"""
content = content.replace(old_row, new_row)

# Re-colspan the 'no data' row from 6 to 8
content = content.replace("""colSpan={6}""", """colSpan={8}""")

with open("FinancePage.jsx", "w") as f:
    f.write(content)
print("patch successful")
