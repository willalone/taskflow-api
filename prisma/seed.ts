import { PrismaClient, TeamRole, ProjectRole, TaskStatus, Priority } from '@prisma/client';
import { hashPassword } from '../src/shared/utils/password.js';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await hashPassword('Password123!');

  const admin = await prisma.user.upsert({
    where: { email: 'admin@taskflow.dev' },
    update: { isActive: true },
    create: {
      email: 'admin@taskflow.dev',
      name: 'Admin User',
      passwordHash,
      isActive: true,
    },
  });

  const member = await prisma.user.upsert({
    where: { email: 'member@taskflow.dev' },
    update: { isActive: true },
    create: {
      email: 'member@taskflow.dev',
      name: 'Team Member',
      passwordHash,
      isActive: true,
    },
  });

  const team = await prisma.team.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Demo Team',
      description: 'Seed data team',
      ownerId: admin.id,
    },
  });

  await prisma.teamMember.upsert({
    where: { teamId_userId: { teamId: team.id, userId: admin.id } },
    update: { role: TeamRole.ADMIN },
    create: { teamId: team.id, userId: admin.id, role: TeamRole.ADMIN },
  });

  await prisma.teamMember.upsert({
    where: { teamId_userId: { teamId: team.id, userId: member.id } },
    update: { role: TeamRole.MEMBER },
    create: { teamId: team.id, userId: member.id, role: TeamRole.MEMBER },
  });

  const project = await prisma.project.upsert({
    where: { id: '00000000-0000-0000-0000-000000000002' },
    update: { createdBy: admin.id },
    create: {
      id: '00000000-0000-0000-0000-000000000002',
      teamId: team.id,
      name: 'Demo Project',
      description: 'Onboarding backlog',
      createdBy: admin.id,
    },
  });

  await prisma.projectMember.upsert({
    where: { projectId_userId: { projectId: project.id, userId: admin.id } },
    update: { role: ProjectRole.PROJECT_MANAGER },
    create: { projectId: project.id, userId: admin.id, role: ProjectRole.PROJECT_MANAGER },
  });

  await prisma.projectMember.upsert({
    where: { projectId_userId: { projectId: project.id, userId: member.id } },
    update: { role: ProjectRole.DEVELOPER },
    create: { projectId: project.id, userId: member.id, role: ProjectRole.DEVELOPER },
  });

  await prisma.task.upsert({
    where: { id: '00000000-0000-0000-0000-000000000003' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000003',
      projectId: project.id,
      createdById: admin.id,
      assigneeId: member.id,
      title: 'Setup CI pipeline',
      description: 'Configure GitHub Actions for lint and tests',
      status: TaskStatus.IN_PROGRESS,
      priority: Priority.HIGH,
      deadline: new Date(Date.now() + 2 * 24 * 3600_000),
    },
  });

  console.log('Seed completed:', { admin: admin.email, member: member.email });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
