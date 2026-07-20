CREATE TABLE "TeamRecentStats" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "country" TEXT NOT NULL,
    "flag" TEXT NOT NULL DEFAULT '',
    "matches" INTEGER NOT NULL DEFAULT 0,
    "goalsFor" INTEGER NOT NULL DEFAULT 0,
    "goalsAgainst" INTEGER NOT NULL DEFAULT 0,
    "corners" INTEGER NOT NULL DEFAULT 0,
    "yellowCards" INTEGER NOT NULL DEFAULT 0,
    "foulsCommitted" INTEGER NOT NULL DEFAULT 0,
    "shotsTotal" INTEGER NOT NULL DEFAULT 0,
    "shotsOnTarget" INTEGER NOT NULL DEFAULT 0,
    "possession" REAL NOT NULL DEFAULT 0,
    "cornersPerMatch" REAL NOT NULL DEFAULT 0,
    "yellowsPerMatch" REAL NOT NULL DEFAULT 0,
    "shotsPerMatch" REAL NOT NULL DEFAULT 0,
    "goalsForPerMatch" REAL NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "TeamRecentStats_country_key" ON "TeamRecentStats"("country");
