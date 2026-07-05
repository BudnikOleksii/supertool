import type { ValidationArguments } from 'class-validator';

import { registerDecorator } from 'class-validator';

import { checkIsBoundedDateRange } from '@supertool/shared/constants/transaction-validation';

type ClassConstructor = new (...argList: never[]) => object;

export const IsBoundedDateRange =
  (fromField: string, toField: string, maxDays: number) =>
  (target: ClassConstructor): void => {
    registerDecorator({
      name: 'isBoundedDateRange',
      target,
      propertyName: toField,
      constraints: [fromField, toField, maxDays],
      validator: {
        validate: (_value: unknown, args: ValidationArguments): boolean => {
          const [fromName, toName, maxDayCount] = args.constraints;
          const fromValue = Reflect.get(args.object, fromName);
          const toValue = Reflect.get(args.object, toName);

          if (typeof fromValue !== 'string' || typeof toValue !== 'string') {
            return true;
          }

          return checkIsBoundedDateRange(fromValue, toValue, maxDayCount);
        },
        defaultMessage: (args: ValidationArguments): string =>
          `The range between ${String(args.constraints[0])} and ${String(args.constraints[1])} must not exceed ${String(args.constraints[2])} days`,
      },
    });
  };
