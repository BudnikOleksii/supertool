import type { Meta, StoryObj } from '@storybook/react-vite';

import { Input } from '@supertool/ui/src/components/atoms/input/Input';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
  FormField,
} from '@supertool/ui/src/components/molecules/field/Field';

const meta = {
  title: 'Primitives/Field',
  component: Field,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
} satisfies Meta<typeof Field>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Field style={{ width: 320 }}>
      <FieldLabel htmlFor="email">Email</FieldLabel>
      <Input id="email" type="email" placeholder="you@example.com" />
      <FieldDescription>We use this to send you receipts.</FieldDescription>
    </Field>
  ),
};

export const WithError: Story = {
  render: () => (
    <Field style={{ width: 320 }}>
      <FieldLabel htmlFor="password">Password</FieldLabel>
      <Input id="password" type="password" error />
      <FieldError errors={[{ message: 'Password must be at least 8 characters.' }]} />
    </Field>
  ),
};

export const GroupedSignUp: Story = {
  render: () => (
    <FieldSet style={{ width: 320 }}>
      <FieldLegend>Create your account</FieldLegend>
      <FieldGroup>
        <FormField label="Email" htmlFor="signup-email">
          <Input id="signup-email" type="email" placeholder="you@example.com" />
        </FormField>
        <FieldSeparator>or</FieldSeparator>
        <FormField
          label="Password"
          htmlFor="signup-password"
          error={{ message: 'Password is required.' }}
        >
          <Input id="signup-password" type="password" error />
        </FormField>
      </FieldGroup>
    </FieldSet>
  ),
};
