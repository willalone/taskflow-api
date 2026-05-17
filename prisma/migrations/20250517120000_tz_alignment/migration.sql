-- Align schema with TZ (isActive, TaskHistory, NotificationType, Project.createdBy, RefreshToken.revoked)

-- User: emailVerified -> isActive
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT false;
UPDATE "User" SET "isActive" = COALESCE("emailVerified", false) WHERE "isActive" = false;
ALTER TABLE "User" DROP COLUMN IF EXISTS "emailVerified";
ALTER TABLE "User" DROP COLUMN IF EXISTS "isAdmin";

-- RefreshToken.revoked
ALTER TABLE "RefreshToken" ADD COLUMN IF NOT EXISTS "revoked" BOOLEAN NOT NULL DEFAULT false;

-- Project.createdBy
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "createdBy" TEXT;
UPDATE "Project" p SET "createdBy" = t."ownerId"
FROM "Team" t WHERE p."teamId" = t.id AND p."createdBy" IS NULL;
ALTER TABLE "Project" ALTER COLUMN "createdBy" SET NOT NULL;
ALTER TABLE "Project" ADD CONSTRAINT "Project_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Task: creatorId -> createdById, TaskPriority -> Priority
ALTER TYPE "TaskPriority" RENAME TO "Priority";
ALTER TABLE "Task" RENAME COLUMN "creatorId" TO "createdById";

-- TaskAuditLog -> TaskHistory
ALTER TABLE "TaskAuditLog" RENAME TO "TaskHistory";
ALTER TABLE "TaskHistory" RENAME COLUMN "userId" TO "changedBy";

-- Notification TZ shape
CREATE TYPE "NotificationType" AS ENUM ('DEADLINE_APPROACHING', 'TASK_ASSIGNED', 'COMMENT_ADDED', 'INVITATION');

ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "content" TEXT;
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "isRead" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "type_new" "NotificationType";

UPDATE "Notification" SET
  "content" = COALESCE("title", '') || ': ' || COALESCE("message", ''),
  "isRead" = COALESCE("read", false),
  "type_new" = 'DEADLINE_APPROACHING'::"NotificationType"
WHERE "content" IS NULL;

ALTER TABLE "Notification" ALTER COLUMN "content" SET NOT NULL;
ALTER TABLE "Notification" DROP COLUMN IF EXISTS "title";
ALTER TABLE "Notification" DROP COLUMN IF EXISTS "message";
ALTER TABLE "Notification" DROP COLUMN IF EXISTS "read";
ALTER TABLE "Notification" DROP COLUMN IF EXISTS "type";
ALTER TABLE "Notification" RENAME COLUMN "type_new" TO "type";
ALTER TABLE "Notification" ALTER COLUMN "type" SET NOT NULL;

-- Full-text search GIN index
CREATE INDEX IF NOT EXISTS "Task_search_gin_idx" ON "Task"
USING GIN (to_tsvector('english', coalesce("title", '') || ' ' || coalesce("description", '')));
