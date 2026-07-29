# Module Blueprint: Product & Sales

- **Module:** `apps.product`, `apps.quote`, `apps.order`, `apps.invoice`
- **Bounded Context:** Product Catalog, Quotations, Orders & Invoicing
- **Status:** Draft v1.0

## Business Purpose

The Product & Sales module manages the revenue lifecycle: product/service catalog, quotation generation, order management, and invoicing. This is the core transaction engine that converts won opportunities into billed revenue.

## Bounded Context

This module owns Products, Quotes, Orders, and Invoices across four apps forming a linear workflow: Product -> Quote -> Order -> Invoice. It consumes Opportunities from Pipeline Management and emits payment events consumed by accounting integrations.

## Aggregates, Entities, Value Objects

### Aggregate: Product
- **Product** (Aggregate Root)
  - `id: UUID v7`
  - `tenant_id: UUID v7`
  - `name: str`
  - `description: Text`
  - `sku: str (unique per tenant)`
  - `product_type: ProductType`
  - `unit_price: Decimal`
  - `cost_price: Decimal | None`
  - `currency: str (ISO 4217)`
  - `taxable: bool`
  - `tax_rate: Decimal | None`
  - `is_active: bool`
  - `category_id: UUID v7 (FK to ProductCategory)`
  - `attributes: JSONB` (variant attributes like color, size)
  - `images: List[str]` (URLs)
  - `timestamps: created_at, updated_at`

### Value Objects
- **ProductType:** `enum(GOOD, SERVICE, DIGITAL, BUNDLE, SUBSCRIPTION)`
- **ProductStatus:** `enum(ACTIVE, INACTIVE, DISCONTINUED)`

### Entities
- **ProductCategory** — Hierarchical categories
- **ProductVariant** — SKU-level variants (size, color)
- **PriceBook** — Named price lists (Standard, Promo, Partner)

### Aggregate: Quote
- **Quote** (Aggregate Root)
  - `id: UUID v7`
  - `tenant_id: UUID v7`
  - `quote_number: str (auto-generated)`
  - `status: QuoteStatus`
  - `opportunity_id: UUID v7 | None`
  - `contact_id: UUID v7`
  - `account_id: UUID v7 | None`
  - `owner_id: UUID v7`
  - `approval_status: ApprovalStatus`
  - `approved_by: UUID v7 | None`
  - `valid_until: Date`
  - `subtotal: Decimal`
  - `discount_percent: Decimal | None`
  - `discount_amount: Decimal`
  - `tax_amount: Decimal`
  - `total: Decimal`
  - `currency: str`
  - `notes: Text`
  - `terms_conditions: Text`
  - `timestamps: created_at, updated_at, approved_at, accepted_at`

### Value Objects
- **QuoteStatus:** `enum(DRAFT, SENT, ACCEPTED, REJECTED, EXPIRED, REVISED)`
- **ApprovalStatus:** `enum(PENDING, APPROVED, REJECTED, NOT_REQUIRED)`

### Entities
- **QuoteLineItem** — Individual product/service on quote
- **QuoteVersion** — Version history of quote revisions

### Aggregate: Order
- **Order** (Aggregate Root)
  - `id: UUID v7`
  - `tenant_id: UUID v7`
  - `order_number: str (auto-generated)`
  - `status: OrderStatus`
  - `quote_id: UUID v7 | None`
  - `contact_id: UUID v7`
  - `account_id: UUID v7 | None`
  - `owner_id: UUID v7`
  - `order_date: Date`
  - `expected_delivery_date: Date | None`
  - `subtotal, discount_amount, tax_amount, total: Decimal`
  - `currency: str`
  - `shipping_address: Address | None`
  - `billing_address: Address`
  - `shipping_method: str | None`
  - `notes: Text`
  - `timestamps: created_at, updated_at, fulfilled_at`

### Value Objects
- **OrderStatus:** `enum(PENDING, CONFIRMED, PROCESSING, SHIPPED, DELIVERED, CANCELLED, RETURNED)`

### Entities
- **OrderLineItem** — Products on order (snapshot of quote line)
- **Fulfillment** — Partial or full delivery records

### Aggregate: Invoice
- **Invoice** (Aggregate Root)
  - `id: UUID v7`
  - `tenant_id: UUID v7`
  - `invoice_number: str (auto-generated)`
  - `status: InvoiceStatus`
  - `order_id: UUID v7`
  - `contact_id: UUID v7`
  - `account_id: UUID v7 | None`
  - `issue_date: Date`
  - `due_date: Date`
  - `subtotal, discount_amount, tax_amount, total: Decimal`
  - `amount_paid: Decimal`
  - `balance_due: Decimal`
  - `currency: str`
  - `billing_address: Address`
  - `payment_terms: str`
  - `notes: Text`
  - `timestamps: created_at, paid_at, cancelled_at`

### Value Objects
- **InvoiceStatus:** `enum(DRAFT, SENT, PARTIAL, PAID, OVERDUE, CANCELLED, REFUNDED)`

### Entities
- **InvoiceLineItem** — Billed items
- **Payment** — Payment records against invoice
- **CreditNote** — Credit/refund notes

## Domain Events

- `ProductCreated`, `ProductUpdated`, `ProductDiscontinued`
- `QuoteCreated`, `QuoteSent`, `QuoteAccepted`, `QuoteRejected`, `QuoteExpired`
- `OrderCreated`, `OrderConfirmed`, `OrderShipped`, `OrderDelivered`, `OrderCancelled`
- `InvoiceGenerated`, `InvoiceSent`, `InvoicePaid`, `InvoiceOverdue`, `InvoiceCancelled`
- `PaymentReceived`, `PaymentFailed`, `PaymentRefunded`

## Commands & Queries

### Commands
- `CreateProduct`, `UpdateProduct`, `DeleteProduct`
- `CreateQuoteFromOpportunity(opportunity_id) -> QuoteId`
- `CreateQuote`, `UpdateQuote`, `SendQuote(quote_id)`, `AcceptQuote`, `RejectQuote`
- `CreateOrderFromQuote(quote_id) -> OrderId`
- `CreateOrder`, `FulfillOrder`, `CancelOrder`
- `GenerateInvoice(order_id) -> InvoiceId`
- `RecordPayment(invoice_id, amount, method, reference)`
- `SendInvoice`, `CancelInvoice`, `IssueCreditNote`

### Queries
- `GetProduct`, `ListProducts`, `SearchProducts`
- `GetQuote`, `ListQuotes`, `GetQuoteVersions`
- `GetOrder`, `ListOrders`, `GetOrderFulfillments`
- `GetInvoice`, `ListInvoices`, `GetInvoicePayments`
- `GetOutstandingInvoices`, `GetAgingReport`, `GetRevenueSummary`

## Application Services

- `ProductCatalogService` — Product CRUD, categorization, pricing
- `QuoteService` — Quote creation, versioning, approval workflow
- `OrderService` — Order processing, fulfillment tracking
- `InvoiceService` — Invoice generation, payment recording, dunning
- `PricingService` — Price calculation, discounts, tax computation
- `SalesWorkflowService` — Orchestrates quote->order->invoice flow
- `DunningService` — Overdue invoice reminders and escalation

## API Endpoints

### Products
| Method | URL | Description |
|--------|-----|-------------|
| GET | `/api/v1/products/` | List products |
| POST | `/api/v1/products/` | Create product |
| GET/PUT/DELETE | `/api/v1/products/{id}/` | CRUD |
| GET | `/api/v1/products/categories/` | List categories |

### Quotes
| Method | URL | Description |
|--------|-----|-------------|
| GET/POST | `/api/v1/quotes/` | List/Create |
| GET/PUT/DELETE | `/api/v1/quotes/{id}/` | CRUD |
| POST | `/api/v1/quotes/{id}/send/` | Send to customer |
| POST | `/api/v1/quotes/{id}/accept/` | Accept quote |
| POST | `/api/v1/quotes/{id}/reject/` | Reject |
| POST | `/api/v1/quotes/{id}/convert-to-order/` | Create order |
| GET | `/api/v1/quotes/{id}/versions/` | Version history |

### Orders
| Method | URL | Description |
|--------|-----|-------------|
| GET/POST | `/api/v1/orders/` | List/Create |
| GET/PUT | `/api/v1/orders/{id}/` | CRUD |
| POST | `/api/v1/orders/{id}/fulfill/` | Mark fulfilled |
| POST | `/api/v1/orders/{id}/cancel/` | Cancel order |

### Invoices
| Method | URL | Description |
|--------|-----|-------------|
| GET | `/api/v1/invoices/` | List invoices |
| POST | `/api/v1/invoices/generate/` | Generate from order |
| GET | `/api/v1/invoices/{id}/` | Get invoice |
| POST | `/api/v1/invoices/{id}/send/` | Send to customer |
| POST | `/api/v1/invoices/{id}/payment/` | Record payment |
| GET | `/api/v1/invoices/{id}/pdf/` | Download PDF |
| GET | `/api/v1/invoices/reports/aging/` | Aging report |
| GET | `/api/v1/invoices/reports/revenue/` | Revenue summary |

## Validation Rules

| Field | Rule |
|-------|------|
| product.sku | Unique per tenant, alphanumeric |
| quote.valid_until | Must be future date |
| quote -> order | Only ACCEPTED quotes can convert |
| order -> invoice | Only DELIVERED orders can invoice |
| invoice.total | Sum of line items must match |
| payment.amount | Cannot exceed invoice.balance_due |

## Security & Permissions

| Permission | Codename |
|------------|----------|
| View Product | `product.view_product` |
| Manage Product | `product.add_product`, `product.change_product`, `product.delete_product` |
| View Quote | `quote.view_quote` |
| Manage Quote | `quote.add_quote`, `quote.change_quote`, `quote.delete_quote` |
| Approve Quote | `quote.approve_quote` |
| View Order | `order.view_order` |
| Manage Order | `order.add_order`, `order.change_order`, `order.delete_order` |
| Fulfill Order | `order.fulfill_order` |
| View Invoice | `invoice.view_invoice` |
| Manage Invoice | `invoice.add_invoice`, `invoice.change_invoice`, `invoice.delete_invoice` |
| Record Payment | `invoice.record_payment` |

## Testing Strategy

| Layer | Focus |
|-------|-------|
| Unit | Product pricing, Discount calculation, Tax computation, Quote->Order conversion validation |
| Integration | Quote workflow (draft->sent->accepted), Order fulfillment flow, Invoice aging report |
| API | Full CRUD for all 4 entities, Payment recording, PDF generation |
| E2E | Create product -> generate quote -> accept -> create order -> fulfill -> invoice -> pay |

## Future Enhancements

- **Subscription Management:** Recurring billing, renewal workflows
- **Payment Gateway Integration:** Stripe, Razorpay auto-payment
- **Multi-Currency:** Real-time FX conversion
- **eSignature:** Embedded DocuSign/HelloSign for quotes
- **Revenue Recognition:** ASC 606 compliance
- **Bulk Pricing Tiers:** Volume-based discounts
- **Coupon/Promotion Engine:** Discount codes and campaigns
