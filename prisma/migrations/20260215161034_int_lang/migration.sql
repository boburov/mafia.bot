-- CreateEnum
CREATE TYPE "Lang" AS ENUM ('eng', 'uz', 'ru');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "lang" "Lang" NOT NULL DEFAULT 'eng';
