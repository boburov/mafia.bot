-- CreateEnum
CREATE TYPE "Status" AS ENUM ('LOBBY', 'RUNNING', 'FINISHED');

-- CreateEnum
CREATE TYPE "Phase" AS ENUM ('DAY', 'NIGHT', 'VOTING');

-- CreateEnum
CREATE TYPE "Lang" AS ENUM ('eng', 'uz', 'ru');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "money" INTEGER NOT NULL DEFAULT 0,
    "diamond" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_user_id_key" ON "User"("user_id");
