export interface CtEntry {
  id: number;
  issuer_ca_id: number;
  issuer_name: string;
  common_name: string;
  name_value: string;
  entry_timestamp: string;
  not_before: string;
  not_after: string;
  serial_number: string;
}

export interface CtLogPreset {
  id: string;
  domain: string;
  badgeType?: 'success' | 'warning' | 'purple' | 'info' | 'danger';
  sampleData: CtEntry[];
  isSpecial?: boolean;
}

export const CT_LOG_PRESETS: CtLogPreset[] = [
  {
    id: 'homeManagement',
    domain: 'home-management.dev',
    isSpecial: true,
    badgeType: 'success',
    sampleData: [
      {
        id: 17405575237,
        issuer_ca_id: 182390,
        issuer_name: "C=US, O=Google Trust Services, CN=WE1",
        common_name: "*.home-management.dev",
        name_value: "*.home-management.dev\nhome-management.dev",
        entry_timestamp: "2026-09-25T10:58:10",
        not_before: "2026-09-25T10:58:10",
        not_after: "2026-12-23T11:21:49",
        serial_number: "04a18d9ab3e0efbc0c373077e869e5a4"
      },
      {
        id: 17057309617,
        issuer_ca_id: 16418,
        issuer_name: "C=US, O=Let's Encrypt, CN=YE2",
        common_name: "home-management.dev",
        name_value: "*.home-management.dev\nhome-management.dev",
        entry_timestamp: "2026-09-08T10:21:17",
        not_before: "2026-09-08T10:21:17",
        not_after: "2026-12-07T10:21:16",
        serial_number: "053b175a010645ac889d2ba55614b13a3a05"
      },
      {
        id: 17129299485,
        issuer_ca_id: 182390,
        issuer_name: "C=US, O=Google Trust Services, CN=WR3",
        common_name: "home-management.dev",
        name_value: "home-management.dev\n*.home-management.dev\napi.home-management.dev",
        entry_timestamp: "2026-09-12T00:04:21",
        not_before: "2026-09-12T00:04:21",
        not_after: "2026-12-11T01:02:25",
        serial_number: "03f9724495ec926133f8ac18449dca75"
      },
      {
        id: 16110838450,
        issuer_ca_id: 16418,
        issuer_name: "C=US, O=Let's Encrypt, CN=R3",
        common_name: "home-management.dev",
        name_value: "home-management.dev\n*.home-management.dev",
        entry_timestamp: "2026-04-20T08:15:00",
        not_before: "2026-04-20T08:15:00",
        not_after: "2026-07-19T08:15:00",
        serial_number: "04b8248d5f22e417fdf37ad050fa0efb"
      },
      {
        id: 15204810294,
        issuer_ca_id: 16418,
        issuer_name: "C=US, O=Let's Encrypt, CN=R3",
        common_name: "*.home-management.dev",
        name_value: "*.home-management.dev\nhome-management.dev",
        entry_timestamp: "2026-01-15T09:00:00",
        not_before: "2026-01-15T09:00:00",
        not_after: "2026-04-15T09:00:00",
        serial_number: "03e91049283740192837401928374019"
      },
      {
        id: 14920194812,
        issuer_ca_id: 16418,
        issuer_name: "C=US, O=Let's Encrypt, CN=R3",
        common_name: "*.home-management.dev",
        name_value: "*.home-management.dev\nhome-management.dev",
        entry_timestamp: "2025-10-15T08:12:30",
        not_before: "2025-10-15T07:10:00",
        not_after: "2026-01-15T07:10:00",
        serial_number: "03bc102938471029384710293847102b"
      },
      {
        id: 14820194810,
        issuer_ca_id: 16418,
        issuer_name: "C=US, O=Let's Encrypt, CN=E1",
        common_name: "home-management.dev",
        name_value: "home-management.dev\napi.home-management.dev\nauth.home-management.dev",
        entry_timestamp: "2025-07-16T12:00:00",
        not_before: "2025-07-16T11:00:00",
        not_after: "2025-10-14T11:00:00",
        serial_number: "02fa910283741029384710293847102c"
      }
    ]
  },
  {
    id: 'github',
    domain: 'github.com',
    badgeType: 'success',
    sampleData: [
      {
        id: 15482910412,
        issuer_ca_id: 185244,
        issuer_name: "C=US, O=DigiCert Inc, CN=DigiCert Global G2 TLS RSA SHA256 2020 CA1",
        common_name: "github.com",
        name_value: "github.com\nwww.github.com",
        entry_timestamp: "2026-03-12T14:22:10",
        not_before: "2026-03-12T00:00:00",
        not_after: "2027-03-15T23:59:59",
        serial_number: "04a91fbc883901b22e7039ef10c71a34"
      },
      {
        id: 14920194811,
        issuer_ca_id: 185244,
        issuer_name: "C=US, O=DigiCert Inc, CN=DigiCert TLS Hybrid ECC SHA384 2020 CA1",
        common_name: "*.github.com",
        name_value: "*.github.com\ngithub.com",
        entry_timestamp: "2025-11-04T09:15:33",
        not_before: "2025-11-04T00:00:00",
        not_after: "2026-11-05T23:59:59",
        serial_number: "087e3bc110a2f448991a0ccb452819f0"
      },
      {
        id: 13810294710,
        issuer_ca_id: 16418,
        issuer_name: "C=US, O=Let's Encrypt, CN=R3",
        common_name: "*.github.io",
        name_value: "*.github.io\ngithub.io",
        entry_timestamp: "2025-08-20T18:02:44",
        not_before: "2025-08-20T17:00:00",
        not_after: "2025-11-18T17:00:00",
        serial_number: "03bc89a7114092ffca33b5d19812a033"
      },
      {
        id: 11928374612,
        issuer_ca_id: 185244,
        issuer_name: "C=US, O=DigiCert Inc, CN=DigiCert SHA2 Extended Validation Server CA",
        common_name: "github.com",
        name_value: "github.com\nwww.github.com",
        entry_timestamp: "2024-03-10T12:00:00",
        not_before: "2024-03-10T00:00:00",
        not_after: "2025-03-14T23:59:59",
        serial_number: "05cb19df9481aa772c4019be981230ab"
      }
    ]
  },
  {
    id: 'google',
    domain: 'google.com',
    badgeType: 'info',
    sampleData: [
      {
        id: 16019284721,
        issuer_ca_id: 182390,
        issuer_name: "C=US, O=Google Trust Services, CN=WR2",
        common_name: "*.google.com",
        name_value: "*.google.com\ngoogle.com\n*.android.com\n*.appengine.google.com\n*.cloud.google.com",
        entry_timestamp: "2026-04-01T08:12:00",
        not_before: "2026-04-01T07:44:19",
        not_after: "2026-06-24T07:44:18",
        serial_number: "39a04cb91288b4f1770e2819cc7b2901"
      },
      {
        id: 15810293844,
        issuer_ca_id: 182390,
        issuer_name: "C=US, O=Google Trust Services, CN=GTS CA 1C3",
        common_name: "google.com",
        name_value: "google.com\n*.google.com\n*.origin.google.com",
        entry_timestamp: "2026-02-15T11:30:22",
        not_before: "2026-02-15T10:11:05",
        not_after: "2026-05-10T10:11:04",
        serial_number: "2201bc89a4ff1802bbd0912448ca9120"
      },
      {
        id: 14209182733,
        issuer_ca_id: 182390,
        issuer_name: "C=US, O=Google Trust Services, CN=GTS CA 1D4",
        common_name: "mail.google.com",
        name_value: "mail.google.com\ninbox.google.com",
        entry_timestamp: "2025-09-01T15:00:00",
        not_before: "2025-09-01T14:20:00",
        not_after: "2025-11-24T14:20:00",
        serial_number: "19ab84001928cbe9481028ba4910ef02"
      }
    ]
  },
  {
    id: 'cloudflare',
    domain: 'cloudflare.com',
    badgeType: 'purple',
    sampleData: [
      {
        id: 15990281923,
        issuer_ca_id: 174021,
        issuer_name: "C=US, O=Cloudflare Inc, CN=Cloudflare Inc ECC CA-3",
        common_name: "cloudflare.com",
        name_value: "cloudflare.com\n*.cloudflare.com",
        entry_timestamp: "2026-03-20T10:14:55",
        not_before: "2026-03-20T00:00:00",
        not_after: "2027-03-21T23:59:59",
        serial_number: "0912bc84910248ca99b01824cb912801"
      },
      {
        id: 15129384711,
        issuer_ca_id: 174021,
        issuer_name: "C=US, O=Cloudflare Inc, CN=Cloudflare Inc RSA CA-2",
        common_name: "*.cloudflare.com",
        name_value: "*.cloudflare.com\ncloudflare.com\n*.dash.cloudflare.com",
        entry_timestamp: "2025-12-10T16:40:11",
        not_before: "2025-12-10T00:00:00",
        not_after: "2026-12-11T23:59:59",
        serial_number: "04bc7102948bb109923847101824ef09"
      },
      {
        id: 13910294822,
        issuer_ca_id: 185244,
        issuer_name: "C=US, O=DigiCert Inc, CN=DigiCert TLS RSA SHA256 2020 CA1",
        common_name: "one.dash.cloudflare.com",
        name_value: "one.dash.cloudflare.com\ndash.cloudflare.com",
        entry_timestamp: "2025-07-14T09:20:00",
        not_before: "2025-07-14T00:00:00",
        not_after: "2025-10-12T23:59:59",
        serial_number: "01f928c04910283ba481029bc0192834"
      }
    ]
  },
  {
    id: 'wikipedia',
    domain: 'wikipedia.org',
    badgeType: 'warning',
    sampleData: [
      {
        id: 15781920391,
        issuer_ca_id: 16418,
        issuer_name: "C=US, O=Let's Encrypt, CN=E6",
        common_name: "*.wikipedia.org",
        name_value: "*.wikipedia.org\nwikipedia.org\n*.m.wikipedia.org",
        entry_timestamp: "2026-03-01T12:00:00",
        not_before: "2026-03-01T11:15:30",
        not_after: "2026-05-30T11:15:29",
        serial_number: "03a194bc02819fba84910283741029ab"
      },
      {
        id: 14819203948,
        issuer_ca_id: 16418,
        issuer_name: "C=US, O=Let's Encrypt, CN=R3",
        common_name: "wikipedia.org",
        name_value: "wikipedia.org\n*.wikipedia.org\n*.wikimedia.org",
        entry_timestamp: "2025-10-18T14:30:10",
        not_before: "2025-10-18T13:40:00",
        not_after: "2026-01-16T13:40:00",
        serial_number: "04bc1928374619028374910283746190"
      },
      {
        id: 12901928374,
        issuer_ca_id: 14201,
        issuer_name: "C=BE, O=GlobalSign nv-sa, CN=GlobalSign GCC R3 DV TLS CA 2020",
        common_name: "*.m.wikipedia.org",
        name_value: "*.m.wikipedia.org\nm.wikipedia.org",
        entry_timestamp: "2024-06-15T09:00:00",
        not_before: "2024-06-15T00:00:00",
        not_after: "2025-06-16T23:59:59",
        serial_number: "02cb8491029384710293847102938471"
      }
    ]
  },
  {
    id: 'badssl',
    domain: 'badssl.com',
    badgeType: 'danger',
    sampleData: [
      {
        id: 15301928471,
        issuer_ca_id: 16418,
        issuer_name: "C=US, O=Let's Encrypt, CN=R3",
        common_name: "*.badssl.com",
        name_value: "*.badssl.com\nbadssl.com",
        entry_timestamp: "2026-02-10T19:22:15",
        not_before: "2026-02-10T18:20:00",
        not_after: "2026-05-11T18:20:00",
        serial_number: "03bc4910283471029384710293847102"
      },
      {
        id: 14102938471,
        issuer_ca_id: 16418,
        issuer_name: "C=US, O=Let's Encrypt, CN=R3",
        common_name: "expired.badssl.com",
        name_value: "expired.badssl.com",
        entry_timestamp: "2024-04-12T08:00:00",
        not_before: "2024-04-12T00:00:00",
        not_after: "2024-07-11T23:59:59",
        serial_number: "04ef9182374619283746192837461928"
      },
      {
        id: 13910293847,
        issuer_ca_id: 16418,
        issuer_name: "C=US, O=Let's Encrypt, CN=E1",
        common_name: "revoked.badssl.com",
        name_value: "revoked.badssl.com",
        entry_timestamp: "2024-02-01T12:00:00",
        not_before: "2024-02-01T00:00:00",
        not_after: "2024-05-01T23:59:59",
        serial_number: "03ff8192384710293847102938471029"
      }
    ]
  }
];
