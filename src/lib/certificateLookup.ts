import { doc, getDoc } from 'firebase/firestore';
import { Certificate } from '../types';
import { db } from './firebase';

/**
 * Fetches one certificate by its code.
 *
 * A direct read of a single document, deliberately: the code is the
 * capability. Anyone holding one can check that one, and nobody can list
 * everybody's — a query would need read access across the collection, which
 * would publish the name and organisation of every teacher who ever attended.
 *
 * Needs no account. A licensing body checking a certificate three years from
 * now will not have one, and requiring a sign-in to verify a credential makes
 * the credential useless.
 */
export async function fetchCertificate(code: string): Promise<Certificate | null> {
  if (!db) return null;
  try {
    const snapshot = await getDoc(doc(db, 'certificates', code));
    return snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as Certificate) : null;
  } catch {
    // A denied or offline read is indistinguishable from a wrong code here,
    // and saying "not found" is the honest answer to "is this genuine".
    return null;
  }
}
