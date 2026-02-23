/*
  Warnings:

  - You are about to drop the column `gamePlayerId` on the `Vote` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Vote" DROP CONSTRAINT "Vote_gamePlayerId_fkey";

-- AlterTable
ALTER TABLE "Vote" DROP COLUMN "gamePlayerId";
