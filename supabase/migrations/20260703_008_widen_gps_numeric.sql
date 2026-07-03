-- ============================================================
-- Ensanchar columnas numéricas de GPS (fix overflow)
-- ============================================================
-- gps_distance_m / gps_accuracy_m eran NUMERIC(8,2) (máx ~1.000 km).
-- Un salto momentáneo del GPS (fix malo en 4G) daba distancias enormes
-- → numeric field overflow → el UPDATE fallaba con 500 y la app mostraba
-- "Edge Function returned a non-2xx status code".
-- ============================================================

ALTER TABLE checkins
  ALTER COLUMN gps_distance_m TYPE NUMERIC(12,2),
  ALTER COLUMN gps_accuracy_m TYPE NUMERIC(12,2);
