BEGIN TRANSACTION;

-- =========================
-- Families & People
-- =========================
CREATE TABLE families (
  family_id          INTEGER PRIMARY KEY AUTOINCREMENT,
  parish_member      INTEGER NOT NULL DEFAULT 0 CHECK (parish_member IN (0,1)),
  parish_number      TEXT UNIQUE,                                     -- nullable
  street             TEXT NOT NULL,
  city               TEXT NOT NULL,
  state              TEXT NOT NULL,
  zip                TEXT NOT NULL
);

CREATE TABLE contacts (
  contact_id    INTEGER PRIMARY KEY AUTOINCREMENT,
  family_id     INTEGER NOT NULL REFERENCES families(family_id) ON DELETE CASCADE,
  lastname      TEXT NOT NULL,
  firstname     TEXT NOT NULL,
  middle        TEXT,
  relationship  TEXT NOT NULL CHECK (relationship IN ('Father', 'Mother', 'Guardian', 'Uncle','Aunt','Grandparent', 'Brother','Sister','Cousin')),
  phone         TEXT,
  email         TEXT,
  is_emergency  INTEGER NOT NULL DEFAULT 0 CHECK (is_emergency IN (0,1))
);

CREATE INDEX ix_contacts_family   ON contacts(family_id, lastname, firstname);
CREATE INDEX ix_contacts_phone    ON contacts(family_id, phone);
CREATE INDEX ix_contacts_email    ON contacts(family_id, email);

CREATE TABLE children (
  child_id           INTEGER PRIMARY KEY AUTOINCREMENT,
  family_id          INTEGER NOT NULL REFERENCES families(family_id) ON DELETE CASCADE,
  lastname           TEXT NOT NULL,
  firstname          TEXT NOT NULL,
  middle             TEXT,
  saintname          TEXT,
  dob                DATE NOT NULL,
  allergy            TEXT,
  is_name_exception  INTEGER NOT NULL DEFAULT 0 CHECK (is_name_exception IN (0,1)),
  exception_notes    TEXT
);

CREATE INDEX       ix_children_family       ON children(family_id, lastname, firstname, saintname, dob);

-- =========================
-- Events (admin | registration | event)
-- =========================
CREATE TABLE events (
  event_id        TEXT PRIMARY KEY,                                   -- e.g. 'EVT_PROGA_2026'
  type            TEXT NOT NULL CHECK (type IN ('admin','registration','event')),
  program_id      TEXT,                                               -- nullable (admin or school-wide)
  school_year     INTEGER NOT NULL,
  description     TEXT NOT NULL,
  scope           TEXT NOT NULL CHECK (scope IN ('family','child')),
  fee             REAL NOT NULL DEFAULT 0.0,
  status          TEXT NOT NULL CHECK (status IN ('draft','open','closed','archived')),
  start_ts        DATETIME NOT NULL,
  end_ts          DATETIME NOT NULL,
  season_event_id TEXT REFERENCES events(event_id)                    -- for type='event' (child events under a season)
) WITHOUT ROWID;

CREATE INDEX ix_events_type_year     ON events(type, school_year);
CREATE INDEX ix_events_status_window ON events(status, start_ts, end_ts);
CREATE INDEX ix_events_program_year  ON events(program_id, school_year);

-- Unconditional prerequisites (B requires A)
CREATE TABLE event_prerequisites (
  event_id               TEXT NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
  prerequisite_event_id  TEXT NOT NULL REFERENCES events(event_id) ON DELETE RESTRICT,
  PRIMARY KEY (event_id, prerequisite_event_id)
);

-- Conditional prerequisites keyed by member_status
CREATE TABLE event_conditional_prereqs (
  event_id          TEXT NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
  member_status     TEXT NOT NULL CHECK (member_status IN ('member','nonMember')),
  required_event_id TEXT NOT NULL REFERENCES events(event_id) ON DELETE RESTRICT,
  PRIMARY KEY (event_id, member_status, required_event_id)
);

-- =========================
-- Registrations & Payments
-- =========================
CREATE TABLE registrations (
  registration_id  TEXT PRIMARY KEY,                                   -- UUID (TEXT) or your REG_* code
  family_id        TEXT NOT NULL REFERENCES families(family_id) ON DELETE CASCADE,
  event_id         TEXT NOT NULL REFERENCES events(event_id)  ON DELETE RESTRICT,
  school_year      INTEGER NOT NULL,                                   -- denormalized from events at write time
  registered_at    DATETIME NOT NULL DEFAULT (CURRENT_TIMESTAMP),

  -- Payment snapshot
  payment_amount   REAL    NOT NULL,
  payment_date     DATETIME NOT NULL,
  payment_status   TEXT NOT NULL CHECK (payment_status IN ('paid')),
  payment_method   TEXT NOT NULL CHECK (payment_method IN ('cash','check','zelle','credit','other')),
  check_number     TEXT,                                               -- nullable, when method='check'
  transaction_id   TEXT,                                               -- e.g. Zelle/credit txn id
  receipt_number   TEXT UNIQUE,                                        -- optional but useful
  received_by      TEXT                                                -- username/staff id
) WITHOUT ROWID;

-- Avoid duplicates: one registration per family×event
CREATE UNIQUE INDEX uq_reg_family_event ON registrations(family_id, event_id);

CREATE INDEX ix_regs_event           ON registrations(event_id);
CREATE INDEX ix_regs_family          ON registrations(family_id);
CREATE INDEX ix_regs_year_event      ON registrations(school_year, event_id);
CREATE INDEX ix_regs_paid_by_year    ON registrations(school_year, payment_status);

-- Children attached to a registration (only for events with scope='child')
CREATE TABLE registration_children (
  registration_id  TEXT NOT NULL REFERENCES registrations(registration_id) ON DELETE CASCADE,
  child_id         TEXT NOT NULL REFERENCES children(child_id) ON DELETE RESTRICT,
  group_id         TEXT,                                               -- e.g. 'K1','G23' (grade band), optional
  PRIMARY KEY (registration_id, child_id)
);

CREATE INDEX ix_reg_children_child ON registration_children(child_id);

COMMIT;
