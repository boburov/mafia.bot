-- AlterTable
ALTER TABLE "Game" ADD COLUMN     "dayNumber" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastTransitionAt" TIMESTAMP(3),
ADD COLUMN     "phase" "Phase" NOT NULL DEFAULT 'DAY',
ADD COLUMN     "startedAt" TIMESTAMP(3);
