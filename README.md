![Full Web Application Image](/full_web_application_zoom_out1.JPG)

![I2R Multi-Cloud Architecture](/i2r_reference_architecture.png)

# 🌐 Incident-to-Resolution (I2R) Platform  

## Multi-Cloud (AWS | Azure) Deployment — SJA Investments LLC

> **Cloud-native incident management system** for utilities and emergency response teams — designed to deploy seamlessly on **AWS** or **Microsoft Azure** using identical Infrastructure-as-Code and CI/CD pipelines.

---
## 🧩 Tech Stack & Core Components
**Frontend:** React + TypeScript (Vite) | **Backend:** Node.js + Express | Prisma ORM  
**Database:** PostgreSQL | **Queue:** Redis (BullMQ for SLA jobs) | **IaC:** Terraform · CloudFormation · Bicep  
**CI/CD:** GitHub Actions | **ITSM Integration:** ServiceNow | **Analytics:** Power BI + CSV endpoints  
**GIS Mapping:** Leaflet + ArcGIS overlays | **AI Assist:** Incident classification & priority prediction  

---

## ☁️ Multi-Cloud Reference Architecture
The I2R application is **cloud-agnostic**, capable of deploying to **AWS** or **Azure** with equal functionality.  
A visual architecture diagram is shown above.  Key highlights:

### **AWS Stack**
- VPC (public + private subnets) with Security Groups  
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

## 🚀 Major Features
- Create and track incidents with dynamic status & priority  
- Assign/unassign assets inline within the incident table  
- Real-time ArcGIS overlays on Leaflet map  
- CSV exports for Power BI (daily trend, by asset, SLA breaches)  
- BullMQ worker handles SLA violations & email notifications  
- ServiceNow integration for ITSM ticket synchronization  
- AI assistant auto-suggests incident type & priority  

---

## 📅 Sprint History (Completed)

### **Sprint 1 — Foundation**
- Initialized monorepo (Vite React web, Express API, Postgres DB via Prisma).  
- Established base schema for Incidents and Assets.

### **Sprint 2 — Incident Form & UI Theming**
- Created “Create Incident” form with validation and dark/light theme.  
- Implemented RBAC and basic API CRUD routes.

### **Sprint 3 — Search & Map**
- Added search filters, pagination, and Leaflet map integration.  
- Deployed local stack (API 5050 / Web 5173 / DB 8080 Adminer).

### **Sprint 4 — Analytics Exports**
- Built daily, by-asset, and SLA CSV endpoints.  
- Connected Power BI to refresh data via web connectors.

### **Sprint 5 — SLA Monitoring**
- Configured BullMQ worker jobs for SLA breaches and email alerts.

### **Sprint 6 — UX & Persistence**
- Persisted filters in localStorage; refined layout & error handling.  
- Added dark/light toggle and data validation via Zod.

### **Sprint 7 — Integrations & Final Delivery**
- Logged events on create/update/assign/export.  
- Integrated ServiceNow ticket sync (bi-directional with retry).  
- Delivered AI classifier and ArcGIS layer overlays.  
- Verified Power BI dashboards with live data refresh.

---

## 🔗 ServiceNow Integration
- On create → I2R opens a new ServiceNow ticket and stores its `sys_id`.  
- On update → ServiceNow ticket is patched automatically.  
- Retries with exponential backoff for failed requests.  
- Health endpoint verifies ServiceNow API availability.

---

## 📊 Analytics & Power BI
Endpoints:  
`/analytics/daily.csv` | `/analytics/by-asset.csv` | `/analytics/sla.csv`  
Each feeds a Power BI dashboard for daily trend, top assets, and SLA breaches.

---

## 🤖 AI Incident Assistant
- ML microservice analyzes incident title & description → suggests **Type** and **Priority**.  
- Dispatchers can accept or override and feedback is stored for continuous learning.

---

## 🗺️ GIS Overlays
- ArcGIS map layers for mains, hydrants, and valves with click-to-assign asset feature.  
- Provides a geospatial view of active and resolved incidents.

---

## ⚙️ Local Development Quick Start
```bash
# Start API server
npm -w api run dev

# Start web frontend
npm -w web run dev
