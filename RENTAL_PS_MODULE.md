# Rental PS Module - Multi-Tenant Financial Configuration

## Overview
The Rental PS module has been enhanced to support **Multi-Tenant Financial Routing**. This allows rental transactions categorized in one tenant (e.g., a specific branch) to be financially recorded in a different tenant (e.g., Head Office or a specific Ledger).

## Key Changes

### 1. Database Schema (`prisma/schema.prisma`)
- Added `rentalPsTargetTenantId` field to the `Settings` model.
- Default value: `'sdm'` (Maintains backward compatibility).

### 2. Settings API (`app/api/rental-ps/settings/route.ts`)
- **GET**:
  - Retrieves the current `rentalPsTargetTenantId`.
  - Accepts a `?target=TENANT_ID` query parameter to fetch Financial Accounts and Chart of Accounts (COA) for a *specific* target tenant.
- **PUT**:
  - Updates the `rentalPsTargetTenantId`.

### 3. Transaction Logic (`app/api/rental-ps/route.ts` & `import/route.ts`)
- **POST (Create)**:
  - Fetches the configured `rentalPsTargetTenantId` from settings.
  - Creates financial journal entries (Sales Recognition & Settlement) in the *target* tenant's ledger.
  - Updates bank/cash balances in the *target* tenant.
- **PUT (Update)**:
  - Rolling back old transactions: Uses the `tenantId` stored in the transaction record to ensure the correct ledger is debited/credited.
  - creating new transactions: Uses the currently configured `rentalPsTargetTenantId`.
- **DELETE**:
  - Rolling back transactions: Uses the `tenantId` stored in the transaction record to ensure the correct ledger is restored.

### 4. User Interface (`src/components/rental-ps/Settings.tsx`)
- Added a "Target Kantor Keuangan" dropdown in the Financial Mapping section.
- Selecting a target tenant automatically fetches the available Accounts and COAs from that tenant.
- **Safety Feature**: Changing the target tenant clears the currently selected Financial Accounts and COAs to prevent saving invalid or mismatched IDs.

## Data Integrity & Safety
- **Dynamic Routing**: Hardcoded references to `'sdm'` have been removed in favor of dynamic routing based on configuration.
- **Rollback Safety**: Rollback operations always respect the `tenantId` where the transaction was originally created, preventing data corruption if settings change between creation and deletion.
