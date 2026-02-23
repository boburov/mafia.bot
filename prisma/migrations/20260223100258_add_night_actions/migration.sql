-- AlterTable
ALTER TABLE "Game" ADD COLUMN     "nightNumber" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "NightAction" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "nightNumber" INTEGER NOT NULL,
    "actorTelegramId" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "targetTelegramId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NightAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NightAction_gameId_nightNumber_idx" ON "NightAction"("gameId", "nightNumber");

-- CreateIndex
CREATE UNIQUE INDEX "NightAction_gameId_nightNumber_actorTelegramId_key" ON "NightAction"("gameId", "nightNumber", "actorTelegramId");

-- AddForeignKey
ALTER TABLE "NightAction" ADD CONSTRAINT "NightAction_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;
