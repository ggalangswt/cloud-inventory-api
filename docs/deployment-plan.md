# AWS Learner Lab deployment plan

The planned Track A deployment runs the Express API on EC2 and uses a Single-AZ RDS for MySQL instance. Use the [planned architecture diagram](architecture.png) during the lab review.

## Review the lab before provisioning

Confirm the remaining lab credits, permitted region and resource types, available IAM roles, access method, VPC and subnets, and estimated cost. Choose the EC2 OS and a supported Node.js 22 patch release together. Choose a supported MySQL version that enforces the schema's check constraints. Review backup, storage, and cleanup requirements with the student.

## Configure the network and instances

1. Use one permitted VPC. If direct access is allowed, put EC2 in a public subnet with a public IPv4 address and a route through an internet gateway. Allow TCP 3000 from the student's current public IP as a `/32`. Allow TCP 22 from the same source only if SSH is the chosen access method.
2. Use a DB subnet group covering suitable private subnets in at least two Availability Zones. Create the RDS instance as Single-AZ with public access disabled. Set its security group to allow TCP 3306 from the EC2 security group.
3. Use the existing approved Learner Lab permissions for AWS operations and any permitted instance role. MySQL authentication uses a separate database account.

See the AWS documentation for [VPC and DB subnet groups](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_VPC.WorkingWithRDSInstanceinaVPC.html) and [EC2-to-RDS VPC scenarios](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_VPC.Scenarios.html).

## Set up the database and API on EC2

1. Use the approved access method to connect to EC2. Transfer the tracked project files using an approved method. Use GitHub only after repository publication is authorized.
2. Install Node.js 22, npm, Bash, cURL, and a compatible MySQL command-line client using the instructions for the selected EC2 OS. Verify `node --version` and `npm --version`, then run `npm ci` in the project directory.
3. Obtain the trusted CA bundle for the selected RDS region and certificate. From EC2, verify DNS, TLS hostname validation, and MySQL login using the RDS endpoint. Open the MySQL client as the database administrator from the project root. The client prompts for the password.

   ```bash
   mysql --host RDS_ENDPOINT --port 3306 --user DB_ADMIN --password \
     --ssl-mode=VERIFY_IDENTITY --ssl-ca=/path/to/rds-ca-bundle.pem
   ```

   In the MySQL client, check the connection and initialize the schema.

   ```sql
   SELECT 1;
   SOURCE db/schema.sql
   ```

   [AWS MySQL TLS client instructions](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_ConnectToInstanceSSL.CLI.html) and [RDS CA bundles](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/UsingWithRDS.SSL.html) cover certificate configuration.

4. Create a dedicated MySQL app user with only `SELECT`, `INSERT`, `UPDATE`, and `DELETE` on `inventory_db.items`. Use a private MySQL session without persistent command history when entering account secrets.
5. Create `.env` on EC2 with restricted permissions. Set `HOST=0.0.0.0` for authorized direct access, or keep the loopback default when using an approved tunnel. Set `PORT=3000`, `DB_HOST` to the RDS DNS endpoint, `DB_PORT=3306`, `DB_NAME=inventory_db`, the dedicated `DB_USER` and `DB_PASSWORD`, and `DB_SSL_CA` to the CA bundle path. Start the API with `npm start`.

## Verify and collect evidence

- Run `curl -i http://127.0.0.1:3000/health` and `curl -i http://127.0.0.1:3000/health/db` from EC2. Both should return 200. If database health returns 503, check the RDS instance state, endpoint, security group source, MySQL credentials, and TLS configuration.
- Run `bash scripts/smoke-test.sh http://127.0.0.1:3000` on EC2. Expect the two health checks to return 200 and the CRUD operations to return 201, 200, 200, and 204.
- Open Swagger at `/docs` from an authorized client. Capture the actual EC2 and RDS settings, VPC and subnet setup, security groups, EC2 access, MySQL connectivity, and API test output with secrets excluded.
- Record the deployed settings and revise the diagram for the final report. Review lab resource state, ongoing charges, and cleanup with the student after collecting evidence.
