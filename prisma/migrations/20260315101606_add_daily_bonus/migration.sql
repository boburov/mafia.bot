-- AlterTable
ALTER TABLE "User" ADD COLUMN     "dailyStreak" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastDailyBonus" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "DailyBonus" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lastClaimed" TIMESTAMP(3) NOT NULL,
    "streak" INTEGER NOT NULL DEFAULT 1,
    "totalClaimed" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DailyBonus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoinLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoinLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DailyBonus_userId_key" ON "DailyBonus"("userId");

-- AddForeignKey
ALTER TABLE "DailyBonus" ADD CONSTRAINT "DailyBonus_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoinLog" ADD CONSTRAINT "CoinLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
