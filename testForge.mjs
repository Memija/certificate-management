import forge from 'node-forge';

const pki = forge.pki;
const keys = pki.rsa.generateKeyPair(1024);
const cert = pki.createCertificate();
cert.publicKey = keys.publicKey;
cert.serialNumber = '01';
cert.validity.notBefore = new Date();
cert.validity.notAfter = new Date();
cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);

cert.sign(keys.privateKey);

console.log("Version:", cert.version);
console.log("Sig OID:", cert.signatureOid);
console.log("PublicKey:", cert.publicKey.n ? cert.publicKey.n.bitLength() : 'Not RSA');

const der = forge.asn1.toDer(pki.certificateToAsn1(cert)).getBytes();
const md = forge.md.sha1.create();
md.update(der);
console.log("SHA1:", md.digest().toHex());
