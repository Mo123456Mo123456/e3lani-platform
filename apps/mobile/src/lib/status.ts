export const STATUS_AR: Record<string, string> = {
  DRAFT: 'مسودة',
  PENDING_REVIEW: 'قيد المراجعة',
  NEEDS_CHANGES: 'يحتاج تعديلات',
  APPROVED_AWAITING_PAYMENT: 'مقبول — بانتظار الدفع',
  PAYMENT_PENDING: 'الدفع قيد التنفيذ',
  ACTIVE: 'نشط',
  REJECTED: 'مرفوض',
};

export function statusLabel(status: string) {
  return STATUS_AR[status] ?? status;
}
