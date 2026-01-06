// src/lib/dateUtils.ts

/**
 * Format a date string to Arabic locale format
 * @param dateString - ISO date string or Date object
 * @returns Formatted date string in Arabic
 */
export function formatDateTime(dateString: string | Date | null | undefined): string {
  if (!dateString) return 'غير محدد';
  
  try {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    
    if (isNaN(date.getTime())) {
      return 'تاريخ غير صالح';
    }
    
    // Format: DD/MM/YYYY HH:mm
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'خطأ في التاريخ';
  }
}

/**
 * Format a date string to short Arabic locale format (date only)
 * @param dateString - ISO date string or Date object
 * @returns Formatted date string in Arabic (DD/MM/YYYY)
 */
export function formatDate(dateString: string | Date | null | undefined): string {
  if (!dateString) return 'غير محدد';
  
  try {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    
    if (isNaN(date.getTime())) {
      return 'تاريخ غير صالح';
    }
    
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    
    return `${day}/${month}/${year}`;
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'خطأ في التاريخ';
  }
}
