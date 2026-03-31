---
description: "Add a new asset type to the Nesab Reminder app. Updates types, model, form, routes, and zakat calculation."
agent: "agent"
argument-hint: "Name and description of the new asset type (e.g., 'gold - physical gold holdings')"
---

Add a new asset type to the Nesab Reminder Zakat tracking app.

## Input

The user will provide:
- **Type name**: A new value for the `Asset.type` union (e.g., `'gold'`, `'real_estate'`)
- **Type-specific fields**: Any extra fields this type needs (e.g., `weight_grams` for gold)

## Steps

Update these files in order, keeping both sides in sync:

### 1. Server types — [server/src/types.ts](../../server/src/types.ts)

- Add the new type value to the `Asset.type` union: `'cash' | 'investment' | 'stock' | '<new_type>'`
- Add any type-specific optional fields to the `Asset` interface (follow the pattern of `quantity?` and `ticker?` for stocks)

### 2. Client types — [client/src/types.ts](../../client/src/types.ts)

- Mirror the exact same changes from step 1. These files must stay in sync.

### 3. Mongoose model — [server/src/models/assetModel.ts](../../server/src/models/assetModel.ts)

- Add the new type to the `type` enum array in the schema
- Add any new fields to the schema definition

### 4. Server route validation — [server/src/routes/assets.ts](../../server/src/routes/assets.ts)

- Add the new type to the `body('type').isIn([...])` validator
- Add `body()` validators for any new fields (use `.optional()` like `quantity` and `ticker`)
- Include new fields in the `createAsset()` and `updateAsset()` calls

### 5. Zakat calculation — [server/src/services/zakatService.ts](../../server/src/services/zakatService.ts)

- Update `calculateZakat()` to handle the new type's EGP value calculation
- Follow the existing pattern: stocks use `quantity × amount`, cash/investment use `amount` directly

### 6. Asset form — [client/src/components/AssetForm.tsx](../../client/src/components/AssetForm.tsx)

- Add the new type to the type selector dropdown
- Add conditional form fields for type-specific properties (follow the pattern of stock-specific fields)

### 7. Asset display — [client/src/pages/Assets.tsx](../../client/src/pages/Assets.tsx)

- Update any type-conditional rendering to include the new type

## Constraints

- Every asset must store both Gregorian (`YYYY-MM-DD`) and Hijri (`YYYY/MM/DD`) dates
- All amounts must be convertible to EGP for Zakat calculation
- Do NOT import `moment-hijri` on the client side
- Run `npm run build` to verify no TypeScript errors after all changes
