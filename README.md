# Cloud Inventory API

A small REST API for tracking equipment in a student organization. This Cloud Computing Week 12 project follows Track A (Cloud VM). The planned deployment runs Express on Amazon EC2 and stores one `items` entity in Amazon RDS for MySQL.

## Run locally

Use Node.js 22 LTS and npm. The project was tested with Node.js 22.15.0 and npm 10.9.2. From the repository root, install the locked dependencies and create your local configuration.

```bash
npm ci
cp .env.example .env
```

In PowerShell, use `Copy-Item .env.example .env`. The defaults bind the API to `127.0.0.1:3000`. Leave `DB_SSL_CA` empty when your local database uses an unencrypted loopback connection.

For CRUD with a real database, use an available MySQL 8.0.16 or later instance. As a database administrator, run `db/schema.sql` to create `inventory_db.items`. Grant the application user `SELECT`, `INSERT`, `UPDATE`, and `DELETE` on that table. Set the MySQL host, port, user, and password privately in `.env`. The schema command prompts for the administrator password.

```bash
mysql --host 127.0.0.1 --port 3306 --user YOUR_MYSQL_ADMIN --password --execute "SOURCE db/schema.sql"
npm start
```

Open `http://127.0.0.1:3000/docs` to try the API, or run these commands in a second terminal. The server can start while MySQL is unavailable. In that case, liveness and Swagger are still available and database health returns 503. On Windows, use `curl.exe` if `curl` resolves to a PowerShell alias.

```bash
curl -i http://127.0.0.1:3000/health
curl -i http://127.0.0.1:3000/health/db
```

## API

| Method | Path | Success |
| --- | --- | --- |
| POST | `/items` | 201, item ID and editable fields |
| GET | `/items` | 200, item array in ID order with database timestamps |
| PUT | `/items/{id}` | 200, item ID and replacement fields |
| DELETE | `/items/{id}` | 204, empty body |
| GET | `/health` | 200, API liveness |
| GET | `/health/db` | 200, MySQL connectivity |

Send JSON with `name`, `category`, `quantity`, and `item_condition` for both POST and PUT. Use `good`, `damaged`, or `maintenance` for the condition. Invalid requests return 400. Updating or deleting a missing item returns 404. See the [OpenAPI definition](docs/openapi.yaml) for payloads and status codes.

## Tests

```bash
npm test
```

The automated test suite exercises the Express application through Supertest with an injected database substitute. It requires neither MySQL nor an AWS account.

With a running API and initialized MySQL database, run the cURL smoke test in Bash (Git Bash on Windows). It makes both health checks, creates one test item, checks that the list contains it, updates it, and deletes it.

```bash
bash scripts/smoke-test.sh http://127.0.0.1:3000
```

## Deployment

- [Planned AWS architecture](docs/architecture.png)
- [EC2 and RDS deployment plan](docs/deployment-plan.md)
