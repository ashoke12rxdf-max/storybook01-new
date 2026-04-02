from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import uuid
import secrets
import string

# =============================================================================
# FIELD DEFINITION MODELS (for dynamic personalization forms)
# =============================================================================

class FieldDefinition(BaseModel):
    """Defines a customer input field for personalization"""
    field_key: str                    # Unique key: dad_name, son_name, message, etc.
    label: str                        # Display label: "Father's Name"
    type: str = "text"                # text | textarea | image | date | select
    required: bool = True
    placeholder: str = ""
    help_text: str = ""
    options: List[str] = []           # For select type
    max_length: Optional[int] = None
    validation_regex: Optional[str] = None


class SpreadBlock(BaseModel):
    """Defines a text/image block position on a spread"""
    spread_id: int                    # Which spread (0-indexed)
    block_id: str                     # Unique block identifier
    type: str = "text"                # text | image
    x: float = 0                      # X position in pixels
    y: float = 0                      # Y position in pixels
    width: float = 200                # Width in pixels
    height: float = 50                # Height in pixels
    text_template: str = ""           # e.g., "From [dad_name] to [son_name]"
    allowed_fields: List[str] = []    # Fields this block uses
    font_family: str = "Helvetica"
    font_size: int = 24
    font_weight: str = "normal"       # normal | bold
    italic: bool = False
    color: str = "#000000"
    alignment: str = "left"           # left | center | right | justify
    max_lines: int = 1
    overflow_behavior: str = "shrink" # truncate | shrink | wrap
    rotation: float = 0
    z_index: int = 1


# =============================================================================
# TEMPLATE MODELS (extended with personalization fields)
# =============================================================================

class FillableField(BaseModel):
    """Represents a fillable field detected in a PDF"""
    fieldName: str
    fieldType: str  # text, checkbox, radio, etc.
    pageNumber: int
    currentValue: str = ""
    bounds: Dict[str, float] = {}  # {x, y, w, h}


class FieldMapping(BaseModel):
    """Maps a PDF field to a variable type"""
    pdfFieldName: str
    variableType: str  # "requestedName" or custom field_key
    fallbackValue: str = ""


class TemplateStylingDefaults(BaseModel):
    """Default styling settings for generated storybooks"""
    fontId: Optional[str] = None
    fontName: Optional[str] = None
    fontUrl: Optional[str] = None
    soundId: Optional[str] = None
    soundName: Optional[str] = None
    soundUrl: Optional[str] = None
    flippingEffect: str = "StoryParallax"
    themePreset: str = "Warm Cream"
    accentColor: str = "#C9A86A"


class Template(BaseModel):
    """Complete template record with personalization support"""
    model_config = ConfigDict(extra="ignore")
    
    # Core identification
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    productSlug: str
    description: str = ""
    
    # File references
    basePdfPath: str
    basePdfUrl: str
    
    # Fillable fields (auto-detected from PDF)
    fillableFields: List[FillableField] = []
    
    # Field mappings (admin configured - legacy single-field system)
    fieldMappings: List[FieldMapping] = []
    
    # NEW: Multi-field personalization definitions
    field_definitions: List[FieldDefinition] = []
    
    # NEW: Visual text block positions for spreads
    spread_blocks: List[SpreadBlock] = []
    
    # Styling defaults for generated storybooks
    stylingDefaults: Optional[TemplateStylingDefaults] = None
    
    # Template metadata
    status: str = "draft"  # draft | active | inactive | archived
    orientation: str = "landscape"
    pageCount: int = 0
    thumbnailUrl: str = ""
    
    # Timestamps
    createdAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updatedAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    activatedAt: Optional[str] = None
    deactivatedAt: Optional[str] = None
    archivedAt: Optional[str] = None
    
    @property
    def requires_personalization(self) -> bool:
        """Returns True if template has field definitions requiring customer input"""
        return len(self.field_definitions) > 0


class TemplateCreate(BaseModel):
    """Request model for creating template"""
    title: str
    productSlug: str
    description: str = ""


class TemplateUpdate(BaseModel):
    """Request model for updating template"""
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    fieldMappings: Optional[List[FieldMapping]] = None
    stylingDefaults: Optional[TemplateStylingDefaults] = None
    field_definitions: Optional[List[FieldDefinition]] = None
    spread_blocks: Optional[List[SpreadBlock]] = None


class TemplateListResponse(BaseModel):
    """Response model for template list"""
    templates: List[Template]
    total: int


# =============================================================================
# PERSONALIZATION SESSION MODELS
# =============================================================================

def generate_session_token() -> str:
    """Generate a secure session token with psn_ prefix"""
    chars = string.ascii_letters + string.digits
    random_part = ''.join(secrets.choice(chars) for _ in range(16))
    return f"psn_{random_part}"


class TemplateSnapshot(BaseModel):
    """Frozen template data at order/session time"""
    productSlug: str
    basePdfPath: str
    title: str
    fieldMappings: List[Dict] = []
    field_definitions: List[Dict] = []
    spread_blocks: List[Dict] = []
    pageCount: int
    orientation: str
    stylingDefaults: Optional[Dict] = None


class PersonalizationSession(BaseModel):
    """Tracks a customer's personalization session after payment"""
    model_config = ConfigDict(extra="ignore")
    
    # Session identification
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    session_token: str = Field(default_factory=generate_session_token)
    
    # Payment/order linkage
    checkout_id: str                  # From Polar redirect URL
    order_id: str                     # From Polar webhook
    external_order_id: str            # For idempotency
    
    # Customer info
    customer_email: str
    customer_name: str = ""
    
    # Legacy compatibility: single requested name from old flow
    requested_name: str = ""
    
    # Product/template linkage
    product_slug: str
    template_id: str
    
    # Frozen template data at session creation
    template_snapshot: TemplateSnapshot
    
    # Customer-submitted personalization data
    personalization_data: Dict[str, Any] = {}
    
    # Session state
    status: str = "pending"           # pending | ready | submitted | expired | processing | completed
    form_locked: bool = False
    submit_count: int = 0             # Must never exceed 1
    
    # Generated storybook (after submission)
    storybook_id: Optional[str] = None
    storybook_slug: Optional[str] = None
    customer_view_url: Optional[str] = None
    
    # Processing info
    error_message: Optional[str] = None
    
    # Timestamps
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    submitted_at: Optional[str] = None
    completed_at: Optional[str] = None
    expires_at: Optional[str] = None  # 30 days from creation


class PersonalizationSubmitRequest(BaseModel):
    """Request model for submitting personalization form"""
    personalization_data: Dict[str, Any]


class PersonalizationSessionResponse(BaseModel):
    """Response model for session data (customer-facing)"""
    session_token: str
    product_title: str
    product_slug: str
    field_definitions: List[Dict]
    status: str
    form_locked: bool
    personalization_data: Dict[str, Any] = {}
    order_reference: str              # Friendly reference (last 8 chars of order_id)
    customer_view_url: Optional[str] = None


# =============================================================================
# ORDER MODELS (existing - for backward compatibility)
# =============================================================================

class ProcessingLogEntry(BaseModel):
    """Single log entry in order processing"""
    timestamp: str
    status: str
    message: str


class CustomerData(BaseModel):
    """Customer information from webhook"""
    requestedName: str
    buyerFullName: str
    customerEmail: str
    password: Optional[str] = None
    customFields: Dict = {}


class PaymentData(BaseModel):
    """Payment information from webhook"""
    amount: Optional[int] = None
    currency: Optional[str] = None
    paymentMethod: Optional[str] = None
    transactionId: Optional[str] = None


class AutomationOrder(BaseModel):
    """Complete automation order record"""
    model_config = ConfigDict(extra="ignore")
    
    # Core identification
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    externalOrderId: str
    webhookEventId: Optional[str] = None
    isSimulatedWebhook: bool = False
    
    # Customer data
    customerData: CustomerData
    
    # Product & template linkage
    productSlug: str
    templateId: Optional[str] = None
    templateTitle: Optional[str] = None
    
    # Template snapshot
    templateSnapshot: Optional[TemplateSnapshot] = None
    
    # Link to personalization session (if applicable)
    personalization_session_id: Optional[str] = None
    
    # Payment data
    paymentData: Optional[PaymentData] = None
    
    # Processing status
    status: str = "received"
    
    # Generation locking
    generationLocked: bool = False
    lockedAt: Optional[str] = None
    finalizedAt: Optional[str] = None
    
    # Generated assets
    personalizedPdfPath: Optional[str] = None
    personalizedPdfUrl: Optional[str] = None
    
    # Generated storybook
    storybookId: Optional[str] = None
    storybookSlug: Optional[str] = None
    customerViewUrl: Optional[str] = None
    
    # Processing logs
    processingLog: List[ProcessingLogEntry] = []
    
    # Error tracking
    errorMessage: Optional[str] = None
    errorDetails: Optional[str] = None
    retryCount: int = 0
    lastRetryAt: Optional[str] = None
    
    # Email delivery
    emailSent: bool = False
    emailSentAt: Optional[str] = None
    
    # Timestamps
    createdAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updatedAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    completedAt: Optional[str] = None


class WebhookSimulateRequest(BaseModel):
    """Request model for simulating webhook"""
    productSlug: str
    requestedName: str
    buyerFullName: Optional[str] = None
    customerEmail: str
    password: Optional[str] = None
    orderId: Optional[str] = None


class OrderListResponse(BaseModel):
    """Response model for order list"""
    orders: List[AutomationOrder]
    total: int
    limit: int
    offset: int
