import type { DummyIdentity } from './types';

const FIRST_NAMES = ['Avery', 'Jordan', 'Morgan', 'Taylor', 'Casey', 'Riley', 'Alex', 'Jamie'];
const LAST_NAMES = ['Reed', 'Parker', 'Morgan', 'Blake', 'Quinn', 'Hayes', 'Lane', 'Ellis'];
const STREETS = ['Cedar Lane', 'Willow Street', 'Maple Avenue', 'Harbor Road', 'Juniper Way', 'Orchard Drive'];
const CITIES = ['Portland', 'Austin', 'Denver', 'Seattle', 'Madison', 'Raleigh'];
const STATES = ['OR', 'TX', 'CO', 'WA', 'WI', 'NC'];

function randomIndex(length: number): number {
  const value = new Uint32Array(1);
  crypto.getRandomValues(value);
  return value[0]! % length;
}

export function generateDummyIdentity(): DummyIdentity {
  const firstName = FIRST_NAMES[randomIndex(FIRST_NAMES.length)]!;
  const lastName = LAST_NAMES[randomIndex(LAST_NAMES.length)]!;
  const cityIndex = randomIndex(CITIES.length);
  const number = 100 + randomIndex(9800);
  const postalCode = String(10_000 + randomIndex(89_999));
  return {
    firstName,
    lastName,
    fullName: `${firstName} ${lastName}`,
    addressLine1: `${number} ${STREETS[randomIndex(STREETS.length)]!}`,
    addressLine2: '',
    city: CITIES[cityIndex]!,
    state: STATES[cityIndex]!,
    postalCode,
    country: 'United States',
    countryCode: 'US'
  };
}
