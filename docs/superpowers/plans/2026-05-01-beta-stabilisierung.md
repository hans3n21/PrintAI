# PrintAI Beta-Stabilisierung Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring PrintAI out of MVP mode by making one complete shirt purchase path reliable, understandable, and operator-ready.

**Architecture:** Stabilize the existing Next.js/Supabase/Printful flow around a single source of truth for product selection, static placement assets, and checkout readiness. Keep the current app structure, but harden the interfaces between Admin, Configure, Checkout, and Printful fulfillment.

**Tech Stack:** Next.js App Router, React, Supabase/Postgres, Printful API, Stripe Checkout, Vitest, Testing Library.

---

## Scope

This sprint is intentionally narrow. The target is one reliable beta path:

- One active shirt product.
- Two active colors, starting with Black and White.
- Static front/back/side assets per color.
- Correct placement coordinates saved into `sessions.config.placement`.
- Checkout only proceeds when product, variant, print file, and placement are valid.

Do not add more product types, marketplace features, analytics, or redesign the AI generation flow in this sprint.

---

## File Structure

- Modify: `printai/src/app/api/admin/printful/sync-catalog/route.ts`
  - Sync only active product colors into relational color/asset tables.
  - Keep asset cleanup strict and deterministic.
- Modify: `printai/src/app/api/admin/printful/products/route.ts`
  - Return product readiness information for Admin.
- Modify: `printai/src/app/api/admin/printful/assets/route.ts`
  - Support preferred asset and calibration updates.
- Modify: `printai/src/components/admin/AdminProducts.tsx`
  - Replace developer-style asset grids with an operator workflow.
- Modify: `printai/src/app/configure/[sessionId]/page.tsx`
  - Centralize selected product/color/size/placement state.
- Modify: `printai/src/components/place/PlacementEditor.tsx`
  - Show only the selected static placement asset and use its calibration.
- Modify: `printai/src/app/api/pricing/quote/route.ts`
  - Fail clearly when selected variant/product is invalid.
- Modify: `printai/src/app/api/checkout/stripe/route.ts`
  - Validate checkout readiness before Stripe session creation.
- Modify: `printai/src/lib/orders/printfulFulfillment.ts`
  - Keep final Printful payload aligned with configured placement.
- Test files:
  - `printai/src/app/api/admin/printful/sync-catalog/__tests__/route.test.ts`
  - `printai/src/app/api/admin/printful/assets/__tests__/route.test.ts`
  - `printai/src/components/admin/__tests__/AdminProducts.test.tsx`
  - `printai/src/components/place/__tests__/PlacementEditor.test.tsx`
  - `printai/src/app/api/pricing/quote/__tests__/route.test.ts`
  - `printai/src/app/api/checkout/stripe/__tests__/route.test.ts`
  - `printai/src/app/api/order/__tests__/route.test.ts`

---

## Task 1: Define Beta Readiness Rules

**Files:**
- Modify: `printai/src/app/api/admin/printful/products/route.ts`
- Test: `printai/src/app/api/admin/printful/products/__tests__/route.test.ts`

- [ ] **Step 1: Add a failing test for product readiness**

Add a test where a product has active variants for Black and White and preferred `front` assets for both colors. Expected `GET /api/admin/printful/products` returns:

```ts
expect(json.products[0].readiness).toMatchObject({
  has_active_variants: true,
  active_colors: ["black", "white"],
  missing_front_assets: [],
  checkout_ready: true,
});
```

Add a second case where White has no preferred front asset:

```ts
expect(json.products[0].readiness).toMatchObject({
  checkout_ready: false,
  missing_front_assets: ["white"],
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd printai && npm test -- src/app/api/admin/printful/products/__tests__/route.test.ts
```

Expected: FAIL because `readiness` is not returned yet.

- [ ] **Step 3: Implement readiness computation**

In `products/route.ts`, compute readiness from:

- `variants` for active color slugs.
- `color_assets` for preferred `front` assets.
- `is_active`.

Use this shape:

```ts
type ProductReadiness = {
  has_active_variants: boolean;
  active_colors: string[];
  missing_front_assets: string[];
  checkout_ready: boolean;
};
```

- [ ] **Step 4: Verify**

Run the same test. Expected: PASS.

---

## Task 2: Make Sync Strict And Predictable

**Files:**
- Modify: `printai/src/app/api/admin/printful/sync-catalog/route.ts`
- Test: `printai/src/app/api/admin/printful/sync-catalog/__tests__/route.test.ts`

- [ ] **Step 1: Add failing tests for active-color cleanup**

Add a test where stored variants are only Black and White, but `printful_product_colors` contains Red. After sync, Red should become inactive or be absent from active colors.

Expected active color rows:

```ts
expect(colorUpsert).toHaveBeenCalledWith(
  expect.arrayContaining([
    expect.objectContaining({ color_slug: "black", is_active: true }),
    expect.objectContaining({ color_slug: "white", is_active: true }),
  ]),
  { onConflict: "printful_product_id,color_slug" }
);
expect(colorDeactivateUpdate).toHaveBeenCalledWith({ is_active: false });
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd printai && npm test -- src/app/api/admin/printful/sync-catalog/__tests__/route.test.ts
```

Expected: FAIL because old colors are not deactivated.

- [ ] **Step 3: Implement active color cleanup**

After color upsert, update `printful_product_colors` for synced products:

```ts
await supabaseAdmin
  .from("printful_product_colors")
  .update({ is_active: false })
  .eq("printful_product_id", product.printful_product_id)
  .not("color_slug", "in", `(${activeSlugs.join(",")})`);
```

Use a safe helper for empty arrays. Do not delete color rows yet; inactive rows preserve history.

- [ ] **Step 4: Verify**

Run sync tests. Expected: PASS.

---

## Task 3: Replace Asset Grid With Operator Workflow

**Files:**
- Modify: `printai/src/components/admin/AdminProducts.tsx`
- Test: `printai/src/components/admin/__tests__/AdminProducts.test.tsx`

- [ ] **Step 1: Add failing UI tests**

Render a product with:

- Black and White active colors.
- Preferred front/back/side assets.
- One missing front asset.

Expect Admin to show a readiness summary:

```ts
expect(screen.getByText("Nicht bereit: White front fehlt")).toBeInTheDocument();
expect(screen.getByRole("tab", { name: "Black" })).toBeInTheDocument();
expect(screen.getByRole("tab", { name: "White" })).toBeInTheDocument();
expect(screen.getByText("Front")).toBeInTheDocument();
expect(screen.getByText("Back")).toBeInTheDocument();
expect(screen.getByText("Side")).toBeInTheDocument();
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd printai && npm test -- src/components/admin/__tests__/AdminProducts.test.tsx
```

Expected: FAIL because the UI is still a compact candidate grid.

- [ ] **Step 3: Implement operator UI**

In expanded product details:

- Show readiness badge.
- Show color tabs/pills.
- For the selected color, render exactly three sections:
  - Front
  - Back
  - Side
- In each section:
  - Show selected asset preview.
  - Show up to three candidates.
  - Show `Nutzen` action.
  - Show calibration inputs only for Front/Back, not Side.

Keep manual upload out of this task; add the placeholder CTA “Manuelles Asset hinzufügen” disabled or hidden behind a follow-up.

- [ ] **Step 4: Verify**

Run Admin tests. Expected: PASS.

---

## Task 4: Configure Uses One Product State

**Files:**
- Modify: `printai/src/app/configure/[sessionId]/page.tsx`
- Modify: `printai/src/components/place/PlacementEditor.tsx`
- Test: `printai/src/components/place/__tests__/PlacementEditor.test.tsx`

- [ ] **Step 1: Add failing tests for selected asset**

Test `PlacementEditor` with selected White color and preferred White front asset:

```ts
expect(screen.getByRole("img", { name: "Shirt-Vorschau" })).toHaveAttribute(
  "src",
  "https://example.com/white-front.png"
);
expect(screen.getByTestId("placement-print-area")).toHaveStyle({
  left: "10.0000%",
  top: "15.0000%",
});
```

Test with Back print area and preferred White back asset:

```ts
expect(screen.getByRole("img", { name: "Shirt-Vorschau" })).toHaveAttribute(
  "src",
  "https://example.com/white-back.png"
);
```

- [ ] **Step 2: Run test to verify it fails if current behavior regresses**

Run:

```bash
cd printai && npm test -- src/components/place/__tests__/PlacementEditor.test.tsx
```

Expected: PASS if current relational asset behavior is already correct; otherwise fix before continuing.

- [ ] **Step 3: Simplify Configure state**

Ensure `ConfigurePage` derives:

- selected product
- selected color
- selected size
- selected variant
- selected print area
- selected asset

from one local state model before writing to Supabase. Avoid writing contradictory values between `config.product_color`, `product_selection.color`, and `cart_lines[0].color`.

- [ ] **Step 4: Verify**

Run:

```bash
cd printai && npm test -- src/components/place/__tests__/PlacementEditor.test.tsx src/app/api/pricing/quote/__tests__/route.test.ts
```

Expected: PASS.

---

## Task 5: Checkout Readiness Gate

**Files:**
- Modify: `printai/src/app/api/checkout/stripe/route.ts`
- Modify: `printai/src/lib/orders/printfulFulfillment.ts`
- Test: `printai/src/app/api/checkout/stripe/__tests__/route.test.ts`
- Test: `printai/src/app/api/order/__tests__/route.test.ts`

- [ ] **Step 1: Add failing checkout validation test**

Create a session with missing `config.placement` or missing `print_file.url`. Expected:

```ts
expect(response.status).toBe(400);
expect(json.error).toContain("checkout readiness");
```

Create a valid session and assert Stripe proceeds.

- [ ] **Step 2: Run test to verify failure**

Run:

```bash
cd printai && npm test -- src/app/api/checkout/stripe/__tests__/route.test.ts
```

Expected: FAIL until readiness gate exists.

- [ ] **Step 3: Implement readiness gate**

Before Stripe creation, validate:

- `printful_product_id`
- `printful_variant_id`
- `config.print_file.url`
- `config.placement.left/top/width/height`
- selected variant belongs to active product variants

Return a user-facing 400 error when invalid.

- [ ] **Step 4: Verify final Printful payload**

Run:

```bash
cd printai && npm test -- src/app/api/checkout/stripe/__tests__/route.test.ts src/app/api/order/__tests__/route.test.ts
```

Expected: PASS.

---

## Task 6: Manual Smoke Test Checklist

**Files:**
- No code files unless bugs are found.

- [ ] **Step 1: Admin setup**

Open `/admin` and verify:

- One active product is chosen.
- Only Black/White are active for the beta product.
- Black and White each have preferred Front assets.
- Back assets exist if Back/Both are offered.

- [ ] **Step 2: User flow**

Run a browser flow:

1. Create or open a session.
2. Select design.
3. Open Configure.
4. Switch Black to White.
5. Confirm shirt background changes to preferred White asset.
6. Drag/resize design.
7. Continue to Checkout.
8. Confirm checkout only proceeds when valid.

- [ ] **Step 3: Record known limitations**

Document remaining beta limitations:

- Manual asset upload not implemented.
- Only one beta product guaranteed.
- Side image is for product display, not print placement.

---

## Verification Commands

Run before considering the sprint complete:

```bash
cd printai && npm test -- \
  src/app/api/admin/printful/sync-catalog/__tests__/route.test.ts \
  src/app/api/admin/printful/products/__tests__/route.test.ts \
  src/app/api/admin/printful/assets/__tests__/route.test.ts \
  src/components/admin/__tests__/AdminProducts.test.tsx \
  src/components/place/__tests__/PlacementEditor.test.tsx \
  src/app/api/pricing/quote/__tests__/route.test.ts \
  src/app/api/checkout/stripe/__tests__/route.test.ts \
  src/app/api/order/__tests__/route.test.ts
```

Expected: all listed tests pass.

Also run:

```bash
cd printai && npm run lint
```

Expected for a clean branch: zero errors. If unrelated pre-existing lint errors remain, list them explicitly and do not claim global lint is clean.

---

## Completion Criteria

This sprint is complete when:

- Admin can tell whether a product is checkout-ready.
- Admin can choose a front asset per active color.
- Konfigurator always uses the preferred asset for selected product/color/print area.
- Checkout refuses invalid sessions before payment.
- One real product with Black/White can be configured and sent to checkout without manual database edits.
