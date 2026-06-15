import type { ValidationOptions } from 'class-validator';

import { registerDecorator } from 'class-validator';

import { checkIsCalendarDate } from '../constants/transaction-validation';

export const IsCalendarDate =
  (validationOptions?: ValidationOptions) =>
  (object: object, propertyName: string): void => {
    registerDecorator({
      name: 'isCalendarDate',
      target: object.constructor,
      propertyName,
      ...(validationOptions ? { options: validationOptions } : {}),
      validator: {
        validate: (value: unknown): boolean =>
          typeof value === 'string' && checkIsCalendarDate(value),
      },
    });
  };
