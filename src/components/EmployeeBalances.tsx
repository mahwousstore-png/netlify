import React, { useState, useEffect } from 'react';
import {
  ArrowLeft, Banknote, Receipt, Trash2, User, AlertCircle, Users, X, CheckCircle, Download, FileText, TrendingUp, DollarSign
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { authService } from '../lib/auth';
import toast, { Toaster } from 'react-hot-toast';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { formatDateTime } from '../lib/dateUtils';

interface UserProfile {
  id: string;
  full_name: string;
  role: string;
  email: string;
}

interface EmployeeBalanceTransaction {
  id: string;
  user_id: string;
  amount: number;
  type: 'credit' | 'debit';
  reason?: string;
  transaction_date: string;
  created_by: string;
  created_at: string;
  user: UserProfile;
  created_by_user?: UserProfile;
}

interface EmployeeSummary {
  user: UserProfile;
  current_balance: number;
  transactions: EmployeeBalanceTransaction[];
}

const EmployeeAdvances: React.FC = () => {
  const [employees, setEmployees] = useState<EmployeeSummary[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState<EmployeeBalanceTransaction | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  // نموذج العملية الجديدة
  const [transactionAmount, setTransactionAmount] = useState<string>('');
  const [transactionDate, setTransactionDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [transactionType, setTransactionType] = useState<'credit' | 'debit'>('credit');
  const [transactionReason, setTransactionReason] = useState<string>('');

  // فلاتر
  const [filterType, setFilterType] = useState<'all' | 'credit' | 'debit'>('all');
  const [filterDateFrom, setFilterDateFrom] = useState<string>('');
  const [filterDateTo, setFilterDateTo] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc'); // الأحدث أولاً

  const currentUser = authService.getCurrentUser();

  useEffect(() => {
    fetchEmployeesData();
  }, []);

  const fetchEmployeesData = async () => {
    setLoading(true);
    try {
      const { data: usersData, error: usersError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('role', 'user')
        .eq('is_active', true)
        .order('full_name');

      if (usersError) throw usersError;

      const { data: transactionsData, error: transactionsError } = await supabase
        .from('employee_balance_transactions')
        .select(`
          *,
          user:user_profiles!employee_balance_transactions_user_id_fkey(full_name, role, email),
          created_by_user:user_profiles!employee_balance_transactions_created_by_fkey(full_name)
        `)
        .order('transaction_date', { ascending: false });

      if (transactionsError) throw transactionsError;

      const employeeMap = new Map<string, EmployeeSummary>();
      usersData?.forEach((user: UserProfile) => {
        employeeMap.set(user.id, {
          user,
          current_balance: 0,
          transactions: []
        });
      });

      transactionsData?.forEach((t: any) => {
        const emp = employeeMap.get(t.user_id);
        if (emp) {
          const transaction: EmployeeBalanceTransaction = {
            ...t,
            user: t.user,
            created_by_user: t.created_by_user,
            amount: parseFloat(t.amount.toString()),
            transaction_date: t.transaction_date,
            created_at: t.created_at
          };
          emp.transactions.push(transaction);
          emp.current_balance += transaction.amount;
        }
      });

      const summaries: EmployeeSummary[] = Array.from(employeeMap.values())
        .sort((a, b) => a.user.full_name.localeCompare(b.user.full_name));

      setEmployees(summaries);
    } catch (e) {
      console.error('Error fetching employee advances:', e);
      toast.error('فشل جلب بيانات عهد الموظفين');
    } finally {
      setLoading(false);
    }
  };

  const handleEmployeeTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !transactionAmount || !selectedEmployee) {
      toast.error('يرجى ملء جميع الحقول');
      return;
    }

    const amount = parseFloat(transactionAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('المبلغ يجب أن يكون رقمًا موجبًا');
      return;
    }

    const finalAmount = transactionType === 'credit' ? amount : -amount;

    try {
      const { data: inserted, error: insertError } = await supabase
        .from('employee_balance_transactions')
        .insert({
          user_id: selectedEmployee.user.id,
          amount: finalAmount,
          type: transactionType,
          reason: transactionReason || `عملية ${transactionType === 'credit' ? 'إضافة عهده' : 'تسوية عهده'}`,
          transaction_date: transactionDate,
          created_by: currentUser.id,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      const newTransaction: EmployeeBalanceTransaction = {
        ...inserted,
        user: selectedEmployee.user,
        amount: finalAmount,
        transaction_date: inserted.transaction_date,
        created_at: inserted.created_at,
        created_by_user: { id: currentUser.id, full_name: currentUser.full_name || 'النظام' }
      };

      setSelectedEmployee(prev => ({
        ...prev!,
        transactions: [newTransaction, ...prev!.transactions],
        current_balance: prev!.current_balance + finalAmount
      }));

      setEmployees(prev =>
        prev.map(emp =>
          emp.user.id === selectedEmployee.user.id
            ? { ...emp, current_balance: emp.current_balance + finalAmount }
            : emp
        )
      );

      resetForm();
      setShowTransactionModal(false);
      toast.success('تم تسجيل العملية في عهده بنجاح');
    } catch (err: any) {
      console.error('خطأ في تسجيل العهده:', err);
      toast.error(err.message || 'فشل التسجيل');
    }
  };

  const openDeleteConfirm = (transaction: EmployeeBalanceTransaction) => {
    setTransactionToDelete(transaction);
    setShowDeleteConfirmModal(true);
  };

  const confirmDelete = async () => {
    if (!currentUser || currentUser.role !== 'admin' || !transactionToDelete) return;

    try {
      const { error: deleteError } = await supabase
        .from('employee_balance_transactions')
        .delete()
        .eq('id', transactionToDelete.id);

      if (deleteError) throw deleteError;

      setSelectedEmployee(prev => ({
        ...prev!,
        transactions: prev!.transactions.filter(t => t.id !== transactionToDelete.id),
        current_balance: prev!.current_balance - transactionToDelete.amount
      }));

      setEmployees(prev =>
        prev.map(emp =>
          emp.user.id === transactionToDelete.user_id
            ? { ...emp, current_balance: emp.current_balance - transactionToDelete.amount }
            : emp
        )
      );

      toast.success('تم حذف العملية من عهده');
      setShowDeleteConfirmModal(false);
      setTransactionToDelete(null);
    } catch (err: any) {
      console.error('خطأ حذف العهده:', err);
      toast.error(err.message || 'فشل الحذف');
    }
  };

  const resetForm = () => {
    setTransactionAmount('');
    setTransactionReason('');
    setTransactionDate(new Date().toISOString().split('T')[0]);
    setTransactionType('credit');
  };

  const formatCurrency = (v: number): string => {
    const rounded = Math.round(v * 100) / 100;
    return `${rounded.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} ر.س`;
  };

  const formatDate = (dateString: string): string => formatDateTime(dateString) || 'غير محدد';

  // دالة الفلترة والترتيب
  const getFilteredAndSortedTransactions = (transactions: EmployeeBalanceTransaction[]) => {
    let filtered = [...transactions];

    // فلترة حسب النوع
    if (filterType !== 'all') {
      filtered = filtered.filter(t => t.type === filterType);
    }

    // فلترة حسب التاريخ
    if (filterDateFrom) {
      filtered = filtered.filter(t => {
        const transDate = new Date(t.transaction_date || t.created_at);
        return transDate >= new Date(filterDateFrom);
      });
    }

    if (filterDateTo) {
      filtered = filtered.filter(t => {
        const transDate = new Date(t.transaction_date || t.created_at);
        return transDate <= new Date(filterDateTo + 'T23:59:59');
      });
    }

    // الترتيب حسب التاريخ
    filtered.sort((a, b) => {
      const dateA = new Date(a.transaction_date || a.created_at).getTime();
      const dateB = new Date(b.transaction_date || b.created_at).getTime();
      return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
    });

    return filtered;
  };

  const [suppliersReceivables, setSuppliersReceivables] = useState<number>(0);

  // Fetch suppliers receivables
  useEffect(() => {
    const fetchSuppliersReceivables = async () => {
      try {
        const { data: receivablesData, error } = await supabase
          .from('receivables')
          .select(`
            remaining_amount,
            entity_id,
            entities!inner(type)
          `)
          .eq('entities.type', 'مورد');

        if (error) throw error;

        const total = receivablesData?.reduce((sum, r) => sum + parseFloat(r.remaining_amount.toString()), 0) || 0;
        setSuppliersReceivables(total);
      } catch (err) {
        console.error('Error fetching suppliers receivables:', err);
      }
    };

    fetchSuppliersReceivables();
  }, []);

  const handleExportExcel = async () => {
    if (!selectedEmployee) return;

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(`عهدة ${selectedEmployee.user.full_name}`, {
      pageSetup: { paperSize: 9, orientation: 'portrait' },
      properties: { defaultColWidth: 20 },
      views: [{ rightToLeft: true }]
    });

    worksheet.mergeCells('A1:D1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = `تقرير عهدة الموظف: ${selectedEmployee.user.full_name}`;
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
    balanceCell.value = `الرصيد الحالي: ${formatCurrency(selectedEmployee.current_balance)}`;
    balanceCell.font = { size: 14, bold: true };
    balanceCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: selectedEmployee.current_balance >= 0 ? 'FFFBBF24' : 'FFEF4444' } };
    balanceCell.alignment = { horizontal: 'center', vertical: 'middle' };

    const headerRow = worksheet.addRow(['التاريخ', 'النوع', 'المبلغ', 'السبب']);
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

    selectedEmployee.transactions.forEach((t, index) => {
      const row = worksheet.addRow([
        formatDate(t.transaction_date),
        t.type === 'credit' ? 'صرف عهده' : 'تسوية عهده',
        Math.abs(t.amount).toFixed(2),
        t.reason || '-'
      ]);

      row.eachCell((cell, colNumber) => {
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        if (colNumber === 3) {
          cell.numFmt = '#,##0.00';
          cell.font = { bold: true, color: { argb: t.type === 'credit' ? 'FFFBBF24' : 'FFEF4444' } };
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

    const buffer = await workbook.xlsx.writeBuffer();
    const fileName = `عهدة_${selectedEmployee.user.full_name}_${new Date().toISOString().split('T')[0]}.xlsx`;
    saveAs(new Blob([buffer]), fileName);
    toast.success('تم تصدير التقرير بنجاح');
  };

  const handleExportPDF = async () => {
    const previewElement = document.getElementById('employee-preview-content');
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

      const fileName = selectedEmployee
        ? `عهدة_${selectedEmployee.user.full_name}_${new Date().toISOString().split('T')[0]}.pdf`
        : `عهد_الموظفين_${new Date().toISOString().split('T')[0]}.pdf`;

      pdf.save(fileName);
      toast.success('تم تصدير التقرير بنجاح');
    } catch (err) {
      console.error('Error generating PDF:', err);
      toast.error('حدث خطأ أثناء إنشاء ملف PDF');
    }
  };

  if (loading) {
    return (
      <div className="p-3 md:p-6">
        <div className="animate-pulse space-y-3 md:space-y-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-20 md:h-24 bg-gray-200 rounded-lg md:rounded-xl"></div>
          ))}
        </div>
      </div>
    );
  }

  // تفاصيل الموظف (العهده والطريقة)
  if (selectedEmployee) {
    const { user, current_balance, transactions } = selectedEmployee;

    return (
      <div className="p-3 md:p-6 max-w-7xl mx-auto">
        <Toaster position="top-center" reverseOrder={false} />

        <div className="flex justify-start items-center mb-4 md:mb-6">
          <button
            onClick={() => setSelectedEmployee(null)}
            className="flex items-center text-blue-600 hover:text-blue-800 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 md:h-5 md:w-5 ml-2" />
            <span className="font-medium text-sm md:text-base">رجوع</span>
          </button>
        </div>

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 md:mb-8 gap-4">
          <div className="flex items-center">
            <div className="h-12 w-12 md:h-16 md:w-16 bg-gradient-to-r from-amber-500 to-orange-600 rounded-lg md:rounded-xl shadow-md ml-3 md:ml-4 flex items-center justify-center">
              <User className="h-6 w-6 md:h-9 md:w-9 text-white" />
            </div>
            <div>
              <h2 className="text-xl md:text-3xl font-bold text-gray-900">{user.full_name}</h2>
              <p className="text-gray-600 text-sm md:text-lg">{user.email}</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
            <button
              onClick={() => setShowPreview(true)}
              className="bg-gray-600 text-white px-3 md:px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors duration-200 flex items-center justify-center space-x-2 space-x-reverse text-sm md:text-base"
            >
              <FileText className="h-4 w-4" />
              <span>معاينة</span>
            </button>
            <button
              onClick={handleExportExcel}
              className="bg-green-600 text-white px-3 md:px-4 py-2 rounded-lg hover:bg-green-700 transition-colors duration-200 flex items-center justify-center space-x-2 space-x-reverse text-sm md:text-base"
            >
              <Download className="h-4 w-4" />
              <span>Excel</span>
            </button>
          </div>
        </div>

        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl md:rounded-2xl p-4 md:p-6 mb-4 md:mb-8 shadow-sm">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 md:mb-6 gap-3">
            <h3 className="text-lg md:text-xl font-bold text-gray-800">ملخص العهده</h3>
            <button
              onClick={() => setShowTransactionModal(true)}
              className="bg-gradient-to-r from-amber-600 to-orange-600 text-white px-3 md:px-5 py-2 md:py-3 rounded-lg md:rounded-xl hover:from-amber-700 hover:to-orange-700 flex items-center space-x-2 shadow-md transition-all w-full sm:w-auto justify-center text-sm md:text-base"
            >
              <Banknote className="h-4 w-4 md:h-5 md:w-5" />
              <span className="font-medium">عملية جديدة</span>
            </button>
          </div>

          <div className="space-y-3 md:space-y-4">
            <div className="flex justify-between text-lg md:text-2xl font-extrabold">
              <span className="text-gray-900">رصيد الموظف:</span>
              <span className={current_balance >= 0 ? 'text-amber-600' : 'text-red-600'}>
                {formatCurrency(current_balance)}
              </span>
            </div>
            <div className="flex justify-between text-sm md:text-base">
              <span className="text-gray-700 font-medium">عدد العمليات:</span>
              <span className="font-bold text-gray-900">{transactions.length}</span>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl md:rounded-2xl p-4 md:p-6 shadow-sm">
          <h3 className="text-base md:text-xl font-bold text-gray-800 mb-4 md:mb-5 flex items-center">
            <Receipt className="h-5 w-5 md:h-6 md:w-6 ml-2 text-amber-600" />
            سجل العهده ({transactions.length})
          </h3>
          {/* الفلاتر */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* فلتر النوع */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  نوع العملية
                </label>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value as 'all' | 'credit' | 'debit')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">الكل</option>
                  <option value="credit">صرف عهدة</option>
                  <option value="debit">تسوية عهدة</option>
                </select>
              </div>

              {/* فلتر التاريخ من */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  من تاريخ
                </label>
                <input
                  type="date"
                  value={filterDateFrom}
                  onChange={(e) => setFilterDateFrom(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* فلتر التاريخ إلى */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  إلى تاريخ
                </label>
                <input
                  type="date"
                  value={filterDateTo}
                  onChange={(e) => setFilterDateTo(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* الترتيب */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  الترتيب
                </label>
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as 'desc' | 'asc')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="desc">الأحدث أولاً</option>
                  <option value="asc">الأقدم أولاً</option>
                </select>
              </div>
            </div>

            {/* زر إعادة تعيين الفلاتر */}
            {(filterType !== 'all' || filterDateFrom || filterDateTo) && (
              <div className="mt-4">
                <button
                  onClick={() => {
                    setFilterType('all');
                    setFilterDateFrom('');
                    setFilterDateTo('');
                  }}
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                >
                  إعادة تعيين الفلاتر
                </button>
              </div>
            )}
          </div>
          <div className="space-y-2 md:space-y-3 max-h-96 overflow-y-auto">
            {(() => {
              const filteredTransactions = getFilteredAndSortedTransactions(transactions);
              return filteredTransactions.length === 0 ? (
                <p className="text-center text-gray-500 py-6">لا توجد عمليات مطابقة للفلاتر</p>
              ) : (
                filteredTransactions.map(t => (
                <div key={t.id} className={`rounded-lg border-2 p-3 shadow-sm hover:shadow-md transition-shadow ${t.type === 'credit'
                  ? 'bg-amber-50 border-amber-300'
                  : 'bg-red-50 border-red-300'
                  }`}>
                  <div className="flex justify-between items-center gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className={`font-bold text-sm ${t.type === 'credit' ? 'text-amber-700' : 'text-red-700'}`}>
                          {t.type === 'credit' ? 'صرف عهده' : 'تسوية عهده'}
                        </span>
                        <span className="font-mono text-xs bg-white text-gray-600 px-2 py-0.5 rounded border border-gray-300">
                          #{t.id.slice(-6)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 font-medium mb-1">
                        📅 {formatDate(t.created_at || t.transaction_date)}
                      </p>
                      {t.reason && (
                        <p className="text-xs text-gray-700 bg-white px-2 py-1 rounded border border-gray-200 mt-1.5">
                          💬 {t.reason}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <p className={`font-extrabold text-lg ${t.type === 'credit' ? 'text-amber-600' : 'text-red-600'}`}>
                          {t.type === 'debit' && '-'}
                          {formatCurrency(Math.abs(t.amount))}
                        </p>
                        <div className="flex items-center justify-end mt-0.5 text-xs text-gray-500 bg-white px-2 py-0.5 rounded border border-gray-200">
                          <User className="h-3 w-3 ml-1" />
                          <span className="font-medium">{t.created_by_user?.full_name || 'النظام'}</span>
                        </div>
                      </div>
                      {currentUser?.role === 'admin' && (
                        <button
                          onClick={() => openDeleteConfirm(t)}
                          className="text-red-600 hover:text-red-800 p-1.5 rounded hover:bg-red-100 transition-colors flex-shrink-0"
                          title="حذف"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            );
            })()}
          </div>
        </div>

        {/* نافذة إضافة عملية... عهدة */}
        {showTransactionModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold text-gray-900">عملية جديدة في عهده ({user.full_name})</h3>
                <button onClick={() => setShowTransactionModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="h-7 w-7" />
                </button>
              </div>
              <form onSubmit={handleEmployeeTransaction} className="space-y-5">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">نوع العملية</label>
                  <select
                    value={transactionType}
                    onChange={e => setTransactionType(e.target.value as 'credit' | 'debit')}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-4 focus:ring-amber-500 focus:border-amber-500"
                  >
                    <option value="credit">صرف عهده (إضافة للموظف)</option>
                    <option value="debit">تسوية عهده (استلام من الموظف)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">المبلغ</label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={transactionAmount}
                      onChange={e => setTransactionAmount(e.target.value)}
                      required
                      className="w-full px-4 py-3 pr-12 border-2 border-gray-300 rounded-xl focus:ring-4 focus:ring-amber-500 focus:border-amber-500 text-lg"
                      placeholder="0.00"
                    />
                    <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-600 font-bold">ر.س</span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">تاريخ العملية</label>
                  <input
                    type="date"
                    value={transactionDate}
                    onChange={e => setTransactionDate(e.target.value)}
                    required
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-4 focus:ring-amber-500 focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">السبب (اختياري)</label>
                  <textarea
                    value={transactionReason}
                    onChange={e => setTransactionReason(e.target.value)}
                    rows={2}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-4 focus:ring-amber-500 focus:border-amber-500"
                    placeholder="مثلاً: مصاريف تسويق، مشتريات نقدية..."
                  />
                </div>
                <div className="flex gap-3 pt-4 border-t border-gray-200">
                  <button
                    type="submit"
                    className="flex-1 bg-gradient-to-r from-amber-600 to-orange-600 text-white py-3 px-6 rounded-xl hover:from-amber-700 hover:to-orange-700 font-bold flex items-center justify-center space-x-2 shadow-md"
                  >
                    <CheckCircle className="h-5 w-5" />
                    <span>تسجيل في العهده</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowTransactionModal(false)}
                    className="flex-1 bg-gray-200 text-gray-700 py-3 px-6 rounded-xl hover:bg-gray-300 font-bold"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* نافذة معاينة التقرير */}
        {showPreview && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[95vh] overflow-y-auto shadow-2xl">
              <div className="sticky top-0 bg-white border-b px-8 py-5 flex justify-between items-center z-10 rounded-t-2xl">
                <h3 className="text-2xl font-bold flex items-center gap-3">
                  <FileText className="h-7 w-7 text-amber-600" />
                  معاينة تقرير العهدة
                </h3>
                <div className="flex gap-2">
                  <button
                    onClick={handleExportPDF}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors duration-200 flex items-center space-x-2 space-x-reverse"
                  >
                    <Download className="h-4 w-4" />
                    <span>تصدير PDF</span>
                  </button>
                  <button
                    onClick={handleExportExcel}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200 flex items-center space-x-2 space-x-reverse"
                  >
                    <Download className="h-4 w-4" />
                    <span>تصدير Excel</span>
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
                <div id="employee-preview-content" className="bg-white" dir="rtl">
                  <div className="text-center mb-8 border-b pb-6">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">
                      تقرير عهدة الموظف: {user.full_name}
                    </h1>
                    <p className="text-gray-600">تاريخ التقرير: {formatDate(new Date().toISOString())}</p>
                  </div>

                  <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-lg p-6 mb-8 text-center">
                    <p className="text-lg text-gray-700 mb-2">الرصيد الحالي</p>
                    <p className={`text-4xl font-bold ${current_balance >= 0 ? 'text-amber-600' : 'text-red-600'}`}>
                      {formatCurrency(current_balance)}
                    </p>
                    <p className="text-sm text-gray-600 mt-2">عدد العمليات: {transactions.length}</p>
                  </div>

                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-blue-600 text-white">
                        <th className="border border-gray-300 px-4 py-3 text-right">التاريخ</th>
                        <th className="border border-gray-300 px-4 py-3 text-right">النوع</th>
                        <th className="border border-gray-300 px-4 py-3 text-right">المبلغ</th>
                        <th className="border border-gray-300 px-4 py-3 text-right">السبب</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map((t, index) => (
                        <tr key={t.id} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                          <td className="border border-gray-300 px-4 py-3">{formatDate(t.transaction_date)}</td>
                          <td className="border border-gray-300 px-4 py-3">
                            <span className={`font-medium ${t.type === 'credit' ? 'text-amber-700' : 'text-red-700'}`}>
                              {t.type === 'credit' ? 'صرف عهدة' : 'تسوية عهدة'}
                            </span>
                          </td>
                          <td className="border border-gray-300 px-4 py-3 text-right">
                            <span className={`font-bold ${t.type === 'credit' ? 'text-amber-600' : 'text-red-600'}`}>
                              {t.type === 'debit' && '-'}
                              {formatCurrency(Math.abs(t.amount))}
                            </span>
                          </td>
                          <td className="border border-gray-300 px-4 py-3 text-sm text-gray-700">{t.reason || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // الصفحة الرئيسية - قائمة الموظفين
  return (
    <div className="min-h-screen bg-gray-50">
      <Toaster position="top-center" reverseOrder={false} />
      <div className="p-3 md:p-6 max-w-7xl mx-auto">
        <div className="mb-6 md:mb-10 text-center">
          <h2 className="text-2xl md:text-4xl font-extrabold text-gray-900 mb-2 md:mb-3">عهد الموظفين</h2>
          <p className="text-gray-600 text-sm md:text-lg">اضغط على أي موظف لعرض عهده</p>
        </div>

        <div className="mb-4 md:mb-8 bg-white border border-gray-200 rounded-lg md:rounded-xl p-4 md:p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="bg-red-100 text-red-600 p-2 md:p-3 rounded-lg ml-2 md:ml-4">
                <DollarSign className="h-5 w-5 md:h-6 md:w-6" />
              </div>
              <div>
                <p className="text-gray-600 text-xs md:text-sm">إجمالي المستحقات لجميع الموردين</p>
                <h3 className="text-lg md:text-2xl font-bold text-red-600">{formatCurrency(suppliersReceivables)}</h3>
              </div>
            </div>
            <TrendingUp className="h-4 w-4 md:h-5 md:w-5 text-red-500" />
          </div>
        </div>

        {employees.length === 0 ? (
          <div className="text-center py-20">
            <Users className="h-16 w-16 text-gray-400 mx-auto mb-6" />
            <p className="text-xl text-gray-600">لا يوجد موظفون لديهم عهده حالياً</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-8">
            {employees.map(emp => (
              <div
                key={emp.user.id}
                onClick={() => setSelectedEmployee(emp)}
                className="bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-200 rounded-xl md:rounded-2xl p-4 md:p-6 shadow-lg hover:shadow-2xl transition-all duration-300 cursor-pointer transform hover:-translate-y-1 md:hover:-translate-y-2 hover:border-amber-400"
              >
                <div className="flex items-center justify-between mb-4 md:mb-5">
                  <div className="flex items-center space-x-2 md:space-x-4 space-x-reverse">
                    <div className="p-2 md:p-3 bg-gradient-to-r from-amber-500 to-orange-600 rounded-lg md:rounded-xl shadow-md">
                      <User className="h-6 w-6 md:h-8 md:w-8 text-white" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-base md:text-xl text-gray-900">{emp.user.full_name}</h3>
                      <p className="text-xs md:text-sm text-gray-600 truncate max-w-[150px] md:max-w-full">{emp.user.email}</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-3 md:space-y-4">
                  <div className="flex justify-between text-base md:text-2xl font-extrabold pt-3 md:pt-4 border-t-2 border-amber-200">
                    <span className="text-gray-900">رصيد الموظف:</span>
                    <span className={emp.current_balance >= 0 ? 'text-amber-600' : 'text-red-600'}>
                      {formatCurrency(emp.current_balance)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs md:text-sm">
                    <span className="text-gray-600 font-medium">عدد العمليات:</span>
                    <span className="font-bold text-gray-900">{emp.transactions.length}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* نافذة تأكيد الحذف */}
      {showDeleteConfirmModal && transactionToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center mb-4 text-red-600">
              <AlertCircle className="h-8 w-8 ml-3" />
              <h3 className="text-xl font-bold">تأكيد حذف العملية من العهده</h3>
            </div>
            <p className="text-gray-700 mb-6">
              هل أنت متأكد من حذف هذه العملية بقيمة{' '}
              <strong>{formatCurrency(Math.abs(transactionToDelete.amount))}</strong>؟
            </p>
            <div className="flex gap-3">
              <button
                onClick={confirmDelete}
                className="flex-1 bg-gradient-to-r from-red-600 to-rose-600 text-white py-3 px-6 rounded-xl hover:from-red-700 hover:to-rose-700 font-bold shadow-md"
              >
                نعم، احذف
              </button>
              <button
                onClick={() => {
                  setShowDeleteConfirmModal(false);
                  setTransactionToDelete(null);
                }}
                className="flex-1 bg-gray-200 text-gray-700 py-3 px-6 rounded-xl hover:bg-gray-300 font-bold"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeAdvances;