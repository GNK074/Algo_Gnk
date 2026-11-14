CREATE TABLE "AccountActivity" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "event" VARCHAR(32) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AccountActivity_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AccountActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "AccountActivity_userId_createdAt_id_idx" ON "AccountActivity"("userId", "createdAt", "id");
