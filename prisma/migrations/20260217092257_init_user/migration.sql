-- CreateEnum
CREATE TYPE "Phase" AS ENUM ('DAY', 'NIGHT', 'VOTING');

-- DropForeignKey
ALTER TABLE "User_equipment" DROP CONSTRAINT "User_equipment_userId_fkey";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "defense" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "documents" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "Game" (
    "id" TEXT NOT NULL,
    "phase" "Phase" NOT NULL DEFAULT 'DAY',

    CONSTRAINT "Game_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Game_User" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "gameId" TEXT,

    CONSTRAINT "Game_User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Game_User_user_id_key" ON "Game_User"("user_id");

-- AddForeignKey
ALTER TABLE "User_equipment" ADD CONSTRAINT "User_equipment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Game_User" ADD CONSTRAINT "Game_User_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;
