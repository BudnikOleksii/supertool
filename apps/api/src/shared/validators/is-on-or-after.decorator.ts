import type { ValidationArguments, ValidationOptions } from 'class-validator';

import { registerDecorator } from 'class-validator';

export const IsOnOrAfter =
  (property: string, validationOptions?: ValidationOptions) =>
  (object: object, propertyName: string): void => {
    registerDecorator({
      name: 'isOnOrAfter',
      target: object.constructor,
      propertyName,
      constraints: [property],
      ...(validationOptions ? { options: validationOptions } : {}),
      validator: {
        validate: (value: unknown, args: ValidationArguments): boolean => {
          const [relatedPropertyName] = args.constraints;
          const relatedValue = Reflect.get(args.object, relatedPropertyName);

          return (
            typeof value === 'string' && typeof relatedValue === 'string' && value >= relatedValue
          );
        },
        defaultMessage: (args: ValidationArguments): string =>
          `${args.property} must be on or after ${String(args.constraints[0])}`,
      },
    });
  };
