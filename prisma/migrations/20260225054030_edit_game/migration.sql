/*
  Warnings:

  - You are about to drop the column `userTgId` on the `Game` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[chatId]` on the table `Game` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `chatId` to the `Game` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Game_userTgId_key";

-- AlterTable
ALTER TABLE "Game" DROP COLUMN "userTgId",
ADD COLUMN     "chatId" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Game_chatId_key" ON "Game"("chatId");
