CREATE TABLE "Authenticator" (
  "userId" UUID PRIMARY KEY REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "secret" TEXT NOT NULL,
  "lastCounter" BIGINT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "LoginChallenge" (
  "digest" CHAR(64) PRIMARY KEY,
  "userId" UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "pendingSecret" TEXT,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "expiresAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "LoginChallenge_userId_idx" ON "LoginChallenge" ("userId");
CREATE INDEX "LoginChallenge_expiresAt_idx" ON "LoginChallenge" ("expiresAt");
CREATE TABLE "Session" (
  "id" UUID PRIMARY KEY,
  "digest" CHAR(64) NOT NULL UNIQUE,
  "userId" UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "Session_userId_expiresAt_idx" ON "Session" ("userId", "expiresAt");
CREATE TABLE "RecoveryCode" (
  "digest" CHAR(64) PRIMARY KEY,
  "userId" UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "RecoveryCode_userId_idx" ON "RecoveryCode" ("userId");
