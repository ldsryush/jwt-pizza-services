# JWT Pizza Production Data Population Status

## Current Situation

✅ **Service is running**: The ECS service is deployed and responding
- Root endpoint works: `https://pizza-service.pizzasanghwa.click`
- Returns: `{"message":"welcome to JWT Pizza","version":"20260306.222424"}`

❌ **Database connectivity issue**: All database-dependent endpoints timeout with 504 errors
- `/api/auth` - Timeout
- `/api/order/menu` - Timeout
- All other DB endpoints - Timeout

## Root Cause

The `jwt-pizza-service/src/config.js` file has hardcoded database settings pointing to **localhost**:

```javascript
db: {
  connection: {
    host: '127.0.0.1',  // ← This won't work in ECS container
    user: 'root',
    password: 'Sanghwa1204',
    database: 'pizza',
    connectTimeout: 60000,
  },
  listPerPage: 10,
}
```

In a containerized ECS environment, the service needs to connect to an **RDS database instance**, not localhost.

## Solutions

### Option 1: Update config.js to use environment variables (Recommended)

Modify `config.js` to read from environment variables:

```javascript
module.exports = {
  jwtSecret: process.env.JWT_SECRET || 'ILikePython',
  db: {
    connection: {
      host: process.env.DB_HOST || '127.0.0.1',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || 'Sanghwa1204',
      database: process.env.DB_NAME || 'pizza',
      connectTimeout: 60000,
    },
    listPerPage: 10,
  },
  factory: {
    url: 'https://pizza-factory.cs329.click',
    apiKey: 'fb3ff04b8f9d45e3b7ea2fef33d5b457',
  },
};
```

Then configure ECS task definition with environment variables:
- `DB_HOST`: Your RDS endpoint (e.g., `pizza-db.xxxxx.us-east-1.rds.amazonaws.com`)
- `DB_USER`: Database username
- `DB_PASSWORD`: Database password (use Secrets Manager)
- `DB_NAME`: `pizza`

### Option 2: Create an RDS instance if one doesn't exist

If you don't have an RDS MySQL database yet, you need to:
1. Create an RDS MySQL instance
2. Update security groups to allow ECS tasks to connect
3. Initialize the database schema
4. Update config.js (as in Option 1)

## Scripts Ready for Data Population

Once database connectivity is restored, these scripts are ready:

### PowerShell Script (Windows-native)
```powershell
powershell -ExecutionPolicy Bypass -File "c:\Users\ldsry\Desktop\cs 329\Pizza\jwt-pizza-service\populateData.ps1" -endpoint https://pizza-service.pizzasanghwa.click
```

### Verification Script
```powershell
powershell -ExecutionPolicy Bypass -File "c:\Users\ldsry\Desktop\cs 329\Pizza\jwt-pizza-service\verifyMenu.ps1" -endpoint https://pizza-service.pizzasanghwa.click
```

### Expected Output (Verification)
```
"A garden of delight"
"Spicy treat"
"Essential classic"
"A dry mouthed favorite"
"For those with a darker side"
```

## Next Steps

**You need to decide:**
1. Do you have an existing RDS database? If so, provide the endpoint.
2. Should I update config.js to use environment variables?
3. Do you need help creating an RDS instance?

Once the database connectivity is fixed, the data population can proceed immediately using the prepared scripts.
