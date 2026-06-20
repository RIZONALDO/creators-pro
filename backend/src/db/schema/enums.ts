import { pgEnum } from 'drizzle-orm/pg-core';

// Compartilhado entre creators.employment_type e collaborators.employment_type (specs/02).
export const employmentTypeEnum = pgEnum('employment_type', ['fixed', 'freelancer']);
export type EmploymentType = (typeof employmentTypeEnum.enumValues)[number];
