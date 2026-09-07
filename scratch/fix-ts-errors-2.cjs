const fs = require('fs');

// Fix TrustStoreInspector.tsx
let uiContent = fs.readFileSync('src/TrustStoreInspector.tsx', 'utf8');

// The reconstruction script replaces the props block using FileTrustStoreProps.
// Wait, the reconstruction script uses:
// function FileTrustStore({ loadedFile, onRemove, onPasswordSubmit, onPasswordChange, onJksUnlockSubmit }: FileTrustStoreProps) {
// But there is no FileTrustStoreProps!
// Let me just manually patch the signature here instead.

uiContent = uiContent.replace(
  /function FileTrustStore\(\{\n  loadedFile,\n  onRemove,\n  onPasswordSubmit,\n  onPasswordChange,\n\}: \{\n  loadedFile: LoadedFile;\n  onRemove: \(\) => void;\n  onPasswordSubmit: \(id: string, password: string\) => void;\n  onPasswordChange: \(id: string, val: string\) => void;\n\}\) \{/g,
  `function FileTrustStore({
  loadedFile,
  onRemove,
  onPasswordSubmit,
  onPasswordChange,
  onJksUnlockSubmit,
}: {
  loadedFile: LoadedFile;
  onRemove: () => void;
  onPasswordSubmit: (id: string, password: string) => void;
  onPasswordChange: (id: string, val: string) => void;
  onJksUnlockSubmit: (id: string, password: string) => void;
}) {
  const { t } = useTranslation();
  const [showPassword, setShowPassword] = useState(false);`
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
  `const keyStr = String.fromCharCode.apply(null, Array.from(encryptedKeyData));\n  const asn1 = forge.asn1.fromDer(forge.util.createBuffer(keyStr));`
);

parserContent = parserContent.replace(
  /const protectedKeyStr = asn1\.value\[1\]\.value;/,
  `const protectedKeyStr = (asn1.value as any)[1].value;`
);

fs.writeFileSync('src/utils/trustStoreParser.ts', parserContent);

console.log('Fixed TS errors');
