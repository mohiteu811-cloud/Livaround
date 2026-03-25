-- Backfill: assign existing workers to their most-associated host
-- (determined by property staff assignments), or to the first host if unassigned.
UPDATE "Worker" w
SET "hostId" = sub."hostId"
FROM (
  SELECT DISTINCT ON (ps."workerId") ps."workerId", p."hostId"
  FROM "PropertyStaff" ps
  JOIN "Property" p ON p."id" = ps."propertyId"
  ORDER BY ps."workerId", ps."createdAt" ASC
) sub
WHERE w."id" = sub."workerId"
  AND w."hostId" IS NULL;

-- Any remaining workers without property assignments: assign to the first host
UPDATE "Worker"
SET "hostId" = (SELECT "id" FROM "Host" ORDER BY "createdAt" ASC LIMIT 1)
WHERE "hostId" IS NULL;
