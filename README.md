# VendBoost Documentation

**Version:** 1.0.0  
**Last Updated:** April 2026

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [Technology Stack](#technology-stack)
4. [Features](#features)
5. [Data Models](#data-models)
6. [API Routes](#api-routes)
7. [Middleware](#middleware)
8. [WhatsApp Integration](#whatsapp-integration)
9. [Subscription Plans](#subscription-plans)
10. [Payment Integration](#payment-integration)
11. [Automation & Cron Jobs](#automation--cron-jobs)
12. [Environment Variables](#environment-variables)

---

## Project Overview

VendBoost is a WhatsApp-based vendor management platform that enables businesses to manage products, customers (leads), and communicate via WhatsApp. It provides features for product catalog management, lead tracking, automated messaging, and WhatsApp marketing broadcasts.

---

## Architecture

### Directory Structure

```
vendboost/
├── app.js                      # Main application entry point
├── src/
│   ├── config/
│   │   ├── DBconfig.js         # Database connection
│   │   ├── plans.js             # Subscription plan definitions
│   │   └── session.js          # Session configuration
│   ├── crons/
│   │   └── followUpScheduler.js # Automated follow-up scheduler
│   ├── middlewares/
│   │   ├── checkSubscription.js # Subscription verification
│   │   ├── limitGuard.js       # Feature limit enforcement
│   │   └── verifyAuth.js       # Authentication verification
│   ├── models/
│   │   ├── Lead.js             # Customer leads model
│   │   ├── Payment.js          # Payment records model
│   │   ├── Product.js          # Product catalog model
│   │   ├── Subscription.js    # Subscription model
│   │   ├── Template.js         # Message templates model
│   │   ├── Usage.js            # Usage tracking model
│   │   ├── Vendor.js           # Vendor/user model
│   │   ├── WhatsappSession.js  # WhatsApp session model
│   │   └── whatsapp.js         # WhatsApp configuration
│   ├── routers/
│   │   ├── authRouter.js       # Authentication routes
│   │   ├── billing.js          # Payment processing routes
│   │   ├── dashboardRouter.js # Dashboard routes
│   │   ├── index.js            # Public routes
│   │   ├── productRouter.js    # Product management routes
│   │   ├── subscriptionRouter.js # Subscription routes
│   │   ├── webhook.js          # Paystack webhook handler
│   │   └── whatsappRouter.js   # WhatsApp connection routes
│   ├── utils/
│   │   ├── defaultTemplate.js  # Default message templates
│   │   ├── imageOpt.js         # Image optimization
│   │   ├── intentDetector.js   # Customer intent detection
│   │   ├── logger.js           # Winston logger
│   │   ├── messageTemplateRenderer.js # Template rendering
│   │   └── paymentDetector.js # Payment confirmation detection
│   └── whatsapp/
│       ├── messageHandler.js  # Incoming message handling
│       └── session.js         # WhatsApp session management
├── public/
│   ├── css/style.css
│   └── js/script.js
└── views/                      # EJS templates
    ├── dashboard/              # Dashboard views
    ├── layouts/                # Layout templates
    └── partials/              # Partial templates
```

---

## Technology Stack

### Core Framework
- **Express.js** - Web application framework
- **Node.js** - Runtime environment
- **EJS** - Template engine

### Database
- **MongoDB** - NoSQL database
- **Mongoose** - ODM for MongoDB
- **connect-mongo** - MongoDB session store

### WhatsApp Integration
- **whatsapp-web.js** - WhatsApp Web API
- **wwebjs-mongo** - MongoDB persistence for sessions

### Payment Processing
- **Paystack API** - Nigerian payment gateway

### Utilities
- **bcryptjs** - Password hashing
- **jsonwebtoken** - JWT handling
- **multer** - File uploads
- **sharp** - Image processing
- **qrcode** - QR code generation
- **node-cron** - Scheduled tasks
- **socket.io** - Real-time communication
- **winston** - Logging
- **axios** - HTTP client

---

## Features

### Authentication
- Vendor signup/signin
- Session-based authentication
- Password hashing with bcrypt
- Role-based access

### Product Management
- Product CRUD operations
- Image upload with multer
- Image optimization with sharp
- Product categorization

### WhatsApp Integration
- QR code-based session connection
- Session persistence across restarts
- Message handling with intent detection
- Product broadcast to leads
- WhatsApp Status posting

### Lead Management
- Automatic lead capture from WhatsApp
- Lead scoring based on intent
- Lead status tracking (new, pending, contacted, qualified, converted, failed)
- Intent detection (price, ready-to-pay, order, inquiry)

### Subscription System
- Three subscription tiers (free, starter, pro)
- Feature-based access control
- Usage tracking and limits
- Plan upgrades

### Marketing
- Product broadcast to leads
- WhatsApp Status (Stories) posting
- Automated follow-up messages

### Analytics
- Lead statistics
- Conversion tracking
- Product performance metrics

---

## Data Models

### Vendor

Represents a business/vendor account.

```javascript
{
  name: String,
  business_type: String,
  email: String (unique, required),
  password: String (required, hashed),
  businessName: String,
  whatsappId: String,
  followUpTimes: [Number] (default: [6, 24, 72]),
  accountDetails: {
    bankName: String,
    accountNumber: String,
    accountName: String
  },
  subscription: {
    plan: String,
    status: String,
    startDate: Date,
    endDate: Date
  }
}
```

### Product

Represents a product in the vendor's catalog.

```javascript
{
  vendor: ObjectId (ref: Vendor, required),
  image: String,
  name: String (required),
  price: Number (required),
  discount: Number (default: 1),
  description: String,
  category: String,
  stock: Number (default: 1),
  views: Number (default: 0),
  clicks: Number (default: 0),
  leads: Number (default: 0),
  isActive: Boolean (default: true),
  createdAt: Date,
  updatedAt: Date
}
```

### Lead

Represents a customer lead captured from WhatsApp interactions.

```javascript
{
  vendor: ObjectId (ref: Vendor, required),
  customerName: String,
  customerNumber: String (required),
  customerEmail: String,
  lastMessage: String,
  intentType: String (enum: ['price', 'availability', 'ready-to-pay', 'order', 'inquiry', 'silent']),
  status: String (enum: ['new', 'pending', 'contacted', 'qualified', 'converted', 'failed']),
  score: Number (0-100),
  source: String (enum: ['whatsapp', 'manual', 'imported']),
  product: ObjectId (ref: Product),
  notes: String,
  followUpsSent: Number (default: 0),
  lastFollowUpAt: Date,
  convertedAt: Date,
  lastContactAt: Date,
  createdAt: Date,
  updatedAt: Date
}
```

### Subscription

Tracks vendor subscription status.

```javascript
{
  vendor: ObjectId (ref: Vendor, required),
  plan: String (enum: ['free', 'starter', 'pro'], default: 'free'),
  status: String (enum: ['active', 'expired', 'cancelled'], default: 'active'),
  startDate: Date (default: Date.now),
  endDate: Date,
  createdAt: Date,
  updatedAt: Date
}
```

### Payment

Records payment transactions.

```javascript
{
  vendor: ObjectId (ref: Vendor, required),
  reference: String (unique, required),
  plan: String (enum: ['starter', 'pro'], required),
  amount: Number (required),
  status: String (enum: ['pending', 'success', 'failed'], default: 'pending'),
  createdAt: Date,
  updatedAt: Date
}
```

### WhatsAppSession

Tracks WhatsApp connection status.

```javascript
{
  vendor: ObjectId (ref: Vendor, required),
  status: String (enum: ['initializing', 'qr', 'connected', 'disconnected', 'error', 'auth_failed']),
  qr: String (base64 QR code image),
  lastSeen: Date
}
```

### Template

Stores message templates per vendor.

```javascript
{
  vendor: ObjectId (ref: Vendor, required),
  templates: {
    welcome: String,
    price: String,
    negotiation: String,
    order: String,
    inquiry: String
  }
}
```

### Usage

Tracks daily feature usage.

```javascript
{
  vendor: ObjectId (ref: Vendor, required),
  date: String (YYYY-MM-DD format),
  broadcastsSent: Number (default: 0),
  messagesSent: Number (default: 0)
}
```

---

## API Routes

### Public Routes (`/`)

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/` | Landing page |
| GET | `/signup` | Registration page |
| GET | `/signin` | Login page |
| GET | `/terms` | Terms and conditions |

### Authentication Routes (`/auth`)

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/signup` | Register new vendor |
| POST | `/signin` | Login vendor |
| GET | `/logout` | Logout vendor |

### Dashboard Routes (`/dashboard`)

All routes require authentication.

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/` | Main dashboard |
| GET | `/analytics` | Analytics page |
| GET | `/new-product` | Product upload form |
| GET | `/products` | Product list |
| GET | `/leads` | Lead list |
| GET | `/settings` | Settings page |
| POST | `/settings/profile` | Update profile |
| POST | `/settings/password` | Change password |
| POST | `/leads/:id/status` | Update lead status |

### Product Routes (`/products`)

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/new` | Create product |
| GET | `/single` | Get single product |
| PUT | `/update` | Update product |
| DELETE | `/delete` | Delete product |
| POST | `/broadcast` | Broadcast product to leads |
| POST | `/post-status` | Post to WhatsApp Status |
| DELETE | `/:id` | Delete product (API) |
| POST | `/:id/broadcast` | Broadcast product (API) |
| POST | `/:id/status` | Post to status (API) |

### WhatsApp Routes (`/whatsapp`)

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/connect-whatsapp` | Initiate WhatsApp connection |
| GET | `/whatsapp-status` | Get connection status |
| POST | `/disconnect` | Disconnect WhatsApp |

### Billing Routes (`/billing`)

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/upgrade` | Upgrade subscription |
| GET | `/verify` | Verify payment |
| GET | `/plans` | Get available plans |

### Subscription Routes (`/subscription`)

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/upgrade` | Upgrade plan |
| GET | `/signup-payment` | Payment page for new signup |
| GET | `/payment-callback` | Payment callback handler |

### Webhook Routes (`/webhook`)

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/paystack` | Paystack webhook handler |

---

## Middleware

### verifyAuth.js

Verifies user authentication via session.

```javascript
requireAuth(req, res, next)
```

- Redirects to `/signin` if not authenticated
- Sets `req.user` with user data from session

### checkSubscription.js

Verifies active subscription and attaches subscription data to request.

```javascript
checkSubscription(req, res, next)
```

- Checks for active subscription
- Validates subscription expiry
- Attaches subscription details to `req.subscription`

**Functions:**

| Function | Description |
|----------|-------------|
| `getVendorSubscription(vendorId)` | Get subscription details |
| `checkPlanLimit(limitType)` | Check feature limit |
| `checkWhatsAppSessionsLimit(vendorId)` | Check WhatsApp session limit |

### limitGuard.js

Enforces feature-based usage limits.

```javascript
limitGuard(feature)(req, res, next)
```

**Features:**

- `broadcast` - Daily broadcast limit
- `leads` - Total lead limit
- `whatsappSessions` - WhatsApp session limit

---

## WhatsApp Integration

### Session Management

The WhatsApp session is managed in `src/whatsapp/session.js`:

- Uses `whatsapp-web.js` with `LocalAuth` strategy
- Stores session data in `.wwebjs_auth` directory
- Generates QR codes for authentication
- Handles reconnection and recovery
- Sessions persist across server restarts

### Message Handling

Incoming messages are processed in `src/whatsapp/messageHandler.js`:

1. **Intent Detection** - Uses NLP to detect customer intent
2. **Lead Creation** - Creates/updates lead records
3. **Automated Responses** - Sends template-based replies
4. **Real-time Updates** - Emits events via Socket.io

### Intent Types

| Intent | Score | Description |
|--------|-------|-------------|
| `ready-to-pay` | 100 | Customer ready to pay |
| `order` | 90 | Customer wants to order |
| `negotiation` | 80 | Customer negotiating |
| `price` | 60 | Customer asking about price |
| `inquiry` | 40 | General inquiry |
| `silent` | 20 | Low engagement |

### Broadcast

Products can be broadcast to all active leads:

- Includes product image and details
- Anti-ban delays between messages
- Success/failure tracking

### WhatsApp Status

Products can be posted to WhatsApp Status (Stories):

- Image optimization required
- Caption support
- 24-hour expiration

---

## Subscription Plans

### Plan Configuration (`src/config/plans.js`)

| Plan | Price | Leads | Broadcasts/Day | WhatsApp Sessions |
|------|-------|-------|-----------------|-------------------|
| Free | ₦0 | 20 | 0 | 1 |
| Starter | ₦5,000 | 200 | 50 | 1 |
| Pro | ₦15,000 | 1,000 | 500 | 3 |

### Plan Features

- **Free**: Basic features, no broadcasts
- **Starter**: Limited broadcasts, 200 leads
- **Pro**: Unlimited broadcasts, 1000 leads, 3 WhatsApp sessions

---

## Payment Integration

### Paystack Integration

The system uses Paystack for Nigerian payment processing:

1. **Initialize Payment** - Creates payment transaction
2. **Authorization URL** - Redirects to payment page
3. **Verify Payment** - Verifies transaction status
4. **Webhook Handler** - Processes async payment confirmation

### Payment Flow

```
Signup → Select Plan → Initialize Payment → 
Paystack Checkout → Callback/Webhook → 
Activate Subscription → Dashboard Access
```

### Billing Routes

- `/billing/upgrade` - Initialize upgrade payment
- `/billing/verify` - Verify payment callback
- `/subscription/signup-payment` - New signup payment
- `/subscription/payment-callback` - Payment callback

---

## Automation & Cron Jobs

### Follow-Up Scheduler

Runs every 5 minutes to send automated follow-up messages.

**Configuration:** `src/crons/followUpScheduler.js`

- Scheduled with `node-cron`: `*/5 * * * *`
- Sends follow-up messages based on vendor settings
- Default intervals: 6, 24, 72 hours
- Respects lead status and follow-up counts

### Session Recovery

On server startup:

- Recovers all disconnected WhatsApp sessions
- Automatically reconnects to previously connected sessions
- Updates session status in database

---

## Environment Variables

Create a `.env` file in the root directory:

```env
PORT=5100
NODE_ENV=development
BASE_URL=http://localhost:5100
PAYSTACK_SECRET=your_paystack_secret_key
PAYSTACK_PUBLIC=your_paystack_public_key
DB_CONNECTION_STRING=your_mongodb_connection_string
SESSION_SECRET=your_session_secret
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- MongoDB (local or Atlas)
- Paystack account (for payments)

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Start production server
npm start
```

### Default Ports

- Application: `5100` (or `process.env.PORT`)
- MongoDB: `27017`

---

## Security Considerations

- Passwords hashed with bcrypt (salt rounds: 10)
- Session-based authentication
- Paystack webhook signature verification
- Rate limiting on authentication routes
- Input validation on forms

---

## License

ISC
