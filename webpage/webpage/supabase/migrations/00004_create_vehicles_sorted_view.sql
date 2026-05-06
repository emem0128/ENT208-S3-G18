-- Sorted vehicle view for the customer-service vehicle list.
-- Keeps pagination stable while ordering data_source as verified -> manual -> legacy.
CREATE OR REPLACE VIEW vehicles_sorted AS
SELECT
  vehicles.*,
  CASE
    WHEN vehicles.data_source = 'verified' THEN 1
    WHEN vehicles.data_source = 'manual' THEN 2
    WHEN vehicles.data_source = 'legacy' THEN 3
    ELSE 4
  END AS data_source_rank,
  operating_companies.name AS operating_company_name,
  operating_companies.short_name AS operating_company_short_name
FROM vehicles
LEFT JOIN operating_companies ON operating_companies.id = vehicles.operating_company_id;
