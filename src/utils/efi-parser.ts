import type { EfiSignatureData, EfiSignatureList, ParsedCertificate } from '@/types'

import { parseX509FromDer } from './x509-parser'

export type { EfiSignatureData, EfiSignatureList, ParsedCertificate }

const GUID_MAP: Record<string, string> = {
  'c1c41626-504c-4092-aca9-41f936934328': 'EFI_CERT_SHA256_GUID',
  '3c5766e8-269c-4e34-aa14-ed776e85b3b6': 'EFI_CERT_RSA2048_GUID',
  'e2b36190-879b-4a3d-ad8d-f2e7bbaf1327': 'EFI_CERT_RSA2048_SHA256_GUID',
  '826ca512-cf10-4ac9-b187-be01496631bd': 'EFI_CERT_SHA1_GUID',
  '67f8444f-8743-48f1-a328-1eaaab873603': 'EFI_CERT_RSA2048_SHA1_GUID',
  'a5c059a1-94e4-4aa7-87b5-ab155c2bf072': 'EFI_CERT_X509_GUID',
  '0b6e5233-a65c-44c9-9407-d9ab83bfd8bd': 'EFI_CERT_SHA224_GUID',
  'ff3e536c-9fd0-42c9-aba8-b197175f7e02': 'EFI_CERT_SHA384_GUID',
  '093e0fae-a6c4-4f50-9f1b-d41e2b89c19a': 'EFI_CERT_SHA512_GUID',
  '3bd2a492-96c0-4079-b420-bcefc98cb1b2': 'EFI_CERT_X509_SHA256_GUID',
  '7076876e-80c2-4ee6-aa3d-f68444a5e01c': 'EFI_CERT_X509_SHA384_GUID',
  '446dbf63-2502-4cda-bcfa-2465d2b0fe9d': 'EFI_CERT_X509_SHA512_GUID',
}

function readGuid(view: DataView, offset: number): string {
  const data1 = view.getUint32(offset, true).toString(16).padStart(8, '0')
  const data2 = view
    .getUint16(offset + 4, true)
    .toString(16)
    .padStart(4, '0')
  const data3 = view
    .getUint16(offset + 6, true)
    .toString(16)
    .padStart(4, '0')

  const data4Part1 = view
    .getUint16(offset + 8, false)
    .toString(16)
    .padStart(4, '0')
  const data4Part2 = view
    .getUint32(offset + 10, false)
    .toString(16)
    .padStart(8, '0')
  const data4Part3 = view
    .getUint16(offset + 14, false)
    .toString(16)
    .padStart(4, '0')

  return `${data1}-${data2}-${data3}-${data4Part1}-${data4Part2}${data4Part3}`
}

function toHexString(byteArray: Uint8Array): string {
  return Array.from(byteArray, (byte) => ('0' + (byte & 0xff).toString(16)).slice(-2)).join('')
}

export function parseEfiSignatureLists(buffer: ArrayBuffer): EfiSignatureList[] {
  const lists: EfiSignatureList[] = []
  const view = new DataView(buffer)
  let offset = 0

  while (offset + 28 <= buffer.byteLength) {
    const signatureTypeGuid = readGuid(view, offset)
    const signatureTypeName = GUID_MAP[signatureTypeGuid] || 'UNKNOWN_GUID'

    const signatureListSize = view.getUint32(offset + 16, true)
    const signatureHeaderSize = view.getUint32(offset + 20, true)
    const signatureSize = view.getUint32(offset + 24, true)

    if (
      signatureListSize === 0 ||
      signatureSize < 16 ||
      offset + signatureListSize > buffer.byteLength
    ) {
      console.warn('Invalid signature list size or end of buffer reached.')
      break
    }

    const signatures: EfiSignatureData[] = []
    let sigOffset = offset + 28 + signatureHeaderSize
    const endOffset = offset + signatureListSize

    while (sigOffset + signatureSize <= endOffset) {
      const signatureOwner = readGuid(view, sigOffset)
      const dataSize = signatureSize - 16
      const dataOffset = sigOffset + 16
      const sliceBuffer = buffer.slice(dataOffset, dataOffset + dataSize)
      const rawData = new Uint8Array(sliceBuffer)

      let certificate: ParsedCertificate | undefined
      let hashData: string | undefined

      if (signatureTypeName === 'EFI_CERT_X509_GUID') {
        certificate = parseX509FromDer(sliceBuffer) ?? undefined
      } else {
        hashData = toHexString(rawData)
      }

      signatures.push({
        signatureOwner,
        rawData,
        certificate,
        hashData,
      })

      sigOffset += signatureSize
    }

    lists.push({
      signatureTypeGuid,
      signatureTypeName,
      signatureListSize,
      signatureHeaderSize,
      signatureSize,
      signatures,
    })

    offset += signatureListSize
  }

  return lists
}

export function parseRawX509(buffer: ArrayBuffer): ParsedCertificate | null {
  return parseX509FromDer(buffer)
}
