import React, { useState } from 'react';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { FileSpreadsheet, Loader2 } from 'lucide-react';

export const MasterReportButton: React.FC = () => {
  const [loading, setLoading] = useState(false);

  const generateReport = async () => {
    setLoading(true);
    try {
      toast.loading('جاري تجهيز التقرير الشامل...', { id: 'master-report' });

      // Fetch data from Supabase
      const [ordersData, entitiesData, receivablesData, paymentsData, userProfilesData, employeeTransactionsData, expensesData] = await Promise.all([
        supabase.from('orders').select('*').order('created_at', { ascending: false }),
        supabase.from('entities').select('*').eq('type', 'مورد').order('name'),
        supabase.from('receivables').select('*'),
        supabase.from('payments').select('*'),
        supabase.from('user_profiles').select('*').eq('role', 'user').eq('is_active', true).order('full_name'),
        supabase.from('employee_balance_transactions').select('*').order('transaction_date', { ascending: false }),
        supabase.from('expenses').select('*').order('created_at', { ascending: false })
      ]);

      const orders = ordersData.data || [];
      const entities = entitiesData.data || [];
      const receivables = receivablesData.data || [];
      const payments = paymentsData.data || [];
      const userProfiles = userProfilesData.data || [];
      const employeeTransactions = employeeTransactionsData.data || [];
      const expenses = expensesData.data || [];

      // Create workbook
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'نظام إدارة المخزون';
      workbook.created = new Date();

      // Sheet 1: Orders
      const ordersSheet = workbook.addWorksheet('الطلبات', {
        views: [{ rightToLeft: true }],
        properties: { defaultColWidth: 20 }
      });

      ordersSheet.columns = [
        { header: 'معرف الطلب', key: 'id', width: 25 },
        { header: 'التاريخ', key: 'date', width: 20 },
        { header: 'الإجمالي (سلة)', key: 'total', width: 15 },
        { header: 'الحالة', key: 'status', width: 15 }
      ];

      // Style header row
      ordersSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      ordersSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
      ordersSheet.getRow(1).alignment = { horizontal: 'center', vertical: 'middle' };

      orders.forEach((order: any) => {
        ordersSheet.addRow({
          id: order.id || '',
          date: order.created_at ? new Date(order.created_at).toLocaleDateString('ar-SA') : '',
          total: order.total || 0,
          status: order.status || ''
        });
      });

      // Sheet 2: Vendors
      const vendorsSheet = workbook.addWorksheet('الموردين', {
        views: [{ rightToLeft: true }],
        properties: { defaultColWidth: 20 }
      });

      vendorsSheet.columns = [
        { header: 'اسم المورد', key: 'name', width: 30 },
        { header: 'إجمالي الفواتير', key: 'total_invoiced', width: 18 },
        { header: 'المدفوع الفعلي', key: 'actual_paid', width: 18 },
        { header: 'الرصيد المستحق', key: 'outstanding', width: 18 }
      ];

      vendorsSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      vendorsSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF10B981' } };
      vendorsSheet.getRow(1).alignment = { horizontal: 'center', vertical: 'middle' };

      entities.forEach((entity: any) => {
        // Calculate vendor totals
        const vendorReceivables = receivables.filter((r: any) => r.entity_id === entity.id);
        const totalInvoiced = vendorReceivables.reduce((sum: number, r: any) => sum + parseFloat(r.total_amount || 0), 0);
        const outstanding = vendorReceivables.reduce((sum: number, r: any) => sum + parseFloat(r.remaining_amount || 0), 0);
        const actualPaid = totalInvoiced - outstanding;

        vendorsSheet.addRow({
          name: entity.name || '',
          total_invoiced: totalInvoiced,
          actual_paid: actualPaid,
          outstanding: outstanding
        });
      });

      // Sheet 3: Custody Audit
      const custodySheet = workbook.addWorksheet('مراجعة العهد', {
        views: [{ rightToLeft: true }],
        properties: { defaultColWidth: 20 }
      });

      custodySheet.columns = [
        { header: 'اسم الموظف', key: 'employee_name', width: 30 },
        { header: 'إجمالي الصرف (IN)', key: 'total_in', width: 20 },
        { header: 'إجمالي التسوية (OUT)', key: 'total_out', width: 20 },
        { header: 'الرصيد المحسوب', key: 'balance', width: 20 }
      ];

      custodySheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      custodySheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFBBF24' } };
      custodySheet.getRow(1).alignment = { horizontal: 'center', vertical: 'middle' };

      userProfiles.forEach((user: any) => {
        const userTransactions = employeeTransactions.filter((t: any) => t.user_id === user.id);
        const totalIn = userTransactions
          .filter((t: any) => parseFloat(t.amount) > 0)
          .reduce((sum: number, t: any) => sum + parseFloat(t.amount || 0), 0);
        const totalOut = Math.abs(userTransactions
          .filter((t: any) => parseFloat(t.amount) < 0)
          .reduce((sum: number, t: any) => sum + parseFloat(t.amount || 0), 0));
        const balance = totalIn - totalOut;

        custodySheet.addRow({
          employee_name: user.full_name || user.email || '',
          total_in: totalIn,
          total_out: totalOut,
          balance: balance
        });
      });

      // Apply number formatting to all data sheets
      [ordersSheet, vendorsSheet, custodySheet].forEach(sheet => {
        sheet.eachRow((row, rowNumber) => {
          if (rowNumber > 1) {
            row.eachCell((cell) => {
              if (typeof cell.value === 'number') {
                cell.numFmt = '#,##0.00';
              }
              cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
              };
            });
            if (rowNumber % 2 === 0) {
              row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
            }
          }
        });
      });

      // Generate timestamped filename
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `Master_Report_${timestamp}.xlsx`;

      // Write and download
      const buffer = await workbook.xlsx.writeBuffer();
      saveAs(new Blob([buffer]), filename);

      toast.success('تم تصدير التقرير الشامل بنجاح!', { id: 'master-report' });
    } catch (error: any) {
      console.error('Error generating master report:', error);
      toast.error('فشل إنشاء التقرير: ' + (error.message || 'حدث خطأ غير متوقع'), { id: 'master-report' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={generateReport}
      disabled={loading}
      className="bg-green-600 text-white px-5 py-2.5 rounded-lg hover:bg-green-700 transition-all flex items-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <FileSpreadsheet className="h-4 w-4" />
      )}
      <span>Export Master Report</span>
    </button>
  );
};

export default MasterReportButton;