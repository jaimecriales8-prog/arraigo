-- ============================================================
-- Vulnerabilidad CRITICAL: las políticas de storage.objects para el
-- bucket checkin-evidence solo verificaban bucket_id — sin restricción
-- de path. Cualquier usuario autenticado (incluido un imputado) podía
-- leer O SOBREESCRIBIR evidencia fotográfica de CUALQUIER otro caso
-- (selfies, fotos de escena) con solo conocer/adivinar el path, sin
-- pasar por ninguna API — esto hacía insuficiente incluso la
-- restricción de rol ya aplicada en /api/checkins/[id]/fotos, porque
-- el bucket se puede golpear directo. Con upsert:true en el cliente,
-- también permitía alterar evidencia de otro caso (cadena de custodia).
--
-- Fix: función helper que valida, según el prefijo del path
-- (checkins/, onboarding/, work-locations/ — los tres patrones que usa
-- la app), que el segundo segmento del path (checkin_id o case_id)
-- pertenezca a un caso donde el usuario es el imputado o el técnico
-- asignado. El staff sigue accediendo igual que siempre: vía las rutas
-- API con service-role, que ya bypasean RLS.
-- ============================================================

CREATE OR REPLACE FUNCTION storage_evidencia_autorizada(object_name TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE
AS $$
  SELECT CASE (storage.foldername(object_name))[1]
    WHEN 'checkins' THEN EXISTS (
      SELECT 1 FROM checkins ck JOIN cases c ON c.id = ck.case_id
      WHERE ck.id::text = (storage.foldername(object_name))[2]
        AND (c.imputado_id = auth.uid() OR c.technician_id = auth.uid())
    )
    WHEN 'onboarding' THEN EXISTS (
      SELECT 1 FROM cases c
      WHERE c.id::text = (storage.foldername(object_name))[2]
        AND (c.imputado_id = auth.uid() OR c.technician_id = auth.uid())
    )
    WHEN 'work-locations' THEN EXISTS (
      SELECT 1 FROM cases c
      WHERE c.id::text = (storage.foldername(object_name))[2]
        AND (c.imputado_id = auth.uid() OR c.technician_id = auth.uid())
    )
    ELSE false
  END;
$$;

DROP POLICY IF EXISTS "authenticated puede subir fotos" ON storage.objects;
CREATE POLICY "authenticated puede subir fotos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'checkin-evidence' AND storage_evidencia_autorizada(name));

DROP POLICY IF EXISTS "authenticated puede leer fotos" ON storage.objects;
CREATE POLICY "authenticated puede leer fotos" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'checkin-evidence' AND storage_evidencia_autorizada(name));

DROP POLICY IF EXISTS "authenticated puede actualizar fotos" ON storage.objects;
CREATE POLICY "authenticated puede actualizar fotos" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'checkin-evidence' AND storage_evidencia_autorizada(name))
  WITH CHECK (bucket_id = 'checkin-evidence' AND storage_evidencia_autorizada(name));
