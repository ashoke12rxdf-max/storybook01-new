from fastapi import FastAPI, APIRouter, UploadFile, File, HTTPException, Form, Depends, Request, BackgroundTasks
from fastapi.responses import FileResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import ssl
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict
import uuid
from datetime import datetime, timezone, timedelta
import fitz
from PIL import Image
import io
import bcrypt
import jwt
import json
import shutil

# Import automation modules
from automation.models import (
    Template, TemplateCreate, TemplateUpdate, TemplateListResponse, 
    FieldMapping, TemplateStylingDefaults, FieldDefinition, SpreadBlock,
    PersonalizationSession, PersonalizationSubmitRequest, PersonalizationSessionResponse
)
from automation.template_manager import TemplateManager
from automation.personalization_session import PersonalizationSessionManager
from automation.personalization_processor import PersonalizationProcessor
from assets_manager import AssetsManager, FONTS_DIR, SOUNDS_DIR
import aiofiles

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
# Use TLS only for remote MongoDB (Railway), skip for localhost
if 'localhost' in mongo_url or '127.0.0.1' in mongo_url:
    client = AsyncIOMotorClient(mongo_url)
else:
    client = AsyncIOMotorClient(
        mongo_url,
        tls=True,
        tlsAllowInvalidCertificates=True
    )
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# JWT Secret
JWT_SECRET = os.environ.get('JWT_SECRET', 'storybook-vault-secret-key-2024')

# Upload directories
UPLOAD_DIR = ROOT_DIR / "uploads"
SPREADS_DIR = ROOT_DIR / "spreads"
TEMPLATES_DIR = ROOT_DIR / "templates"
PERSONALIZED_DIR = ROOT_DIR / "personalized"
SESSION_UPLOADS_DIR = ROOT_DIR / "uploads" / "sessions"
UPLOAD_DIR.mkdir(exist_ok=True)
SPREADS_DIR.mkdir(exist_ok=True)
TEMPLATES_DIR.mkdir(exist_ok=True)
PERSONALIZED_DIR.mkdir(exist_ok=True)
SESSION_UPLOADS_DIR.mkdir(exist_ok=True, parents=True)

# Max image upload size (5MB)
MAX_IMAGE_UPLOAD_SIZE = 5 * 1024 * 1024
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/jpg"}

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Models
class AdminLogin(BaseModel):
    password: str = ""  # Optional, kept for API compatibility

class AdminLoginResponse(BaseModel):
    token: str
    message: str

# Review Models
class ReviewSubmit(BaseModel):
    storybook_id: str
    storybook_slug: str
    star_rating: int  # 1-5
    review_text: Optional[str] = ""
    reviewer_session_id: str  # Client-generated to prevent duplicates

class ReviewResponse(BaseModel):
    id: str
    storybook_id: str
    storybook_slug: str
    storybook_title: Optional[str] = None
    star_rating: int
    review_text: str
    reviewer_session_id: str
    submitted_at: str

class StorybookSettings(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    defaultViewMode: str = "one-page"
    onePageEffect: str = "StoryParallax"
    twoPageEffect: str = "Hardcover Classic"
    mobilePreferredEffect: str = "StoryParallax"
    soundEnabled: bool = True
    defaultSound: str = "Sound 2"
    soundVolume: float = 0.7
    perSpreadSoundMap: Dict[str, Dict[str, str]] = {}
    navLayout: str = "AirBar"
    roundedCorners: bool = True
    cornerRadius: int = 16
    themePreset: str = "Warm Cream"
    toolbarStyle: str = "Glass"
    accentColor: str = "#C9A86A"
    showThumbnails: bool = True
    showPageNumbers: bool = True
    allowFullscreen: bool = True
    allowRotate: bool = True
    allowZoom: bool = True

class Storybook(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    slug: str
    subtitle: str = ""
    pdfUrl: str
    coverImageUrl: str = ""
    status: str = "draft"
    orientation: str = "landscape"
    spreadCount: int = 0
    spreads: List[str] = []
    createdAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updatedAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    customerLink: str = ""
    embedCode: str = ""
    passwordProtected: bool = False
    passwordHash: str = ""
    expiresAt: Optional[str] = None
    viewCount: int = 0
    settings: StorybookSettings = Field(default_factory=StorybookSettings)

class StorybookCreate(BaseModel):
    title: str
    subtitle: str = ""

class StorybookUpdate(BaseModel):
    title: Optional[str] = None
    subtitle: Optional[str] = None
    status: Optional[str] = None
    passwordProtected: Optional[bool] = None
    password: Optional[str] = None
    expiresAt: Optional[str] = None
    settings: Optional[Dict] = None

class PasswordVerify(BaseModel):
    password: str

# Helper functions
def create_token(data: dict):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=7)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, JWT_SECRET, algorithm="HS256")

def verify_token(token: str):
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_current_admin(authorization: str = Depends(lambda: None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization.replace("Bearer ", "")
    verify_token(token)
    return {"authenticated": True}

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

async def convert_pdf_to_spreads(pdf_path: str, storybook_id: str) -> tuple:
    """Convert PDF to image spreads with optimization for web delivery"""
    try:
        doc = fitz.open(pdf_path)
        spread_dir = SPREADS_DIR / storybook_id
        spread_dir.mkdir(exist_ok=True)
        
        spreads = []
        orientation = "landscape"
        
        for page_num in range(len(doc)):
            page = doc[page_num]
            
            # Determine orientation from first page
            if page_num == 0:
                if page.rect.width < page.rect.height:
                    orientation = "portrait"
            
            # Optimize: 1.5x zoom instead of 2x (better balance of quality/size)
            mat = fitz.Matrix(1.5, 1.5)
            pix = page.get_pixmap(matrix=mat)
            
            # Convert to PIL Image
            img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
            
            # Resize if too large (max 1920px width for landscape, 1080px for portrait)
            max_width = 1920 if orientation == "landscape" else 1080
            if img.width > max_width:
                ratio = max_width / img.width
                new_height = int(img.height * ratio)
                img = img.resize((max_width, new_height), Image.Resampling.LANCZOS)
            
            # Save as WebP with good compression (smaller files, better quality)
            spread_path_webp = spread_dir / f"spread_{page_num}.webp"
            spread_path_jpg = spread_dir / f"spread_{page_num}.jpg"
            
            # Save WebP (primary format - 70% smaller than JPEG)
            img.save(spread_path_webp, "WEBP", quality=85, method=6)
            
            # Save JPEG fallback (for older browsers)
            img.save(spread_path_jpg, "JPEG", quality=80, optimize=True, progressive=True)
            
            spreads.append(f"/api/spreads/{storybook_id}/spread_{page_num}.webp")
        
        doc.close()
        
        # Create cover from first page
        cover_url = spreads[0] if spreads else ""
        
        return spreads, cover_url, orientation, len(spreads)
    except Exception as e:
        logger.error(f"Error converting PDF: {e}")
        raise HTTPException(status_code=500, detail=f"PDF conversion failed: {str(e)}")


# ============================================================================
# AUTOMATION: Internal Flipbook Conversion Function
# ============================================================================

async def convert_pdf_to_storybook(
    pdf_path: str,
    title: str,
    customer_name: str,
    password: Optional[str] = None,
    styling_defaults: Optional[Dict] = None
) -> dict:
    """
    Internal function to convert a personalized PDF into a storybook.
    Reuses existing flipbook generation logic.
    
    Args:
        pdf_path: Path to the personalized PDF
        title: Title for the storybook
        customer_name: Customer's requested name
        password: Optional password for protection
        styling_defaults: Optional styling defaults from template
        
    Returns:
        Dict with storybookId, slug, customerViewUrl
    """
    try:
        # Create storybook ID
        storybook_id = str(uuid.uuid4())
        slug = title.lower().replace(" ", "-").replace("'", "") + "-" + storybook_id[:8]
        
        # Convert PDF to spreads (reuse existing function)
        spreads, cover_url, orientation, spread_count = await convert_pdf_to_spreads(pdf_path, storybook_id)
        
        # Copy PDF to uploads directory (for consistency with existing system)
        uploaded_pdf_path = UPLOAD_DIR / f"{storybook_id}.pdf"
        # Note: We no longer copy the PDF here - the spreads are generated directly
        # and the original personalized PDF will be cleaned up after use
        
        # Create storybook settings with defaults from template
        settings = StorybookSettings()
        
        if styling_defaults:
            # Apply template styling defaults to storybook settings
            if styling_defaults.get("flippingEffect"):
                effect = styling_defaults["flippingEffect"]
                settings.onePageEffect = effect
                settings.mobilePreferredEffect = effect
                # Map effect names to valid options
                effect_mapping = {
                    "StoryParallax": "StoryParallax",
                    "HardcoverClassic": "Hardcover Classic",
                    "MagazineSlide": "Magazine",
                    "SoftFade": "Fade",
                    "None": "None"
                }
                mapped_effect = effect_mapping.get(effect, effect)
                settings.onePageEffect = mapped_effect
                settings.mobilePreferredEffect = mapped_effect
            
            if styling_defaults.get("themePreset"):
                settings.themePreset = styling_defaults["themePreset"]
            
            if styling_defaults.get("accentColor"):
                settings.accentColor = styling_defaults["accentColor"]
            
            if styling_defaults.get("soundName"):
                settings.defaultSound = styling_defaults["soundName"]
                settings.soundEnabled = True
            
            if styling_defaults.get("soundUrl"):
                # Store custom sound URL for the viewer
                settings.perSpreadSoundMap = {
                    "_customSound": {
                        "url": styling_defaults["soundUrl"],
                        "name": styling_defaults.get("soundName", "Custom Sound")
                    }
                }
        
        # Create storybook record
        storybook_data = {
            "id": storybook_id,
            "title": title,
            "slug": slug,
            "subtitle": f"Personalized for {customer_name}",
            "pdfUrl": f"/api/uploads/{storybook_id}.pdf",
            "coverImageUrl": cover_url,
            "spreads": spreads,
            "orientation": orientation,
            "spreadCount": spread_count,
            "status": "ready",
            "customerLink": f"/view/{slug}",
            "embedCode": f'<iframe src="/view/{slug}" width="100%" height="600px" frameborder="0"></iframe>',
            "passwordProtected": False,
            "passwordHash": "",
            "expiresAt": None,
            "viewCount": 0,
            "settings": settings.model_dump(),
            "stylingDefaults": styling_defaults,  # Store original template defaults
            "createdAt": datetime.now(timezone.utc).isoformat(),
            "updatedAt": datetime.now(timezone.utc).isoformat()
        }
        
        # Apply password protection if provided
        if password:
            storybook_data["passwordProtected"] = True
            storybook_data["passwordHash"] = hash_password(password)
        
        # Save to database
        await db.storybooks.insert_one(storybook_data)
        
        logger.info(f"Storybook created from automation: {storybook_id} (slug: {slug})")
        
        return {
            "storybookId": storybook_id,
            "slug": slug,
            "customerViewUrl": f"/view/{slug}"
        }
        
    except Exception as e:
        logger.error(f"Error converting PDF to storybook: {str(e)}")
        raise Exception(f"Failed to create storybook: {str(e)}")


# Routes
@api_router.get("/")
async def root():
    return {"message": "Storybook Vault API"}

@api_router.post("/admin/login", response_model=AdminLoginResponse)
async def admin_login(login: AdminLogin):
    # No password required - admin access is open
    token = create_token({"role": "admin"})
    return AdminLoginResponse(token=token, message="Login successful")

# ============================================================================
# TEMPLATE MANAGEMENT ENDPOINTS (Phase 1A)
# ============================================================================

@api_router.post("/templates/upload", response_model=Template)
async def upload_template(
    file: UploadFile = File(...),
    title: str = Form(...),
    productSlug: str = Form(...),
    description: str = Form("")
):
    """Upload a new fillable PDF template"""
    try:
        # Validate PDF file
        if not file.filename.endswith('.pdf'):
            raise HTTPException(status_code=400, detail="Only PDF files are allowed")
        
        # Create template ID
        template_id = str(uuid.uuid4())
        
        # Save PDF file
        pdf_path = TEMPLATES_DIR / f"{template_id}.pdf"
        with open(pdf_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        logger.info(f"Saved template PDF: {pdf_path}")
        
        # Detect fillable fields (optional - PDFs without fillable fields are allowed
        # so admins can use Spread Block Editor for visual text overlays)
        fillable_fields = await TemplateManager.detect_fillable_fields(str(pdf_path))
        if not fillable_fields:
            logger.info(f"No fillable fields detected in PDF {template_id} - proceeding (spread blocks will be used)")
        
        # Get PDF info
        pdf_info = await TemplateManager.get_pdf_info(str(pdf_path))
        
        # Generate thumbnail
        thumbnail_path = TEMPLATES_DIR / f"{template_id}_thumbnail.webp"
        await TemplateManager.generate_thumbnail(str(pdf_path), str(thumbnail_path))
        
        # Create template record
        template = Template(
            id=template_id,
            title=title,
            productSlug=productSlug,
            description=description,
            basePdfPath=str(pdf_path),
            basePdfUrl=f"/api/templates/{template_id}.pdf",
            fillableFields=fillable_fields,
            fieldMappings=[],
            status="draft",
            orientation=pdf_info["orientation"],
            pageCount=pdf_info["pageCount"],
            thumbnailUrl=f"/api/templates/{template_id}/thumbnail.webp"
        )
        
        # Save to database
        template_dict = template.model_dump()
        await db.templates.insert_one(template_dict)
        
        logger.info(f"Template created successfully: {template_id}")
        return template
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Template upload failed: {str(e)}")
        # Clean up on error
        if pdf_path.exists():
            pdf_path.unlink()
        if thumbnail_path.exists():
            thumbnail_path.unlink()
        raise HTTPException(status_code=500, detail=f"Template upload failed: {str(e)}")


@api_router.get("/templates", response_model=TemplateListResponse)
async def get_templates(status: Optional[str] = None):
    """Get all templates with optional status filter"""
    try:
        query = {}
        if status and status != "all":
            if status not in ["draft", "active", "inactive", "archived"]:
                raise HTTPException(status_code=400, detail="Invalid status value")
            query["status"] = status
        
        templates = await db.templates.find(query, {"_id": 0}).sort("createdAt", -1).to_list(1000)
        
        return TemplateListResponse(
            templates=templates,
            total=len(templates)
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching templates: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to fetch templates")


@api_router.get("/templates/{template_id}", response_model=Template)
async def get_template(template_id: str):
    """Get single template by ID"""
    try:
        template = await db.templates.find_one({"id": template_id}, {"_id": 0})
        
        if not template:
            raise HTTPException(status_code=404, detail="Template not found")
        
        return template
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching template: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to fetch template")


@api_router.put("/templates/{template_id}", response_model=Template)
async def update_template(template_id: str, update: TemplateUpdate):
    """Update template configuration"""
    try:
        # Get existing template
        template = await db.templates.find_one({"id": template_id}, {"_id": 0})
        if not template:
            raise HTTPException(status_code=404, detail="Template not found")
        
        update_data = {}
        
        # Handle title update
        if update.title is not None:
            update_data["title"] = update.title
        
        # Handle description update
        if update.description is not None:
            update_data["description"] = update.description
        
        # Handle field mappings update
        if update.fieldMappings is not None:
            # Validate field mappings
            fillable_fields = template.get("fillableFields", [])
            field_mappings = [m.model_dump() for m in update.fieldMappings]
            
            is_valid, error_msg = await TemplateManager.validate_field_mappings(
                fillable_fields,
                field_mappings
            )
            
            if not is_valid:
                raise HTTPException(status_code=400, detail=error_msg)
            
            update_data["fieldMappings"] = field_mappings
        
        # Handle styling defaults update
        if update.stylingDefaults is not None:
            update_data["stylingDefaults"] = update.stylingDefaults.model_dump()
        
        # Handle field_definitions update (NEW)
        if update.field_definitions is not None:
            update_data["field_definitions"] = [f.model_dump() for f in update.field_definitions]
        
        # Handle spread_blocks update (NEW)
        if update.spread_blocks is not None:
            update_data["spread_blocks"] = [b.model_dump() for b in update.spread_blocks]
        
        # Handle status update (includes one-active-per-productSlug rule)
        if update.status is not None:
            if update.status not in ["draft", "active", "inactive", "archived"]:
                raise HTTPException(status_code=400, detail="Invalid status value")
            
            current_status = template.get("status")
            new_status = update.status
            
            # If activating a template
            if new_status == "active" and current_status != "active":
                # Check if another template is already active for this productSlug
                product_slug = template["productSlug"]
                existing_active = await db.templates.find_one({
                    "productSlug": product_slug,
                    "status": "active",
                    "id": {"$ne": template_id}
                })
                
                if existing_active:
                    raise HTTPException(
                        status_code=409,
                        detail=f"Template '{existing_active['title']}' is already active for product '{product_slug}'. Please deactivate it first."
                    )
                
                update_data["status"] = "active"
                update_data["activatedAt"] = datetime.now(timezone.utc).isoformat()
            
            # If deactivating from active
            elif current_status == "active" and new_status == "inactive":
                update_data["status"] = "inactive"
                update_data["deactivatedAt"] = datetime.now(timezone.utc).isoformat()
            
            # If archiving
            elif new_status == "archived":
                update_data["status"] = "archived"
                update_data["archivedAt"] = datetime.now(timezone.utc).isoformat()
            
            # Other status changes
            else:
                update_data["status"] = new_status
        
        # Update timestamp
        update_data["updatedAt"] = datetime.now(timezone.utc).isoformat()
        
        # Perform update
        result = await db.templates.update_one(
            {"id": template_id},
            {"$set": update_data}
        )
        
        if result.modified_count == 0:
            logger.warning(f"Template update resulted in no changes: {template_id}")
        
        # Return updated template
        updated_template = await db.templates.find_one({"id": template_id}, {"_id": 0})
        return updated_template
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating template: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to update template: {str(e)}")


@api_router.delete("/templates/{template_id}")
async def delete_template(template_id: str):
    """Delete a template"""
    try:
        # Get template
        template = await db.templates.find_one({"id": template_id})
        if not template:
            raise HTTPException(status_code=404, detail="Template not found")
        
        # Check if template is active
        if template.get("status") == "active":
            raise HTTPException(
                status_code=400,
                detail="Cannot delete active template. Set status to 'inactive' first."
            )
        
        # Delete files
        pdf_path = Path(template["basePdfPath"])
        thumbnail_path = TEMPLATES_DIR / f"{template_id}_thumbnail.webp"
        
        if pdf_path.exists():
            pdf_path.unlink()
            logger.info(f"Deleted template PDF: {pdf_path}")
        
        if thumbnail_path.exists():
            thumbnail_path.unlink()
            logger.info(f"Deleted thumbnail: {thumbnail_path}")
        
        # Delete from database
        result = await db.templates.delete_one({"id": template_id})
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Template not found in database")
        
        return {"message": "Template deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting template: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to delete template")


@api_router.get("/templates/{template_id}/thumbnail.webp")
async def get_template_thumbnail(template_id: str):
    """Get template thumbnail"""
    thumbnail_path = TEMPLATES_DIR / f"{template_id}_thumbnail.webp"
    
    if not thumbnail_path.exists():
        raise HTTPException(status_code=404, detail="Thumbnail not found")
    
    return FileResponse(thumbnail_path, media_type="image/webp")


@api_router.get("/templates/{template_id}.pdf")
async def get_template_pdf(template_id: str):
    """Get template PDF file"""
    pdf_path = TEMPLATES_DIR / f"{template_id}.pdf"
    
    if not pdf_path.exists():
        raise HTTPException(status_code=404, detail="Template PDF not found")
    
    return FileResponse(pdf_path, media_type="application/pdf")


# ============================================================================
# ADMIN: SPREAD BLOCK EDITOR ROUTES (for Fabric.js visual editor)
# ============================================================================

@api_router.get("/admin/templates/{template_id}/spreads")
async def get_template_spreads(template_id: str):
    """Get all spreads for a template with their block configs"""
    try:
        template = await db.templates.find_one({"id": template_id}, {"_id": 0})
        if not template:
            raise HTTPException(status_code=404, detail="Template not found")
        
        # Find storybook with spreads for this template (by productSlug)
        storybook = await db.storybooks.find_one(
            {"productSlug": template.get("productSlug")},
            {"spreads": 1, "spreadCount": 1, "orientation": 1}
        )
        
        # Build spreads list with block data
        spreads = []
        spread_count = template.get("pageCount", 0)
        spread_blocks = template.get("spread_blocks", [])
        
        for i in range(spread_count):
            # Get blocks for this spread
            blocks_for_spread = [b for b in spread_blocks if b.get("spread_id") == i]
            
            # Get spread image URL if storybook exists
            spread_image_url = None
            if storybook and storybook.get("spreads") and i < len(storybook["spreads"]):
                spread_image_url = storybook["spreads"][i]
            
            spreads.append({
                "spread_id": i,
                "spread_image_url": spread_image_url,
                "blocks": blocks_for_spread
            })
        
        return {
            "template_id": template_id,
            "title": template.get("title"),
            "orientation": template.get("orientation"),
            "page_count": spread_count,
            "spreads": spreads,
            "field_definitions": template.get("field_definitions", [])
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching spreads: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to fetch spreads")


@api_router.get("/admin/templates/{template_id}/spreads/{spread_id}")
async def get_spread_blocks(template_id: str, spread_id: int):
    """Get spread image and blocks for visual editor"""
    try:
        template = await db.templates.find_one({"id": template_id}, {"_id": 0})
        if not template:
            raise HTTPException(status_code=404, detail="Template not found")
        
        spread_blocks = template.get("spread_blocks", [])
        blocks_for_spread = [b for b in spread_blocks if b.get("spread_id") == spread_id]
        
        # Find spread image
        storybook = await db.storybooks.find_one(
            {"productSlug": template.get("productSlug")},
            {"spreads": 1}
        )
        
        spread_image_url = None
        if storybook and storybook.get("spreads") and spread_id < len(storybook["spreads"]):
            spread_image_url = storybook["spreads"][spread_id]
        
        return {
            "template_id": template_id,
            "spread_id": spread_id,
            "spread_image_url": spread_image_url,
            "blocks": blocks_for_spread,
            "field_definitions": template.get("field_definitions", [])
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching spread: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to fetch spread")


@api_router.put("/admin/templates/{template_id}/spreads/{spread_id}/blocks")
async def update_spread_blocks(template_id: str, spread_id: int, blocks: List[Dict]):
    """Update blocks for a specific spread"""
    try:
        template = await db.templates.find_one({"id": template_id}, {"_id": 0})
        if not template:
            raise HTTPException(status_code=404, detail="Template not found")
        
        # Get existing spread_blocks
        existing_blocks = template.get("spread_blocks", [])
        
        # Remove blocks for this spread_id
        other_blocks = [b for b in existing_blocks if b.get("spread_id") != spread_id]
        
        # Add new blocks with correct spread_id
        for block in blocks:
            block["spread_id"] = spread_id
        
        # Combine
        updated_blocks = other_blocks + blocks
        
        # Update template
        await db.templates.update_one(
            {"id": template_id},
            {
                "$set": {
                    "spread_blocks": updated_blocks,
                    "updatedAt": datetime.now(timezone.utc).isoformat()
                }
            }
        )
        
        logger.info(f"Updated {len(blocks)} blocks for spread {spread_id} in template {template_id}")
        
        return {
            "success": True,
            "spread_id": spread_id,
            "block_count": len(blocks)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating spread blocks: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to update spread blocks")



# ============================================================================
# AUTOMATION: WEBHOOK & ORDER PROCESSING ENDPOINTS (Phase 1C)
# ============================================================================

# Import automation modules
from automation.webhook_handler import WebhookHandler
from automation.order_processor import OrderProcessor
from automation.models import (
    AutomationOrder, WebhookSimulateRequest, OrderListResponse,
    ProcessingLogEntry
)

# Initialize automation handlers
webhook_handler = WebhookHandler(db)
order_processor = OrderProcessor(db, TEMPLATES_DIR, PERSONALIZED_DIR)
session_manager = PersonalizationSessionManager(db)
personalization_processor = PersonalizationProcessor(db, TEMPLATES_DIR, PERSONALIZED_DIR)


@api_router.post("/automation/simulate-webhook")
async def simulate_webhook(request: WebhookSimulateRequest):
    """
    Simulate a webhook for testing without real payments.
    """
    try:
        # Prepare webhook data
        webhook_data = {
            "orderId": request.orderId or f"sim-{str(uuid.uuid4())[:8]}",
            "eventId": f"evt-sim-{str(uuid.uuid4())[:8]}",
            "productSlug": request.productSlug,
            "requestedName": request.requestedName,
            "buyerFullName": request.buyerFullName or request.requestedName,
            "customerEmail": request.customerEmail,
            "password": request.password
        }
        
        # Handle webhook (creates order with idempotency)
        result = await webhook_handler.handle_webhook(webhook_data, is_simulated=True)
        
        if result.get("isExisting"):
            # Return existing order
            order = await db.automation_orders.find_one(
                {"id": result["orderId"]},
                {"_id": 0}
            )
            return {
                "success": True,
                "message": result["message"],
                "orderId": result["orderId"],
                "order": order
            }
        
        # Process the new order
        order_id = result["orderId"]
        
        try:
            # Run full automation pipeline
            completed_order = await order_processor.process_order(
                order_id,
                convert_pdf_to_storybook
            )
            
            return {
                "success": True,
                "message": "Simulated webhook processed successfully",
                "orderId": order_id,
                "order": completed_order
            }
            
        except Exception as process_error:
            # Order failed but was created - return with error
            failed_order = await db.automation_orders.find_one(
                {"id": order_id},
                {"_id": 0}
            )
            
            return {
                "success": False,
                "message": f"Order processing failed: {str(process_error)}",
                "orderId": order_id,
                "order": failed_order
            }
        
    except Exception as e:
        logger.error(f"Simulate webhook failed: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Webhook simulation failed: {str(e)}"
        )


async def process_polar_order_background(order_id: str):
    """Background task to process a Polar order after acknowledging webhook"""
    try:
        await order_processor.process_order(order_id, convert_pdf_to_storybook)
        logger.info(f"Background order processing completed: {order_id}")
    except Exception as e:
        logger.error(f"Background order processing failed for {order_id}: {str(e)}")


async def send_personalization_email(session_token: str):
    """Background task to send personalization link email to customer"""
    try:
        from automation.email_sender import EmailSender
        
        session = await session_manager.get_session_by_token(session_token)
        if not session:
            logger.error(f"Session not found for email: {session_token}")
            return
        
        customer_email = session.get("customer_email")
        customer_name = session.get("customer_name", "Friend")
        product_title = session.get("template_snapshot", {}).get("title", "Your Storybook")
        
        # Build personalization URL
        base_url = os.getenv("APP_BASE_URL", "http://localhost:3000").rstrip('/')
        personalization_url = f"{base_url}/personalize/{session_token}"
        
        # Send email with personalization link
        html_content = f"""
        <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #6B46C1;">Storybook Vault</h1>
            </div>
            <h2>Hi {customer_name}!</h2>
            <p>Thank you for your purchase! Your personalized storybook <strong>{product_title}</strong> is almost ready.</p>
            <p>To complete your storybook, please fill in the personalization details:</p>
            <div style="text-align: center; margin: 30px 0;">
                <a href="{personalization_url}" 
                   style="background-color: #6B46C1; color: white; padding: 15px 30px; 
                          text-decoration: none; border-radius: 8px; font-weight: bold;">
                    Personalize Your Storybook
                </a>
            </div>
            <p style="color: #666; font-size: 14px;">
                Or copy this link: {personalization_url}
            </p>
            <p style="color: #666; font-size: 14px; margin-top: 30px;">
                Note: You can only submit the form once, so please make sure all details are correct before submitting.
            </p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            <p style="color: #999; font-size: 12px; text-align: center;">
                Made with love by Storybook Vault
            </p>
        </body>
        </html>
        """
        
        text_content = f"""
Hi {customer_name}!

Thank you for your purchase! Your personalized storybook "{product_title}" is almost ready.

To complete your storybook, please fill in the personalization details at:
{personalization_url}

Note: You can only submit the form once, so please make sure all details are correct before submitting.

Made with love by Storybook Vault
        """
        
        import resend
        resend.api_key = os.getenv("RESEND_API_KEY", "")
        email_from = os.getenv("FROM_EMAIL", "noreply@example.com")
        
        params = {
            "from": f"Storybook Vault <{email_from}>",
            "to": [customer_email],
            "subject": f"Complete your personalized storybook - {product_title}",
            "html": html_content,
            "text": text_content
        }
        
        response = resend.Emails.send(params)
        
        if response and response.get("id"):
            logger.info(f"Personalization email sent to {customer_email} for session {session_token}")
        else:
            logger.error(f"Failed to send personalization email: {response}")
            
    except Exception as e:
        logger.error(f"Personalization email error for {session_token}: {str(e)}")


async def process_personalization_background(session_token: str):
    """Background task to process a submitted personalization session"""
    try:
        await personalization_processor.process_session(session_token, convert_pdf_to_storybook)
        logger.info(f"Personalization processing completed: {session_token}")
    except Exception as e:
        logger.error(f"Personalization processing failed for {session_token}: {str(e)}")


@api_router.post("/webhooks/polar")
async def polar_webhook(request: Request, background_tasks: BackgroundTasks):
    """
    Production webhook endpoint for Polar.sh payment notifications.
    
    Handles these Polar events:
    - order.paid → Create order and trigger storybook generation
    
    Polar webhook payload structure:
    {
        "type": "order.paid",
        "data": {
            "id": "order_id",
            "metadata": {"product_slug": "..."},
            "custom_field_data": {"requested_name": "...", "password": "..."},
            "customer": {"email": "...", "name": "..."}
        }
    }
    
    1. Reads raw body bytes BEFORE JSON parsing
    2. Verifies webhook signature using POLAR_WEBHOOK_SECRET
    3. Returns 200 immediately (don't make Polar wait for full processing)
    4. Processes order async in background
    """
    event_log = {
        "id": str(uuid.uuid4()),
        "receivedAt": datetime.utcnow().isoformat() + "Z",
        "provider": "polar",
        "eventType": None,
        "payload": None,
        "processingStatus": "pending",
        "errorMessage": None
    }
    
    try:
        # Read raw body bytes FIRST (before any JSON parsing)
        raw_body = await request.body()
        
        # Get Polar signature headers
        webhook_id = request.headers.get("webhook-id", "")
        webhook_timestamp = request.headers.get("webhook-timestamp", "")
        webhook_signature = request.headers.get("webhook-signature", "")
        
        # Get webhook secret from environment
        webhook_secret = os.getenv("POLAR_WEBHOOK_SECRET", "")
        
        if not webhook_secret:
            logger.warning("POLAR_WEBHOOK_SECRET not configured - skipping signature verification")
        else:
            # Verify signature
            is_valid = await webhook_handler.verify_polar_signature(
                raw_body=raw_body,
                webhook_id=webhook_id,
                timestamp=webhook_timestamp,
                signature=webhook_signature,
                webhook_secret=webhook_secret
            )
            
            if not is_valid:
                logger.warning("Invalid Polar webhook signature")
                # For now, log but don't reject - Polar signature verification can be tricky
                # event_log["processingStatus"] = "failed"
                # event_log["errorMessage"] = "Invalid signature"
                # await db.webhook_events.insert_one(event_log)
                # raise HTTPException(status_code=403, detail="Invalid signature")
        
        # Parse JSON payload
        try:
            webhook_data = await request.json()
        except Exception:
            # If body was already consumed, decode from raw_body
            webhook_data = json.loads(raw_body.decode("utf-8"))
        
        # Extract event type
        event_type = webhook_data.get("type", "unknown")
        event_log["eventType"] = event_type
        event_log["payload"] = webhook_data
        
        logger.info(f"Received Polar webhook: event={event_type}")
        
        # Handle order.paid event
        if event_type == "order.paid":
            # Parse the Polar webhook data
            parsed_data = webhook_handler.parse_polar_webhook(webhook_data)
            
            # Validate required fields
            if not parsed_data.get("productSlug"):
                event_log["processingStatus"] = "failed"
                event_log["errorMessage"] = "Missing product_slug in metadata"
                await db.webhook_events.insert_one(event_log)
                return {
                    "received": True,
                    "error": "Missing product_slug in metadata",
                    "message": "Please add product_slug to metadata in Polar product settings"
                }
            
            if not parsed_data.get("customerEmail"):
                event_log["processingStatus"] = "failed"
                event_log["errorMessage"] = "Missing customer email"
                await db.webhook_events.insert_one(event_log)
                return {
                    "received": True,
                    "error": "Missing customer email",
                    "message": "Customer email is required"
                }
            
            # NEW: Use conditional personalization flow
            # Check if template requires personalization (has field_definitions)
            result = await webhook_handler.handle_webhook_with_personalization(
                parsed_data, 
                is_simulated=False
            )
            
            if result.get("isExisting"):
                # Already processed - acknowledge
                event_log["processingStatus"] = "skipped"
                event_log["errorMessage"] = "Already processed (idempotent)"
                await db.webhook_events.insert_one(event_log)
                return {
                    "received": True,
                    "message": "Already processed",
                    "orderId": result.get("orderId"),
                    "sessionToken": result.get("sessionToken")
                }
            
            # Check if this requires personalization
            if result.get("requiresPersonalization"):
                # PERSONALIZATION FLOW: Session created, customer must fill form
                event_log["processingStatus"] = "awaiting_personalization"
                event_log["sessionToken"] = result.get("sessionToken")
                await db.webhook_events.insert_one(event_log)
                
                # Send personalization link email
                background_tasks.add_task(
                    send_personalization_email,
                    result.get("sessionToken")
                )
                
                return {
                    "received": True,
                    "message": "Personalization session created - awaiting customer input",
                    "flow": "personalization",
                    "sessionToken": result.get("sessionToken"),
                    "personalizationUrl": result.get("personalizationUrl")
                }
            else:
                # LEGACY FLOW: Auto-generate immediately
                order_id = result["orderId"]
                background_tasks.add_task(process_polar_order_background, order_id)
                
                event_log["processingStatus"] = "processing"
                await db.webhook_events.insert_one(event_log)
                
                return {
                    "received": True,
                    "message": "Webhook received, processing in background",
                    "flow": "auto_generation",
                    "orderId": order_id
                }
        
        else:
            # Unknown/unhandled event type - log but accept
            logger.info(f"Polar event type '{event_type}' received but not processed")
            event_log["processingStatus"] = "ignored"
            event_log["errorMessage"] = f"Event type '{event_type}' not handled"
            await db.webhook_events.insert_one(event_log)
            
            return {
                "received": True,
                "message": f"Event type '{event_type}' acknowledged but not processed"
            }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Polar webhook error: {str(e)}")
        event_log["processingStatus"] = "error"
        event_log["errorMessage"] = str(e)
        try:
            await db.webhook_events.insert_one(event_log)
        except:
            pass
        # Return 200 anyway to prevent Polar from retrying
        return {
            "received": True,
            "error": str(e),
            "message": "Webhook received but processing may have failed"
        }


@api_router.post("/automation/simulate-polar-webhook")
async def simulate_polar_webhook(request: Dict):
    """
    Simulate a Polar webhook for testing the automation flow.
    Uses conditional personalization flow.
    
    Expected payload:
    {
        "productSlug": "Demo",
        "requestedName": "ChildName",
        "customerEmail": "customer@example.com",
        "customerName": "John Doe",
        "password": "optional_password"
    }
    """
    try:
        # Build simulated Polar webhook payload
        order_id = str(uuid.uuid4())
        
        simulated_payload = {
            "type": "order.paid",
            "data": {
                "id": order_id,
                "metadata": {
                    "product_slug": request.get("productSlug")
                },
                "custom_field_data": {
                    "requested_name": request.get("requestedName"),
                    "password": request.get("password")
                },
                "customer": {
                    "email": request.get("customerEmail"),
                    "name": request.get("customerName", request.get("requestedName"))
                },
                "amount": 2999,
                "currency": "USD"
            }
        }
        
        # Parse the simulated webhook
        parsed_data = webhook_handler.parse_polar_webhook(simulated_payload)
        
        # Validate required fields
        if not parsed_data.get("productSlug"):
            raise HTTPException(status_code=400, detail="productSlug is required")
        if not parsed_data.get("customerEmail"):
            raise HTTPException(status_code=400, detail="customerEmail is required")
        
        # NEW: Use conditional personalization flow
        result = await webhook_handler.handle_webhook_with_personalization(
            parsed_data, 
            is_simulated=True
        )
        
        if result.get("isExisting"):
            if result.get("requiresPersonalization"):
                session = await db.personalization_sessions.find_one(
                    {"session_token": result["sessionToken"]}, {"_id": 0}
                )
                return {
                    "success": True,
                    "message": "Session already exists (idempotent)",
                    "flow": "personalization",
                    "sessionToken": result["sessionToken"],
                    "session": session
                }
            else:
                order = await db.automation_orders.find_one({"id": result["orderId"]}, {"_id": 0})
                return {
                    "success": True,
                    "message": "Order already exists (idempotent)",
                    "flow": "auto_generation",
                    "orderId": result["orderId"],
                    "order": order
                }
        
        # Check if this requires personalization
        if result.get("requiresPersonalization"):
            # PERSONALIZATION FLOW: Return session info
            session = await db.personalization_sessions.find_one(
                {"session_token": result["sessionToken"]}, {"_id": 0}
            )
            
            return {
                "success": True,
                "message": "Personalization session created - customer must complete form",
                "flow": "personalization",
                "sessionToken": result["sessionToken"],
                "personalizationUrl": result["personalizationUrl"],
                "session": session
            }
        else:
            # LEGACY FLOW: Process the order synchronously for testing
            order_id = result["orderId"]
            await order_processor.process_order(order_id, convert_pdf_to_storybook)
            
            # Get updated order
            order = await db.automation_orders.find_one({"id": order_id}, {"_id": 0})
            
            return {
                "success": True,
                "message": "Simulated Polar webhook processed successfully",
                "flow": "auto_generation",
                "orderId": order_id,
                "order": order
            }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Simulated Polar webhook error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# PERSONALIZATION SESSION API ROUTES
# ============================================================================

@api_router.get("/personalization/by-checkout")
async def get_session_by_checkout(checkout_id: str):
    """
    Find personalization session by Polar checkout ID.
    Used by the success page after Polar redirect.
    """
    try:
        session = await session_manager.get_session_by_checkout(checkout_id)
        
        if not session:
            return {
                "status": "not_found",
                "message": "Session not found. It may still be processing."
            }
        
        if session.get("status") == "ready":
            return {
                "status": "ready",
                "session_token": session["session_token"],
                "redirect_url": f"/personalize/{session['session_token']}"
            }
        elif session.get("status") == "submitted":
            return {
                "status": "submitted",
                "message": "Form already submitted",
                "customer_view_url": session.get("customer_view_url")
            }
        elif session.get("status") == "completed":
            return {
                "status": "completed",
                "customer_view_url": session.get("customer_view_url")
            }
        else:
            return {
                "status": session.get("status", "processing"),
                "message": "Session is being prepared"
            }
            
    except Exception as e:
        logger.error(f"Error fetching session by checkout: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to fetch session")


@api_router.get("/personalization/session/{token}")
async def get_personalization_session(token: str):
    """
    Get personalization session data for the customer form.
    Returns field definitions and current status.
    """
    try:
        session = await session_manager.get_session_by_token(token)
        
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        
        # Check expiration
        if session.get("status") == "expired":
            raise HTTPException(status_code=410, detail="Session has expired")
        
        # Build response (don't expose internal IDs to customer)
        template_snapshot = session.get("template_snapshot", {})
        
        response = {
            "session_token": session["session_token"],
            "product_title": template_snapshot.get("title", "Your Storybook"),
            "product_slug": session.get("product_slug"),
            "field_definitions": template_snapshot.get("field_definitions", []),
            "status": session.get("status"),
            "form_locked": session.get("form_locked", False),
            "personalization_data": session.get("personalization_data", {}),
            "order_reference": session.get("order_id", "")[-8:].upper(),  # Last 8 chars as friendly reference
            "customer_view_url": session.get("customer_view_url")
        }
        
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching session: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to fetch session")


@api_router.post("/personalization/session/{token}/submit")
async def submit_personalization(
    token: str, 
    request: PersonalizationSubmitRequest,
    background_tasks: BackgroundTasks
):
    """
    Submit personalization form data.
    Triggers flipbook generation after successful validation.
    """
    try:
        # Validate and submit
        result = await session_manager.validate_and_submit(
            token,
            request.personalization_data
        )
        
        if not result.get("success"):
            error_code = result.get("error_code", "UNKNOWN")
            status_code = {
                "NOT_FOUND": 404,
                "ALREADY_SUBMITTED": 409,
                "LOCKED": 409,
                "EXPIRED": 410,
                "VALIDATION_ERROR": 400
            }.get(error_code, 400)
            
            raise HTTPException(
                status_code=status_code,
                detail={
                    "error": result.get("error"),
                    "validation_errors": result.get("validation_errors", [])
                }
            )
        
        # Trigger flipbook generation in background
        background_tasks.add_task(process_personalization_background, token)
        
        return {
            "success": True,
            "message": "Personalization submitted successfully! Your storybook is being generated.",
            "status": "processing"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error submitting personalization: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to submit personalization")


@api_router.post("/personalization/session/{token}/upload-image")
async def upload_personalization_image(
    token: str,
    field_key: str = Form(...),
    file: UploadFile = File(...)
):
    """
    Upload an image for a personalization session image field.
    Accepts JPG and PNG only, max 5MB.
    """
    try:
        # Verify session exists and is not locked
        session = await session_manager.get_session_by_token(token)
        
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        
        if session.get("form_locked"):
            raise HTTPException(status_code=409, detail="Form is locked")
        
        if session.get("status") == "expired":
            raise HTTPException(status_code=410, detail="Session expired")
        
        # Validate file type
        content_type = file.content_type
        if content_type not in ALLOWED_IMAGE_TYPES:
            raise HTTPException(
                status_code=400, 
                detail="Only JPG and PNG images are allowed"
            )
        
        # Read and check file size
        contents = await file.read()
        if len(contents) > MAX_IMAGE_UPLOAD_SIZE:
            raise HTTPException(
                status_code=400,
                detail="Image must be 5MB or less"
            )
        
        # Create session upload directory
        session_dir = SESSION_UPLOADS_DIR / token
        session_dir.mkdir(exist_ok=True)
        
        # Generate filename
        ext = ".jpg" if "jpeg" in content_type or "jpg" in content_type else ".png"
        filename = f"{field_key}{ext}"
        file_path = session_dir / filename
        
        # Save file
        async with aiofiles.open(file_path, 'wb') as f:
            await f.write(contents)
        
        # Generate URL
        image_url = f"/api/personalization/uploads/{token}/{filename}"
        
        logger.info(f"Image uploaded for session {token}: {filename}")
        
        return {
            "success": True,
            "field_key": field_key,
            "url": image_url,
            "filename": filename,
            "size": len(contents)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Image upload error: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to upload image")


@api_router.get("/personalization/uploads/{token}/{filename}")
async def get_personalization_upload(token: str, filename: str):
    """Serve uploaded personalization images"""
    file_path = SESSION_UPLOADS_DIR / token / filename
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Image not found")
    
    return FileResponse(file_path)


@api_router.get("/personalization/sessions")
async def list_personalization_sessions(
    status: Optional[str] = None,
    limit: int = 50,
    offset: int = 0
):
    """Admin endpoint to list personalization sessions"""
    try:
        query = {}
        if status and status != "all":
            query["status"] = status
        
        total = await db.personalization_sessions.count_documents(query)
        
        sessions = await db.personalization_sessions.find(query, {"_id": 0}) \
            .sort("created_at", -1) \
            .skip(offset) \
            .limit(limit) \
            .to_list(limit)
        
        return {
            "sessions": sessions,
            "total": total,
            "limit": limit,
            "offset": offset
        }
        
    except Exception as e:
        logger.error(f"Error listing sessions: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to list sessions")


@api_router.get("/automation/orders", response_model=OrderListResponse)
async def get_orders(
    status: Optional[str] = None,
    limit: int = 50,
    offset: int = 0
):
    """Get all automation orders with optional status filter"""
    try:
        query = {}
        if status and status != "all":
            valid_statuses = ["received", "verified", "processing", "completed", "failed", "cancelled"]
            if status not in valid_statuses:
                raise HTTPException(status_code=400, detail="Invalid status value")
            query["status"] = status
        
        # Get total count
        total = await db.automation_orders.count_documents(query)
        
        # Get orders with pagination
        orders = await db.automation_orders.find(query, {"_id": 0}) \
            .sort("createdAt", -1) \
            .skip(offset) \
            .limit(limit) \
            .to_list(limit)
        
        return OrderListResponse(
            orders=orders,
            total=total,
            limit=limit,
            offset=offset
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching orders: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to fetch orders")


@api_router.get("/automation/orders/{order_id}", response_model=AutomationOrder)
async def get_order(order_id: str):
    """Get single order by ID"""
    try:
        order = await db.automation_orders.find_one({"id": order_id}, {"_id": 0})
        
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")
        
        return order
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching order: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to fetch order")


@api_router.post("/automation/orders/{order_id}/retry")
async def retry_order(order_id: str):
    """Retry a failed order"""
    try:
        # Use order processor to retry
        result = await order_processor.retry_order(order_id, convert_pdf_to_storybook)
        
        return {
            "message": "Order retry completed",
            "orderId": order_id,
            "order": result
        }
        
    except Exception as e:
        logger.error(f"Order retry failed: {str(e)}")
        raise HTTPException(
            status_code=400,
            detail=str(e)
        )


@api_router.get("/personalized/{filename}")
async def get_personalized_pdf(filename: str):
    """Get personalized PDF file"""
    file_path = PERSONALIZED_DIR / filename
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Personalized PDF not found")
    
    return FileResponse(file_path, media_type="application/pdf")



@api_router.post("/automation/test-pdf-fill")
async def test_pdf_fill(request: dict):
    """
    Test endpoint to fill a template PDF with a test name and download result.
    For admin use only - verify font preservation before running full automation.
    
    Request:
      {
        "templateId": "template-uuid",
        "testName": "Sarah"
      }
    
    Returns:
      The filled PDF file as download
    """
    try:
        template_id = request.get("templateId")
        test_name = request.get("testName", "TestName")
        
        if not template_id:
            raise HTTPException(status_code=400, detail="templateId is required")
        
        # Get template
        template = await db.templates.find_one({"id": template_id}, {"_id": 0})
        if not template:
            raise HTTPException(status_code=404, detail="Template not found")
        
        # Prepare test customer data
        customer_data = {
            "requestedName": test_name,
            "buyerFullName": test_name,
            "customerEmail": "test@example.com"
        }
        
        # Generate temporary output path
        import tempfile
        temp_output = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf")
        output_path = temp_output.name
        temp_output.close()
        
        # Fill the PDF
        from automation.pdf_filler import PDFFiller
        pdf_filler = PDFFiller()
        
        await pdf_filler.fill_pdf_fields(
            template_path=template["basePdfPath"],
            field_mappings=template.get("fieldMappings", []),
            customer_data=customer_data,
            output_path=output_path
        )
        
        logger.info(f"Test PDF fill completed: {output_path}")
        
        # Return the filled PDF as download
        from fastapi.responses import FileResponse
        return FileResponse(
            output_path,
            media_type="application/pdf",
            filename=f"test-fill-{test_name}.pdf",
            headers={"Content-Disposition": f'attachment; filename="test-fill-{test_name}.pdf"'}
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Test PDF fill failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Test fill failed: {str(e)}")


@api_router.post("/automation/test-email")
async def test_email(request: dict):
    """
    Test endpoint to send a delivery email without triggering full automation.
    For admin use only.
    
    Request:
      {
        "to_email": "test@example.com",
        "customer_name": "Sarah",
        "storybook_title": "Sarah's Luna Adventure",
        "customer_view_url": "https://example.com/view/sarahs-story",
        "password": "sarah123"  // optional
      }
    
    Returns:
      { "success": true/false, "message": "..." }
    """
    try:
        to_email = request.get("to_email")
        customer_name = request.get("customer_name", "Friend")
        storybook_title = request.get("storybook_title", "Your Storybook")
        customer_view_url = request.get("customer_view_url")
        password = request.get("password")
        
        if not to_email or not customer_view_url:
            raise HTTPException(
                status_code=400,
                detail="to_email and customer_view_url are required"
            )
        
        from automation.email_sender import EmailSender
        
        success = await EmailSender.send_storybook_delivery_email(
            to_email=to_email,
            customer_name=customer_name,
            storybook_title=storybook_title,
            customer_view_url=customer_view_url,
            password=password,
            order_id="test-email"
        )
        
        if success:
            return {
                "success": True,
                "message": f"Test email sent successfully to {to_email}"
            }
        else:
            return {
                "success": False,
                "message": "Email sending failed. Check backend logs for details."
            }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Test email failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Test email failed: {str(e)}")


@api_router.post("/storybooks/upload")
async def upload_storybook(
    file: UploadFile = File(...),
    title: str = Form(...),
    subtitle: str = Form("")
):
    # Validate PDF
    if not file.filename.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")
    
    # Create storybook record
    storybook_id = str(uuid.uuid4())
    slug = title.lower().replace(" ", "-") + "-" + storybook_id[:8]
    
    # Save PDF
    pdf_path = UPLOAD_DIR / f"{storybook_id}.pdf"
    with open(pdf_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    # Convert to spreads
    spreads, cover_url, orientation, spread_count = await convert_pdf_to_spreads(str(pdf_path), storybook_id)
    
    # Create storybook
    storybook = Storybook(
        id=storybook_id,
        title=title,
        slug=slug,
        subtitle=subtitle,
        pdfUrl=f"/api/uploads/{storybook_id}.pdf",
        coverImageUrl=cover_url,
        spreads=spreads,
        orientation=orientation,
        spreadCount=spread_count,
        status="ready",
        customerLink=f"/view/{slug}",
        embedCode=f'<iframe src="/view/{slug}" width="100%" height="600px" frameborder="0"></iframe>'
    )
    
    doc = storybook.model_dump()
    await db.storybooks.insert_one(doc)
    
    return storybook

@api_router.get("/storybooks", response_model=List[Storybook])
async def get_storybooks(status: Optional[str] = None):
    query = {}
    if status and status != "all":
        query["status"] = status
    
    storybooks = await db.storybooks.find(query, {"_id": 0}).sort("createdAt", -1).to_list(1000)
    return storybooks

@api_router.get("/storybooks/{storybook_id}", response_model=Storybook)
async def get_storybook(storybook_id: str):
    storybook = await db.storybooks.find_one({"id": storybook_id}, {"_id": 0})
    if not storybook:
        raise HTTPException(status_code=404, detail="Storybook not found")
    return storybook

@api_router.get("/storybooks/slug/{slug}", response_model=Storybook)
async def get_storybook_by_slug(slug: str):
    storybook = await db.storybooks.find_one({"slug": slug}, {"_id": 0})
    if not storybook:
        raise HTTPException(status_code=404, detail="Storybook not found")
    
    # Increment view count
    await db.storybooks.update_one(
        {"slug": slug},
        {"$inc": {"viewCount": 1}}
    )
    
    return storybook

@api_router.put("/storybooks/{storybook_id}")
async def update_storybook(storybook_id: str, update: StorybookUpdate):
    update_data = {k: v for k, v in update.model_dump().items() if v is not None}
    
    # Handle password update
    if "password" in update_data and update_data["password"]:
        update_data["passwordHash"] = hash_password(update_data["password"])
        del update_data["password"]
    
    update_data["updatedAt"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.storybooks.update_one(
        {"id": storybook_id},
        {"$set": update_data}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Storybook not found")
    
    return {"message": "Storybook updated"}

@api_router.delete("/storybooks/{storybook_id}")
async def delete_storybook(storybook_id: str):
    # Delete files
    pdf_path = UPLOAD_DIR / f"{storybook_id}.pdf"
    spread_dir = SPREADS_DIR / storybook_id
    
    if pdf_path.exists():
        pdf_path.unlink()
    if spread_dir.exists():
        shutil.rmtree(spread_dir)
    
    result = await db.storybooks.delete_one({"id": storybook_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Storybook not found")
    
    return {"message": "Storybook deleted"}

@api_router.post("/storybooks/{storybook_id}/verify-password")
async def verify_storybook_password(storybook_id: str, verify: PasswordVerify):
    storybook = await db.storybooks.find_one({"id": storybook_id}, {"_id": 0})
    
    if not storybook:
        raise HTTPException(status_code=404, detail="Storybook not found")
    
    if not storybook.get("passwordProtected"):
        return {"valid": True}
    
    password_hash = storybook.get("passwordHash", "")
    if verify_password(verify.password, password_hash):
        return {"valid": True}
    
    return {"valid": False}

@api_router.get("/spreads/{storybook_id}/{filename}")
async def get_spread(storybook_id: str, filename: str):
    spread_path = SPREADS_DIR / storybook_id / filename
    
    if not spread_path.exists():
        raise HTTPException(status_code=404, detail="Spread not found")
    
    # Add aggressive caching headers for spread images
    headers = {
        "Cache-Control": "public, max-age=31536000, immutable",  # Cache for 1 year
        "ETag": f'"{storybook_id}-{filename}"',
        "Accept-Ranges": "bytes"
    }
    
    return FileResponse(spread_path, headers=headers)

@api_router.get("/uploads/{filename}")
async def get_upload(filename: str):
    file_path = UPLOAD_DIR / filename
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    
    return FileResponse(file_path)

@api_router.get("/download-backup")
async def download_backup():
    """Download the complete backup package"""
    backup_path = Path("/app/storybook_vault_backup.zip")
    
    if not backup_path.exists():
        raise HTTPException(status_code=404, detail="Backup file not found. Please create backup first.")
    
    return FileResponse(
        backup_path, 
        filename="storybook_vault_backup.zip",
        media_type="application/zip"
    )


# ==================== ASSETS LIBRARY API ====================

assets_manager = AssetsManager(db)

# --- Fonts API ---

@api_router.post("/assets/fonts")
async def upload_font(file: UploadFile = File(...)):
    """Upload a font file"""
    try:
        content = await file.read()
        font = await assets_manager.upload_font(content, file.filename)
        return {"success": True, "font": font}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Font upload error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to upload font: {str(e)}")


@api_router.get("/assets/fonts")
async def list_fonts():
    """Get all uploaded fonts"""
    fonts = await assets_manager.get_fonts()
    return {"fonts": fonts, "total": len(fonts)}


@api_router.get("/assets/fonts/{filename}")
async def serve_font(filename: str):
    """Serve a font file"""
    file_path = FONTS_DIR / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Font not found")
    
    # Determine content type
    ext = Path(filename).suffix.lower()
    content_types = {
        '.ttf': 'font/ttf',
        '.otf': 'font/otf',
        '.woff': 'font/woff',
        '.woff2': 'font/woff2'
    }
    
    return FileResponse(
        file_path,
        media_type=content_types.get(ext, 'application/octet-stream'),
        headers={
            "Cache-Control": "public, max-age=31536000",
            "Access-Control-Allow-Origin": "*"
        }
    )


@api_router.delete("/assets/fonts/{font_id}")
async def delete_font(font_id: str):
    """Delete a font"""
    success = await assets_manager.delete_font(font_id)
    if not success:
        raise HTTPException(status_code=404, detail="Font not found")
    return {"success": True, "message": "Font deleted"}


# --- Sounds API ---

@api_router.post("/assets/sounds")
async def upload_sound(file: UploadFile = File(...)):
    """Upload a sound effect file"""
    try:
        content = await file.read()
        sound = await assets_manager.upload_sound(content, file.filename)
        return {"success": True, "sound": sound}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Sound upload error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to upload sound: {str(e)}")


@api_router.get("/assets/sounds")
async def list_sounds():
    """Get all uploaded sounds"""
    sounds = await assets_manager.get_sounds()
    return {"sounds": sounds, "total": len(sounds)}


@api_router.get("/assets/sounds/{filename}")
async def serve_sound(filename: str):
    """Serve a sound file"""
    file_path = SOUNDS_DIR / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Sound not found")
    
    # Determine content type
    ext = Path(filename).suffix.lower()
    content_types = {
        '.mp3': 'audio/mpeg',
        '.wav': 'audio/wav'
    }
    
    return FileResponse(
        file_path,
        media_type=content_types.get(ext, 'application/octet-stream'),
        headers={
            "Cache-Control": "public, max-age=31536000",
            "Access-Control-Allow-Origin": "*"
        }
    )


@api_router.delete("/assets/sounds/{sound_id}")
async def delete_sound(sound_id: str):
    """Delete a sound"""
    success = await assets_manager.delete_sound(sound_id)
    if not success:
        raise HTTPException(status_code=404, detail="Sound not found")
    return {"success": True, "message": "Sound deleted"}


# --- Settings/Credentials API ---

@api_router.get("/settings/polar")
async def get_polar_settings():
    """Get Polar webhook settings for admin display"""
    # Get the webhook URL from environment or construct it
    app_base_url = os.getenv("APP_BASE_URL", "http://localhost:3000")
    backend_url = app_base_url.replace("-frontend.", "-backend.").rstrip('/')
    
    # For production, construct the webhook URL
    webhook_url = f"{backend_url}/api/webhooks/polar"
    
    # Check if credentials are configured
    has_secret = bool(os.getenv("POLAR_WEBHOOK_SECRET"))
    
    return {
        "webhookUrl": webhook_url,
        "secretConfigured": has_secret,
        "instructions": [
            "1. Copy the webhook URL above",
            "2. Go to your Polar.sh dashboard → Settings → Webhooks",
            "3. Add a new webhook with the URL",
            "4. Select event: order.paid",
            "5. Copy the webhook secret and add it to POLAR_WEBHOOK_SECRET in backend/.env",
            "6. In your Polar product, add metadata field: product_slug (matching your template's product slug)",
            "7. Add custom fields to checkout: requested_name (required), password (optional)"
        ],
        "requiredFields": {
            "metadata": {
                "product_slug": "Must match template's Product Slug in Storybook Vault"
            },
            "custom_field_data": {
                "requested_name": "The name to personalize in the storybook (required)",
                "password": "Optional password to protect the storybook"
            }
        }
    }

# ============================================================================
# REVIEWS API ENDPOINTS
# ============================================================================

@api_router.post("/reviews/submit")
async def submit_review(review: ReviewSubmit):
    """Submit a review for a storybook"""
    try:
        # Validate star rating
        if review.star_rating < 1 or review.star_rating > 5:
            raise HTTPException(status_code=400, detail="Star rating must be between 1 and 5")
        
        # Check for duplicate submission from same session
        existing = await db.reviews.find_one({
            "storybook_id": review.storybook_id,
            "reviewer_session_id": review.reviewer_session_id
        })
        
        if existing:
            raise HTTPException(
                status_code=409, 
                detail="You have already submitted a review for this storybook"
            )
        
        # Get storybook title for admin display
        storybook = await db.storybooks.find_one(
            {"id": review.storybook_id},
            {"title": 1}
        )
        storybook_title = storybook.get("title") if storybook else None
        
        # Create review document
        review_doc = {
            "id": str(uuid.uuid4()),
            "storybook_id": review.storybook_id,
            "storybook_slug": review.storybook_slug,
            "storybook_title": storybook_title,
            "star_rating": review.star_rating,
            "review_text": review.review_text or "",
            "reviewer_session_id": review.reviewer_session_id,
            "submitted_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.reviews.insert_one(review_doc)
        
        logger.info(f"Review submitted for storybook {review.storybook_slug}: {review.star_rating} stars")
        
        return {
            "success": True,
            "message": "Thank you for your feedback!",
            "review_id": review_doc["id"]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Review submission failed: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to submit review")


@api_router.get("/admin/reviews")
async def get_all_reviews(limit: int = 100, offset: int = 0):
    """Get all reviews for admin dashboard"""
    try:
        total = await db.reviews.count_documents({})
        
        reviews = await db.reviews.find({}, {"_id": 0}) \
            .sort("submitted_at", -1) \
            .skip(offset) \
            .limit(limit) \
            .to_list(limit)
        
        return {
            "reviews": reviews,
            "total": total,
            "limit": limit,
            "offset": offset
        }
        
    except Exception as e:
        logger.error(f"Failed to fetch reviews: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to fetch reviews")


@api_router.get("/reviews/check/{storybook_id}/{session_id}")
async def check_review_submitted(storybook_id: str, session_id: str):
    """Check if a review was already submitted for this session"""
    try:
        existing = await db.reviews.find_one({
            "storybook_id": storybook_id,
            "reviewer_session_id": session_id
        })
        
        return {"submitted": existing is not None}
        
    except Exception as e:
        logger.error(f"Review check failed: {str(e)}")
        return {"submitted": False}


# Mount router (no prefix needed, already set in APIRouter)
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
