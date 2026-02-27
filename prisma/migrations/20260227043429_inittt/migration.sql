/*
  Warnings:

  - A unique constraint covering the columns `[chatId,status]` on the table `Game` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[userTgId,gameId]` on the table `Player` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "Player" DROP CONSTRAINT "Player_gameId_fkey";

-- DropIndex
DROP INDEX "Player_userTgId_key";

-- CreateIndex
CREATE UNIQUE INDEX "Game_chatId_status_key" ON "Game"("chatId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Player_userTgId_gameId_key" ON "Player"("userTgId", "gameId");

-- AddForeignKey
ALTER TABLE "Player" ADD CONSTRAINT "Player_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;
