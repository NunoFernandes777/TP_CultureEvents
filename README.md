# Cultural Events Dashboard

Application web Next.js pour consulter des evenements culturels, avec une chaine ETL MongoDB -> MySQL et une API interne pour la consultation.

## 1. Installation

### Prerequis
- Node.js 20+ (Node 24 teste)
- npm
- MySQL (local ou distant)
- (Optionnel) acces MongoDB si vous lancez les scripts ETL Mongo

### Installation des dependances
```bash
npm install
```

### Configuration base MySQL
Par defaut, le projet utilise:
- host: `127.0.0.1`
- port: `3306`
- user: `root`
- password: `""` (vide)
- database: `cultural_events`

Creer la base et le schema:
```sql
CREATE DATABASE IF NOT EXISTS cultural_events;
USE cultural_events;
SOURCE sql/schema.sql;
```

Ou copier/coller le contenu de `sql/schema.sql` dans HeidiSQL.

### Lancer en developpement
```bash
npm run dev
```

Mode auto-restart (si tu veux un restart serveur complet):
```bash
npm run dev:restart
```

### Build production
```bash
npm run build
npm run start
```

## 2. Architecture

### Vue globale
Le projet suit une architecture simple en couches:
- UI React (App Router): `app/page.tsx`
- API Next.js (routes serveur): `app/api/**`
- Acces DB MySQL: `lib/db.js`
- Logique ETL testable: `lib/etl.js`
- Scripts ETL d'import: `script/*.js`
- Tests: `tests/unit` et `tests/integration`

### Arborescence utile
```text
app/
  api/
    items/route.js
    items/[id]/route.js
    stats/route.js
  globals.css
  page.tsx
lib/
  db.js
  etl.js
script/
  collectdonnes.js
  enrichdata.js
  mongoToMySQL.js
tests/
  unit/etl.test.js
  integration/pipeline.integration.test.js
sql/
  schema.sql
TESTS.md
```

### Flux de donnees
1. Collecte donnees externes -> Mongo RAW (`script/collectdonnes.js` / `script/stockmongoDB.js`)
2. Enrichissement -> Mongo ENRICHED (`script/enrichdata.js`)
3. Mapping ETL + upsert -> MySQL (`script/mongoToMySQL.js`)
4. API Next lit MySQL (`app/api/items`, `app/api/stats`)
5. UI affiche, filtre, pagine (`app/page.tsx`)

## 3. Choix techniques

### Next.js App Router
- API routes server-side simples a exposer (`GET /api/items`, `/api/stats`).
- Integrable rapidement avec React et TypeScript.

### MySQL + mysql2/promise
- Requetes SQL directes, controle fin des joins/pagination.
- Pool de connexions dans `lib/db.js`.

### MongoDB pour les donnees brutes/enrichies
- Mode document pratique pour stocker payloads API et enrichissements intermediaires.

### ETL modulaire (`lib/etl.js`)
- Fonctions pures separant:
  - normalisation
  - categorisation
  - parsing
  - enrichissement
  - mapping SQL
- Permet des tests unitaires robustes.

### Tests natifs Node (`node:test`)
- Pas de dependance test supplementaire.
- Rapide pour un projet ETL/API simple.

## 4. Limites du projet

- Credentials actuellement en dur dans certains scripts/fichiers (a migrer vers `.env`).
- Pas d'authentification/autorisation API.
- Classification par mots-cles (heuristique), pas de modele NLP.
- ETL `mongoToMySQL.js` lit toute la collection ENRICHED (pas d'incremental strict).
- UI filtre/pagine cote client sur un grand lot (`pageSize=5000` cote fetch) -> scalable limitee pour tres gros volumes.
- Tests integration dependants de services externes (reseau/API/DB).

## 5. Code source (points clefs)

- UI dashboard: `app/page.tsx`
- Styles globaux: `app/globals.css`
- API liste/pagination: `app/api/items/route.js`
- API detail evenement: `app/api/items/[id]/route.js`
- API stats par ville: `app/api/stats/route.js`
- Connexion MySQL (pool): `lib/db.js`
- Moteur ETL testable: `lib/etl.js`
- ETL Mongo -> MySQL: `script/mongoToMySQL.js`

## 6. Tests

Voir le rapport detaille: `TESTS.md`.

### Commandes
Tous les tests:
```bash
npm test
```

Unitaires:
```bash
npm run test:unit
```

Integration:
```bash
npm run test:integration
```

### Activation des tests d'integration
Les tests integration sont conditionnels:
- `RUN_API_INTEGRATION=1` pour endpoint externe reel
- `RUN_SQL_INTEGRATION=1` pour requetes MySQL + mini pipeline

Exemple PowerShell:
```powershell
$env:RUN_API_INTEGRATION="1"
$env:RUN_SQL_INTEGRATION="1"
$env:MYSQL_HOST="127.0.0.1"
$env:MYSQL_PORT="3306"
$env:MYSQL_USER="root"
$env:MYSQL_PASSWORD=""
$env:MYSQL_DATABASE="cultural_events"
npm run test:integration
```

## 7. Schema SQL

Le schema SQL est fourni dans:
- `sql/schema.sql`

Il contient:
- table `locations`
- table `events`
- contraintes et index utiles (dont `UNIQUE(uid)` et `UNIQUE(city, country, address)`)

Import rapide:
```sql
USE cultural_events;
SOURCE sql/schema.sql;
```

## 8. Scripts utiles

- Dev:
  - `npm run dev`
  - `npm run dev:restart`
- ETL Mongo -> MySQL:
  - `npm run etl:mongo-to-mysql`
- Tests:
  - `npm test`
  - `npm run test:unit`
  - `npm run test:integration`
