// src/lib/auditLogger.ts
import { supabase } from './supabase';

interface PaymentLogData {
  user_id: string;
  vendor_id: string;
  payment_id: string;
  amount: number;
  payment_method: string;
  action_type: 'payment_created' | 'payment_deleted' | 'payment_updated';
  status: 'success' | 'failed';
  notes?: string;
}

class AuditLogger {
  /**
   * Log payment-related actions to audit log
   */
  async logPayment(data: PaymentLogData): Promise<void> {
    try {
      const { error } = await supabase
        .from('audit_logs')
        .insert({
          user_id: data.user_id,
          action_type: data.action_type,
          entity_type: 'payment',
          entity_id: data.payment_id,
          details: {
            vendor_id: data.vendor_id,
            amount: data.amount,
            payment_method: data.payment_method,
            status: data.status
          },
          notes: data.notes,
          created_at: new Date().toISOString()
        });

      if (error) {
        console.error('Failed to log audit entry:', error);
      }
    } catch (err) {
      console.error('Error in audit logging:', err);
    }
  }

  /**
   * Log general actions to audit log
   */
  async log(actionType: string, entityType: string, entityId: string, details: any, userId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('audit_logs')
        .insert({
          user_id: userId,
          action_type: actionType,
          entity_type: entityType,
          entity_id: entityId,
          details,
          created_at: new Date().toISOString()
        });

      if (error) {
        console.error('Failed to log audit entry:', error);
      }
    } catch (err) {
      console.error('Error in audit logging:', err);
    }
  }
}

export const auditLogger = new AuditLogger();
