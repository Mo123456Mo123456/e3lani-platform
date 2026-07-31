export interface OtpSendResult {
  delivered: boolean;
  providerRef?: string;
  /** يُملأ فقط بمزوّد التطوير — لا يُعاد أبدًا في استجابة الـ API. */
  debugCode?: string;
}

/**
 * واجهة مزوّد رسائل التحقق (Adapter Pattern).
 * تبديل المزوّد يتم بمتغيّر بيئة واحد دون تعديل أي منطق أعمال.
 */
export interface OtpProvider {
  readonly name: string;
  send(phone: string, code: string): Promise<OtpSendResult>;
}
