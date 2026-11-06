ALTER TABLE "users" ALTER COLUMN "passwordHash" DROP NOT NULL;

CREATE TYPE "AuthActionTokenPurpose" AS ENUM ('PASSWORD_SETUP', 'PASSWORD_RESET');

CREATE TABLE "auth_action_tokens" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "purpose" "AuthActionTokenPurpose" NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_action_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "auth_action_tokens_tokenHash_key" ON "auth_action_tokens"("tokenHash");
CREATE INDEX "auth_action_tokens_userId_purpose_usedAt_idx" ON "auth_action_tokens"("userId", "purpose", "usedAt");
CREATE INDEX "auth_action_tokens_expiresAt_idx" ON "auth_action_tokens"("expiresAt");

ALTER TABLE "auth_action_tokens"
ADD CONSTRAINT "auth_action_tokens_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;