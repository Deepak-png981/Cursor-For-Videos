import asyncio
import uuid
from pathlib import Path
from typing import Optional

import aiofiles
from openai import AsyncOpenAI

from ..core.config import get_settings


settings = get_settings()


class OpenAIVideoService:
    def __init__(self) -> None:
        if not settings.OPENAI_API_KEY:
            raise ValueError("OPENAI_API_KEY must be set")
        self.client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        self.model = settings.OPENAI_VIDEO_MODEL
        self.storage_path = Path(settings.STORAGE_DIR).resolve()
        self.storage_path.mkdir(parents=True, exist_ok=True)

    async def generate_video(
        self,
        *,
        project_id: str,
        scene_index: int,
        title: str,
        description: str,
        visual_plan: Optional[str] = None,
        voiceover: Optional[str] = None,
        target_duration_seconds: Optional[float] = None,
        on_progress: Optional[callable] = None,
    ) -> str:
        prompt_parts = [
            f"Scene {scene_index + 1}: {title}",
            "",
            "Description:",
            description or "",
        ]

        if visual_plan:
            prompt_parts.extend(
                ["", "Visual plan (step by step, what the camera shows):", visual_plan]
            )

        if voiceover:
            prompt_parts.extend(
                ["", "Voiceover transcript (for timing context):", voiceover]
            )

        if target_duration_seconds and target_duration_seconds > 0:
            prompt_parts.extend(
                [
                    "",
                    f"Target approximate duration: {int(target_duration_seconds)} seconds.",
                    "Keep pacing natural but stay close to this duration.",
                ]
            )

        prompt = "\n".join(prompt_parts)
        print("prompt to OpenAI video:", prompt)

        # Map to supported durations (4, 8, 12 seconds) for Sora
        if not target_duration_seconds or target_duration_seconds <= 4:
            seconds = 4
        elif target_duration_seconds <= 8:
            seconds = 8
        else:
            seconds = 12

        # Sora expects seconds as a string enum: "4", "8", or "12"
        # We use manual create + poll loop to support progress updates if callback provided
        if on_progress:
            await on_progress("Submitting generation job...")
            
        video = await self.client.videos.create(
            model=self.model,
            prompt=prompt,
            seconds=str(seconds),
        )
        
        video_id = video.id
        while True:
            video = await self.client.videos.retrieve(video_id)
            if video.status == "completed":
                break
            if video.status == "failed":
                message = getattr(getattr(video, "error", None), "message", "Unknown error")
                raise RuntimeError(f"Video generation failed: {message}")
            
            if on_progress:
                await on_progress(f"Generating ({video.status})...")
            
            await asyncio.sleep(5)

        if on_progress:
            await on_progress("Downloading video...")

        content = await self.client.videos.download_content(video.id, variant="video")

        output_dir = self.storage_path / project_id
        output_dir.mkdir(parents=True, exist_ok=True)

        filename = f"scene_{scene_index}_{uuid.uuid4().hex}.mp4"
        output_path = output_dir / filename

        body = content.read()
        if asyncio.iscoroutine(body):
            body = await body

        async with aiofiles.open(output_path, "wb") as f:
            await f.write(body)

        return f"/media/{project_id}/{output_path.name}"


video_service = OpenAIVideoService()


