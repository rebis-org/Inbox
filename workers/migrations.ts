export interface Migration {
  name: string,
  sql: string
}

const MIGRATION_BEGIN_REGEX = /^\s*BEGIN\s+TRANSACTION\s*;?\s*/i;
const MIGRATION_COMMIT_REGEX = /\s*COMMIT\s*(?:;\s*)?$/i;
const WRAP_BEGIN_REGEX = /^\s*BEGIN\b/i;

export function applyMigrations(
  sql: SqlStorage,
  migrations: Migration[],
  storage?: DurableObjectStorage
): void {
  sql.exec(`CREATE TABLE IF NOT EXISTS d1_migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);

  for (let i = 0, len = migrations.length; i < len; i++) {
    const migration = migrations[i];
    const applied = [...sql.exec('SELECT 1 FROM d1_migrations WHERE name = ?', migration.name)];
    if (applied.length > 0) continue;

    const migrationSql = migration.sql
      .trim()
      .replace(MIGRATION_BEGIN_REGEX, '')
      .replace(MIGRATION_COMMIT_REGEX, '');

    const escapedName = migration.name.replaceAll('\'', '\'\'');
    const run = () => {
      sql.exec(migrationSql);
      sql.exec(`INSERT INTO d1_migrations (name) VALUES ('${escapedName}')`);
    };

    if (storage) {
      storage.transactionSync(run);
    } else {
      run();
    }
  }
}

interface DurableObjectStorage {
  transactionSync: <T>(closure: () => T) => T
}

function wrapInTransaction(sql: string) {
  const trimmed = sql.trim();
  return WRAP_BEGIN_REGEX.test(trimmed) ? trimmed : `BEGIN TRANSACTION;\n${trimmed}\nCOMMIT;`;
}

export const mailboxMigrations: Migration[] = [
  {
    name: '1_initial_setup',
    sql: wrapInTransaction(`
            CREATE TABLE folders (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL UNIQUE,
                is_deletable INTEGER NOT NULL DEFAULT 1
            );

            INSERT INTO folders (id, name, is_deletable) VALUES
                ('inbox', 'Inbox', 0),
                ('sent', 'Sent', 0),
                ('trash', 'Trash', 0),
                ('archive', 'Archive', 0),
                ('spam', 'Spam', 0);

            CREATE TABLE emails (
                id TEXT PRIMARY KEY,
                folder_id TEXT NOT NULL,
                subject TEXT,
                sender TEXT,
                recipient TEXT,
                date TEXT,
                read INTEGER DEFAULT 0,
                starred INTEGER DEFAULT 0,
                body TEXT,
                FOREIGN KEY(folder_id) REFERENCES folders(id) ON DELETE CASCADE
            );

            CREATE TABLE attachments (
                id TEXT PRIMARY KEY,
                email_id TEXT NOT NULL,
                filename TEXT NOT NULL,
                mimetype TEXT NOT NULL,
                size INTEGER NOT NULL,
                content_id TEXT,
                disposition TEXT,
                FOREIGN KEY(email_id) REFERENCES emails(id) ON DELETE CASCADE
            );
        `)
  },
  {
    name: '2_add_email_threading',
    sql: wrapInTransaction(`
            ALTER TABLE emails ADD COLUMN in_reply_to TEXT;
            ALTER TABLE emails ADD COLUMN email_references TEXT;
            ALTER TABLE emails ADD COLUMN thread_id TEXT;

            CREATE INDEX idx_emails_thread_id ON emails(thread_id);
            CREATE INDEX idx_emails_in_reply_to ON emails(in_reply_to);
        `)
  },
  {
    name: '3_add_draft_folder',
    sql: wrapInTransaction(
      'INSERT INTO folders (id, name, is_deletable) VALUES (\'draft\', \'Drafts\', 0);'
    )
  },
  {
    name: '4_add_message_id',
    sql: wrapInTransaction('ALTER TABLE emails ADD COLUMN message_id TEXT;')
  },
  {
    name: '5_add_raw_headers',
    sql: wrapInTransaction('ALTER TABLE emails ADD COLUMN raw_headers TEXT;')
  },
  {
    name: '6_mark_sent_emails_as_read',
    sql: wrapInTransaction('UPDATE emails SET read = 1 WHERE folder_id = \'sent\' AND read = 0;')
  },
  {
    name: '7_add_cc_bcc',
    sql: wrapInTransaction(`
            ALTER TABLE emails ADD COLUMN cc TEXT;
            ALTER TABLE emails ADD COLUMN bcc TEXT;
        `)
  },
  {
    name: '8_add_folder_date_indexes',
    sql: `
            CREATE INDEX IF NOT EXISTS idx_emails_folder_id ON emails(folder_id);
            CREATE INDEX IF NOT EXISTS idx_emails_date ON emails(date);
            CREATE INDEX IF NOT EXISTS idx_emails_folder_date ON emails(folder_id, date DESC);
        `
  },
  {
    name: '9_add_resend_delivery_status',
    sql: wrapInTransaction(`
            ALTER TABLE emails ADD COLUMN resend_id TEXT;
            ALTER TABLE emails ADD COLUMN delivery_status TEXT NOT NULL DEFAULT 'sent';
        `)
  }
];
