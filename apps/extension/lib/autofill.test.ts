import { beforeEach, describe, expect, it } from 'vitest';
import { fillSignupForm } from './autofill';
import type { AutofillPayload } from './types';

const payload: AutofillPayload = {
  email: 'quiet@example.test',
  password: 'Unique!Password12345',
  identity: {
    firstName: 'Avery',
    lastName: 'Reed',
    fullName: 'Avery Reed',
    addressLine1: '410 Cedar Lane',
    addressLine2: '',
    city: 'Portland',
    state: 'OR',
    postalCode: '97205',
    country: 'United States',
    countryCode: 'US'
  },
  settings: {
    autofillEmail: true,
    autofillPassword: true,
    autofillName: false,
    autofillAddress: false
  }
};

describe('fillSignupForm', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    document.execCommand = () => true;
  });

  it('fills email and password across the form even when a name field is focused', () => {
    document.body.innerHTML = `<form>
      <input name="full_name" />
      <input type="email" name="email" />
      <input type="password" name="new-password" />
      <input type="tel" name="phone" />
    </form>`;
    const name = document.querySelector<HTMLInputElement>('[name="full_name"]')!;
    name.focus();

    const result = fillSignupForm(payload);

    expect(result.filledFields).toEqual(['email', 'password']);
    expect(document.querySelector<HTMLInputElement>('[name="email"]')!.value).toBe(payload.email);
    expect(document.querySelector<HTMLInputElement>('[name="new-password"]')!.value).toBe(payload.password);
    expect(name.value).toBe('');
    expect(document.querySelector<HTMLInputElement>('[name="phone"]')!.value).toBe('');
  });

  it('fills enabled dummy name and address fields but always skips phone numbers', () => {
    document.body.innerHTML = `<form>
      <input autocomplete="given-name" />
      <input autocomplete="family-name" />
      <input autocomplete="street-address" />
      <input autocomplete="address-level2" aria-label="City" />
      <input autocomplete="postal-code" />
      <select autocomplete="country"><option value="US">United States</option></select>
      <input type="tel" autocomplete="tel" />
    </form>`;
    document.querySelector<HTMLInputElement>('input')!.focus();
    const result = fillSignupForm({ ...payload, settings: { ...payload.settings, autofillName: true, autofillAddress: true } });

    expect(result.filledFields).toEqual(['firstName', 'lastName', 'addressLine1', 'city', 'postalCode', 'country']);
    expect(document.querySelector<HTMLInputElement>('[autocomplete="given-name"]')!.value).toBe('Avery');
    expect(document.querySelector<HTMLInputElement>('[autocomplete="street-address"]')!.value).toBe('410 Cedar Lane');
    expect(document.querySelector<HTMLSelectElement>('select')!.value).toBe('US');
    expect(document.querySelector<HTMLInputElement>('[type="tel"]')!.value).toBe('');
  });

  it('dispatches input and change events for controlled forms', () => {
    document.body.innerHTML = '<form><input type="email" /></form>';
    const field = document.querySelector<HTMLInputElement>('input')!;
    field.focus();
    let inputEvents = 0;
    let changeEvents = 0;
    field.addEventListener('input', () => inputEvents++);
    field.addEventListener('change', () => changeEvents++);

    fillSignupForm(payload);

    expect(inputEvents).toBe(1);
    expect(changeEvents).toBe(1);
  });

  it('shows autofill feedback in the middle of the page', () => {
    document.body.innerHTML = '<form><input type="email" /></form>';
    document.querySelector<HTMLInputElement>('input')!.focus();
    fillSignupForm(payload);

    const toast = document.getElementById('anonymail-toast')!;
    expect(toast.style.left).toBe('50%');
    expect(toast.style.top).toBe('50%');
    expect(toast.style.transform).toBe('translate(-50%, -50%)');
  });
});
