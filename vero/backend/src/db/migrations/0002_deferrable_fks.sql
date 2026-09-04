-- VERO 0002 — جعل المفاتيح الأجنبية قابلة للتأجيل
--
-- السبب: بين الجداول مراجع دائرية (vehicles.current_worker_id ↔ workers.default_vehicle_id)،
-- فلا يوجد ترتيب إدخال واحد يرضي كل القيود أثناء استعادة نسخة احتياطية كاملة.
-- بجعل القيود DEFERRABLE يمكن تأجيل فحصها إلى نهاية معاملة الاستعادة،
-- فيبقى الفحص كاملًا وصارمًا لكنه يُطبَّق مرة واحدة عند الالتزام.
--
-- في التشغيل العادي تبقى INITIALLY IMMEDIATE، أي بلا أي تغيير في السلوك.

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.conname AS constraint_name, t.relname AS table_name
      FROM pg_constraint c
      JOIN pg_class t     ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
     WHERE c.contype = 'f'
       AND n.nspname = 'public'
       AND NOT c.condeferrable
  LOOP
    EXECUTE format(
      'ALTER TABLE public.%I ALTER CONSTRAINT %I DEFERRABLE INITIALLY IMMEDIATE',
      r.table_name, r.constraint_name
    );
  END LOOP;
END $$;
