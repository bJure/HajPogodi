import { redirect } from 'next/navigation';

/**
 * The root is a pure entry point: authenticated users belong in the app shell,
 * everyone else at the login screen. The real routing decision is made by
 * middleware; this redirect just gives `/` a destination.
 */
export default function RootPage() {
  redirect('/pocetna');
}
