import { describe, expect, it } from 'vitest';

import { composeFullName, splitFullName } from './full-name';

describe('composeFullName', () => {
  it('joins a first and last name with a single space', () => {
    expect(composeFullName('Ann', 'Smith')).toBe('Ann Smith');
  });

  it('returns only the first name when the last name is missing', () => {
    expect(composeFullName('Ann', null)).toBe('Ann');
    expect(composeFullName('Ann', undefined)).toBe('Ann');
    expect(composeFullName('Ann', '')).toBe('Ann');
  });

  it('returns an empty string when both parts are empty', () => {
    expect(composeFullName('', '')).toBe('');
    expect(composeFullName(null, null)).toBe('');
  });
});

describe('splitFullName', () => {
  it('splits a two-token name into first and last', () => {
    expect(splitFullName('Ann Smith')).toEqual({ firstName: 'Ann', lastName: 'Smith' });
  });

  it('puts everything after the first space into the last name', () => {
    expect(splitFullName('Ann Mary Smith')).toEqual({ firstName: 'Ann', lastName: 'Mary Smith' });
  });

  it('returns a null last name for a single-token name', () => {
    expect(splitFullName('Operator')).toEqual({ firstName: 'Operator', lastName: null });
  });

  it('trims leading and trailing whitespace', () => {
    expect(splitFullName('  Ann Smith  ')).toEqual({ firstName: 'Ann', lastName: 'Smith' });
  });
});
