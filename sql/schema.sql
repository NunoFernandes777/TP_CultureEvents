CREATE TABLE IF NOT EXISTS locations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  city VARCHAR(255) NOT NULL,
  country VARCHAR(255) NOT NULL,
  address VARCHAR(255) NOT NULL DEFAULT '',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_location (city, country, address)
);

CREATE TABLE IF NOT EXISTS events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  uid VARCHAR(255) NOT NULL,
  title VARCHAR(500) NOT NULL,
  description TEXT NULL,
  event_date VARCHAR(64) NULL,
  location_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_uid (uid),
  KEY idx_event_date (event_date),
  KEY idx_location_id (location_id),
  CONSTRAINT fk_events_location
    FOREIGN KEY (location_id) REFERENCES locations(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS event_types (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(100) NOT NULL,
  label_fr VARCHAR(255) NOT NULL,
  description TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_event_type_code (code)
);

CREATE TABLE IF NOT EXISTS events_event_types (
  event_id INT NOT NULL,
  event_type_id INT NOT NULL,
  confidence_score DECIMAL(4,3) NULL,
  source VARCHAR(120) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (event_id, event_type_id),
  KEY idx_evt_type_event_type_id (event_type_id),
  CONSTRAINT fk_evt_type_event
    FOREIGN KEY (event_id) REFERENCES events(id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,
  CONSTRAINT fk_evt_type_type
    FOREIGN KEY (event_type_id) REFERENCES event_types(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS event_schedules (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  event_id INT NOT NULL,
  starts_at DATETIME NULL,
  ends_at DATETIME NULL,
  timezone VARCHAR(64) NOT NULL DEFAULT 'Europe/Paris',
  is_all_day TINYINT(1) NOT NULL DEFAULT 0,
  source_date_text VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_event_schedules_event_id (event_id),
  KEY idx_event_schedules_starts_at (starts_at),
  CONSTRAINT fk_event_schedules_event
    FOREIGN KEY (event_id) REFERENCES events(id)
    ON UPDATE CASCADE
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS event_pricing (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  event_id INT NOT NULL,
  ticket_type_id INT NULL,
  amount DECIMAL(10,2) NULL,
  currency CHAR(3) NOT NULL DEFAULT 'EUR',
  is_free TINYINT(1) NOT NULL DEFAULT 0,
  conditions_text TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_event_pricing_event_id (event_id),
  KEY idx_event_pricing_is_free (is_free),
  CONSTRAINT fk_event_pricing_event
    FOREIGN KEY (event_id) REFERENCES events(id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,
  CONSTRAINT fk_event_pricing_ticket_type
    FOREIGN KEY (ticket_type_id) REFERENCES ticket_types(id)
    ON UPDATE CASCADE
    ON DELETE SET NULL
);

INSERT IGNORE INTO event_types (code, label_fr, description) VALUES
  ('music', 'Musique', 'Concerts, scenes live, festivals musicaux'),
  ('exhibition', 'Exposition', 'Musees, galeries, installations visuelles'),
  ('theater', 'Theatre', 'Pieces, performances sceniques, arts dramatiques'),
  ('workshop', 'Atelier', 'Ateliers pratiques et creatifs'),
  ('conference', 'Conference', 'Talks, rencontres, debats'),
  ('festival', 'Festival', 'Evenements multi-activites sur plusieurs jours'),
  ('cinema', 'Cinema', 'Projections et rencontres autour du film'),
  ('dance', 'Danse', 'Spectacles de danse et performances corporelles'),
  ('heritage', 'Patrimoine', 'Visites historiques et patrimoine culturel'),
  ('kids', 'Jeune public', 'Evenements adaptes aux enfants'),
  ('other', 'Autre', 'Type non classe');

CREATE OR REPLACE VIEW vw_event_type_frequency AS
SELECT
  et.id AS event_type_id,
  et.code,
  et.label_fr,
  COUNT(*) AS event_count
FROM events_event_types eet
JOIN event_types et ON et.id = eet.event_type_id
GROUP BY et.id, et.code, et.label_fr
ORDER BY event_count DESC;
