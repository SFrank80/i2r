![I2R Web Application Image](/full_web_application_zoom_out1.JPG)

![I2R Multi-Cloud Architecture](/i2r_reference_architecture.png)

---

# 🌐 Incident-to-Resolution (I2R) Platform  
### Multi-Cloud (AWS | Azure) Deployment — SJA Investments LLC

> **Cloud-native incident management system** for utilities and emergency response teams — designed to deploy seamlessly on **AWS** or **Microsoft Azure** using identical Infrastructure-as-Code and CI/CD pipelines.

## 🧩 Tech Stack & Core Components
**Frontend:** React + TypeScript (Vite) | **Backend:** Node.js + Express | Prisma ORM  
**Database:** PostgreSQL | **Queue:** Redis (BullMQ for SLA jobs) | **IaC:** Terraform · CloudFormation · Bicep  
**CI/CD:** GitHub Actions | **ITSM Integration:** ServiceNow | **Analytics:** Power BI + CSV endpoints  
**GIS Mapping:** Leaflet + ArcGIS overlays | **AI Assist:** Incident classification & priority prediction  

---

## ☁️ Multi-Cloud Reference Architecture
The I2R application is **cloud-agnostic**, deployable to **AWS** or **Azure** with identical code and user experience.

### **AWS Stack**
- VPC (public/private subnets) with Security Groups  
- ALB → ECS Fargate (API & Web containers)  
- RDS for PostgreSQL (Multi-AZ)  
- ElastiCache Redis for BullMQ queues  
- S3 + CloudFront for static hosting  
- CloudWatch · GuardDuty · CloudTrail · KMS for monitoring & security  
- Optional Lambda + API Gateway for ServiceNow webhooks  

### **Azure Stack**
- VNet (private endpoints + NSG)  
- Azure Front Door → App Service / Container Apps  
- Azure Database for PostgreSQL (Flexible Server)  
- Azure Cache for Redis (BullMQ)  
- Blob Storage + CDN for static hosting  
- Azure Monitor · Defender for Cloud · Sentinel · Key Vault  
- Logic Apps / Functions for ServiceNow webhooks  

---

## 🚀 Features
- Create and track incidents with dynamic status & priority  
- Assign/unassign assets inline within the incident table  
- Real-time ArcGIS overlays on Leaflet map  
- CSV exports for Power BI (daily trend, by asset, SLA breaches)  
- BullMQ worker handles SLA violations & email notifications  
- ServiceNow integration for ITSM ticket synchronization  
- AI assistant auto-suggests incident type & priority  

---

## 📅 Sprint Summary (Completed)
- **Sprint 1:** Project foundation (React + Vite + Express + Prisma setup).  
- **Sprint 2:** Create-Incident form, validation, dark/light mode.  
- **Sprint 3:** Search filters, pagination, and map panel.  
- **Sprint 4:** Analytics CSV exports (daily/by-asset/SLA) for Power BI.  
- **Sprint 5:** SLA monitoring and notification jobs.  
- **Sprint 6:** UX polish, filter persistence, accessibility fixes.  
- **Sprint 7:** Full integrations — Power BI refresh, ServiceNow sync, AI assist, GIS overlays.

---

## 🔗 ServiceNow Integration
- Creates or updates ITSM tickets on incident changes.  
- Stores `sys_id` on record for synchronization.  
- Retries failed requests with exponential backoff.  
- Includes health check endpoint for monitoring.  

---

## 📊 Power BI Analytics
Endpoints:  
`/analytics/daily.csv` | `/analytics/by-asset.csv` | `/analytics/sla.csv`  
Feed **Power BI dashboards** for daily trends, asset activity, and SLA compliance.

---

## 🧠 AI Incident Assistant
- Classifies incident *type* and *priority* from text input.  
- Dispatchers can accept or override suggestions.  
- Logs feedback to improve future predictions.

---

## 🗺️ GIS Overlays
- ArcGIS layers for mains, hydrants, and valves.  
- Click-to-assign asset capability directly on the map.

---

# 🧱 Getting Started — Rebuild the Project from Scratch

---

## 1️⃣ Prerequisites
| Tool | Minimum Version | Purpose |
|------|------------------|----------|
| Node.js | 18.x+ | Web + API runtime |
| npm | 9.x+ | Package management |
| Docker Desktop | latest | Local Postgres + Redis |
| Git | any | Clone + versioning |
| PowerShell 7.x | recommended | Commands for Windows users |
| Power BI Desktop | optional | Analytics dashboard |
| ServiceNow Dev Instance | optional | ITSM integration |
| ArcGIS Account | optional | Map overlays |

---

## 2️⃣ Repository Layout
```
i2r/
├─ api/         # Express + Prisma backend
├─ web/         # React + TypeScript + Vite frontend
├─ infra/       # Terraform modules for AWS/Azure
├─ docker/      # Dockerfiles + compose templates
├─ seeds/       # Prisma seed scripts
└─ docs/        # Architecture diagrams & README assets
```

---

## 3️⃣ Environment Setup
Copy sample env files:
```bash
cp .env.example .env
cp api/.env.example api/.env
cp web/.env.example web/.env
```

Then edit these values.

### Root `.env`
```
NODE_ENV=development
```

### `api/.env`
```
PORT=<port#> Your default local port number that's not being used
DATABASE_URL=postgresql://i2r:<yourpassword@localhost>:<port#>/i2r
REDIS_URL=redis://localhost:<port#>
CORS_ORIGIN=http://localhost:<port#>
SN_ENABLED=false
```

### `web/.env`
```
VITE_API_BASE=http://localhost:<port#>
VITE_ARCGIS_TOKEN=
VITE_ARCGIS_LAYERS=
```

---

## 4️⃣ Install & Launch
```bash
npm install
docker compose -f docker-compose.dev.yml up -d
npm -w api run prisma:generate
npm -w api run prisma:migrate:dev
npm -w api run seed
```

### Run the stack
```bash
npm -w api run dev     # API → http://localhost:<port#>
npm -w web run dev     # Web → http://localhost:<port#>
```

### Verify
```bash
curl http://localhost:<port#>/health
curl http://localhost:<port#>/analytics/daily.csv
```

---

## 5️⃣ Power BI Setup
### Option A — CSV endpoints
Add web connectors:
- http://localhost:<port#>/analytics/daily.csv
- http://localhost:<port#>/analytics/by-asset.csv
- http://localhost:<port#>/analytics/sla.csv

### Option B — Direct DB
Connect to Postgres on `localhost:<port#>` (**user/password:** `i2r` / `i2r`).

---

## 6️⃣ Enabling Integrations

### ServiceNow
```
SN_ENABLED=true
SN_BASE_URL=https://<your-instance>.service-now.com
SN_USERNAME=<user>
SN_PASSWORD=<password>
SN_TABLE=incident
```
Restart the API — new incidents now create matching ServiceNow tickets.

### ArcGIS
Set your `VITE_ARCGIS_TOKEN` and `VITE_ARCGIS_LAYERS` URLs, then restart the web client.

### AI Assist
```
ML_URL=http://localhost:<port#>
```
Optional microservice that classifies incident Type/Priority.

---

## 7️⃣ Production Build
```bash
npm -w web run build
docker build -t i2r-api ./api
docker build -t i2r-web ./web
docker compose -f docker-compose.prod.yml up -d
```
Reverse proxy (Nginx or Traefik) handles TLS and routing.

---

## 8️⃣ Cloud Deployment
### AWS
Terraform modules:
- ECS Fargate, RDS, ElastiCache, S3, CloudFront
- KMS for secrets, CloudWatch for monitoring

### Azure
Terraform modules:
- App Service / Container Apps, Azure PostgreSQL, Redis Cache
- Key Vault for secrets, Front Door + CDN for static hosting

```bash
cd infra/aws   # or infra/azure
terraform init
terraform apply -var-file=env/dev.tfvars
```

---

## 9️⃣ CI/CD
GitHub Actions pipeline:

- Lint → Test → Build → Push Docker images to ECR/ACR  
- Terraform plan/apply with approval  
- Deploy ECS (AWS) or App Service (Azure)

### Secrets used:
```
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
AZURE_CREDENTIALS
AZURE_SUBSCRIPTION_ID
SN_BASE_URL
SN_USERNAME
SN_PASSWORD (optional)
```

---

## 🔍 Verification Checklist
✅ `localhost:<port#>/health` returns OK  
✅ Web app loads and can create incidents  
✅ CSV exports generate data  
✅ Power BI refresh succeeds  
✅ ServiceNow tickets sync (if enabled)  
✅ ArcGIS overlays visible on map  

---

## 🛠️ Troubleshooting
| Issue | Fix |
|-------|-----|
| Ports already in use | Kill stray Node/Vite/Docker containers |
| Blank CSV exports | Create new incidents first |
| Redis connection error | Ensure container is running; check `REDIS_URL` |
| Prisma errors | Regenerate + migrate (`npm -w api run prisma:migrate:dev`) |
| CORS error | Update `CORS_ORIGIN` in `api/.env` |
| ServiceNow 401 | Recheck credentials and `SN_TABLE` name |

---

## 🔒 Security & Compliance
- TLS via ALB (AWS) or Front Door (Azure)  
- KMS / Key Vault for at-rest encryption  
- RBAC enforced through IAM or Managed Identities  
- FedRAMP-aligned Terraform guardrails  
- Logging & audit: CloudTrail or Azure Activity Logs  

---

## 📁 Repo Structure Summary
```
i2r/
├── api/              # Node.js + Express backend
├── web/              # React + Vite frontend
├── infra/            # Terraform & IaC templates
├── seeds/            # Prisma seeds
├── docker/           # Compose files
├── docs/             # Diagrams & presentation
└── README.md
```

---

## 🧾 License
MIT © 2025 SJA Investments LLC  
All rights reserved for architecture and diagram assets.

---

**Contact:**  
👩🏽‍💻 **Shameeka Franklin** — Cloud DevSecOps Engineer  
📧 shameeka.franklin@gmail.com | 🌐 www.sjainvestmentsllc.com
