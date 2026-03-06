# JWT Pizza Service - Deployment Steps for Database Connectivity

## What I've Done ✅

1. **Updated `src/config.js`** to use environment variables instead of hardcoded values:
   - `DB_HOST` (instead of hardcoded 127.0.0.1)
   - `DB_USER` (instead of hardcoded root)
   - `DB_PASSWORD` (instead of hardcoded password)
   - `DB_NAME` (instead of hardcoded pizza)

## Env Vars Confirmed From `src/config.js`

The service currently reads these exact names:

```
JWT_SECRET
DB_HOST
DB_USER
DB_PASSWORD
DB_NAME
FACTORY_URL
FACTORY_API_KEY
```

For database connectivity, the required ones are:

```
DB_HOST=jwt-pizza-service-db.c0bmqqww0yir.us-east-1.rds.amazonaws.com
DB_USER=admin
DB_PASSWORD=<your-db-password>
DB_NAME=pizza
```

## What You Need to Do 🔧

### Step 1: Commit and Push the Config Change

```bash
cd jwt-pizza-service
git add src/config.js
git commit -m "Update config to use environment variables for database connection"
git push origin main
```

This will trigger your GitHub Actions CI/CD pipeline.

### Step 2: Update ECS Task Definition with Environment Variables

You need to add these environment variables to your ECS task definition:

**Required Environment Variables:**
```
DB_HOST=jwt-pizza-service-db.c0bmqqww0yir.us-east-1.rds.amazonaws.com
DB_USER=admin
DB_PASSWORD=<your-db-password>
DB_NAME=pizza
```

**How to update ECS task definition:**

Option A - Via AWS Console:
1. Go to ECS → Task Definitions → jwt-pizza-service
2. Create new revision
3. Add environment variables in the container definition
4. Update the service to use the new task definition

Option B - Via AWS CLI (recommended, reproducible):
```bash
# 1) Get current task definition and strip read-only fields
aws ecs describe-task-definition \
   --task-definition jwt-pizza-service \
   --query 'taskDefinition' > task-def.json

cat task-def.json \
   | jq 'del(.taskDefinitionArn,.revision,.status,.requiresAttributes,.compatibilities,.registeredAt,.registeredBy)
            | .containerDefinitions[0].environment += [
                  {"name":"DB_HOST","value":"jwt-pizza-service-db.c0bmqqww0yir.us-east-1.rds.amazonaws.com"},
                  {"name":"DB_USER","value":"admin"},
                  {"name":"DB_PASSWORD","value":"your-password-here"},
                  {"name":"DB_NAME","value":"pizza"}
               ]' > task-def-updated.json

# 2) Register new revision
aws ecs register-task-definition --cli-input-json file://task-def-updated.json

# 3) Force service to redeploy on the latest revision
aws ecs update-service \
   --cluster jwt-pizza-service \
   --service jwt-pizza-service \
   --force-new-deployment
```

### Step 3: Wait for Deployment to Complete

Monitor the deployment:
```bash
aws ecs describe-services --cluster jwt-pizza-service --services jwt-pizza-service --query "services[0].deployments"
```

Wait until:
- Running count = Desired count
- Only one deployment is listed
- Rollout state = COMPLETED

### Step 4: Verify Database Connectivity

Test if the service can now connect to the database:
```bash
curl https://pizza-service.pizzasanghwa.click/api/order/menu
```

Expected: `[]` (empty array) or existing menu items
If you still get 504 timeout, there's a connectivity issue.

### Step 5: Populate Production Data

Once the database connectivity is working, run:

```powershell
powershell -ExecutionPolicy Bypass -File "c:\Users\ldsry\Desktop\cs 329\Pizza\jwt-pizza-service\populateData.ps1" -endpoint https://pizza-service.pizzasanghwa.click
```

### Step 6: Verify Menu Descriptions

```powershell
powershell -ExecutionPolicy Bypass -File "c:\Users\ldsry\Desktop\cs 329\Pizza\jwt-pizza-service\verifyMenu.ps1" -endpoint https://pizza-service.pizzasanghwa.click
```

Expected output:
```
"A garden of delight"
"Spicy treat"
"Essential classic"
"A dry mouthed favorite"
"For those with a darker side"
```

## Current Blocker 🚫

**Database connectivity is not working yet.**
- The config.js file has been updated to use environment variables
- But the ECS task may not have those environment variables configured
- So it's still trying to connect to localhost (default fallback in config.js)
- This causes 504 Gateway Timeout errors

**Data population cannot proceed until Steps 1-4 above are completed.**

## Summary

The code changes are ready. You need to:
1. Push the config.js changes
2. Update ECS task definition with environment variables
3. Wait for deployment
4. Then run the data population scripts

Let me know once the service can successfully query the database, and I can help with the data population!
