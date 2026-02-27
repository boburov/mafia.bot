/*
  Warnings:

  - You are about to drop the `Players` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Players" DROP CONSTRAINT "Players_gameId_fkey";

-- DropTable
DROP TABLE "Players";

-- CreateTable
CREATE TABLE "Chanel" (
    "id" TEXT NOT NULL,
    "chat_name" TEXT NOT NULL,

    CONSTRAINT "Chanel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL,
    "userTgId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT '',
    "gameId" TEXT,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Player_userTgId_key" ON "Player"("userTgId");

-- AddForeignKey
ALTER TABLE "Player" ADD CONSTRAINT "Player_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE SET NULL ON UPDATE CASCADE;
