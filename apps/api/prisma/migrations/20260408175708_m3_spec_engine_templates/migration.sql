-- AlterTable
ALTER TABLE "project_specs" ADD COLUMN     "source" VARCHAR(20) NOT NULL DEFAULT 'generated',
ADD COLUMN     "valid" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "templates" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT NOT NULL,
    "icon" VARCHAR(50) NOT NULL,
    "stack" VARCHAR(50) NOT NULL,
    "tags" TEXT[],
    "defaults" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "templates_pkey" PRIMARY KEY ("id")
);
