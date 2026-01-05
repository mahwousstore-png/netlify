// src/components/Suppliers.tsx
import React, { useState, useEffect } from 'react';
import {
  Search, Building2, DollarSign, ArrowLeft, Plus,
  Edit2, MapPin, Phone, Mail, Trash2, Wallet,
  Download, FileText, Eye, TrendingUp, User, Clock
} from 'lucide-react';
import { auditLogger } from '../lib/auditLogger';
import { useReceivables } from '../hooks/useReceivables';
import { authService } from "../lib/auth";
import { supabase } from "../lib/supabase";
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import toast from 'react-hot-toast';
import Swal from 'sweetalert2';
import { formatDateTime } from '../lib/dateUtils';
import MasterReportButton from './MasterReportButton';

const Suppliers: React.FC = () => {
  const {
    entities,
    receivables,
    loading,
    addEntity,
    updateEntity,
    deleteEntity,
    refresh
  } = useReceivables();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEntity, setSelectedEntity] = useState<any>(null);
  const [showPayModal, setShowPayModal] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<'كاش' | 'تحويل'>('كاش');
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [supplierName, setSupplierName] = useState('');
  const [supplierAddress, setSupplierAddress] = useState('');
  const [supplierPhone, setSupplierPhone] = useState('');
  const [supplierEmail, setSupplierEmail] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [showPaymentHistory, setShowPaymentHistory] = useState(false);
  const [paymentHistory, setPaymentHistory] = useState<any[]>([]);
  const [showEmployeeBalance, setShowEmployeeBalance] = useState(false);
  const [employeeTransactions, setEmployeeTransactions] = useState<any[]>([]);

  // رصيد الموظف
  const [employeeBalance, setEmployeeBalance] = useState<number>(0);
  const [balanceLoading, setBalanceLoading] = useState(true);

  // إدارة المستحقات (للأدمن)
  const [showReceivableModal, setShowReceivableModal] = useState(false);
  const [receivableFormData, setReceivableFormData] = useState({
    id: '',
    description: '',
    amount: '',
    dueDate: new Date().toISOString().split('T')[0],
  });
  const [isEditReceivable, setIsEditReceivable] = useState(false);

  const currentUser = authService.getCurrentUser();
  const isAdmin = currentUser?.role === 'admin';

  // Calculate total receivables for all suppliers
  const totalReceivables = receivables
    .filter(r => entities.some(e => e.id === r.entity_id && e.type === 'مورد'))
    .reduce((sum, r) => sum + r.remaining_amount, 0);

  // تنسيق العملة
  const formatCurrency = (v: number): string => {
    const rounded = Math.round(v * 100) / 100;
    return `${rounded.toLocaleString('en-SA', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} ر.س`;
  };

  // تحويل الأرقام العربية إلى إنجليزية
  const toEnglishDigits = (str: string) =>
    str.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString())
      .replace(/[^0-9.]/g, '');

  const formatDate = (dateString: any) => formatDateTime(dateString);

  const fetchPaymentHistory = async () => {
    if (!selectedEntity) return;

    try {
      const entityReceivables = receivables.filter(r => r.entity_id === selectedEntity.id);
      const receivableIds = entityReceivables.map(r => r.id);

      if (receivableIds.length === 0) {
        setPaymentHistory([]);
        return;
      }

      const { data, error } = await supabase
        .from('payments')
        .select(`
          id,
          receivable_id,
          amount,
          receipt_number,
          payment_date,
          created_at,
          notes,
          created_by,
          created_by_user:user_profiles!payments_created_by_fkey(full_name, email)
        `)
        .in('receivable_id', receivableIds)
        .order('payment_date', { ascending: false });

      if (error) throw error;
      setPaymentHistory(data || []);
    } catch (err) {
      console.error('Error fetching payment history:', err);
      toast.error('فشل جلب سجل المدفوعات');
    }
  };

  const fetchEmployeeTransactions = async () => {
    if (!currentUser) return;

    try {
      const { data, error } = await supabase
        .from('employee_balance_transactions')
        .select(`
          *,
          created_by_user:user_profiles!employee_balance_transactions_created_by_fkey(full_name)
        `)
        .eq('user_id', currentUser.id)
        .order('transaction_date', { ascending: false });

      if (error) throw error;
      setEmployeeTransactions(data || []);
    } catch (err) {
      console.error('Error fetching employee transactions:', err);
      toast.error('فشل جلب سجل العهدة');
    }
  };

  const handleExportExcel = async () => {
    if (!selectedEntity) return;

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(`مورد ${selectedEntity.name}`, {
      pageSetup: { paperSize: 9, orientation: 'portrait' },
      properties: { defaultColWidth: 20 },
      views: [{ rightToLeft: true }]
    });

    worksheet.mergeCells('A1:D1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = `تقرير المورد: ${selectedEntity.name}`;
    titleCell.font = { size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

    worksheet.mergeCells('A2:D2');
    const dateCell = worksheet.getCell('A2');
    dateCell.value = `تاريخ التقرير: ${formatDate(new Date().toISOString())}`;
    dateCell.font = { size: 12, italic: true };
    dateCell.alignment = { horizontal: 'center' };

    worksheet.mergeCells('A3:D3');
    const balanceCell = worksheet.getCell('A3');
    balanceCell.value = `إجمالي المستحقات: ${formatCurrency(totalDue)}`;
    balanceCell.font = { size: 14, bold: true };
    balanceCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEF4444' } };
    balanceCell.alignment = { horizontal: 'center', vertical: 'middle' };

    const headerRow = worksheet.addRow(['الوصف', 'تاريخ الاستحقاق', 'المبلغ الكلي', 'المتبقي']);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
    headerRow.eachCell((cell) => {
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });

    entityReceivables.forEach((r, index) => {
      const row = worksheet.addRow([
        r.description,
        formatDate(r.due_date),
        r.total_amount.toFixed(2),
        r.remaining_amount.toFixed(2)
      ]);

      row.eachCell((cell, colNumber) => {
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        if (colNumber >= 3) {
          cell.numFmt = '#,##0.00';
        }
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });

      if (index % 2 === 0) {
        row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
      }
    });

    // إضافة سجل المدفوعات
    if (paymentHistory.length > 0) {
      worksheet.addRow([]);
      worksheet.mergeCells(`A${worksheet.rowCount + 1}:D${worksheet.rowCount + 1}`);
      const paymentTitleCell = worksheet.getCell(`A${worksheet.rowCount}`);
      paymentTitleCell.value = 'سجل المدفوعات';
      paymentTitleCell.font = { size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
      paymentTitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF10B981' } };
      paymentTitleCell.alignment = { horizontal: 'center', vertical: 'middle' };

      const paymentHeaderRow = worksheet.addRow(['التاريخ', 'المبلغ', 'رقم الإيصال', 'المسدد']);
      paymentHeaderRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      paymentHeaderRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF059669' } };
      paymentHeaderRow.eachCell((cell) => {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });

      paymentHistory.forEach((payment, index) => {
        const row = worksheet.addRow([
          formatDate(payment.payment_date),
          parseFloat(payment.amount).toFixed(2),
          payment.receipt_number,
          payment.created_by_user?.full_name || payment.created_by_user?.email || (payment.notes ? payment.notes.split(' - ')[1] || 'مدفوعات قديمة' : 'مدفوعات قديمة')
        ]);

        row.eachCell((cell, colNumber) => {
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
          if (colNumber === 2) {
            cell.numFmt = '#,##0.00';
          }
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          };
        });

        if (index % 2 === 0) {
          row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDF4' } };
        }
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const fileName = `مورد_${selectedEntity.name}_${new Date().toISOString().split('T')[0]}.xlsx`;
    saveAs(new Blob([buffer]), fileName);
    toast.success('تم تصدير التقرير بنجاح');
  };

  const handleExportPDF = async () => {
    const previewElement = document.getElementById('supplier-preview-content');
    if (!previewElement) return;

    try {
      const canvas = await html2canvas(previewElement, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pdfWidth - 20;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 10;

      pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight - 20;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight + 10;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
        heightLeft -= pdfHeight - 20;
      }

      const fileName = `مورد_${selectedEntity.name}_${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(fileName);
      toast.success('تم تصدير التقرير بنجاح');
    } catch (err) {
      console.error('Error generating PDF:', err);
      toast.error('حدث خطأ أثناء إنشاء ملف PDF');
    }
  };

  // جلب رصيد الموظف عند التحميل
  useEffect(() => {
    if (!isAdmin && currentUser) {
      const fetchBalance = async () => {
        try {
          const { data, error } = await supabase
            .from('employee_balance_transactions')
            .select('amount')
            .eq('user_id', currentUser.id);

          if (error) throw error;

          const total = data?.reduce((sum, t) => sum + Number(t.amount), 0) || 0;
          setEmployeeBalance(total);
        } catch (err) {
          console.error('فشل جلب الرصيد:', err);
          setEmployeeBalance(0);
        } finally {
          setBalanceLoading(false);
        }
      };
      fetchBalance();
    } else {
      setBalanceLoading(false);
    }
  }, [currentUser, isAdmin]);

  const filteredEntities = entities
    .filter(e => e.type === 'مورد')
    .filter(e => e.name?.toLowerCase().includes(searchTerm.toLowerCase()));

  const getContactInfo = (entity: any) => entity.contact_info || {};

  const entityReceivables = selectedEntity
    ? receivables
      .filter(r => r.entity_id === selectedEntity.id && r.remaining_amount > 0)
      .sort((a, b) => new Date(a.due_date || 0).getTime() - new Date(b.due_date || 0).getTime())
    : [];

  const totalDue = entityReceivables.reduce((sum, r) => sum + r.remaining_amount, 0);

  // مودال إضافة / تعديل مورد
  const openAddModal = () => {
    setIsEditMode(false);
    setSupplierName('');
    setSupplierAddress('');
    setSupplierPhone('');
    setSupplierEmail('');
    setShowSupplierModal(true);
  };

  const openEditModal = () => {
    if (!selectedEntity) return;
    const info = getContactInfo(selectedEntity);
    setIsEditMode(true);
    setSupplierName(selectedEntity.name || '');
    setSupplierAddress(info.address || '');
    setSupplierPhone(info.phone || '');
    setSupplierEmail(info.email || '');
    setShowSupplierModal(true);
  };

  const handleSaveSupplier = async () => {
    if (!supplierName.trim()) return alert('اسم المورد مطلوب');
    if (!supplierAddress.trim()) return alert('العنوان مطلوب');

    const contactInfo = {
      address: supplierAddress.trim(),
      phone: supplierPhone.trim() || undefined,
      email: supplierEmail.trim() || undefined,
    };

    try {
      if (isEditMode && selectedEntity) {
        await updateEntity(selectedEntity.id, { name: supplierName.trim(), contact_info: contactInfo });
        setSelectedEntity({ ...selectedEntity, name: supplierName.trim(), contact_info: contactInfo });
      } else {
        await addEntity({ name: supplierName.trim(), type: 'مورد', contact_info: contactInfo });
      }
      setShowSupplierModal(false);
      refresh();
      alert('تم الحفظ بنجاح');
    } catch (error: any) {
      alert('فشل الحفظ: ' + error.message);
    }
  };

  const handleDeleteSupplier = async () => {
    if (!isAdmin) return alert('غير مسموح لك');
    if (!confirm(`حذف "${selectedEntity.name}" نهائيًا؟`)) return;
    try {
      await deleteEntity(selectedEntity.id);
      setSelectedEntity(null);
      alert('تم الحذف');
    } catch {
      alert('فشل الحذف');
    }
  };

  // دوال إدارة المستحقات
  const openAddReceivableModal = () => {
    setIsEditReceivable(false);
    setReceivableFormData({
      id: '',
      description: '',
      amount: '',
      dueDate: new Date().toISOString().split('T')[0],
    });
    setShowReceivableModal(true);
  };

  const openEditReceivableModal = (receivable: any) => {
    setIsEditReceivable(true);
    setReceivableFormData({
      id: receivable.id,
      description: receivable.description,
      amount: receivable.total_amount.toString(),
      dueDate: receivable.due_date.split('T')[0],
    });
    setShowReceivableModal(true);
  };

  const handleSaveReceivable = async () => {
    if (!isAdmin) return alert('غير مسموح لك');
    if (!receivableFormData.description || !receivableFormData.amount) {
      return alert('جميع الحقول مطلوبة');
    }

    const amount = parseFloat(toEnglishDigits(receivableFormData.amount));
    if (isNaN(amount) || amount <= 0) return alert('المبلغ غير صحيح');

    try {
      if (isEditReceivable) {
        // تحديث مستحق
        const oldReceivable = receivables.find(r => r.id === receivableFormData.id);
        if (!oldReceivable) return;

        const diff = amount - oldReceivable.total_amount;
        const newRemaining = oldReceivable.remaining_amount + diff;

        if (newRemaining < 0) return alert('لا يمكن تعديل المبلغ ليكون أقل من المدفوع');

        const { error } = await supabase
          .from('receivables')
          .update({
            description: receivableFormData.description,
            total_amount: amount,
            remaining_amount: newRemaining,
            due_date: receivableFormData.dueDate,
          })
          .eq('id', receivableFormData.id);

        if (error) throw error;
      } else {
        // إضافة مستحق جديد
        const { error } = await supabase
          .from('receivables')
          .insert({
            entity_id: selectedEntity.id,
            description: receivableFormData.description,
            total_amount: amount,
            remaining_amount: amount,
            due_date: receivableFormData.dueDate,
            purchase_date: new Date().toISOString().split('T')[0],
          });

        if (error) throw error;
      }
      setShowReceivableModal(false);
      refresh();
      alert('تم الحفظ بنجاح');
    } catch (error: any) {
      alert('فشل الحفظ: ' + error.message);
    }
  };

  const handleDeleteReceivable = async (id: string) => {
    if (!isAdmin) return alert('غير مسموح لك');
    if (!confirm('هل أنت متأكد من حذف هذا المستحق؟')) return;
    try {
      const { error } = await supabase.from('receivables').delete().eq('id', id);
      if (error) throw error;
      refresh();
      alert('تم الحذف بنجاح');
    } catch (error: any) {
      alert('فشل الحذف: ' + error.message);
    }
  };

  // Safe Delete Payment - Admin Only
  const [isDeletingPayment, setIsDeletingPayment] = useState(false);

  const handleSafeDeletePayment = async (payment: any) => {
    if (!isAdmin) {
      Swal.fire('غير مسموح', 'هذه العملية متاحة للمدير فقط', 'error');
      return;
    }

    if (isDeletingPayment) return;

    // تأكيد من المستخدم
    const result = await Swal.fire({
      title: 'تأكيد حذف الدفعة',
      html: `
        <div class="text-right">
          <p class="mb-2"><strong>المبلغ:</strong> ${formatCurrency(payment.amount)}</p>
          <p class="mb-2"><strong>التاريخ:</strong> ${formatDate(payment.created_at)}</p>
          <p class="mb-2"><strong>الطريقة:</strong> ${payment.payment_method}</p>
          <p class="text-red-600 mt-4">⚠️ سيتم:</p>
          <ul class="text-sm text-gray-700 mt-2">
            <li>• إعادة المبلغ إلى رصيد المورد</li>
            <li>• إعادة المبلغ إلى عهدة الموظف</li>
            <li>• حذف سجل الدفعة نهائياً</li>
          </ul>
	          </div>
	        </div>
      `,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'نعم، احذف',
      cancelButtonText: 'إلغاء'
    });

    if (!result.isConfirmed) return;

    setIsDeletingPayment(true);

    try {
      // 1. تسجيل في Audit Log BEFORE deletion
      await auditLogger.logPayment({
        user_id: currentUser?.id || '',
        vendor_id: payment.entity_id,
        payment_id: payment.id,
        amount: payment.amount,
        payment_method: payment.payment_method,
        action_type: 'payment_deleted',
        status: 'success',
        notes: `حذف دفعة بواسطة ${currentUser?.full_name}`
      });

      // 2. إعادة المبلغ للمورد (receivables)
      const { error: receivableError } = await supabase
        .from('receivables')
        .update({
          remaining_amount: supabase.raw(`remaining_amount + ${payment.amount}`)
        })
        .eq('id', payment.receivable_id);

      if (receivableError) throw new Error('فشل تحديث رصيد المورد: ' + receivableError.message);

      // 3. إعادة المبلغ للموظف (employee_balance_transactions)
      const { error: balanceError } = await supabase
        .from('employee_balance_transactions')
        .insert({
          user_id: payment.created_by,
          amount: payment.amount,
          type: 'credit',
          reason: `استرداد دفعة محذوفة #${payment.id.slice(-6)}`,
          transaction_date: new Date().toISOString(),
          created_by: currentUser?.id
        });

      if (balanceError) throw new Error('فشل إعادة المبلغ للموظف: ' + balanceError.message);

      // 4. حذف الدفعة
      const { error: deleteError } = await supabase
        .from('payments')
        .delete()
        .eq('id', payment.id);

      if (deleteError) throw new Error('فشل حذف الدفعة: ' + deleteError.message);

      // 5. تحديث البيانات
      refresh();

      // 6. رسالة نجاح
      Swal.fire({
        title: 'تم الحذف بنجاح!',
        html: `
          <div class="text-right">
            <p>✅ تم حذف الدفعة</p>
            <p>✅ تم إعادة ${formatCurrency(payment.amount)} إلى رصيد المورد</p>
            <p>✅ تم إعادة ${formatCurrency(payment.amount)} إلى عهدة الموظف</p>
          </div>
        `,
        icon: 'success'
      });

    } catch (error: any) {
      console.error('Error deleting payment:', error);
      
      // تسجيل الفشل في Audit Log
      await auditLogger.logPayment({
        user_id: currentUser?.id || '',
        vendor_id: payment.entity_id,
        payment_id: payment.id,
        amount: payment.amount,
        payment_method: payment.payment_method,
        action_type: 'payment_deleted',
        status: 'failed',
        notes: `فشل الحذف: ${error.message}`
      });

      Swal.fire('خطأ', error.message || 'فشل حذف الدفعة', 'error');
    } finally {
      setIsDeletingPayment(false);
    }
  };

  // السداد مع التحقق من رصيد الموظف
  const handlePayment = async () => {
    const amount = parseFloat(toEnglishDigits(payAmount));
    if (isNaN(amount) || amount <= 0) return alert('أدخل مبلغ صحيح');
    if (amount > totalDue) return alert('المبلغ أكبر من المستحق');

    // تحقق من رصيد الموظف
    if (!isAdmin) {
      if (balanceLoading) return alert('جاري تحميل الرصيد...');
      if (employeeBalance < amount) {
        return alert(
          `الرصيد غير كافٍ!\nرصيدك: ${formatCurrency(employeeBalance)}\nالمطلوب: ${formatCurrency(amount)}`
        );
      }
    }

    let remaining = amount;

    try {
      // 1. سداد المستحقات في جدول receivables
      for (const rec of entityReceivables) {
        if (remaining <= 0) break;
        const payThis = Math.min(rec.remaining_amount, remaining);

        // Insert payment with created_by
        const { error: paymentError } = await supabase
          .from('payments')
          .insert({
            receivable_id: rec.id,
            amount: payThis,
            receipt_number: payMethod === 'تحويل' ? 'تحويل بنكي' : 'كاش',
            payment_date: new Date().toISOString().split('T')[0],
            notes: `سداد مورد: ${selectedEntity.name} - ${currentUser?.full_name || 'موظف'}`,
            created_by: currentUser?.id
          });

        if (paymentError) throw paymentError;

        // Update receivable remaining amount
        const newRemaining = rec.remaining_amount - payThis;
        const { error: updateError } = await supabase
          .from('receivables')
          .update({ remaining_amount: newRemaining > 0 ? newRemaining : 0 })
          .eq('id', rec.id);

        if (updateError) throw updateError;

        remaining -= payThis;
      }

      // 2. خصم من رصيد الموظف
      if (!isAdmin && currentUser) {
        const { error } = await supabase
          .from('employee_balance_transactions')
          .insert({
            user_id: currentUser.id,
            amount: -amount,
            type: 'debit',
            reason: `سداد للمورد: ${selectedEntity.name} - ${payMethod}`,
            transaction_date: new Date().toISOString().split('T')[0],
            created_by: currentUser.id,
          });

        if (error) throw error;
        setEmployeeBalance(prev => prev - amount); // تحديث فوري
      }

      setShowPayModal(false);
      setPayAmount('');
      alert(`تم السداد بنجاح: ${formatCurrency(amount)}`);
      refresh();
    } catch (err: any) {
      console.error(err);
      alert('فشل السداد: ' + (err.message || 'خطأ'));
    }
  };

  if (loading || balanceLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl text-gray-500">جاري التحميل...</div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-gray-50">

        {/* شريط العنوان */}
        <div className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-3 md:px-4 py-3 md:py-4 flex items-center justify-between">
            <h1 className="text-lg md:text-xl font-bold text-gray-800">الموردين والمستحقات</h1>
            <div className="flex items-center gap-3">
              {isAdmin && <MasterReportButton />}
              <button
                onClick={openAddModal}
                className="bg-indigo-600 text-white px-3 md:px-5 py-2 md:py-2.5 rounded-lg flex items-center gap-2 text-sm md:text-base font-medium hover:bg-indigo-700 transition">
                <Plus className="h-4 w-4 md:h-5 md:w-5" /> <span className="hidden sm:inline">مورد جديد</span><span className="sm:hidden">جديد</span>
              </button>
            </div>
	          </div>

        {/* إجمالي المستحقات لجميع الموردين */}
        <div className="max-w-7xl mx-auto px-3 md:px-4 py-4 md:py-6">
          <div className="bg-white border border-gray-200 rounded-lg md:rounded-xl p-4 md:p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="bg-red-100 text-red-600 p-2 md:p-3 rounded-lg ml-2 md:ml-4">
                  <DollarSign className="h-5 w-5 md:h-6 md:w-6" />
                </div>
                <div>
                  <p className="text-gray-600 text-xs md:text-sm">إجمالي المستحقات</p>
                  <h3 className="text-lg md:text-2xl font-bold text-red-600">{formatCurrency(totalReceivables)}</h3>
                </div>
              </div>
              <TrendingUp className="h-4 w-4 md:h-5 md:w-5 text-red-500" />
            </div>
          </div>
        </div>

        {/* رصيد الموظف في الأعلى */}
        {!isAdmin && (
          <div className="bg-gradient-to-r from-amber-500 to-orange-600 text-white py-3 md:py-4 shadow-lg">
            <div className="max-w-7xl mx-auto px-3 md:px-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 md:gap-4">
                <Wallet className="h-8 w-8 md:h-10 md:w-10" />
                <div>
                  <p className="text-sm md:text-lg opacity-90">رصيدك المتاح</p>
                  <p className="text-xl md:text-3xl font-bold">{formatCurrency(employeeBalance)}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  fetchEmployeeTransactions();
                  setShowEmployeeBalance(true);
                }}
                className="bg-white text-amber-600 px-4 md:px-6 py-2 md:py-3 rounded-lg md:rounded-xl hover:bg-amber-50 transition-colors flex items-center gap-2 font-bold shadow-lg text-sm md:text-base w-full sm:w-auto justify-center"
              >
                <FileText className="h-4 w-4 md:h-5 md:w-5" />
                تفاصيل العهدة
              </button>
            </div>
          </div>
        )}

        <div className="max-w-7xl mx-auto p-3 md:p-6">

          {/* قائمة الموردين */}
          {!selectedEntity ? (
            <>
              <div className="mb-6 md:mb-8">
                <div className="relative max-w-md w-full">
                  <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
                  <input
                    type="text"
                    placeholder="ابحث عن مورد..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pr-12 pl-4 py-3 bg-white border border-gray-200 rounded-xl shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
                {filteredEntities.map((entity) => {
                  const due = receivables
                    .filter(r => r.entity_id === entity.id && r.remaining_amount > 0)
                    .reduce((s, r) => s + r.remaining_amount, 0);
                  const info = getContactInfo(entity);
                  return (
                    <div
                      key={entity.id}
                      onClick={() => setSelectedEntity(entity)}
                      className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-xl cursor-pointer transition-all duration-300 border border-gray-100 group relative overflow-hidden"
                    >
                      <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                      <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-indigo-50 rounded-xl group-hover:bg-indigo-100 transition-colors duration-300">
                          <Building2 className="h-8 w-8 text-indigo-600" />
                        </div>
                        <span className="text-xs font-semibold bg-gray-100 text-gray-600 px-3 py-1 rounded-full">مورد</span>
                      </div>
                      <h3 className="font-bold text-lg text-gray-900 mb-2 group-hover:text-indigo-600 transition-colors">{entity.name}</h3>
                      <div className="space-y-1 mb-4">
                        {info.address && (
                          <p className="text-sm text-gray-500 flex items-center gap-2">
                            <MapPin className="h-3 w-3" />
                            <span className="truncate">{info.address}</span>
                          </p>
                        )}
                        {info.phone && (
                          <p className="text-sm text-gray-500 flex items-center gap-2" dir="ltr">
                            <Phone className="h-3 w-3" />
                            <span className="truncate">{info.phone}</span>
                          </p>
                        )}
                      </div>
                      <div className="pt-4 border-t border-gray-100 flex justify-between items-center">
                        <span className="text-sm text-gray-500">المستحقات</span>
                        {due > 0 ? (
                          <p className="text-lg font-bold text-red-600">{formatCurrency(due)}</p>
                        ) : (
                          <p className="text-sm font-semibold text-green-600 bg-green-50 px-2 py-1 rounded-lg">لا مستحقات</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            /* تفاصيل المورد */
            <div>
              <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between mb-8 gap-4">
                <button
                  onClick={() => setSelectedEntity(null)}
                  className="flex items-center gap-2 text-indigo-600 hover:bg-indigo-50 px-4 py-2 rounded-xl font-medium transition-colors">
                  <ArrowLeft className="h-5 w-5" /> رجوع للقائمة
                </button>
                <div className="flex flex-wrap gap-3 w-full lg:w-auto">
                  <button
                    onClick={() => {
                      fetchPaymentHistory();
                      setShowPaymentHistory(true);
                    }}
                    className="flex-1 lg:flex-none bg-gray-800 text-white px-5 py-2.5 rounded-xl hover:bg-gray-900 transition-all flex items-center justify-center gap-2 shadow-sm"
                  >
                    <Clock className="h-4 w-4" />
                    <span className="whitespace-nowrap">سجل المدفوعات</span>
                  </button>
                  <button
                    onClick={async () => {
                      await fetchPaymentHistory();
                      setShowPreview(true);
                    }}
                    className="flex-1 lg:flex-none bg-indigo-600 text-white px-5 py-2.5 rounded-xl hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 shadow-sm"
                  >
                    <Eye className="h-4 w-4" />
                    <span>معاينة</span>
                  </button>
                  <button
                    onClick={async () => {
                      await fetchPaymentHistory();
                      handleExportExcel();
                    }}
                    className="flex-1 lg:flex-none bg-green-600 text-white px-5 py-2.5 rounded-xl hover:bg-green-700 transition-all flex items-center justify-center gap-2 shadow-sm"
                  >
                    <Download className="h-4 w-4" />
                    <span>Excel</span>
                  </button>
                  {isAdmin && (
                    <>
                      <button onClick={openEditModal} className="flex-1 lg:flex-none bg-blue-600 text-white px-5 py-2.5 rounded-xl hover:bg-blue-700 flex items-center justify-center gap-2 shadow-sm">
                        <Edit2 className="h-4 w-4" /> <span>تعديل</span>
                      </button>
                      {isAdmin && (
                        <button onClick={handleDeleteSupplier} className="flex-1 lg:flex-none bg-red-600 text-white px-5 py-2.5 rounded-xl hover:bg-red-700 flex items-center justify-center gap-2 shadow-sm">
                          <Trash2 className="h-4 w-4" /> <span>حذف</span>
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-xl p-8">
                <div className="text-center mb-8">
                  <div className="inline-flex p-5 bg-indigo-100 rounded-full mb-4">
                    <Building2 className="h-12 w-12 text-indigo-600" />
                  </div>
                  <h2 className="text-3xl font-bold text-gray-800">{selectedEntity.name}</h2>
                  <div className="mt-4 space-y-2 text-gray-600">
                    {getContactInfo(selectedEntity).address && (
                      <p className="flex items-center justify-center gap-2">
                        <MapPin className="h-5 w-5" /> {getContactInfo(selectedEntity).address}
                      </p>
                    )}
                    {getContactInfo(selectedEntity).phone && (
                      <p className="flex items-center justify-center gap-2" dir="ltr">
                        <Phone className="h-5 w-5" /> {getContactInfo(selectedEntity).phone}
                      </p>
                    )}
                    {getContactInfo(selectedEntity).email && (
                      <p className="flex items-center justify-center gap-2">
                        <Mail className="h-5 w-5" /> {getContactInfo(selectedEntity).email}
                      </p>
                    )}
                  </div>
                </div>

                {/* رصيد الموظف داخل تفاصيل المورد */}
                {!isAdmin && (
                  <div className="mb-8 p-6 bg-gradient-to-r from-amber-50 to-orange-100 border-2 border-amber-400 rounded-2xl text-center">
                    <p className="text-amber-800 font-bold text-lg mb-2">رصيدك المتاح للسداد</p>
                    <p className="text-4xl font-extrabold text-amber-900">{formatCurrency(employeeBalance)}</p>
                  </div>
                )}

                <div className="bg-gradient-to-r from-red-500 to-rose-600 rounded-2xl p-8 text-white text-center mb-8">
                  <p className="text-xl mb-2 opacity-90">إجمالي المستحقات</p>
                  <p className="text-5xl font-bold">{formatCurrency(totalDue)}</p>
                  {totalDue > 0 && (
                    <button
                      onClick={() => {
                        setShowPayModal(true);
                        setPayAmount(totalDue.toFixed(2));
                      }}
                      className="mt-6 bg-white text-red-600 px-10 py-4 rounded-xl text-xl font-bold hover:scale-105 transition">
                      <DollarSign className="h-8 w-8 inline-block -mt-1" /> سداد الآن
                    </button>
                  )}
                  {isAdmin && (
                    <button
                      onClick={openAddReceivableModal}
                      className="mt-6 mr-4 bg-white/20 text-white px-6 py-4 rounded-xl text-lg font-bold hover:bg-white/30 transition">
                      <Plus className="h-6 w-6 inline-block -mt-1" /> إضافة مستحق
                    </button>
                  )}
                </div>

                {entityReceivables.length > 0 && (
                  <div>
                    <h3 className="text-xl font-bold text-gray-800 mb-4">تفاصيل المستحقات</h3>
                    <div className="space-y-3">
                      {entityReceivables.map((r: any) => (
                        <div key={r.id} className="bg-gray-50 rounded-xl p-4 flex justify-between items-center group">
                          <div>
                            <p className="font-medium">{r.description}</p>
                            <p className="text-sm text-gray-500">
                              {formatDateTime(r.created_at || r.due_date)}
                            </p>
                          </div>
                          <div className="flex items-center gap-4">
                            <p className="text-xl font-bold text-red-600">{formatCurrency(r.remaining_amount)}</p>
                            {isAdmin && (
                              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() => openEditReceivableModal(r)}
                                  className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg"
                                  title="تعديل">
                                  <Edit2 className="h-4 w-4" />
                                </button>
                                {isAdmin && (
                                  <button
                                    onClick={() => handleDeleteReceivable(r.id)}
                                    className="p-2 text-red-600 hover:bg-red-100 rounded-lg"
                                    title="حذف">
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* مودال السداد */}
        {showPayModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-auto p-6 md:p-8 max-h-[90vh] overflow-y-auto">
              <h2 className="text-2xl md:text-3xl font-bold text-center mb-4">تأكيد السداد</h2>
              <p className="text-center text-gray-600 text-lg mb-6">{selectedEntity?.name}</p>

              {!isAdmin && (
                <div className="bg-amber-50 border-2 border-amber-400 rounded-xl p-5 text-center mb-6">
                  <p className="text-amber-800 font-bold text-lg">رصيدك الحالي</p>
                  <p className="text-3xl md:text-4xl font-extrabold text-amber-900">{formatCurrency(employeeBalance)}</p>
                </div>
              )}

              <div className="bg-red-50 rounded-xl p-6 text-center mb-6">
                <p className="text-4xl md:text-5xl font-bold text-red-600">{formatCurrency(totalDue)}</p>
                <p className="text-gray-600 mt-2">المبلغ المستحق</p>
              </div>

              <input
                type="text"
                inputMode="numeric"
                value={payAmount}
                onChange={(e) => setPayAmount(toEnglishDigits(e.target.value))}
                className="w-full text-center text-3xl md:text-4xl font-bold py-4 border-2 rounded-xl mb-6 focus:border-indigo-500 focus:ring-0"
                placeholder="0.00"
              />

              <div className="grid grid-cols-2 gap-4 mb-8">
                {(['كاش', 'تحويل'] as const).map(m => (
                  <button
                    key={m}
                    onClick={() => setPayMethod(m)}
                    className={`py-4 rounded-xl font-bold text-lg transition-all duration-200 ${payMethod === m ? 'bg-indigo-600 text-white shadow-lg transform scale-105' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}>
                    {m}
                  </button>
                ))}
              </div>

              <div className="flex gap-4">
                <button
                  onClick={handlePayment}
                  className="flex-1 bg-emerald-600 text-white py-4 rounded-xl font-bold text-xl hover:bg-emerald-700 transition shadow-lg hover:shadow-emerald-500/30">
                  تأكيد السداد
                </button>
                <button
                  onClick={() => {
                    setShowPayModal(false);
                    setPayAmount('');
                  }}
                  className="flex-1 bg-gray-100 text-gray-700 py-4 rounded-xl font-bold text-lg hover:bg-gray-200 transition">
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        )}

        {/* مودال إضافة/تعديل مورد */}
        {showSupplierModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-auto p-6 md:p-8 max-h-[90vh] overflow-y-auto">
              <h3 className="text-2xl font-bold text-center mb-6">
                {isEditMode ? 'تعديل المورد' : 'إضافة مورد جديد'}
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">اسم المورد</label>
                  <input
                    type="text"
                    value={supplierName}
                    onChange={(e) => setSupplierName(e.target.value)}
                    className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">العنوان</label>
                  <input
                    type="text"
                    value={supplierAddress}
                    onChange={(e) => setSupplierAddress(e.target.value)}
                    className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">رقم الهاتف</label>
                  <input
                    type="tel"
                    value={supplierPhone}
                    onChange={(e) => setSupplierPhone(e.target.value)}
                    className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">البريد الإلكتروني</label>
                  <input
                    type="email"
                    value={supplierEmail}
                    onChange={(e) => setSupplierEmail(e.target.value)}
                    className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                    dir="ltr"
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-8">
                <button
                  onClick={handleSaveSupplier}
                  className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition shadow-lg hover:shadow-indigo-500/30">
                  حفظ
                </button>
                <button
                  onClick={() => setShowSupplierModal(false)}
                  className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl font-bold hover:bg-gray-200 transition">
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        )}

        {/* مودال إضافة/تعديل مستحق (للأدمن فقط) */}
        {showReceivableModal && isAdmin && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-auto p-6 md:p-8 max-h-[90vh] overflow-y-auto">
              <h3 className="text-2xl font-bold text-center mb-6">
                {isEditReceivable ? 'تعديل مستحق' : 'إضافة مستحق جديد'}
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">الوصف</label>
                  <input
                    type="text"
                    value={receivableFormData.description}
                    onChange={(e) => setReceivableFormData({ ...receivableFormData, description: e.target.value })}
                    className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                    placeholder="مثال: فاتورة رقم 123"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">المبلغ</label>
                  <input
                    type="text"
                    value={receivableFormData.amount}
                    onChange={(e) => setReceivableFormData({ ...receivableFormData, amount: toEnglishDigits(e.target.value) })}
                    className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">تاريخ الاستحقاق</label>
                  <input
                    type="date"
                    value={receivableFormData.dueDate}
                    onChange={(e) => setReceivableFormData({ ...receivableFormData, dueDate: e.target.value })}
                    className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                  />
                </div>
                <div className="flex gap-3 mt-6">
                  <button
                    onClick={handleSaveReceivable}
                    className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition shadow-lg hover:shadow-indigo-500/30">
                    حفظ
                  </button>
                  <button
                    onClick={() => setShowReceivableModal(false)}
                    className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl font-bold hover:bg-gray-200 transition">
                    إلغاء
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* مودال معاينة التقرير */}
        {showPreview && selectedEntity && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-4xl mx-auto max-h-[95vh] overflow-y-auto shadow-2xl">
              <div className="sticky top-0 bg-white border-b px-8 py-5 flex justify-between items-center z-10 rounded-t-2xl">
                <h3 className="text-2xl font-bold flex items-center gap-3">
                  <FileText className="h-7 w-7 text-indigo-600" />
                  معاينة تقرير المورد
                </h3>
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      await fetchPaymentHistory();
                      handleExportPDF();
                    }}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center space-x-2 space-x-reverse"
                  >
                    <Download className="h-4 w-4" />
                    <span>PDF</span>
                  </button>
                  <button
                    onClick={async () => {
                      await fetchPaymentHistory();
                      handleExportExcel();
                    }}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2 space-x-reverse"
                  >
                    <Download className="h-4 w-4" />
                    <span>Excel</span>
                  </button>
                  <button
                    onClick={() => setShowPreview(false)}
                    className="p-2 hover:bg-gray-100 rounded-lg"
                  >
                    <span className="text-2xl">✕</span>
                  </button>
                </div>
              </div>

              <div className="p-8">
                <div id="supplier-preview-content" className="bg-white" dir="rtl">
                  <div className="text-center mb-8 border-b pb-6">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">
                      تقرير المورد: {selectedEntity.name}
                    </h1>
                    <p className="text-gray-600">تاريخ التقرير: {formatDate(new Date().toISOString())}</p>
                  </div>

                  <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-8 text-center">
                    <p className="text-lg text-gray-700 mb-2">إجمالي المستحقات</p>
                    <p className="text-4xl font-bold text-red-600">{formatCurrency(totalDue)}</p>
                  </div>

                  <table className="w-full border-collapse mb-8">
                    <thead>
                      <tr className="bg-indigo-600 text-white">
                        <th className="border border-gray-300 px-4 py-3 text-right">الوصف</th>
                        <th className="border border-gray-300 px-4 py-3 text-right">تاريخ الاستحقاق</th>
                        <th className="border border-gray-300 px-4 py-3 text-right">المبلغ الكلي</th>
                        <th className="border border-gray-300 px-4 py-3 text-right">المتبقي</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entityReceivables.map((r, index) => (
                        <tr key={r.id} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                          <td className="border border-gray-300 px-4 py-3">{r.description}</td>
                          <td className="border border-gray-300 px-4 py-3">{formatDate(r.due_date)}</td>
                          <td className="border border-gray-300 px-4 py-3 text-right font-medium">
                            {formatCurrency(r.total_amount)}
                          </td>
                          <td className="border border-gray-300 px-4 py-3 text-right font-bold text-red-600">
                            {formatCurrency(r.remaining_amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* سجل المدفوعات */}
                  {paymentHistory.length > 0 && (
                    <div className="mt-8">
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4 text-center">
                        <h2 className="text-2xl font-bold text-green-800">سجل المدفوعات</h2>
                      </div>
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="bg-green-600 text-white">
                            <th className="border border-gray-300 px-4 py-3 text-right">التاريخ</th>
                            <th className="border border-gray-300 px-4 py-3 text-right">المبلغ</th>
                            <th className="border border-gray-300 px-4 py-3 text-right">رقم الإيصال</th>
                            <th className="border border-gray-300 px-4 py-3 text-right">المسدد</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paymentHistory.map((payment, index) => (
                            <tr key={payment.id} className={index % 2 === 0 ? 'bg-green-50' : 'bg-white'}>
                              <td className="border border-gray-300 px-4 py-3">{formatDate(payment.created_at || payment.payment_date)}</td>
                              <td className="border border-gray-300 px-4 py-3 text-right font-bold text-green-700">
                                {formatCurrency(parseFloat(payment.amount))}
                              </td>
                              <td className="border border-gray-300 px-4 py-3">{payment.receipt_number}</td>
                              <td className="border border-gray-300 px-4 py-3">
                                {payment.created_by_user?.full_name ||
                                  payment.created_by_user?.email ||
                                  (payment.notes ? payment.notes.split(' - ')[1] || 'مدفوعات قديمة' : 'مدفوعات قديمة')}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* مودال سجل المدفوعات */}
        {showPaymentHistory && selectedEntity && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-4xl mx-auto max-h-[95vh] overflow-y-auto shadow-2xl">
              <div className="sticky top-0 bg-white border-b px-8 py-5 flex justify-between items-center z-10 rounded-t-2xl">
                <h3 className="text-2xl font-bold flex items-center gap-3">
                  <Clock className="h-7 w-7 text-blue-600" />
                  سجل المدفوعات - {selectedEntity.name}
                </h3>
                <button
                  onClick={() => setShowPaymentHistory(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <span className="text-2xl">✕</span>
                </button>
              </div>

              <div className="p-8">
                {paymentHistory.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <Clock className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                    <p className="text-xl">لا توجد مدفوعات مسجلة</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {paymentHistory.map((payment) => (
                      <div key={payment.id} className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-6 border border-green-200">
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="font-bold text-lg text-green-800">
                                {formatCurrency(parseFloat(payment.amount))}
                              </span>
                              <span className="bg-green-200 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                                {payment.receipt_number}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                              <User className="h-4 w-4" />
                              <span>المسدد: {payment.created_by_user?.full_name ||
                                payment.created_by_user?.email ||
                                (payment.notes ? payment.notes.split(' - ')[1] || 'مدفوعات قديمة' : 'مدفوعات قديمة')}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <Clock className="h-4 w-4" />
                              <span>التاريخ: {formatDate(payment.created_at || payment.payment_date)}</span>
                            </div>
                            {payment.notes && (
                              <p className="text-sm text-gray-700 mt-2 italic">"{payment.notes}"</p>
                            )}
                          </div>
                          {isAdmin && (
                            <button
                              onClick={() => handleSafeDeletePayment(payment)}
                              disabled={isDeletingPayment}
                              className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              title="حذف الدفعة"
                            >
                              <Trash2 className="h-5 w-5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* مودال تفاصيل عهدة الموظف */}
        {showEmployeeBalance && !isAdmin && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-4xl mx-auto max-h-[95vh] overflow-y-auto shadow-2xl">
              <div className="sticky top-0 bg-white border-b px-8 py-5 flex justify-between items-center z-10 rounded-t-2xl">
                <h3 className="text-2xl font-bold flex items-center gap-3">
                  <Wallet className="h-7 w-7 text-amber-600" />
                  تفاصيل عهدتي
                </h3>
                <button
                  onClick={() => setShowEmployeeBalance(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <span className="text-2xl">✕</span>
                </button>
              </div>

              <div className="p-8">
                {/* ملخص الرصيد */}
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-6 mb-8 text-center">
                  <p className="text-lg text-gray-700 mb-2">رصيدك الحالي</p>
                  <p className={`text-5xl font-bold ${employeeBalance >= 0 ? 'text-amber-600' : 'text-red-600'}`}>
                    {formatCurrency(employeeBalance)}
                  </p>
                  <p className="text-sm text-gray-600 mt-3">عدد العمليات: {employeeTransactions.length}</p>
                </div>

                {/* قائمة العمليات */}
                {employeeTransactions.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <Wallet className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                    <p className="text-xl">لا توجد عمليات في عهدتك</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <h4 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                      <Clock className="h-6 w-6 text-amber-600" />
                      سجل العمليات
                    </h4>
                    {employeeTransactions.map((transaction) => (
                      <div
                        key={transaction.id}
                        className={`rounded-xl p-6 border ${transaction.type === 'credit'
                          ? 'bg-gradient-to-r from-amber-50 to-yellow-50 border-amber-200'
                          : 'bg-gradient-to-r from-red-50 to-rose-50 border-red-200'
                          }`}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className={`font-bold text-lg ${transaction.type === 'credit' ? 'text-amber-800' : 'text-red-800'
                                }`}>
                                {transaction.type === 'credit' ? 'صرف عهدة' : 'تسوية عهدة'}
                              </span>
                              <span className="bg-gray-200 text-gray-700 px-3 py-1 rounded-full text-xs font-mono">
                                #{transaction.id.slice(-6)}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                              <Clock className="h-4 w-4" />
                              <span>التاريخ: {formatDate(transaction.transaction_date)}</span>
                            </div>
                            {transaction.created_by_user && (
                              <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                                <User className="h-4 w-4" />
                                <span>بواسطة: {transaction.created_by_user.full_name}</span>
                              </div>
                            )}
                            {transaction.reason && (
                              <p className="text-sm text-gray-700 mt-2 italic">"{transaction.reason}"</p>
                            )}
                          </div>
                          <div className="text-left mr-4">
                            <p className={`text-2xl font-bold ${transaction.type === 'credit' ? 'text-amber-600' : 'text-red-600'
                              }`}>
                              {transaction.amount < 0 ? '-' : '+'}
                              {formatCurrency(Math.abs(parseFloat(transaction.amount)))}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div >
    </>
  );
};

export default Suppliers;