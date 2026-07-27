export const STATUS_AR: Record<string, string> = {
  DRAFT: 'مسودة',
  PENDING_REVIEW: 'قيد المراجعة',
  NEEDS_CHANGES: 'يحتاج تعديلات',
  APPROVED_AWAITING_PAYMENT: 'مقبول — بانتظار الدفع',
  PAYMENT_PENDING: 'الدفع قيد التنفيذ',
  APPROVED: 'مقبول',
  SCHEDULED: 'مجدول',
  ACTIVE: 'نشط',
  PAUSED: 'متوقف مؤقتًا',
  EXPIRED: 'منتهي',
  REJECTED: 'مرفوض',
  REMOVED: 'محذوف',
};

export const STATUS_EN: Record<string, string> = {
  DRAFT: 'Draft',
  PENDING_REVIEW: 'Pending review',
  NEEDS_CHANGES: 'Needs changes',
  APPROVED_AWAITING_PAYMENT: 'Approved — awaiting payment',
  PAYMENT_PENDING: 'Payment pending',
  APPROVED: 'Approved',
  SCHEDULED: 'Scheduled',
  ACTIVE: 'Active',
  PAUSED: 'Paused',
  EXPIRED: 'Expired',
  REJECTED: 'Rejected',
  REMOVED: 'Removed',
};

export function statusLabel(status: string, locale: 'ar' | 'en' = 'ar') {
  return (locale === 'ar' ? STATUS_AR : STATUS_EN)[status] ?? status;
}
