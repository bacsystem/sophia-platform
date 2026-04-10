-- AddUniqueConstraint
ALTER TABLE "generated_files" ADD CONSTRAINT "uq_generated_files_project_path" UNIQUE ("project_id", "path");

-- CreateTable
CREATE TABLE "agent_messages" (
    "id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "turn_number" INTEGER NOT NULL,
    "role" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "tokens" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "agent_messages_agent_id_turn_number_idx" ON "agent_messages"("agent_id", "turn_number");

-- CreateIndex
CREATE INDEX "agent_messages_project_id_idx" ON "agent_messages"("project_id");

-- AddForeignKey
ALTER TABLE "agent_messages" ADD CONSTRAINT "agent_messages_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_messages" ADD CONSTRAINT "agent_messages_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
