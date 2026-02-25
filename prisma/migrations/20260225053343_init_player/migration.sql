-- CreateTable
CREATE TABLE "Game" (
    "id" TEXT NOT NULL,
    "userTgId" TEXT NOT NULL,
    "status" "Status" NOT NULL DEFAULT 'LOBBY',
    "phase" "Phase" NOT NULL DEFAULT 'DAY',

    CONSTRAINT "Game_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Players" (
    "id" TEXT NOT NULL,
    "userTgId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT '',
    "gameId" TEXT,

    CONSTRAINT "Players_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Game_userTgId_key" ON "Game"("userTgId");

-- CreateIndex
CREATE UNIQUE INDEX "Players_userTgId_key" ON "Players"("userTgId");

-- AddForeignKey
ALTER TABLE "Players" ADD CONSTRAINT "Players_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE SET NULL ON UPDATE CASCADE;
