import { describe, expect, it } from 'vitest';

import { CREATE_PHOTO_REFERENCES_TABLE_SQL, CURRENT_SCHEMA_VERSION } from './schema';

describe('local database schema', () => {
  it('uses schema version 2 for the photo reference foreign key migration', () => {
    expect(CURRENT_SCHEMA_VERSION).toBe(2);
  });

  it('does not require local timeEntries rows for photo reference matches', () => {
    expect(CREATE_PHOTO_REFERENCES_TABLE_SQL).not.toContain('FOREIGN KEY (entryId)');
    expect(CREATE_PHOTO_REFERENCES_TABLE_SQL).toContain('entryId TEXT');
  });
});
