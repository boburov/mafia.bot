/*
  Warnings:

  - You are about to drop the column `creatorTelegramId` on the `Game` table. All the data in the column will be lost.
  - You are about to drop the column `dayNumber` on the `Game` table. All the data in the column will be lost.
  - You are about to drop the column `endedAt` on the `Game` table. All the data in the column will be lost.
  - You are about to drop the column `lastTransitionAt` on the `Game` table. All the data in the column will be lost.
  - You are about to drop the column `nightNumber` on the `Game` table. All the data in the column will be lost.
  - You are about to drop the column `phase` on the `Game` table. All the data in the column will be lost.
  - You are about to drop the column `startedAt` on the `Game` table. All the data in the column will be lost.
  - You are about to drop the column `winnerTeam` on the `Game` table. All the data in the column will be lost.
  - You are about to drop the column `hasVoted` on the `GamePlayer` table. All the data in the column will be lost.
  - You are about to drop the column `isProtected` on the `GamePlayer` table. All the data in the column will be lost.
  - You are about to drop the column `lastHealedNight` on the `GamePlayer` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `GamePlayer` table. All the data in the column will be lost.
  - You are about to drop the `GameAction` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `GameLog` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `GameVote` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[gameId,telegramId]` on the table `GamePlayer` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "GameAction" DROP CONSTRAINT "GameAction_actorPlayerId_fkey";

-- DropForeignKey
ALTER TABLE "GameAction" DROP CONSTRAINT "GameAction_gameId_fkey";

-- DropForeignKey
ALTER TABLE "GameAction" DROP CONSTRAINT "GameAction_targetPlayerId_fkey";

-- DropForeignKey
ALTER TABLE "GameLog" DROP CONSTRAINT "GameLog_gameId_fkey";

-- DropForeignKey
ALTER TABLE "GameVote" DROP CONSTRAINT "GameVote_gameId_fkey";

-- DropForeignKey
ALTER TABLE "GameVote" DROP CONSTRAINT "GameVote_targetPlayerId_fkey";

-- DropForeignKey
ALTER TABLE "GameVote" DROP CONSTRAINT "GameVote_voterPlayerId_fkey";

-- DropIndex
DROP INDEX "GamePlayer_gameId_userId_key";

-- AlterTable
ALTER TABLE "Game" DROP COLUMN "creatorTelegramId",
DROP COLUMN "dayNumber",
DROP COLUMN "endedAt",
DROP COLUMN "lastTransitionAt",
DROP COLUMN "nightNumber",
DROP COLUMN "phase",
DROP COLUMN "startedAt",
DROP COLUMN "winnerTeam",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "GamePlayer" DROP COLUMN "hasVoted",
DROP COLUMN "isProtected",
DROP COLUMN "lastHealedNight",
DROP COLUMN "userId";

-- DropTable
DROP TABLE "GameAction";

-- DropTable
DROP TABLE "GameLog";

-- DropTable
DROP TABLE "GameVote";

-- CreateIndex
CREATE UNIQUE INDEX "GamePlayer_gameId_telegramId_key" ON "GamePlayer"("gameId", "telegramId");
