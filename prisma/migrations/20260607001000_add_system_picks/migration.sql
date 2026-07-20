CREATE TABLE "SystemPick" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "signature" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'simple',
    "matchId" TEXT NOT NULL,
    "matchName" TEXT NOT NULL DEFAULT '',
    "player" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "marketLabel" TEXT NOT NULL,
    "line" TEXT NOT NULL,
    "odds" REAL NOT NULL,
    "stake" REAL NOT NULL DEFAULT 1,
    "picks" TEXT NOT NULL DEFAULT '[]',
    "riskLevel" TEXT NOT NULL DEFAULT '',
    "result" TEXT NOT NULL DEFAULT 'pending',
    "profit" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "settledAt" DATETIME
);

CREATE UNIQUE INDEX "SystemPick_signature_key" ON "SystemPick"("signature");
CREATE INDEX "SystemPick_matchId_idx" ON "SystemPick"("matchId");
CREATE INDEX "SystemPick_result_idx" ON "SystemPick"("result");
CREATE INDEX "SystemPick_marketId_idx" ON "SystemPick"("marketId");
