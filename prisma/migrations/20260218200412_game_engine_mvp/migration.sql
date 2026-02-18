/*
  Warnings:

  - Added the required column `telegramId` to the `GamePlayer` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Game" ADD COLUMN     "creatorTelegramId" TEXT,
ADD COLUMN     "dayNumber" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "endedAt" TIMESTAMP(3),
ADD COLUMN     "lastTransitionAt" TIMESTAMP(3),
ADD COLUMN     "nightNumber" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "startedAt" TIMESTAMP(3),
ADD COLUMN     "winnerTeam" TEXT;

-- AlterTable
ALTER TABLE "GamePlayer" ADD COLUMN     "hasVoted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isAlive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "isProtected" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastHealedNight" INTEGER,
ADD COLUMN     "telegramId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "GameAction" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "actorPlayerId" TEXT NOT NULL,
    "targetPlayerId" TEXT,
    "actionType" TEXT NOT NULL,
    "nightNumber" INTEGER NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameVote" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "voterPlayerId" TEXT NOT NULL,
    "targetPlayerId" TEXT NOT NULL,
    "dayNumber" INTEGER NOT NULL,
    "isRevote" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameLog" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GameAction_gameId_actorPlayerId_nightNumber_key" ON "GameAction"("gameId", "actorPlayerId", "nightNumber");

-- CreateIndex
CREATE UNIQUE INDEX "GameVote_gameId_voterPlayerId_dayNumber_isRevote_key" ON "GameVote"("gameId", "voterPlayerId", "dayNumber", "isRevote");

-- AddForeignKey
ALTER TABLE "GameAction" ADD CONSTRAINT "GameAction_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameAction" ADD CONSTRAINT "GameAction_actorPlayerId_fkey" FOREIGN KEY ("actorPlayerId") REFERENCES "GamePlayer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameAction" ADD CONSTRAINT "GameAction_targetPlayerId_fkey" FOREIGN KEY ("targetPlayerId") REFERENCES "GamePlayer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameVote" ADD CONSTRAINT "GameVote_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameVote" ADD CONSTRAINT "GameVote_voterPlayerId_fkey" FOREIGN KEY ("voterPlayerId") REFERENCES "GamePlayer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameVote" ADD CONSTRAINT "GameVote_targetPlayerId_fkey" FOREIGN KEY ("targetPlayerId") REFERENCES "GamePlayer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameLog" ADD CONSTRAINT "GameLog_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;
