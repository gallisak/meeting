-- CreateExtension
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- AlterTable
ALTER TABLE "bookings"
  ALTER COLUMN "startsAt" SET DATA TYPE TIMESTAMPTZ(3) USING "startsAt" AT TIME ZONE 'UTC',
  ALTER COLUMN "endsAt" SET DATA TYPE TIMESTAMPTZ(3) USING "endsAt" AT TIME ZONE 'UTC';

-- AddCheckConstraint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_period_check" CHECK ("endsAt" > "startsAt");

-- AddCheckConstraint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_attendees_check" CHECK ("attendeesCount" >= 1);

-- AddExclusionConstraint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_no_overlap"
  EXCLUDE USING gist ("roomId" WITH =, tstzrange("startsAt", "endsAt", '[)') WITH &&)
  WHERE ("status" = 'CONFIRMED');
