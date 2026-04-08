import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const templates = [
  {
    name: 'ERP Módulo',
    description: 'Módulo completo para sistema ERP con CRUD, reportes y roles de usuario',
    icon: 'Building2',
    stack: 'laravel-nextjs',
    tags: ['Laravel', 'Next.js', 'PostgreSQL', 'Multi-role'],
    defaults: {
      agents: ['dba', 'seed', 'backend', 'frontend', 'qa', 'security', 'docs', 'deploy', 'integration'],
      model: 'claude-sonnet-4-6',
    },
  },
  {
    name: 'SaaS Starter',
    description: 'Aplicación SaaS multi-tenant con billing, autenticación y dashboard de métricas',
    icon: 'Rocket',
    stack: 'node-nextjs',
    tags: ['Node.js', 'Next.js', 'Multi-tenant', 'Billing'],
    defaults: {
      agents: ['dba', 'seed', 'backend', 'frontend', 'qa', 'security', 'docs', 'deploy', 'integration'],
      model: 'claude-sonnet-4-6',
    },
  },
  {
    name: 'REST API',
    description: 'API backend pura con autenticación, CRUD completo y documentación OpenAPI',
    icon: 'Plug',
    stack: 'node-nextjs',
    tags: ['Node.js', 'Fastify', 'OpenAPI', 'Auth'],
    defaults: {
      agents: ['dba', 'seed', 'backend', 'qa', 'security', 'docs', 'deploy', 'integration'],
      model: 'claude-sonnet-4-6',
    },
  },
  {
    name: 'Landing + Admin',
    description: 'Landing page pública con panel administrativo protegido para gestión de contenido',
    icon: 'Monitor',
    stack: 'node-nextjs',
    tags: ['Next.js', 'Landing', 'Admin Panel', 'CMS'],
    defaults: {
      agents: ['dba', 'seed', 'backend', 'frontend', 'qa', 'security', 'docs', 'deploy', 'integration'],
      model: 'claude-sonnet-4-6',
    },
  },
  {
    name: 'EdTech',
    description: 'Plataforma educativa con cursos, estudiantes, progreso y certificados',
    icon: 'BookOpen',
    stack: 'python-nextjs',
    tags: ['Python', 'Next.js', 'Education', 'Progress Tracking'],
    defaults: {
      agents: ['dba', 'seed', 'backend', 'frontend', 'qa', 'security', 'docs', 'deploy', 'integration'],
      model: 'claude-sonnet-4-6',
    },
  },
];

async function main() {
  console.log('Seeding templates...');

  const existing = await prisma.template.count();
  if (existing === 0) {
    await prisma.template.createMany({ data: templates });
    console.log(`Created ${templates.length} templates`);
  } else {
    console.log(`Templates already exist (${existing}), skipping`);
  }

  console.log('Seed complete');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
