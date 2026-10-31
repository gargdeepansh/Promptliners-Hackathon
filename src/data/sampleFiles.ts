import { FileItem } from '../types';

/**
 * Deterministic seed files for the sample Files run.
 * Timestamps accurately match the 2026 dates in their filenames.
 */
export const SAMPLE_FILES: FileItem[] = [
  // Screenshots
  {
    id: 'f_ss_01',
    name: 'Screenshot 2026-09-14 at 10.22.45.png',
    path: 'Screenshot 2026-09-14 at 10.22.45.png',
    size: 1420500,
    lastModified: new Date('2026-09-14T10:22:45Z').getTime(),
    extension: '.png',
  },
  {
    id: 'f_ss_02',
    name: 'Screenshot 2026-09-18 at 14.15.10.png',
    path: 'Screenshot 2026-09-18 at 14.15.10.png',
    size: 2105400,
    lastModified: new Date('2026-09-18T14:15:10Z').getTime(),
    extension: '.png',
  },
  {
    id: 'f_ss_03',
    name: 'Screenshot 2026-10-02 at 09.05.33.png',
    path: 'Screenshot 2026-10-02 at 09.05.33.png',
    size: 1890200,
    lastModified: new Date('2026-10-02T09:05:33Z').getTime(),
    extension: '.png',
  },
  {
    id: 'f_ss_04',
    name: 'Screenshot 2026-10-10 at 16.44.12.png',
    path: 'Screenshot 2026-10-10 at 16.44.12.png',
    size: 3200100,
    lastModified: new Date('2026-10-10T16:44:12Z').getTime(),
    extension: '.png',
  },
  {
    id: 'f_ss_05',
    name: 'Screenshot 2026-10-24 at 11.12.01.png',
    path: 'Screenshot 2026-10-24 at 11.12.01.png',
    size: 2450300,
    lastModified: new Date('2026-10-24T11:12:01Z').getTime(),
    extension: '.png',
  },

  // Installers (.dmg, .pkg, .exe)
  {
    id: 'f_inst_01',
    name: 'DockerDesktop-4.32.0.dmg',
    path: 'DockerDesktop-4.32.0.dmg',
    size: 724800000,
    lastModified: new Date('2026-08-15T08:00:00Z').getTime(),
    extension: '.dmg',
  },
  {
    id: 'f_inst_02',
    name: 'Postman-darwin-arm64.dmg',
    path: 'Postman-darwin-arm64.dmg',
    size: 184500000,
    lastModified: new Date('2026-08-20T12:00:00Z').getTime(),
    extension: '.dmg',
  },
  {
    id: 'f_inst_03',
    name: 'Slack-setup-4.38.1.dmg',
    path: 'Slack-setup-4.38.1.dmg',
    size: 122400000,
    lastModified: new Date('2026-09-01T15:00:00Z').getTime(),
    extension: '.dmg',
  },
  {
    id: 'f_inst_04',
    name: 'Node-v22.14.0.pkg',
    path: 'Node-v22.14.0.pkg',
    size: 45600000,
    lastModified: new Date('2026-09-10T18:00:00Z').getTime(),
    extension: '.pkg',
  },

  // Temporary & lock files (temp_*, tmp_*, ~$*, ~lock.*, .tmp, .temp, .swp, .part, .crdownload)
  {
    id: 'f_tmp_01',
    name: 'temp_notes_dump.tmp',
    path: 'temp_notes_dump.tmp',
    size: 48200,
    lastModified: new Date('2026-10-05T09:30:00Z').getTime(),
    extension: '.tmp',
  },
  {
    id: 'f_tmp_02',
    name: 'tmp_cache_buffer.temp',
    path: 'tmp_cache_buffer.temp',
    size: 124000,
    lastModified: new Date('2026-09-22T14:10:00Z').getTime(),
    extension: '.temp',
  },
  {
    id: 'f_tmp_03',
    name: '~lock.Quarterly_Report_2026.docx#',
    path: '~lock.Quarterly_Report_2026.docx#',
    size: 384,
    lastModified: new Date('2026-10-15T16:20:00Z').getTime(),
    extension: '.docx#',
  },
  {
    id: 'f_tmp_04',
    name: 'backup_sqlite_db.bak',
    path: 'backup_sqlite_db.bak',
    size: 14500000,
    lastModified: new Date('2026-09-08T11:00:00Z').getTime(),
    extension: '.bak',
  },

  // Logs (.log)
  {
    id: 'f_log_01',
    name: 'npm_debug_2026_09_12.log',
    path: 'npm_debug_2026_09_12.log',
    size: 480200,
    lastModified: new Date('2026-09-12T08:15:00Z').getTime(),
    extension: '.log',
  },
  {
    id: 'f_log_02',
    name: 'build_trace_client_err.log',
    path: 'build_trace_client_err.log',
    size: 890400,
    lastModified: new Date('2026-09-20T17:40:00Z').getTime(),
    extension: '.log',
  },
  {
    id: 'f_log_03',
    name: 'system_crash_report.log',
    path: 'system_crash_report.log',
    size: 320000,
    lastModified: new Date('2026-10-01T12:00:00Z').getTime(),
    extension: '.log',
  },
  {
    id: 'f_log_04',
    name: 'test_runner_stdout.log',
    path: 'test_runner_stdout.log',
    size: 612000,
    lastModified: new Date('2026-10-12T19:25:00Z').getTime(),
    extension: '.log',
  },

  // Invoices & Receipts (.pdf)
  {
    id: 'f_inv_01',
    name: 'Invoice_2026_08_GCP_Cloud.pdf',
    path: 'Invoice_2026_08_GCP_Cloud.pdf',
    size: 145000,
    lastModified: new Date('2026-08-31T20:00:00Z').getTime(),
    extension: '.pdf',
  },
  {
    id: 'f_inv_02',
    name: 'Invoice_2026_09_GoogleWorkspace.pdf',
    path: 'Invoice_2026_09_GoogleWorkspace.pdf',
    size: 132000,
    lastModified: new Date('2026-09-30T20:00:00Z').getTime(),
    extension: '.pdf',
  },
  {
    id: 'f_inv_03',
    name: 'Receipt_AppleStore_MacBookPro.pdf',
    path: 'Receipt_AppleStore_MacBookPro.pdf',
    size: 284000,
    lastModified: new Date('2026-07-20T14:30:00Z').getTime(),
    extension: '.pdf',
  },
  {
    id: 'f_inv_04',
    name: 'Invoice_2026_10_HealthInsurance.pdf',
    path: 'Invoice_2026_10_HealthInsurance.pdf',
    size: 198000,
    lastModified: new Date('2026-10-25T11:00:00Z').getTime(),
    extension: '.pdf',
  },

  // Camera & Drone Imports (IMG_*, DSC_*)
  {
    id: 'f_img_01',
    name: 'IMG_4821_Yosemite_Hike.JPG',
    path: 'IMG_4821_Yosemite_Hike.JPG',
    size: 14500000,
    lastModified: new Date('2026-08-10T15:20:00Z').getTime(),
    extension: '.jpg',
  },
  {
    id: 'f_img_02',
    name: 'IMG_4822_Half_Dome_View.JPG',
    path: 'IMG_4822_Half_Dome_View.JPG',
    size: 15200000,
    lastModified: new Date('2026-08-10T15:25:00Z').getTime(),
    extension: '.jpg',
  },
  {
    id: 'f_img_03',
    name: 'IMG_4823_Sunset_Camp.JPG',
    path: 'IMG_4823_Sunset_Camp.JPG',
    size: 16100000,
    lastModified: new Date('2026-08-10T19:45:00Z').getTime(),
    extension: '.jpg',
  },
  {
    id: 'f_img_04',
    name: 'DSC_0091_Studio_Lighting.jpg',
    path: 'DSC_0091_Studio_Lighting.jpg',
    size: 12400000,
    lastModified: new Date('2026-09-15T16:00:00Z').getTime(),
    extension: '.jpg',
  },

  // Compressed Archives (.zip, .tar.gz)
  {
    id: 'f_arc_01',
    name: 'client_brand_assets_v2.zip',
    path: 'client_brand_assets_v2.zip',
    size: 89400000,
    lastModified: new Date('2026-08-05T13:00:00Z').getTime(),
    extension: '.zip',
  },
  {
    id: 'f_arc_02',
    name: 'archive_q2_raw_telemetry.tar.gz',
    path: 'archive_q2_raw_telemetry.tar.gz',
    size: 142000000,
    lastModified: new Date('2026-07-15T10:00:00Z').getTime(),
    extension: '.tar.gz',
  },
  {
    id: 'f_arc_03',
    name: 'production_database_export_aug.zip',
    path: 'production_database_export_aug.zip',
    size: 215000000,
    lastModified: new Date('2026-08-28T04:00:00Z').getTime(),
    extension: '.zip',
  },

  // General Documents (.pdf)
  {
    id: 'f_doc_01',
    name: 'Apartment_Lease_Agreement_Signed.pdf',
    path: 'Apartment_Lease_Agreement_Signed.pdf',
    size: 4200000,
    lastModified: new Date('2026-07-22T09:00:00Z').getTime(),
    extension: '.pdf',
  },
  {
    id: 'f_doc_02',
    name: 'Tax_Return_Federal_2025.pdf',
    path: 'Tax_Return_Federal_2025.pdf',
    size: 3100000,
    lastModified: new Date('2026-04-14T11:00:00Z').getTime(),
    extension: '.pdf',
  },
  {
    id: 'f_doc_02_dup',
    name: 'Tax_Return_Federal_2025 (1).pdf',
    path: 'Tax_Return_Federal_2025 (1).pdf',
    size: 3100000,
    lastModified: new Date('2026-04-14T11:05:00Z').getTime(),
    extension: '.pdf',
  },
  {
    id: 'f_doc_03',
    name: 'Car_Insurance_Policy_Decs.pdf',
    path: 'Car_Insurance_Policy_Decs.pdf',
    size: 1120000,
    lastModified: new Date('2026-08-12T10:30:00Z').getTime(),
    extension: '.pdf',
  },
];
