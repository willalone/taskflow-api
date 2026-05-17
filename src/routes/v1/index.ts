import { Router } from 'express';
import { authRouter } from '../../modules/auth/auth.routes.js';
import { usersRouter } from '../../modules/users/users.routes.js';
import { teamsRouter } from '../../modules/teams/teams.routes.js';
import { projectsRouter } from '../../modules/projects/projects.routes.js';
import { tasksRouter } from '../../modules/tasks/tasks.routes.js';
import { notificationsRouter } from '../../modules/notifications/notifications.routes.js';

export const v1Router = Router();

v1Router.use('/auth', authRouter);
v1Router.use('/users', usersRouter);
v1Router.use('/teams', teamsRouter);
v1Router.use('/projects', projectsRouter);
v1Router.use('/tasks', tasksRouter);
v1Router.use('/notifications', notificationsRouter);
