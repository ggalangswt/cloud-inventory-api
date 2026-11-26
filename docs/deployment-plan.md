# AWS Learner Lab deployment guide

The Cloud Inventory API was deployed and tested on 26 November 2026 in the AWS Academy Cloud Foundations Sandbox. The deployment followed Track A and used an Express API on EC2 with a private, Single-AZ RDS for MySQL instance. The lab session has ended.

[Final architecture diagram](architecture.png) · [Editable Draw.io source](architecture.drawio)

## Week 12 deployment configuration

The deployment used `us-east-1` (N. Virginia). The Lab VPC used `10.0.0.0/16` with DNS resolution and DNS hostnames enabled.

| Subnet | CIDR | Availability Zone | Workload and routing |
| --- | --- | --- | --- |
| Public | `10.0.1.0/24` | `us-east-1a` | EC2 with a public IPv4 address. The public route table sent `0.0.0.0/0` to the lab internet gateway. |
| Private DB A | `10.0.2.0/24` | `us-east-1a` | Active Single-AZ RDS instance. The main route table provided local VPC routing only. |
| Private DB B | `10.0.3.0/24` | `us-east-1b` | Second member of the DB subnet group. Local VPC routing only. |

Both private subnets belonged to `inventory-db-subnet-group`. The RDS instance ran in `us-east-1a`. The deployment used no NAT gateway. The lab VPC's existing S3 gateway endpoint was unused by the application.

| Component | Configuration used in the lab |
| --- | --- |
| EC2 | `inventory-api-server`, `t3.micro`, Amazon Linux 2023 x86_64, 8 GiB gp2, IMDSv2 required |
| EC2 security group | `inventory-ec2-sg`, inbound TCP 3000 from the student's public IPv4 `/32` only, default outbound, no inbound SSH |
| EC2 management | Browser-based Systems Manager Session Manager as `ssm-user`, using the existing `LabRole` through `LabInstanceProfile` and temporary Learner Lab permissions |
| RDS | `inventory-mysql`, MySQL Community 8.4.11, `db.t3.micro`, Single-AZ, public access disabled |
| RDS storage | 20 GiB gp2, as reported by the student |
| RDS security group | `inventory-rds-sg`, inbound TCP 3306 from `inventory-ec2-sg` only |
| Runtime on EC2 | Node.js 22.23.5, npm 10.9.9, Git 2.50.1, MariaDB client 10.5.29 |

The API accepted HTTP on port 3000 from the student's authorized address for the lab demo. EC2 connected to the RDS DNS endpoint on port 3306 over TLS. The instance profile supported Systems Manager access. MySQL authentication used a dedicated database user.

## Reproduce the deployment in an authorized lab

Confirm the lab's allowed region, instance types, IAM profile, spending limits, and cleanup rules before creating resources. Use one VPC with the public and private routing shown above. Configure the EC2 and RDS security groups before testing. Keep the RDS subnet group across two Availability Zones and the database instance Single-AZ with public access disabled.

### 1. Install the runtime on EC2

Open a browser-based Session Manager terminal. The following commands were used on Amazon Linux 2023.

```bash
sudo dnf install -y nodejs22 nodejs22-npm git mariadb105
cd "$HOME"
git clone https://github.com/ggalangswt/cloud-inventory-api.git
cd cloud-inventory-api
npm ci
npm test
```

### 2. Verify TLS and initialize MySQL

Download the RDS CA bundle for the deployment region. From the repository root, open the MariaDB client with the RDS DNS endpoint substituted for `RDS_ENDPOINT`. The client prompts for the admin password.

```bash
mkdir -p "$HOME/certs"
curl -fL https://truststore.pki.rds.amazonaws.com/us-east-1/us-east-1-bundle.pem \
  -o "$HOME/certs/rds-ca-bundle.pem"

MYSQL_HISTFILE=/dev/null mysql -h RDS_ENDPOINT -P 3306 -u admin -p \
  --ssl-ca="$HOME/certs/rds-ca-bundle.pem" --ssl-verify-server-cert --connect-timeout=10
```

In the SQL client, check the connection and initialize the schema.

```sql
SELECT VERSION();
SELECT 1 AS connection_test;
SHOW SESSION STATUS LIKE 'Ssl_version';
SHOW SESSION STATUS LIKE 'Ssl_cipher';
SOURCE db/schema.sql
SHOW TABLES;
DESCRIBE items;
SELECT * FROM items;
```

Create the dedicated application user once. Save the generated password privately and grant the user access to the inventory table.

```sql
CREATE USER 'inventory_app'@'%' IDENTIFIED BY RANDOM PASSWORD REQUIRE SSL;
GRANT SELECT, INSERT, UPDATE, DELETE ON inventory_db.items TO 'inventory_app'@'%';
```

Reconnect over TLS as `inventory_app` using the same connection flags. Use `SELECT CURRENT_USER()`, `SHOW GRANTS`, and a `SELECT` on `inventory_db.items` to verify the account and access.

### 3. Configure and start the API

In a fresh checkout, create `.env` from `.env.example` and set its permissions to `600`. Fill in the values privately using the deployed RDS DNS endpoint, the generated application password, and the local CA path.

```dotenv
HOST=0.0.0.0
PORT=3000
DB_HOST=RDS_ENDPOINT
DB_PORT=3306
DB_NAME=inventory_db
DB_USER=inventory_app
DB_PASSWORD=YOUR_APPLICATION_PASSWORD
DB_SSL_CA=/home/ssm-user/certs/rds-ca-bundle.pem
```

Run `npm start` in the foreground in Session Manager. Open a second session for the checks below.

### 4. Verify the API and collect evidence

```bash
curl -i http://127.0.0.1:3000/health
curl -i http://127.0.0.1:3000/health/db
bash scripts/smoke-test.sh http://127.0.0.1:3000
```

Check Swagger UI at `http://EC2_PUBLIC_IPV4:3000/docs` from the address allowed by the EC2 security group. If database health returns `503`, check the RDS DNS endpoint, application login, TLS settings, and the security group source. Capture networking, access, schema, and test evidence privately.

## Week 12 verification results

These results were recorded during the original lab session.

- On EC2, `npm ci` installed 100 packages and reported 0 vulnerabilities at the time. All 18 automated tests passed with a database mock.
- The MySQL client returned version `8.4.11` and `1` for `SELECT 1 AS connection_test`. Certificate verification succeeded and the session negotiated TLS 1.3 with `TLS_AES_256_GCM_SHA384`.
- The schema created the seven-column `items` table in the existing database. The table was initially empty. The client emitted one warning whose text was not captured. The application user's login, grants, and read access were verified.
- After the RDS hostname and application password in `.env` were corrected, both browser health endpoints returned `{"status":"ok"}`. Swagger displayed all six endpoints. The API ran as a foreground Session Manager process.
- The smoke test ran from EC2 against the API connected to RDS and returned the following output.

```text
$ bash scripts/smoke-test.sh http://127.0.0.1:3000
GET /health -> 200
GET /health/db -> 200
POST /items -> 201
GET /items -> 200
PUT /items/1 -> 200
DELETE /items/1 -> 204
Smoke test passed.
```

## Lab shutdown

After evidence collection, the student chose **End Lab** and the console reported resources terminating. Final deletion was not independently verified. For future runs, verify resource state and any ongoing charges according to the lab's cleanup rules.

## Proposed improvements

The final diagram labels four future improvements as proposed. An Application Load Balancer could terminate HTTPS and distribute traffic, EC2 Auto Scaling could adjust capacity, CloudWatch could collect application logs and monitoring data, and Secrets Manager could store database credentials.
