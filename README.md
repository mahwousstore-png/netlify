# نظام إدارة المحوس - Mahwous Management System

A comprehensive financial management system for tracking employee custody/advances and supplier receivables.

## Features

### 1. Employee Custody Management (عهد الموظفين)
- Track employee advances and settlements
- Credit/Debit transactions with detailed history
- Filter by transaction type and date range
- Export reports to Excel and PDF
- Audit trail for all transactions
- Automatic balance calculation
- Special audit tracking for discrepancies (e.g., Abu Tamim custody audit)

### 2. Supplier Receivables Management (الموردين والمستحقات)
- Manage supplier information and contact details
- Track receivables and outstanding balances
- Payment history with detailed logs
- Safe payment deletion with automatic balance adjustment
- Export supplier reports to Excel and PDF
- Real-time balance tracking for employees
- Audit logging for all payment operations

### 3. Master Report Generation
- Comprehensive Excel report with 5 worksheets:
  1. Orders Master (سجل الطلبات)
  2. Vendor Ledger (كشف الموردين)
  3. Employee Custody Audit (تدقيق عهد الموظفين)
  4. Expenses Breakdown (تفاصيل المصروفات)
  5. Executive Summary (ملخص تنفيذي)
- Automatic highlighting of discrepancies
- Professional formatting with Arabic RTL support

## Tech Stack

- **Frontend**: React 18 with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Database**: Supabase
- **UI Components**: Lucide React icons
- **Notifications**: React Hot Toast, SweetAlert2
- **Export**: ExcelJS, jsPDF, html2canvas

## Setup Instructions

### Prerequisites
- Node.js 18+ and pnpm (or npm)
- Supabase account and project

### Installation

1. Clone the repository:
```bash
git clone https://github.com/mahwousstore-png/netlify.git
cd netlify
```

2. Install dependencies:
```bash
pnpm install
```

3. Configure environment variables:
```bash
cp .env.example .env
```

Edit `.env` and add your Supabase credentials:
```
VITE_SUPABASE_URL=your-supabase-project-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

4. Start the development server:
```bash
pnpm dev
```

5. Build for production:
```bash
pnpm build
```

## Database Schema

The system expects the following Supabase tables:

### user_profiles
- id (uuid, primary key)
- full_name (text)
- email (text)
- role (text) - 'admin' or 'user'
- is_active (boolean)

### employee_balance_transactions
- id (uuid, primary key)
- user_id (uuid, foreign key to user_profiles)
- amount (numeric)
- type (text) - 'credit' or 'debit'
- reason (text)
- transaction_date (date)
- created_by (uuid, foreign key to user_profiles)
- created_at (timestamp)

### entities
- id (uuid, primary key)
- name (text)
- type (text) - 'مورد' (supplier) or other
- contact_info (jsonb)
- created_at (timestamp)

### receivables
- id (uuid, primary key)
- entity_id (uuid, foreign key to entities)
- description (text)
- total_amount (numeric)
- remaining_amount (numeric)
- due_date (date)
- purchase_date (date)
- created_at (timestamp)

### payments
- id (uuid, primary key)
- receivable_id (uuid, foreign key to receivables)
- amount (numeric)
- receipt_number (text)
- payment_date (date)
- payment_method (text)
- notes (text)
- created_by (uuid, foreign key to user_profiles)
- created_at (timestamp)

### audit_logs
- id (uuid, primary key)
- user_id (uuid, foreign key to user_profiles)
- action_type (text)
- entity_type (text)
- entity_id (text)
- details (jsonb)
- notes (text)
- created_at (timestamp)

## Usage

### For Employees
1. View your current custody balance on the dashboard
2. Review transaction history with filters
3. Export personal custody reports
4. Make payments to suppliers (deducted from custody balance)

### For Administrators
1. Manage all employee custody transactions
2. Add/edit/delete suppliers and receivables
3. Process payments and track history
4. Delete payments (automatically adjusts balances and custody)
5. Generate comprehensive master reports
6. View audit logs for all operations

## Special Features

### Abu Tamim Custody Audit
The system includes special tracking for the documented discrepancy of 16,128.36 SAR in Abu Tamim's custody account. This is highlighted in red in the Employee Custody Audit worksheet of the master report.

### Safe Payment Deletion
When an admin deletes a payment:
1. The amount is returned to the supplier's receivable balance
2. The amount is credited back to the employee's custody
3. An audit log entry is created
4. All changes are transactional

## Deployment

The project is configured for Netlify deployment. Simply connect your GitHub repository to Netlify and it will automatically build and deploy.

## License

Proprietary - All rights reserved

## Support

For issues and questions, please contact the development team.
