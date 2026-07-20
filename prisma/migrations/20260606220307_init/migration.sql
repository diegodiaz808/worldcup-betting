-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "externalId" TEXT,
    "name" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "club" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "flag" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PlayerStats" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "playerId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "goals" INTEGER NOT NULL DEFAULT 0,
    "assists" INTEGER NOT NULL DEFAULT 0,
    "matches" INTEGER NOT NULL DEFAULT 0,
    "rating" REAL NOT NULL DEFAULT 0,
    "goalsPerMatch" REAL NOT NULL DEFAULT 0,
    "shotsOnTarget" INTEGER NOT NULL DEFAULT 0,
    "weightedScore" REAL NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PlayerStats_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WorldCupStats" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "playerId" TEXT NOT NULL,
    "group" TEXT NOT NULL,
    "goals" INTEGER NOT NULL DEFAULT 0,
    "assists" INTEGER NOT NULL DEFAULT 0,
    "matches" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "WorldCupStats_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Match" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "externalId" TEXT,
    "homeTeam" TEXT NOT NULL,
    "awayTeam" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "result" TEXT,
    "competition" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Combo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "riskLevel" TEXT NOT NULL,
    "totalOdds" REAL NOT NULL,
    "realProbability" REAL NOT NULL,
    "picks" TEXT NOT NULL,
    "justification" TEXT NOT NULL,
    "edgeTip" TEXT NOT NULL,
    "marketInsight" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "SyncLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "message" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "Player_externalId_key" ON "Player"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerStats_playerId_period_key" ON "PlayerStats"("playerId", "period");

-- CreateIndex
CREATE UNIQUE INDEX "WorldCupStats_playerId_key" ON "WorldCupStats"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "Match_externalId_key" ON "Match"("externalId");
