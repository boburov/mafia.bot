/*
  Warnings:

  - Added the required column `firstName` to the `GamePlayer` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Game" ADD COLUMN     "lobby_msg" INTEGER;

-- AlterTable
ALTER TABLE "GamePlayer" ADD COLUMN     "firstName" TEXT NOT NULL,
ADD COLUMN     "username" TEXT;
