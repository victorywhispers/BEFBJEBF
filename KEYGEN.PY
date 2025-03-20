import os
import json
import random
import string
import asyncio
import datetime
from datetime import timedelta
import logging
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import Application, CommandHandler, CallbackQueryHandler, MessageHandler, filters, ContextTypes
from telegram.constants import ParseMode
from pymongo import MongoClient

# Configure logging
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)

# Configuration
BOT_TOKEN = "7693246799:AAF30PjRnkpRDowNL58IDrRdW7ALs2VLTGA"
API_URL = "https://wormgpt-frontend.onrender.com"

# MongoDB setup with connection retry
def setup_mongodb():
    max_retries = 3
    retry_count = 0
    
    while retry_count < max_retries:
        try:
            MONGO_URI = os.getenv('MONGODB_URI')
            if not MONGO_URI:
                raise ValueError("MONGODB_URI environment variable not set")
            
            client = MongoClient(MONGO_URI)
            # Test connection
            client.admin.command('ping')
            db = client.wormgpt
            collection = db.keys
            
            # Add this logging to verify connection
            logging.info(f"Connected to MongoDB. Collection: {collection.name}")
            logging.info(f"Document count: {collection.count_documents({})}")
            
            return collection
        except Exception as e:
            retry_count += 1
            logging.error(f"MongoDB connection attempt {retry_count} failed: {str(e)}")
            if retry_count >= max_retries:
                raise
            time.sleep(5)  # Wait 5 seconds before retrying

keys_collection = setup_mongodb()

def generate_key():
    """Generate a random key in WR-XXXXXXXXXX format"""
    return "WR-" + ''.join(random.choices(string.ascii_uppercase + string.digits, k=10))

def get_expiry_time():
    """Get expiry time 24 hours from now"""
    return (datetime.datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d %H:%M:%S")

async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /start command"""
    keyboard = InlineKeyboardMarkup([
        [InlineKeyboardButton("🔑 Generate Key", callback_data="generate")],
        [InlineKeyboardButton("ℹ️ Check Key Status", callback_data="check")]
    ])
    
    await update.message.reply_text(
        "*Welcome to WormGPT Key Generator!*\n\n"
        "• Generate 24-hour trial keys\n"
        "• Check key status\n"
        "• Access unlimited AI chat\n",
        reply_markup=keyboard,
        parse_mode=ParseMode.MARKDOWN
    )

async def generate_key_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle key generation"""
    message = await update.callback_query.message.reply_text("🔄 Generating key...")
    
    key = generate_key()
    expiry = datetime.datetime.now() + timedelta(days=1)
    user_id = str(update.effective_user.id)
    
    try:
        # Store key in MongoDB
        key_data = {
            "user_id": user_id,
            "key": key,
            "expiry_time": expiry,
            "created_at": datetime.datetime.now(),
            "username": update.effective_user.username,
            "first_name": update.effective_user.first_name,
            "last_name": update.effective_user.last_name,
            "is_valid": True
        }
        
        keys_collection.insert_one(key_data)
            
        await message.edit_text(
            f"✅ *Your WormGPT Key*\n\n"
            f"`{key}`\n\n"
            f"⏱️ Expires: {expiry.strftime('%Y-%m-%d %H:%M:%S')}\n\n"
            f"Use this key at {API_URL}",
            parse_mode=ParseMode.MARKDOWN
        )
    except Exception as e:
        logging.error(f"Error generating key: {e}")
        await message.edit_text("❌ Error generating key. Please try again.")

async def check_key_status(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Check key status"""
    try:
        user_id = str(update.effective_user.id)
        key_data = keys_collection.find_one(
            {"user_id": user_id},
            sort=[("created_at", -1)]
        )
            
        if not key_data:
            await update.callback_query.message.reply_text(
                "❌ You don't have any keys. Generate one first!"
            )
            return

        expiry = key_data['expiry_time']
        remaining = expiry - datetime.datetime.now()

        if remaining.total_seconds() > 0:
            hours = int(remaining.total_seconds() // 3600)
            minutes = int((remaining.total_seconds() % 3600) // 60)
            
            await update.callback_query.message.reply_text(
                f"🔑 *Current Key Status*\n\n"
                f"Key: `{key_data['key']}`\n"
                f"Time remaining: {hours}h {minutes}m\n"
                f"Expires: {expiry.strftime('%Y-%m-%d %H:%M:%S')}",
                parse_mode=ParseMode.MARKDOWN
            )
        else:
            await update.callback_query.message.reply_text(
                "❌ Your key has expired. Generate a new one!"
            )

    except Exception as e:
        logging.error(f"Error checking key status: {e}")
        await update.callback_query.message.reply_text(
            "❌ Error checking key status. Please try again."
        )

async def button_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle button callbacks"""
    query = update.callback_query
    await query.answer()

    if query.data == "generate":
        await generate_key_handler(update, context)
    elif query.data == "check":
        await check_key_status(update, context)

def main():
    """Start the bot"""
    # Create application
    application = Application.builder().token(BOT_TOKEN).build()

    # Add handlers
    application.add_handler(CommandHandler("start", start_command))
    application.add_handler(CallbackQueryHandler(button_handler))

    # Start bot
    print("Bot is running...")
    application.run_polling(allowed_updates=Update.ALL_TYPES)

if __name__ == "__main__":
    main()
