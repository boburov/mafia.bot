/*
  Warnings:

  - You are about to drop the `Game_User` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "Status" AS ENUM ('FINISHED', 'RUNNING', 'LOBBY');

-- DropForeignKey
ALTER TABLE "Game_User" DROP CONSTRAINT "Game_User_gameId_fkey";

-- AlterTable
ALTER TABLE "Game" ADD COLUMN     "status" "Status" NOT NULL DEFAULT 'LOBBY';

-- DropTable
DROP TABLE "Game_User";

-- CreateTable
CREATE TABLE "GamePlayer" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "role" TEXT NOT NULL,

    CONSTRAINT "GamePlayer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GamePlayer_userId_key" ON "GamePlayer"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "GamePlayer_gameId_userId_key" ON "GamePlayer"("gameId", "userId");

-- AddForeignKey
ALTER TABLE "GamePlayer" ADD CONSTRAINT "GamePlayer_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;
