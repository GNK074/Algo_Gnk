-- CreateTable
CREATE TABLE "AgreementVersion" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "version" INTEGER NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "format" VARCHAR(8) NOT NULL,
    "source" BYTEA NOT NULL,
    "sha256" CHAR(64) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "AgreementVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgreementAcceptance" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "versionId" UUID NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "document" BYTEA NOT NULL,
    "sha256" CHAR(64) NOT NULL,

    CONSTRAINT "AgreementAcceptance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgreementDelivery" (
    "id" UUID NOT NULL,
    "acceptanceId" UUID NOT NULL,
    "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "AgreementDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AgreementVersion_slug_version_key" ON "AgreementVersion"("slug", "version");

-- CreateIndex
CREATE INDEX "AgreementAcceptance_versionId_acceptedAt_idx" ON "AgreementAcceptance"("versionId", "acceptedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AgreementAcceptance_userId_versionId_key" ON "AgreementAcceptance"("userId", "versionId");

-- CreateIndex
CREATE INDEX "AgreementDelivery_acceptanceId_attemptedAt_idx" ON "AgreementDelivery"("acceptanceId", "attemptedAt");

-- AddForeignKey
ALTER TABLE "AgreementAcceptance" ADD CONSTRAINT "AgreementAcceptance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgreementAcceptance" ADD CONSTRAINT "AgreementAcceptance_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "AgreementVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgreementDelivery" ADD CONSTRAINT "AgreementDelivery_acceptanceId_fkey" FOREIGN KEY ("acceptanceId") REFERENCES "AgreementAcceptance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
