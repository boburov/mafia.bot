/*
  Warnings:

  - You are about to drop the column `actionType` on the `NightAction` table. All the data in the column will be lost.
  - You are about to drop the column `actorTelegramId` on the `NightAction` table. All the data in the column will be lost.
  - You are about to drop the column `nightNumber` on the `NightAction` table. All the data in the column will be lost.
  - You are about to drop the column `targetTelegramId` on the `NightAction` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[gameId,night,actorId]` on the table `NightAction` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `actorId` to the `NightAction` table without a default value. This is not possible if the table is not empty.
  - Added the required column `night` to the `NightAction` table without a default value. This is not possible if the table is not empty.
  - Added the required column `type` to the `NightAction` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "NightAction_gameId_nightNumber_actorTelegramId_key";

-- DropIndex
DROP INDEX "NightAction_gameId_nightNumber_idx";

-- AlterTable
ALTER TABLE "NightAction" DROP COLUMN "actionType",
DROP COLUMN "actorTelegramId",
DROP COLUMN "nightNumber",
DROP COLUMN "targetTelegramId",
ADD COLUMN     "actorId" TEXT NOT NULL,
ADD COLUMN     "night" INTEGER NOT NULL,
ADD COLUMN     "targetId" TEXT,
ADD COLUMN     "type" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "Vote" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "day" INTEGER NOT NULL,
    "voterId" TEXT NOT NULL,
    "targetId" TEXT,
    "weight" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gamePlayerId" TEXT,

    CONSTRAINT "Vote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Vote_gameId_day_idx" ON "Vote"("gameId", "day");

-- CreateIndex
CREATE UNIQUE INDEX "Vote_gameId_day_voterId_key" ON "Vote"("gameId", "day", "voterId");

-- CreateIndex
CREATE INDEX "NightAction_gameId_night_idx" ON "NightAction"("gameId", "night");

-- CreateIndex
CREATE UNIQUE INDEX "NightAction_gameId_night_actorId_key" ON "NightAction"("gameId", "night", "actorId");

-- AddForeignKey
ALTER TABLE "NightAction" ADD CONSTRAINT "NightAction_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "GamePlayer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_voterId_fkey" FOREIGN KEY ("voterId") REFERENCES "GamePlayer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "GamePlayer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_gamePlayerId_fkey" FOREIGN KEY ("gamePlayerId") REFERENCES "GamePlayer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
