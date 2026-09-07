const fs = require('fs');

let content = fs.readFileSync('src/TrustStoreInspector.tsx', 'utf8');

// 1. Import decryptJKSPrivateKey
content = content.replace(
  "import { parseTrustStoreFile } from './utils/trustStoreParser';",
  "import { parseTrustStoreFile, decryptJKSPrivateKey } from './utils/trustStoreParser';"
);

// 2. Private Key button red
content = content.replace(
  /className="btn btn-secondary"\s*style=\{\{ fontSize: '0.85rem', padding: '0.4rem 1rem' \}\}\s*onClick=\{([^}]+)\}\s*>\s*\{showPrivKey \? <EyeOff size=\{14\} \/> : <Key size=\{14\} \/>\}\s*\{showPrivKey \? 'Hide Private Key' : 'View Private Key'\}/g,
  `className="btn"
            style={{ fontSize: '0.85rem', padding: '0.4rem 1rem', background: 'var(--danger-color)' }}
            onClick={$1}
          >
            {showPrivKey ? <EyeOff size={14} /> : <Key size={14} />}
            {showPrivKey ? t("app.trustStore.certDetails.hidePrivateKey", "Hide Private Key") : t("app.trustStore.certDetails.viewPrivateKey", "View Private Key")}`
);

// 2b. View PEM localization
content = content.replace(
  /\{showPem \? 'Hide PEM' : 'View PEM'\}/g,
  `{showPem ? t("app.trustStore.certDetails.hidePem", "Hide PEM") : t("app.trustStore.certDetails.viewPem", "View PEM")}`
);

// 3. Password Warning Localization
content = content.replace(
  /\{store\.warnings\.map\(\(w, i\) => \(\s*<p key=\{i\} style=\{\{ color: 'var\(--danger-color\)', marginTop: '0\.5rem', fontSize: '0\.85rem' \}\}>\{w\}<\/p>\s*\)\)\}/g,
  `{store.warnings.map((w, i) => (
            <p key={i} style={{ color: 'var(--danger-color)', marginTop: '0.5rem', fontSize: '0.85rem' }}>
              {w === 'Incorrect password.' ? t('app.trustStore.inspector.incorrectPassword', 'Incorrect password.') : w}
            </p>
          ))}`
);

// 4. Unlock Button Localization
content = content.replace(
  /Unlock\s*<\/button>/g,
  `{t("app.trustStore.inspector.unlock", "Unlock")}
            </button>`
);

// 5. Initial load incorrect password filter
content = content.replace(
  /const result = await parseTrustStoreFile\(file, ''\);/g,
  `const result = await parseTrustStoreFile(file, '');
        // Do not show the incorrect password warning on initial empty-password load
        if (result.needsPassword) {
          result.warnings = result.warnings.filter(w => w !== 'Incorrect password.');
        }`
);

// 6. Handle password submit incorrect translation
content = content.replace(
  /warnings: \[e\?\.message \|\| 'Decryption failed\.'\]/g,
  `warnings: [(e?.message?.includes('password') || e?.message?.includes('MAC') || e?.message === 'Incorrect password.') ? 'Incorrect password.' : (e?.message || 'Decryption failed.')]`
);

// 7. JKS Warnings
content = content.replace(
  /\{store\.warnings\.map\(\(w, i\) => \(\s*<div key=\{i\}/g,
  `{store.warnings.map((w, i) => {
        let localizedW = w;
        if (w.includes('Private keys are never displayed')) {
          const match = w.match(/contains (\\d+) private key/);
          if (match) {
            localizedW = t('app.trustStore.warnings.privateKeyCount', 'This file contains {{count}} private key(s).', { count: parseInt(match[1], 10) });
          } else {
            localizedW = t('app.trustStore.warnings.privateKey', 'This file contains a private key entry.');
          }
        } else if (w.includes('JKS MAC verification skipped')) {
          localizedW = t('app.trustStore.warnings.jksMacSkipped', 'JKS MAC verification skipped - certificates are readable without a password. Private key entries are never displayed.');
        } else if (w.includes('private key entry - skipped')) {
          const aliasMatch = w.match(/Alias "([^"]+)"/);
          if (aliasMatch) {
            localizedW = t('app.trustStore.warnings.jksPrivKeySkipped', 'Alias "{{alias}}": private key entry - skipped (keys are never displayed).', { alias: aliasMatch[1] });
          }
        }
        
        return (
          <div key={i}`
);

content = content.replace(
  /<span style=\{\{ fontSize: '0\.82rem', color: 'var\(--text-secondary\)' \}\}>\{w\}<\/span>/g,
  `<span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{localizedW}</span>`
);

// 8. JKS Unlock UI
const jksUnlockUI = `
      {/* JKS Unlock Private Keys */}
      {store.entries.some(e => e.isEncryptedJksKey && !e.privateKeyPem) && (
        <div style={{ padding: '1.25rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', marginBottom: '1.5rem', border: '1px solid var(--glass-border)' }}>
          <p style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: 500 }}>
            <Key size={16} style={{ verticalAlign: 'text-bottom', marginRight: '0.5rem' }} />
            {t("app.trustStore.inspector.unlockJksTitle", "Unlock Private Keys")}
          </p>
          <div style={{ display: 'flex', gap: '0.5rem', width: '100%', maxWidth: '400px' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <input
                type={showPassword ? "text" : "password"}
                placeholder={t("app.trustStore.inspector.passwordPlaceholder", "Enter password...")}
                value={loadedFile.passwordInput || ''}
                onChange={e => onPasswordChange(id, e.target.value)}
                onKeyDown={e => e.key === 'Enter' && onJksUnlockSubmit(id, loadedFile.passwordInput ?? '')}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '0.6rem 2.5rem 0.6rem 1rem',
                  borderRadius: '8px',
                  border: '1px solid var(--glass-border)',
                  background: 'rgba(255,255,255,0.05)',
                  color: 'var(--text-primary)',
                  fontSize: '0.9rem',
                  outline: 'none',
                }}
              />
              <div 
                onClick={() => setShowPassword(!showPassword)}
                style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </div>
            </div>
            <button className="btn" onClick={() => onJksUnlockSubmit(id, loadedFile.passwordInput ?? '')}>
               {t("app.trustStore.inspector.unlock", "Unlock")}
            </button>
          </div>
        </div>
      )}
`;

content = content.replace(
  /\{\/\* Empty state \*\/\}/,
  jksUnlockUI + '\n      {/* Empty state */}'
);

const onJksUnlockMethod = `
  const onJksUnlockSubmit = (id: string, pwd: string) => {
    setLoadedFiles(prev => prev.map(f => {
      if (f.id !== id) return f;
      const newEntries = [...f.store.entries];
      let newWarnings = [...f.store.warnings];
      let errorEncountered = false;

      for (let i = 0; i < newEntries.length; i++) {
        const e = newEntries[i];
        if (e.isEncryptedJksKey && e.encryptedJksKeyData && !e.privateKeyPem) {
          try {
            const pem = decryptJKSPrivateKey(e.encryptedJksKeyData, pwd);
            newEntries[i] = { ...e, privateKeyPem: pem };
          } catch (err) {
            errorEncountered = true;
          }
        }
      }

      if (errorEncountered) {
        if (!newWarnings.includes('Incorrect password.')) {
          newWarnings.unshift('Incorrect password.');
        }
      } else {
        newWarnings = newWarnings.filter(w => !w.includes('JKS MAC') && w !== 'Incorrect password.');
        newWarnings = newWarnings.filter(w => !w.includes('private key is encrypted'));
      }
      return { ...f, store: { ...f.store, entries: newEntries, warnings: newWarnings } };
    }));
  };

  const handlePasswordChange =`;

content = content.replace(
  /const handlePasswordChange =/g,
  onJksUnlockMethod
);


// 9. Update the FileTrustStore props and component sig
content = content.replace(
  /onPasswordSubmit: \(id: string, password: string\) => void;\n  onPasswordChange: \(id: string, val: string\) => void;\n\}/g,
  `onPasswordSubmit: (id: string, password: string) => void;
  onPasswordChange: (id: string, val: string) => void;
  onJksUnlockSubmit: (id: string, password: string) => void;
}`
);

content = content.replace(
  /function FileTrustStore\(\{ loadedFile, onRemove, onPasswordSubmit, onPasswordChange \}: FileTrustStoreProps\) \{/g,
  `function FileTrustStore({ loadedFile, onRemove, onPasswordSubmit, onPasswordChange, onJksUnlockSubmit }: FileTrustStoreProps) {`
);

content = content.replace(
  /<FileTrustStore\s+key=\{lf\.id\}\s+loadedFile=\{lf\}\s+onRemove=\{\(\) => removeFile\(lf\.id\)\}\s+onPasswordSubmit=\{handlePasswordSubmit\}\s+onPasswordChange=\{handlePasswordChange\}\s*\/>/g,
  `<FileTrustStore
                key={lf.id}
                loadedFile={lf}
                onRemove={() => removeFile(lf.id)}
                onPasswordSubmit={handlePasswordSubmit}
                onPasswordChange={handlePasswordChange}
                onJksUnlockSubmit={onJksUnlockSubmit}
              />`
);

content = content.replace(
  /Loaded Files Do not make it Caps Lock/,
  'Loaded Files'
);

content = content.replace(
  /textTransform: 'uppercase'/,
  'textTransform: "none"'
);

fs.writeFileSync('src/TrustStoreInspector.tsx', content);
