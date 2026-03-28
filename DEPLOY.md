# Azure Deployment Guide for Nesab Reminder

## Prerequisites

1. **Install Azure CLI**: https://learn.microsoft.com/en-us/cli/azure/install-azure-cli-windows
   ```powershell
   winget install -e --id Microsoft.AzureCLI
   ```

2. **Login to Azure**:
   ```powershell
   az login
   ```

## Step 1: Create Azure Resources

Run these commands (replace `<your-resource-group>` and `<your-app-name>` with your choices):

```powershell
# Set variables
$RESOURCE_GROUP = "nesab-reminder-rg"
$APP_NAME = "nesab-reminder"         # must be globally unique
$LOCATION = "eastus"                 # or your preferred region

# Create resource group
az group create --name $RESOURCE_GROUP --location $LOCATION

# Create Azure Cosmos DB for MongoDB (free tier available)
az cosmosdb create `
  --name "${APP_NAME}-db" `
  --resource-group $RESOURCE_GROUP `
  --kind MongoDB `
  --server-version "7.0" `
  --enable-free-tier true

# Get the connection string
$COSMOS_CONNECTION = az cosmosdb keys list `
  --name "${APP_NAME}-db" `
  --resource-group $RESOURCE_GROUP `
  --type connection-strings `
  --query "connectionStrings[0].connectionString" -o tsv

# Create App Service Plan (B1 is the cheapest paid tier, F1 is free)
az appservice plan create `
  --name "${APP_NAME}-plan" `
  --resource-group $RESOURCE_GROUP `
  --sku B1 `
  --is-linux

# Create Web App
az webapp create `
  --name $APP_NAME `
  --resource-group $RESOURCE_GROUP `
  --plan "${APP_NAME}-plan" `
  --runtime "NODE:18-lts"
```

## Step 2: Configure App Settings

```powershell
az webapp config appsettings set `
  --name $APP_NAME `
  --resource-group $RESOURCE_GROUP `
  --settings `
    MONGODB_URI="$COSMOS_CONNECTION" `
    AUTH_USERNAME="admin" `
    AUTH_PASSWORD="<choose-a-strong-password>" `
    JWT_SECRET="<generate-a-random-64-char-string>" `
    SCM_DO_BUILD_DURING_DEPLOYMENT="true" `
    WEBSITE_NODE_DEFAULT_VERSION="~18"

# Set startup command
az webapp config set `
  --name $APP_NAME `
  --resource-group $RESOURCE_GROUP `
  --startup-file "npm start"
```

## Step 3: Build and Deploy

```powershell
# From the project root directory
npm run build

# Deploy using zip deploy
az webapp deploy `
  --name $APP_NAME `
  --resource-group $RESOURCE_GROUP `
  --src-path "." `
  --type zip
```

**Alternative: Deploy with Git (recommended)**

```powershell
# Configure local Git deployment
az webapp deployment source config-local-git `
  --name $APP_NAME `
  --resource-group $RESOURCE_GROUP

# Get the Git remote URL
$GIT_URL = az webapp deployment source config-local-git `
  --name $APP_NAME `
  --resource-group $RESOURCE_GROUP `
  --query url -o tsv

# Add Azure as a remote and push
git remote add azure $GIT_URL
git push azure main
```

**Alternative: Deploy from current folder (simplest)**

```powershell
# Build first
npm run build

# Deploy using az webapp up (auto-creates resources if needed)
az webapp up `
  --name $APP_NAME `
  --resource-group $RESOURCE_GROUP `
  --runtime "NODE:18-lts" `
  --sku B1
```

## Step 4: Verify Deployment

```powershell
# Open the app in browser
az webapp browse --name $APP_NAME --resource-group $RESOURCE_GROUP

# Check logs if something goes wrong
az webapp log tail --name $APP_NAME --resource-group $RESOURCE_GROUP
```

## Optional: Set up Azure Communication Services (for email reminders)

```powershell
# Create ACS resource
az communication create `
  --name "${APP_NAME}-acs" `
  --resource-group $RESOURCE_GROUP `
  --data-location "United States"

# Get the connection string from Azure Portal > ACS resource > Keys
# Then set in app settings:
az webapp config appsettings set `
  --name $APP_NAME `
  --resource-group $RESOURCE_GROUP `
  --settings `
    ACS_CONNECTION_STRING="<your-acs-connection-string>" `
    ACS_SENDER_ADDRESS="<your-acs-sender-email>" `
    EMAIL_TO="<your-email>"
```

## Cleanup (if needed)

```powershell
# Delete everything
az group delete --name $RESOURCE_GROUP --yes --no-wait
```
