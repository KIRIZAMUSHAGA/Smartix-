# Smartix - Setup Instructions

## Import Status: Frontend Running ✅

Your Smartix project has been successfully imported to Replit! 

### What's Working:
- ✅ **Frontend**: Running successfully on port 5000
- ✅ All Node.js dependencies installed
- ✅ All Python dependencies installed
- ✅ Missing utils file created for UI components

### What's Needed: MongoDB Database

Your backend requires a MongoDB database to run. The backend is currently failing because it cannot connect to MongoDB.

## Setup Options

### Option 1: MongoDB Atlas (Recommended - Free)
1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a free account
3. Create a new cluster (free M0 tier available)
4. Click "Connect" → "Connect your application"
5. Copy the connection string (looks like: `mongodb+srv://username:password@cluster.mongodb.net/`)
6. Replace `<password>` with your actual password
7. Add your connection string as an environment variable

### Option 2: Other MongoDB Hosting
You can use any MongoDB hosting service (DigitalOcean, AWS DocumentDB, etc.)

## Required Environment Variables

Once you have your MongoDB connection string, you need to set these environment variables:

1. **MONGO_URL**: Your MongoDB connection string
   - Example: `mongodb+srv://username:password@cluster.mongodb.net/smartohada_db`

2. **SECRET_KEY**: A secure random string for JWT tokens
   - Example: Generate one with: `openssl rand -hex 32`

3. **DB_NAME**: Database name (optional, defaults to `smartohada_db`)

## Collections That Will Be Created

The backend will automatically create these collections:
- users
- stories
- posts
- notifications
- music
- marketplace_categories
- marketplace_sellers
- marketplace_products
- marketplace_orders
- marketplace_order_items
- marketplace_payments
- marketplace_wallets
- marketplace_wallet_transactions
- marketplace_reviews
- marketplace_products_preview

## Next Steps

1. Get your MongoDB connection string
2. I'll help you configure the environment variables
3. Restart the backend workflow
4. Your app will be fully functional!

---

**Note**: I've created a `.env.example` file in the backend directory showing the required variables.
