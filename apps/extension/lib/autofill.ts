import type { AutofillPayload, AutofillResult } from './types';

export function fillSignupForm(payload: AutofillPayload): AutofillResult {
  type Fillable = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

  function activeElement(): Element | null {
    let active: Element | null = document.activeElement;
    while (active instanceof HTMLElement && active.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
    return active;
  }

  function hint(element: Fillable): string {
    const label = element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement
      ? Array.from(element.labels ?? []).map((item) => item.textContent ?? '').join(' ')
      : '';
    return [
      element.getAttribute('type'), element.getAttribute('autocomplete'), element.getAttribute('name'),
      element.id, element.getAttribute('placeholder'), element.getAttribute('aria-label'), label
    ].filter(Boolean).join(' ').toLowerCase().replace(/[_-]+/g, ' ');
  }

  function role(element: Fillable): string | null {
    const text = hint(element);
    const type = element instanceof HTMLInputElement ? element.type.toLowerCase() : '';
    if (type === 'tel' || /phone|mobile|telephone|fax/.test(text)) return null;
    if (type === 'email' || /\b(email|e mail)\b/.test(text) || /\busername\b/.test(text)) return 'email';
    if (type === 'password' || /\b(pass(word)?|new password|confirm password)\b/.test(text)) return 'password';
    if (/\b(given name|first name|firstname|fname)\b/.test(text)) return 'firstName';
    if (/\b(family name|last name|lastname|surname|lname)\b/.test(text)) return 'lastName';
    if (/\b(full name|your name|display name|name)\b/.test(text) && !/user|company|business/.test(text)) return 'fullName';
    if (/\b(address line ?2|address ?2|apartment|apt|suite|unit)\b/.test(text)) return 'addressLine2';
    if (/\b(city|town|locality|address level ?2)\b/.test(text)) return 'city';
    if (/\b(state|province|region|address level ?1)\b/.test(text)) return 'state';
    if (/\b(street address|address line ?1|address ?1|street)\b/.test(text) || /\baddress\b/.test(text)) return 'addressLine1';
    if (/\b(zip|postal|postcode)\b/.test(text)) return 'postalCode';
    if (/\b(country)\b/.test(text)) return 'country';
    return null;
  }

  function enabledFor(fieldRole: string): boolean {
    if (fieldRole === 'email') return payload.settings.autofillEmail && Boolean(payload.email);
    if (fieldRole === 'password') return payload.settings.autofillPassword && Boolean(payload.password);
    if (['firstName', 'lastName', 'fullName'].includes(fieldRole)) return payload.settings.autofillName;
    return payload.settings.autofillAddress;
  }

  function valueFor(fieldRole: string): string {
    if (fieldRole === 'email') return payload.email ?? '';
    if (fieldRole === 'password') return payload.password ?? '';
    if (fieldRole === 'country') return payload.identity.country;
    return payload.identity[fieldRole as keyof typeof payload.identity] ?? '';
  }

  function setValue(element: Fillable, value: string, fieldRole: string): boolean {
    if (element instanceof HTMLSelectElement) {
      const alternatives = fieldRole === 'country'
        ? [payload.identity.countryCode, payload.identity.country]
        : [value];
      const option = Array.from(element.options).find((item) =>
        alternatives.some((candidate) => item.value.toLowerCase() === candidate.toLowerCase() || item.text.toLowerCase() === candidate.toLowerCase())
      );
      if (!option) return false;
      element.value = option.value;
    } else {
      const prototype = element instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
      if (setter) setter.call(element, value);
      else element.value = value;
    }
    element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  function toast(message: string): void {
    document.getElementById('anonymail-toast')?.remove();
    const node = document.createElement('div');
    node.id = 'anonymail-toast';
    node.textContent = message;
    Object.assign(node.style, {
      position: 'fixed', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', zIndex: '2147483647',
      background: '#20242b', color: '#fff', padding: '12px 16px', borderRadius: '12px',
      font: '500 13px ui-monospace, SFMono-Regular, Menlo, monospace',
      boxShadow: '0 10px 30px rgba(25, 31, 43, .22)', textAlign: 'center', maxWidth: 'min(360px, calc(100vw - 40px))'
    });
    document.documentElement.appendChild(node);
    window.setTimeout(() => node.remove(), 2800);
  }

  function copyFallback(value: string): void {
    const area = document.createElement('textarea');
    area.value = value;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    document.execCommand('copy');
    area.remove();
  }

  const active = activeElement();
  const form = active?.closest('form') ?? active?.closest('[role="form"]');
  const scope: ParentNode = form ?? document;
  const fields = Array.from(scope.querySelectorAll<Fillable>('input, textarea, select')).filter((element) => {
    if (element.disabled) return false;
    if (element instanceof HTMLInputElement && ['hidden', 'file', 'submit', 'button', 'reset', 'checkbox', 'radio', 'tel'].includes(element.type.toLowerCase())) return false;
    return !element.hasAttribute('readonly');
  });
  const filledFields: string[] = [];

  for (const field of fields) {
    const fieldRole = role(field);
    if (!fieldRole || !enabledFor(fieldRole)) continue;
    if (setValue(field, valueFor(fieldRole), fieldRole)) filledFields.push(fieldRole);
  }

  if (!filledFields.length) {
    const fallback = payload.settings.autofillEmail && payload.email ? payload.email : payload.password;
    if (fallback) {
      copyFallback(fallback);
      toast('No matching enabled fields found — value copied instead.');
    } else {
      toast('No matching enabled fields found. Check Anonymail settings.');
    }
    return { filled: false, filledFields };
  }

  const groups = Array.from(new Set(filledFields.map((field) => {
    if (['firstName', 'lastName', 'fullName'].includes(field)) return 'name';
    if (['addressLine1', 'addressLine2', 'city', 'state', 'postalCode', 'country'].includes(field)) return 'address';
    return field;
  })));
  toast(`Filled ${groups.join(', ')}.`);
  return { filled: true, filledFields };
}
