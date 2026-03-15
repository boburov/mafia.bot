-- CreateTable
CREATE TABLE "GroupSettings" (
    "id" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "defaultLang" "Lang" NOT NULL DEFAULT 'uz',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GroupSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GroupSettings_chatId_key" ON "GroupSettings"("chatId");
