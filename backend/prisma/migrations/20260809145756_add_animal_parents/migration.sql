-- AlterTable
ALTER TABLE "Animal" ADD COLUMN     "fatherId" TEXT,
ADD COLUMN     "groupName" TEXT,
ADD COLUMN     "motherId" TEXT;

-- CreateIndex
CREATE INDEX "Animal_fatherId_idx" ON "Animal"("fatherId");

-- CreateIndex
CREATE INDEX "Animal_motherId_idx" ON "Animal"("motherId");

-- CreateIndex
CREATE INDEX "Animal_groupName_idx" ON "Animal"("groupName");

-- AddForeignKey
ALTER TABLE "Animal" ADD CONSTRAINT "Animal_fatherId_fkey" FOREIGN KEY ("fatherId") REFERENCES "Animal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Animal" ADD CONSTRAINT "Animal_motherId_fkey" FOREIGN KEY ("motherId") REFERENCES "Animal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Module F : CHECK constraint (Prisma ne supporte pas les CHECK — SQL manuel)
ALTER TABLE "Animal" ADD CONSTRAINT "Animal_groupName_length_check" CHECK (char_length("groupName") <= 100);
