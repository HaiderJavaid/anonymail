import { describe, expect, it } from 'vitest';
import { generateMailboxName, generateProviderPassword, generateSignupPassword } from './password';

describe('password generation', () => {
  it('creates a 20-character website password with every required class', () => {
    const password = generateSignupPassword();
    expect(password).toHaveLength(20);
    expect(password).toMatch(/[a-z]/);
    expect(password).toMatch(/[A-Z]/);
    expect(password).toMatch(/[0-9]/);
    expect(password).toMatch(/[!@#$%^&*_+=-]/);
  });

  it('keeps provider and website credentials distinct', () => {
    const providerPassword = generateProviderPassword();
    const signupPassword = generateSignupPassword();
    expect(providerPassword).toHaveLength(32);
    expect(signupPassword).not.toBe(providerPassword);
  });

  it('does not issue repeated passwords', () => {
    expect(new Set(Array.from({ length: 50 }, () => generateSignupPassword())).size).toBe(50);
  });

  it('creates short, clean, collision-resistant mailbox names', () => {
    const names = Array.from({ length: 50 }, () => generateMailboxName());
    expect(names.every((name) => name.length === 6 && /^a[a-z2-9]{5}$/.test(name))).toBe(true);
    expect(new Set(names).size).toBe(names.length);
  });
});
