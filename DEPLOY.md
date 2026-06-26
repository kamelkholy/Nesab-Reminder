# Azure Deployment Guide for Nesab Reminder

## Current Deployment

- **App URL**: https://nesab-reminder.azurewebsites.net
- **Resource Group**: `nesab-reminder-rg`
- **Location**: Central US
- **Runtime**: Node 22 LTS (Linux)
- **SKU**: B1
- **Database**: Azure Cosmos DB for MongoDB
- **Build**: Oryx (runs `postinstall` → installs server + client deps, then `build`)

## Prerequisites

1. **Install Azure CLI**: https://learn.microsoft.com/en-us/cli/azure/install-azure-cli-windows
   ```powershell
   winget install -e --id Microsoft.AzureCLI
   ```

2. **Login to Azure**:
   ```powershell
   az login
   ```

## Deploy Changes

From the project root, commit your changes then run:

```powershell
az webapp up --name nesab-reminder --resource-group nesab-reminder-rg --runtime "NODE:22-lts" --sku B1
```

This uploads the source, Oryx builds it on Azure (`postinstall` installs subdeps, `npm run build` compiles server + client), and restarts the app.

### Verify

```powershell
# Open in browser
az webapp browse --name nesab-reminder --resource-group nesab-reminder-rg

# Stream logs
az webapp log tail --name nesab-reminder --resource-group nesab-reminder-rg
```

## First-Time Setup

If setting up from scratch, run the following steps.

### 1. Create Azure Resources

```powershell
$RESOURCE_GROUP = "nesab-reminder-rg"
$APP_NAME = "nesab-reminder"
$LOCATION = "centralus"

# Create resource group
az group create --name $RESOURCE_GROUP --location $LOCATION

# Create Cosmos DB for MongoDB (free tier)
az cosmosdb create `
  --name "${APP_NAME}-db" `
  --resource-group $RESOURCE_GROUP `
  --kind MongoDB `
  --server-version "7.0" `
  --enable-free-tier true

# Get connection string
$COSMOS_CONNECTION = az cosmosdb keys list `
  --name "${APP_NAME}-db" `
  --resource-group $RESOURCE_GROUP `
  --type connection-strings `
  --query "connectionStrings[0].connectionString" -o tsv
```

### 2. Configure App Settings

```powershell
az webapp config appsettings set `
  --name $APP_NAME `
  --resource-group $RESOURCE_GROUP `
  --settings `
    MONGODB_URI="$COSMOS_CONNECTION" `
    AUTH_USERNAME="admin" `
    AUTH_PASSWORD="<choose-a-strong-password>" `
    JWT_SECRET="<generate-a-random-64-char-string>" `
    SCM_DO_BUILD_DURING_DEPLOYMENT="true"
```

### 3. Deploy

```powershell
az webapp up `
  --name $APP_NAME `
  --resource-group $RESOURCE_GROUP `
  --runtime "NODE:22-lts" `
  --sku B1
```

This creates the App Service Plan and Web App if they don't exist, then deploys.

## Optional: Azure Communication Services (email reminders)

```powershell
az communication create `
  --name "${APP_NAME}-acs" `
  --resource-group $RESOURCE_GROUP `
  --data-location "United States"

# Get connection string from Azure Portal > ACS resource > Keys, then:
az webapp config appsettings set `
  --name $APP_NAME `
  --resource-group $RESOURCE_GROUP `
  --settings `
    ACS_CONNECTION_STRING="<your-acs-connection-string>" `
    ACS_SENDER_ADDRESS="<your-acs-sender-email>" `
    EMAIL_TO="<your-email>"
```

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `MONGODB_URI` | Yes | Cosmos DB / MongoDB connection string |
| `AUTH_USERNAME` | Yes | Login username |
| `AUTH_PASSWORD` | Yes | Login password |
| `JWT_SECRET` | Yes | Secret for JWT signing |
| `SCM_DO_BUILD_DURING_DEPLOYMENT` | Yes | Must be `true` for Oryx build |
| `ACS_CONNECTION_STRING` | No | Azure Communication Services (email) |
| `ACS_SENDER_ADDRESS` | No | Sender email address for ACS |
| `EMAIL_TO` | No | Recipient email for Zakat reminders |

## Cleanup

```powershell
az group delete --name nesab-reminder-rg --yes --no-wait
```
