import type { ValidationArguments, ValidationOptions } from 'class-validator';

import { registerDecorator } from 'class-validator';

import { checkIsOrderedDateRange } from '@supertool/shared/constants/transaction-validation';

type ClassConstructor = new (...argList: never[]) => object;

export const IsOrderedDateRange =
  (fromField: string, toField: string, validationOptions?: ValidationOptions) =>
  (target: ClassConstructor): void => {
    registerDecorator({
      name: 'isOrderedDateRange',
      target,
      propertyName: toField,
      constraints: [fromField, toField],
      ...(validationOptions ? { options: validationOptions } : {}),
      validator: {
        validate: (_value: unknown, args: ValidationArguments): boolean => {
          const [fromName, toName] = args.constraints;
          const fromValue = Reflect.get(args.object, fromName);
          const toValue = Reflect.get(args.object, toName);

          if (typeof fromValue !== 'string' || typeof toValue !== 'string') {
            return true;
          }

          return checkIsOrderedDateRange(fromValue, toValue);
        },
        defaultMessage: (args: ValidationArguments): string =>
          `${String(args.constraints[1])} must be on or after ${String(args.constraints[0])}`,
      },
    });
  };
