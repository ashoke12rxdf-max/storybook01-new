"""
Assets Management Module
Handles fonts and sound effects for the application
"""
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Dict, Optional
import logging
import uuid
import os

logger = logging.getLogger(__name__)

# Asset directories
ASSETS_DIR = Path(__file__).parent / "assets"
FONTS_DIR = ASSETS_DIR / "fonts"
SOUNDS_DIR = ASSETS_DIR / "sounds"

# Ensure directories exist
FONTS_DIR.mkdir(parents=True, exist_ok=True)
SOUNDS_DIR.mkdir(parents=True, exist_ok=True)

# Allowed file extensions
ALLOWED_FONT_EXTENSIONS = {'.ttf', '.otf', '.woff', '.woff2'}
ALLOWED_SOUND_EXTENSIONS = {'.mp3', '.wav'}


class AssetsManager:
    """Manages fonts and sound effects assets"""
    
    def __init__(self, db):
        self.db = db
    
    # ==================== FONTS ====================
    
    async def upload_font(self, file_content: bytes, filename: str) -> Dict:
        """
        Upload a font file.
        
        Args:
            file_content: The font file bytes
            filename: Original filename
            
        Returns:
            Font metadata dict
        """
        # Validate extension
        ext = Path(filename).suffix.lower()
        if ext not in ALLOWED_FONT_EXTENSIONS:
            raise ValueError(f"Invalid font format. Allowed: {', '.join(ALLOWED_FONT_EXTENSIONS)}")
        
        # Generate unique ID and filename
        font_id = str(uuid.uuid4())
        safe_filename = f"{font_id}{ext}"
        file_path = FONTS_DIR / safe_filename
        
        # Extract font name from filename (remove extension)
        font_name = Path(filename).stem
        
        # Save file
        with open(file_path, 'wb') as f:
            f.write(file_content)
        
        # Create metadata
        font_data = {
            "id": font_id,
            "name": font_name,
            "originalFilename": filename,
            "filename": safe_filename,
            "filePath": str(file_path),
            "publicUrl": f"/api/assets/fonts/{safe_filename}",
            "extension": ext,
            "fileSize": len(file_content),
            "uploadedAt": datetime.now(timezone.utc).isoformat(),
            "type": "font"
        }
        
        # Save to database
        await self.db.assets.insert_one(font_data)
        
        logger.info(f"Font uploaded: {font_name} ({font_id})")
        return {k: v for k, v in font_data.items() if k != '_id'}
    
    async def get_fonts(self) -> List[Dict]:
        """Get all uploaded fonts"""
        fonts = await self.db.assets.find(
            {"type": "font"},
            {"_id": 0}
        ).sort("uploadedAt", -1).to_list(length=100)
        return fonts
    
    async def get_font(self, font_id: str) -> Optional[Dict]:
        """Get a single font by ID"""
        return await self.db.assets.find_one(
            {"id": font_id, "type": "font"},
            {"_id": 0}
        )
    
    async def delete_font(self, font_id: str) -> bool:
        """Delete a font"""
        font = await self.get_font(font_id)
        if not font:
            return False
        
        # Delete file
        file_path = Path(font["filePath"])
        if file_path.exists():
            file_path.unlink()
        
        # Delete from database
        await self.db.assets.delete_one({"id": font_id})
        
        logger.info(f"Font deleted: {font['name']} ({font_id})")
        return True
    
    # ==================== SOUNDS ====================
    
    async def upload_sound(self, file_content: bytes, filename: str) -> Dict:
        """
        Upload a sound effect file.
        
        Args:
            file_content: The audio file bytes
            filename: Original filename
            
        Returns:
            Sound metadata dict
        """
        # Validate extension
        ext = Path(filename).suffix.lower()
        if ext not in ALLOWED_SOUND_EXTENSIONS:
            raise ValueError(f"Invalid sound format. Allowed: {', '.join(ALLOWED_SOUND_EXTENSIONS)}")
        
        # Generate unique ID and filename
        sound_id = str(uuid.uuid4())
        safe_filename = f"{sound_id}{ext}"
        file_path = SOUNDS_DIR / safe_filename
        
        # Extract sound name from filename (remove extension)
        sound_name = Path(filename).stem
        
        # Save file
        with open(file_path, 'wb') as f:
            f.write(file_content)
        
        # Create metadata
        sound_data = {
            "id": sound_id,
            "name": sound_name,
            "originalFilename": filename,
            "filename": safe_filename,
            "filePath": str(file_path),
            "publicUrl": f"/api/assets/sounds/{safe_filename}",
            "extension": ext,
            "fileSize": len(file_content),
            "uploadedAt": datetime.now(timezone.utc).isoformat(),
            "type": "sound"
        }
        
        # Save to database
        await self.db.assets.insert_one(sound_data)
        
        logger.info(f"Sound uploaded: {sound_name} ({sound_id})")
        return {k: v for k, v in sound_data.items() if k != '_id'}
    
    async def get_sounds(self) -> List[Dict]:
        """Get all uploaded sounds"""
        sounds = await self.db.assets.find(
            {"type": "sound"},
            {"_id": 0}
        ).sort("uploadedAt", -1).to_list(length=100)
        return sounds
    
    async def get_sound(self, sound_id: str) -> Optional[Dict]:
        """Get a single sound by ID"""
        return await self.db.assets.find_one(
            {"id": sound_id, "type": "sound"},
            {"_id": 0}
        )
    
    async def delete_sound(self, sound_id: str) -> bool:
        """Delete a sound"""
        sound = await self.get_sound(sound_id)
        if not sound:
            return False
        
        # Delete file
        file_path = Path(sound["filePath"])
        if file_path.exists():
            file_path.unlink()
        
        # Delete from database
        await self.db.assets.delete_one({"id": sound_id})
        
        logger.info(f"Sound deleted: {sound['name']} ({sound_id})")
        return True
