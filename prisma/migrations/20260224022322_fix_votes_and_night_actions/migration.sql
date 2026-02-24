/*
  Warnings:

  - You are about to drop the column `actorId` on the `NightAction` table. All the data in the column will be lost.
  - You are about to drop the column `night` on the `NightAction` table. All the data in the column will be lost.
  - You are about to drop the column `targetId` on the `NightAction` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `NightAction` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[gameId,nightNumber,actorTelegramId]` on the table `NightAction` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `actionType` to the `NightAction` table without a default value. This is not possible if the table is not empty.
  - Added the required column `actorTelegramId` to the `NightAction` table without a default value. This is not possible if the table is not empty.
  - Added the required column `nightNumber` to the `NightAction` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "NightAction" DROP CONSTRAINT "NightAction_actorId_fkey";

-- DropForeignKey
ALTER TABLE "Vote" DROP CONSTRAINT "Vote_targetId_fkey";

-- DropIndex
DROP INDEX "NightAction_gameId_night_actorId_key";

-- DropIndex
DROP INDEX "NightAction_gameId_night_idx";

-- DropIndex
DROP INDEX "Vote_gameId_day_idx";

-- AlterTable
ALTER TABLE "NightAction" DROP COLUMN "actorId",
DROP COLUMN "night",
DROP COLUMN "targetId",
DROP COLUMN "type",
ADD COLUMN     "actionType" TEXT NOT NULL,
ADD COLUMN     "actorTelegramId" TEXT NOT NULL,
ADD COLUMN     "nightNumber" INTEGER NOT NULL,
ADD COLUMN     "targetTelegramId" TEXT;

-- CreateIndex
CREATE INDEX "NightAction_gameId_nightNumber_idx" ON "NightAction"("gameId", "nightNumber");

-- CreateIndex
CREATE UNIQUE INDEX "NightAction_gameId_nightNumber_actorTelegramId_key" ON "NightAction"("gameId", "nightNumber", "actorTelegramId");

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "GamePlayer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
