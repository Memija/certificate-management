import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { FileText, GitFork, Upload } from 'lucide-react'

import styles from './ChainValidator.module.css'

export interface ChainEmptyInputGridProps {
  isDragging: boolean
  pemInput: string
  onPemInputChange: (next: string) => void
  onLoadPem: () => void
  onTriggerFileSelect: () => void
}

export const ChainEmptyInputGrid = memo(function ChainEmptyInputGrid({
  isDragging,
  pemInput,
  onPemInputChange,
  onLoadPem,
  onTriggerFileSelect,
}: ChainEmptyInputGridProps) {
  const { t } = useTranslation()

  return (
    <div className={styles.inputGrid}>
      <section className={`drop-zone ${styles.dropZonePanel} ${isDragging ? 'active' : ''}`}>
        <div className={styles.dropZoneIcon}>
          <GitFork size={42} aria-hidden="true" />
        </div>
        <h2 className={styles.dropZoneTitle}>
          {t('app.chain.dropZoneTitle', 'Drop certificates here to reconstruct trust graph')}
        </h2>
        <p className={styles.dropZoneDesc}>
          {t(
            'app.chain.dropZoneDesc',
            'Upload single files or multi-certificate bundles (.pem, .crt, .p7b, .pfx) to visualize and mathematically verify the full certification path.',
          )}
        </p>
        <div className={styles.dropZoneFormats}>
          <span className={styles.formatPill}>.PEM</span>
          <span className={styles.formatPill}>.CRT / .CER</span>
          <span className={styles.formatPill}>.P7B / PKCS#7</span>
          <span className={styles.formatPill}>.PFX / .P12</span>
        </div>
        <button type="button" className="btn btn-primary" onClick={onTriggerFileSelect}>
          <Upload size={16} aria-hidden="true" />
          <span>{t('app.chain.addCerts', 'Add Certs')}</span>
        </button>
      </section>

      <section className={`glass-panel ${styles.pemPanel}`}>
        <h2 className={styles.pemTitle}>
          {t('app.formatConverter.certLabel', 'Certificate (PEM)')}
        </h2>
        <div className="form-group">
          <label htmlFor="chain-pem-textarea" className="form-label">
            {t('app.ocsp.inputLabel', 'Certificate (PEM / DER)')}
          </label>
          <textarea
            id="chain-pem-textarea"
            className="form-textarea"
            placeholder={t(
              'app.ocsp.placeholder',
              '-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----',
            )}
            value={pemInput}
            onChange={(e) => onPemInputChange(e.target.value)}
            rows={6}
          />
        </div>
        <div className={styles.pemActions}>
          {pemInput.trim().length > 0 && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => onPemInputChange('')}
            >
              {t('common.clear', 'Clear')}
            </button>
          )}
          <button type="button" className="btn btn-primary btn-sm" onClick={onLoadPem}>
            <FileText size={14} aria-hidden="true" />
            <span>{t('app.chain.viewPem', 'View PEM')}</span>
          </button>
        </div>
      </section>
    </div>
  )
})

export interface ChainInlinePemDrawerProps {
  pemInput: string
  onPemInputChange: (next: string) => void
  onLoadPem: () => void
  onCancel: () => void
}

export const ChainInlinePemDrawer = memo(function ChainInlinePemDrawer({
  pemInput,
  onPemInputChange,
  onLoadPem,
  onCancel,
}: ChainInlinePemDrawerProps) {
  const { t } = useTranslation()

  return (
    <section className={`glass-panel ${styles.pemPanel}`}>
      <h2 className={styles.pemTitle}>{t('app.formatConverter.certLabel', 'Certificate (PEM)')}</h2>
      <div className="form-group">
        <label htmlFor="chain-add-pem-textarea" className="form-label">
          {t('app.ocsp.inputLabel', 'Certificate (PEM / DER)')}
        </label>
        <textarea
          id="chain-add-pem-textarea"
          className="form-textarea"
          placeholder={t(
            'app.ocsp.placeholder',
            '-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----',
          )}
          value={pemInput}
          onChange={(e) => onPemInputChange(e.target.value)}
          rows={4}
        />
      </div>
      <div className={styles.pemActions}>
        <button type="button" className="btn btn-secondary btn-sm" onClick={onCancel}>
          {t('common.cancel', 'Cancel')}
        </button>
        <button type="button" className="btn btn-primary btn-sm" onClick={onLoadPem}>
          <Upload size={13} aria-hidden="true" />
          <span>{t('app.chain.addCerts', 'Add Certs')}</span>
        </button>
      </div>
    </section>
  )
})
