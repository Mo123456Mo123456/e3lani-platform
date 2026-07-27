export const STATUS_AR: Record<string, string> = {
  DRAFT: 'مسودة',
  PENDING_REVIEW: 'قيد المراجعة',
  NEEDS_CHANGES: 'يحتاج تعديلات',
  APPROVED_AWAITING_PAYMENT: 'مقبول — بانتظار الدفع',
  PAYMENT_PENDING: 'الدفع قيد التنفيذ',
  PAYMENT_FAILED: 'فشل الدفع',
  ACTIVE: 'نشط',
  PAUSED: 'متوقف',
  REJECTED: 'مرفوض',
  EXPIRED: 'منتهٍ',
  REMOVED: 'محذوف',
};

export function statusLabel(status: string) {
  return STATUS_AR[status] ?? status;
}
