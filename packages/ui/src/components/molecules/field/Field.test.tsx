import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Input } from '../../atoms/input/Input';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FormField,
} from './Field';

describe('Field', () => {
  it('renders a labelled field with a description', () => {
    render(
      <Field>
        <FieldLabel htmlFor="email">Email</FieldLabel>
        <Input id="email" />
        <FieldDescription>We never share your email.</FieldDescription>
      </Field>,
    );

    screen.getByText('Email');
    screen.getByText('We never share your email.');
    screen.getByRole('group');
  });

  it('renders a single error message via the alert role', () => {
    render(<FieldError errors={[{ message: 'Required' }]} />);

    const alert = screen.getByRole('alert');

    expect(alert.textContent).toBe('Required');
  });

  it('renders nothing when there are no errors', () => {
    const { container } = render(<FieldError errors={[]} />);

    expect(container.firstChild).toBeNull();
  });

  it('groups fields under a legend within a field set', () => {
    render(
      <FieldSet>
        <FieldLegend>Account</FieldLegend>
        <FieldGroup>
          <FormField label="Email" htmlFor="email">
            <Input id="email" />
          </FormField>
        </FieldGroup>
      </FieldSet>,
    );

    screen.getByText('Account');
    screen.getByText('Email');
  });
});
