CREATE TABLE "User" (
    "id" UUID PRIMARY KEY,
    "email" VARCHAR(254) NOT NULL,
    "firstName" VARCHAR(100) NOT NULL,
    "lastName" VARCHAR(100) NOT NULL,
    "mobile" VARCHAR(16) NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "emailVerifiedAt" TIMESTAMP(3),
    "disabledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "User_email_normalized" CHECK ("email" = lower(btrim("email"))),
    CONSTRAINT "User_mobile_format" CHECK ("mobile" ~ '^[+][1-9][0-9]{7,14}$')
);

CREATE UNIQUE INDEX "User_email_key" ON "User" ("email");

CREATE TABLE "TermsAcceptance" (
    "id" UUID PRIMARY KEY,
    "userId" UUID NOT NULL,
    "termsVersion" VARCHAR(64) NOT NULL,
    "privacyVersion" VARCHAR(64) NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TermsAcceptance_userId_fkey" FOREIGN KEY ("userId")
        REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "TermsAcceptance_userId_termsVersion_privacyVersion_key"
    ON "TermsAcceptance" ("userId", "termsVersion", "privacyVersion");
