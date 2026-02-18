/*
  Warnings:

  - A unique constraint covering the columns `[chat_id]` on the table `Game` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `chat_id` to the `Game` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Game" ADD COLUMN     "chat_id" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Game_chat_id_key" ON "Game"("chat_id");
