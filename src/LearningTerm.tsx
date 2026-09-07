import React from 'react';

export const ALL_LEARNING_TERMS = [
  'nvram', 'db', 'dbx', 'kek', 'pk', 'x509', 'efi', 'uac',
  'rootCa', 'intermediateCa', 'leafCert', 'crl', 'csr',
  'ocsp', 'ctlog', 'pem', 'der'
] as const;

export type TermId = typeof ALL_LEARNING_TERMS[number];

interface LearningTermProps {
  termId: TermId;
  children: React.ReactNode;
}

export function LearningTerm({ children }: LearningTermProps) {
  return <>{children}</>;
}
