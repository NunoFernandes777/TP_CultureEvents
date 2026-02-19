# Rapport de Tests — ETL & API

## 1. Objectif
Valider la qualité de la chaîne de traitement des données demandée à l'étape 7:
- Tests unitaires (obligatoires):
  - parsing des données
  - enrichissement
  - normalisation
  - mapping ETL
- Tests d'intégration (obligatoires):
  - appel réel d'un endpoint API
  - requête SQL
  - pipeline complet sur un petit jeu de données

## 2. Périmètre
Composants testés:
- `lib/etl.js`
- API distante OpenDataSoft (test d'intégration optionnel)
- MySQL (test d'intégration optionnel)

Fichiers de tests:
- `tests/unit/etl.test.js`
- `tests/integration/pipeline.integration.test.js`

## 3. Outils et exécution
Runner utilisé:
- `node:test` (natif Node.js)

Scripts NPM:
- `npm test`
- `npm run test:unit`
- `npm run test:integration`

## 4. Détails des tests unitaires
Fichier: `tests/unit/etl.test.js`

### 4.1 Normalisation
- Fonction testée: `normalizeText`
- Vérifie:
  - passage en minuscules
  - suppression des accents
- Critère de succès: sortie normalisée attendue

### 4.2 Parsing des données
- Fonction testée: `parseRawPayload`
- Vérifie:
  - extraction des champs utiles depuis `payload.records[].fields`
  - structure de sortie stable
- Critère de succès: objet parsé conforme

### 4.3 Enrichissement
- Fonction testée: `enrichParsedRecord`
- Vérifie:
  - cas invalide (`title_fr` ou `location_city` manquant) -> `status: "failed"`
  - cas valide -> `status: "success"` et catégorisation
- Critère de succès: statut + contenu enrichi corrects

### 4.4 Mapping ETL
- Fonction testée: `mapEnrichedToSqlRow`
- Vérifie:
  - mapping vers structure SQL-ready
  - valeurs par défaut (`Unknown country`, `""`, etc.)
- Critère de succès: champs mappés attendus

## 5. Détails des tests d'intégration
Fichier: `tests/integration/pipeline.integration.test.js`

### 5.1 Appel réel d'un endpoint API
- Test: récupération de données depuis:
  - `https://public.opendatasoft.com/api/records/1.0/search/?dataset=evenements-publics-openagenda&rows=5`
- Vérifie:
  - statut HTTP OK
  - présence de `records`

Activation:
- Variable requise: `RUN_API_INTEGRATION=1`

### 5.2 Requête SQL
- Test: exécution d'une requête simple (`SELECT 1 AS ok`) sur MySQL
- Vérifie:
  - connexion DB valide
  - exécution SQL valide

Activation:
- Variable requise: `RUN_SQL_INTEGRATION=1`
- Paramètres DB via variables d'environnement:
  - `MYSQL_HOST`
  - `MYSQL_PORT`
  - `MYSQL_USER`
  - `MYSQL_PASSWORD`
  - `MYSQL_DATABASE`

### 5.3 Pipeline complet (petit dataset)
- Étapes testées:
  - parse -> enrich -> map ETL -> insert SQL
- Jeu de données:
  - 2 records (1 valide, 1 invalide)
- Vérifie:
  - création en tables temporaires
  - insertion d'un seul record valide
  - comptages SQL attendus

Activation:
- Variable requise: `RUN_SQL_INTEGRATION=1`

## 6. Commandes de lancement
### 6.1 Tous les tests
```bash
npm test
```

### 6.2 Unitaires uniquement
```bash
npm run test:unit
```

### 6.3 Intégration API
```powershell
$env:RUN_API_INTEGRATION="1"
npm run test:integration
```

### 6.4 Intégration SQL + pipeline complet
```powershell
$env:RUN_SQL_INTEGRATION="1"
$env:MYSQL_HOST="127.0.0.1"
$env:MYSQL_PORT="3306"
$env:MYSQL_USER="root"
$env:MYSQL_PASSWORD=""
$env:MYSQL_DATABASE="cultural_events"
npm run test:integration
```

## 7. Résultat observé
Exécution `npm test`:
- Tests unitaires: PASS
- Tests d'intégration: présents et SKIP par défaut (non activés sans variables d'environnement)

Résumé:
- `pass: 5`
- `fail: 0`
- `skip: 3`

## 8. Critères de validation (étape 7)
- Parsing des données: couvert
- Enrichissement: couvert
- Normalisation: couverte
- Mapping ETL: couvert
- Endpoint API réel: couvert (mode intégration activable)
- Requête SQL: couverte (mode intégration activable)
- Pipeline complet petit dataset: couvert (mode intégration activable)

## 9. Limites et recommandations
- Les tests d'intégration dépendent de services externes (réseau/API/MySQL).
- Pour CI/CD:
  - garder les intégrations conditionnelles
  - ajouter un job dédié avec variables d'environnement provisionnées.
