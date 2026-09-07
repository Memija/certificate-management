const fs = require('fs');

// Fix TrustStoreInspector.tsx
let uiContent = fs.readFileSync('src/TrustStoreInspector.tsx', 'utf8');

if (!uiContent.includes('const { t } = useTranslation();') && uiContent.includes('function FileTrustStore')) {
  uiContent = uiContent.replace(
    /function FileTrustStore\(\{ loadedFile, onRemove, onPasswordSubmit, onPasswordChange, onJksUnlockSubmit \}: FileTrustStoreProps\) \{/,
    `function FileTrustStore({ loadedFile, onRemove, onPasswordSubmit, onPasswordChange, onJksUnlockSubmit }: FileTrustStoreProps) {
  const { t } = useTranslation();
  const [showPassword, setShowPassword] = useState(false);`
  );
}

uiContent = uiContent.replace(
  /interface FileTrustStoreProps \{[\s\S]*?onPasswordChange: \(id: string, val: string\) => void;\n\}/,
  `interface FileTrustStoreProps {
  loadedFile: LoadedFile;
  onRemove: () => void;
  onPasswordSubmit: (id: string, password: string) => void;
  onPasswordChange: (id: string, val: string) => void;
  onJksUnlockSubmit: (id: string, password: string) => void;
}`
);

fs.writeFileSync('src/TrustStoreInspector.tsx', uiContent);

// Fix trustStoreParser.ts
let parserContent = fs.readFileSync('src/utils/trustStoreParser.ts', 'utf8');

parserContent = parserContent.replace(
  /const pem = forge\.pki\.privateKeyToPem\(p12Entry\.key\);/,
  `const pem = p12Entry.key ? forge.pki.privateKeyToPem(p12Entry.key) : undefined;`
);

parserContent = parserContent.replace(
  /const buffer = firstCertBytes\.buffer\.slice\(firstCertBytes\.byteOffset, firstCertBytes\.byteOffset \+ firstCertBytes\.byteLength\);/,
  `const buffer = firstCertBytes.buffer.slice(firstCertBytes.byteOffset, firstCertBytes.byteOffset + firstCertBytes.byteLength) as ArrayBuffer;`
);

parserContent = parserContent.replace(
  /const asn1 = forge\.asn1\.fromDer\(forge\.util\.createBuffer\(encryptedKeyData\)\);/,
  `// createBuffer takes binary string or byte array
  const keyStr = String.fromCharCode.apply(null, Array.from(encryptedKeyData));
  const asn1 = forge.asn1.fromDer(forge.util.createBuffer(keyStr));`
);

parserContent = parserContent.replace(
  /const protectedKeyStr = asn1\.value\[1\]\.value;/,
  `const protectedKeyStr = (asn1.value as any)[1].value;`
);

fs.writeFileSync('src/utils/trustStoreParser.ts', parserContent);

console.log('Fixed TS errors');
