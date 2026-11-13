CREATE TABLE "AccountToken" (
  "digest" CHAR(64) PRIMARY KEY,
  "userId" UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "purpose" VARCHAR(16) NOT NULL CHECK ("purpose" IN ('verify', 'reset')),
  "expiresAt" TIMESTAMP(3) NOT NULL,
  UNIQUE ("userId", "purpose")
);
