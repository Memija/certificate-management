import { useTranslation } from 'react-i18next'
import { Copy, Download, FileKey, Shield } from 'lucide-react'

import { useToast } from '@/components/shared'

import { type KeyGeneratorOutputType, triggerTextDownload } from './key-generator-helpers'

import styles from './KeyGenerator.module.css'

export interface KeyGeneratorOutputPanelProps {
  outputType: KeyGeneratorOutputType
  safeName: string
  generatedKey: string
  generatedOutput: string
}

export function KeyGeneratorOutputPanel({
  outputType,
  safeName,
  generatedKey,
  generatedOutput,
}: KeyGeneratorOutputPanelProps) {
  const { t } = useTranslation()
  const { showToast } = useToast()

  const copyToClipboard = (text: string, label: string): void => {
    void navigator.clipboard
      .writeText(text)
      .then(() => {
        showToast(
          t('app.keyGenerator.copiedToast', {
            label,
            defaultValue: `Copied ${label} to clipboard`,
          }),
          'success',
        )
      })
      .catch((err: unknown) => {
        console.error('Clipboard copy failed:', err)
        showToast(t('common.error', 'Error'), 'error')
      })
  }

  const downloadFile = (content: string, filename: string, mime: string): void => {
    triggerTextDownload(content, filename, mime)
    showToast(
      t('app.keyGenerator.downloadedToast', {
        filename,
        defaultValue: `Downloaded ${filename}`,
      }),
      'success',
    )
  }

  const privateKeyHeading = t('app.keyGenerator.generatedPrivateKey', 'Generated Private Key')
  const artifactHeading =
    outputType === 'csr'
      ? t('app.keyGenerator.generatedCsr', 'Generated CSR')
      : t('app.keyGenerator.generatedCert', 'Generated Certificate')
  const artifactExt = outputType === 'csr' ? 'csr' : 'crt'
  const artifactCopyLabel =
    outputType === 'csr'
      ? t('app.keyGenerator.csrLabel', 'CSR')
      : t('app.keyGenerator.certLabel', 'Certificate')

  return (
    <div className={styles.outputColumn}>
      <div className="glass-panel">
        <div className={styles.outputHeader}>
          <h2 className={styles.outputHeading}>
            <FileKey size={16} className={styles.iconAccent} aria-hidden="true" />
            <span>{privateKeyHeading}</span>
          </h2>
          {generatedKey && (
            <div className={styles.outputActions}>
              <button
                type="button"
                className="btn btn-download-pem btn-sm"
                onClick={() =>
                  downloadFile(generatedKey, `${safeName}_private.key`, 'application/x-pem-file')
                }
              >
                <Download size={12} aria-hidden="true" />
                <span>{t('app.keyGenerator.downloadKey', '.key')}</span>
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() =>
                  copyToClipboard(
                    generatedKey,
                    t('app.keyGenerator.privateKeyLabel', 'Private Key'),
                  )
                }
              >
                <Copy size={12} aria-hidden="true" />
                <span>{t('app.keyGenerator.copy', 'Copy')}</span>
              </button>
            </div>
          )}
        </div>
        <textarea
          value={generatedKey}
          readOnly
          aria-label={privateKeyHeading}
          className={`form-textarea mono ${styles.outputTextarea}`}
          placeholder={t(
            'app.keyGenerator.privateKeyPlaceholder',
            'Generated RSA private key will appear here...',
          )}
        />
      </div>

      <div className="glass-panel">
        <div className={styles.outputHeader}>
          <h2 className={styles.outputHeading}>
            <Shield size={16} className={styles.iconSuccess} aria-hidden="true" />
            <span>{artifactHeading}</span>
          </h2>
          {generatedOutput && (
            <div className={styles.outputActions}>
              <button
                type="button"
                className="btn btn-download-pem btn-sm"
                onClick={() =>
                  downloadFile(
                    generatedOutput,
                    `${safeName}.${artifactExt}`,
                    'application/x-pem-file',
                  )
                }
              >
                <Download size={12} aria-hidden="true" />
                <span>
                  {outputType === 'csr'
                    ? t('app.keyGenerator.downloadCsr', '.csr')
                    : t('app.keyGenerator.downloadCert', '.crt')}
                </span>
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => copyToClipboard(generatedOutput, artifactCopyLabel)}
              >
                <Copy size={12} aria-hidden="true" />
                <span>{t('app.keyGenerator.copy', 'Copy')}</span>
              </button>
            </div>
          )}
        </div>
        <textarea
          value={generatedOutput}
          readOnly
          aria-label={artifactHeading}
          className={`form-textarea mono ${styles.outputTextarea}`}
          placeholder={
            outputType === 'csr'
              ? t('app.keyGenerator.csrPlaceholder', 'Generated CSR will appear here...')
              : t(
                  'app.keyGenerator.certPlaceholder',
                  'Generated Self-Signed Certificate will appear here...',
                )
          }
        />
      </div>
    </div>
  )
}
