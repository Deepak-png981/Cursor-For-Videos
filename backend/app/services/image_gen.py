import os
import uuid
import httpx
import aiofiles
from pathlib import Path
from ..core.config import get_settings

settings = get_settings()

class ImageGenerationService:
    def __init__(self):
        self.api_key = settings.OPENAI_API_KEY
        self.storage_path = Path(settings.STORAGE_DIR).resolve()
        
    async def generate_image(self, prompt: str, project_id: str) -> str:
        """
        Generates an image using DALL-E 3 and saves it locally.
        Returns the absolute local path to the image.
        """
        try:
            print(f"Generating image for prompt: {prompt[:50]}...")
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "https://api.openai.com/v1/images/generations",
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": "dall-e-3",
                        "prompt": prompt,
                        "n": 1,
                        "size": "1024x1024",
                        "response_format": "url"
                    },
                    timeout=60.0
                )
                response.raise_for_status()
                data = response.json()
                image_url = data['data'][0]['url']
                
                # Download image
                image_response = await client.get(image_url)
                image_response.raise_for_status()
                
                # Save to storage
                image_id = str(uuid.uuid4())
                assets_dir = self.storage_path / project_id / "assets"
                assets_dir.mkdir(parents=True, exist_ok=True)
                
                file_path = assets_dir / f"{image_id}.png"
                
                async with aiofiles.open(file_path, 'wb') as f:
                    await f.write(image_response.content)
                    
                return str(file_path)
                
        except Exception as e:
            print(f"Image generation failed: {e}")
            return None

image_service = ImageGenerationService()

