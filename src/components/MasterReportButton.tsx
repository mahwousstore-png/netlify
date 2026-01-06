import React from "react";
import ExcelJS from "exceljs";

const MasterReportButton: React.FC = () => {
  const generateReport = async () => {
    const workbook = new ExcelJS.Workbook();

    const sheets = [
      { name: "Orders", columns: ["Order ID", "Customer", "Date", "Total"], rows: [] },
      { name: "Vendors", columns: ["Vendor ID", "Name", "Contact"], rows: [] },
      { name: "Custody", columns: ["Custody ID", "Description", "Status"], rows: [] },
      { name: "Expenses", columns: ["Expense ID", "Amount", "Category"], rows: [] },
      { name: "Summary", columns: ["Item", "Details"], rows: [] },
    ];

    sheets.forEach((sheet) => {
      const worksheet = workbook.addWorksheet(sheet.name);
      worksheet.columns = sheet.columns.map((header) => ({ header }));
      sheet.rows.forEach((row) => worksheet.addRow(row));
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });

    const link = document.createElement("a");
    link.href = window.URL.createObjectURL(blob);
    link.download = "MasterReport.xlsx";
    link.click();
  };

  return <button onClick={generateReport}>Download Master Report</button>;
};

export default MasterReportButton;