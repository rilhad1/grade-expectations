import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod';

import { AppError } from '../errors.js';

export interface Problem {
  type: string;
  title: string;
  status: number;
  code: string;
  detail?: string;
  instance?: string;
  errors?: unknown;
}

/** Єдиний формат помилок: application/problem+json з кодом домену. */
export const errorsPlugin = fp((app: FastifyInstance) => {
  app.setErrorHandler((error, request, reply) => {
    let problem: Problem;

    if (error instanceof AppError) {
      problem = {
        type: `about:blank#${error.code}`,
        title: error.title,
        status: error.status,
        code: error.code,
        ...(error.detail !== undefined && { detail: error.detail }),
      };
    } else if (hasZodFastifySchemaValidationErrors(error)) {
      problem = {
        type: 'about:blank#VALIDATION_ERROR',
        title: 'Некоректні дані запиту',
        status: 400,
        code: 'VALIDATION_ERROR',
        errors: error.validation.map((v) => ({ path: v.instancePath, message: v.message })),
      };
    } else if (typeof (error as { statusCode?: number }).statusCode === 'number') {
      const status = (error as { statusCode: number }).statusCode;
      const rateLimited = status === 429;
      problem = {
        type: `about:blank#${rateLimited ? 'RATE_LIMITED' : 'HTTP_ERROR'}`,
        title: rateLimited ? 'Забагато запитів' : 'Помилка запиту',
        status,
        code: rateLimited ? 'RATE_LIMITED' : 'HTTP_ERROR',
      };
    } else {
      request.log.error({ err: error }, 'необроблена помилка');
      problem = {
        type: 'about:blank#INTERNAL_ERROR',
        title: 'Внутрішня помилка сервера',
        status: 500,
        code: 'INTERNAL_ERROR',
      };
    }

    return reply
      .status(problem.status)
      .type('application/problem+json')
      .send({ ...problem, instance: request.url });
  });
});
