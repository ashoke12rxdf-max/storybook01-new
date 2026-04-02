"""
Seed script to create an example template with multi-field personalization.
Run: python seed_personalization_template.py
"""

import asyncio
import os
from datetime import datetime, timezone
from pathlib import Path
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

# Load environment
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Connect to MongoDB
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]


async def seed_example_template():
    """Create the baby-boy-story example template with multi-field personalization"""
    
    template_id = "baby-boy-story-template-001"
    product_slug = "baby-boy-story"
    
    # Check if template already exists
    existing = await db.templates.find_one({"id": template_id})
    if existing:
        print(f"Template {template_id} already exists. Updating...")
        
    # Define field definitions for the personalization form
    field_definitions = [
        {
            "field_key": "dad_name",
            "label": "Father's Name",
            "type": "text",
            "required": True,
            "placeholder": "e.g., James",
            "help_text": "This will appear in the dedication page",
            "max_length": 50
        },
        {
            "field_key": "son_name",
            "label": "Son's Name",
            "type": "text",
            "required": True,
            "placeholder": "e.g., Ethan",
            "help_text": "The hero of your storybook",
            "max_length": 50
        },
        {
            "field_key": "message",
            "label": "Personal Message",
            "type": "textarea",
            "required": False,
            "placeholder": "Write a special message for your child...",
            "help_text": "Optional: This will appear on the last page",
            "max_length": 500
        },
        {
            "field_key": "photo",
            "label": "Child's Photo",
            "type": "image",
            "required": False,
            "help_text": "Optional: Upload a photo of your child (JPG or PNG, max 5MB)"
        }
    ]
    
    # Define spread blocks (visual positions for personalized text)
    spread_blocks = [
        {
            "spread_id": 0,
            "block_id": "cover_name",
            "type": "text",
            "x": 400,
            "y": 500,
            "width": 400,
            "height": 80,
            "text_template": "[son_name]'s Adventure",
            "allowed_fields": ["son_name"],
            "font_family": "Poppins",
            "font_size": 48,
            "font_weight": "bold",
            "italic": False,
            "color": "#2D3748",
            "alignment": "center",
            "max_lines": 1,
            "overflow_behavior": "shrink",
            "rotation": 0,
            "z_index": 1
        },
        {
            "spread_id": 3,
            "block_id": "hero_mention",
            "type": "text",
            "x": 100,
            "y": 300,
            "width": 600,
            "height": 60,
            "text_template": "Once upon a time, [son_name] went on a magical journey...",
            "allowed_fields": ["son_name"],
            "font_family": "Georgia",
            "font_size": 24,
            "font_weight": "normal",
            "italic": False,
            "color": "#4A5568",
            "alignment": "left",
            "max_lines": 2,
            "overflow_behavior": "wrap",
            "rotation": 0,
            "z_index": 1
        },
        {
            "spread_id": 6,
            "block_id": "dedication_line",
            "type": "text",
            "x": 150,
            "y": 400,
            "width": 500,
            "height": 80,
            "text_template": "From [dad_name] to [son_name]",
            "allowed_fields": ["dad_name", "son_name"],
            "font_family": "Dancing Script",
            "font_size": 36,
            "font_weight": "normal",
            "italic": True,
            "color": "#6B46C1",
            "alignment": "center",
            "max_lines": 1,
            "overflow_behavior": "shrink",
            "rotation": 0,
            "z_index": 1
        },
        {
            "spread_id": 10,
            "block_id": "personal_message",
            "type": "text",
            "x": 100,
            "y": 200,
            "width": 600,
            "height": 200,
            "text_template": "[message]",
            "allowed_fields": ["message"],
            "font_family": "Georgia",
            "font_size": 20,
            "font_weight": "normal",
            "italic": True,
            "color": "#718096",
            "alignment": "center",
            "max_lines": 8,
            "overflow_behavior": "shrink",
            "rotation": 0,
            "z_index": 1
        },
        {
            "spread_id": 5,
            "block_id": "child_photo",
            "type": "image",
            "x": 300,
            "y": 150,
            "width": 200,
            "height": 200,
            "text_template": "",
            "allowed_fields": ["photo"],
            "font_family": "",
            "font_size": 0,
            "font_weight": "normal",
            "italic": False,
            "color": "",
            "alignment": "center",
            "max_lines": 0,
            "overflow_behavior": "shrink",
            "rotation": 0,
            "z_index": 1
        }
    ]
    
    # Template document
    template_doc = {
        "id": template_id,
        "title": "Baby Boy Adventure",
        "productSlug": product_slug,
        "description": "A magical personalized storybook for your little boy",
        "basePdfPath": str(ROOT_DIR / "demo_template.pdf"),  # Use existing demo
        "basePdfUrl": f"/api/templates/{template_id}.pdf",
        "fillableFields": [],  # Will be detected from PDF
        "fieldMappings": [],   # Legacy single-field mappings
        "field_definitions": field_definitions,
        "spread_blocks": spread_blocks,
        "stylingDefaults": {
            "fontId": None,
            "fontName": None,
            "fontUrl": None,
            "soundId": None,
            "soundName": None,
            "soundUrl": None,
            "flippingEffect": "StoryParallax",
            "themePreset": "Warm Cream",
            "accentColor": "#6B46C1"
        },
        "status": "active",  # Ready for use
        "orientation": "landscape",
        "pageCount": 12,
        "thumbnailUrl": f"/api/templates/{template_id}/thumbnail.webp",
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "updatedAt": datetime.now(timezone.utc).isoformat(),
        "activatedAt": datetime.now(timezone.utc).isoformat()
    }
    
    # Upsert template
    await db.templates.update_one(
        {"id": template_id},
        {"$set": template_doc},
        upsert=True
    )
    
    print(f"Template '{template_doc['title']}' seeded successfully!")
    print(f"  - Product slug: {product_slug}")
    print(f"  - Field definitions: {len(field_definitions)}")
    print(f"  - Spread blocks: {len(spread_blocks)}")
    print(f"  - Status: {template_doc['status']}")
    print(f"\nThis template requires personalization (field_definitions.length > 0)")
    print(f"When a Polar webhook arrives for product_slug='{product_slug}',")
    print(f"a personalization session will be created instead of auto-generating.")


async def main():
    try:
        await seed_example_template()
    finally:
        client.close()


if __name__ == "__main__":
    asyncio.run(main())
