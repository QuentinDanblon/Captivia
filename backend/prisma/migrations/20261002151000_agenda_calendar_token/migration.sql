-- Agenda des soins : jeton de flux iCalendar personnel et révocable (sha256 du jeton, jamais le clair).

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "calendarToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_calendarToken_key" ON "User"("calendarToken");
