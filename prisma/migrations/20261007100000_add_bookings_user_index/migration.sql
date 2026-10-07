-- CreateIndex
CREATE INDEX "bookings_userId_startsAt_idx" ON "bookings"("userId", "startsAt");
