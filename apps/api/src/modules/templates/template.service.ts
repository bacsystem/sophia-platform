import prisma from '../../lib/prisma.js';

/** Lists all system templates. */
export async function listTemplates() {
  const templates = await prisma.template.findMany({
    orderBy: { createdAt: 'asc' },
  });

  return {
    data: templates.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      icon: t.icon,
      stack: t.stack,
      tags: t.tags,
      defaults: t.defaults,
    })),
  };
}
