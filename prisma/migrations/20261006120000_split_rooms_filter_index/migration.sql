-- DropIndex
DROP INDEX "rooms_isActive_capacity_floor_idx";

-- CreateIndex
CREATE INDEX "rooms_capacity_idx" ON "rooms"("capacity");

-- CreateIndex
CREATE INDEX "rooms_floor_idx" ON "rooms"("floor");
