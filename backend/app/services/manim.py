import asyncio
import os
import uuid
from pathlib import Path
from ..core.config import get_settings

settings = get_settings()

class ManimService:
    def __init__(self):
        self.semaphore = asyncio.Semaphore(3)  # Limit to 3 concurrent renders
        # Use absolute path for storage to avoid confusion with CWD
        self.storage_path = Path(settings.STORAGE_DIR).resolve()
        self.storage_path.mkdir(parents=True, exist_ok=True)

    async def render_scene(self, code: str, scene_name: str, project_id: str) -> str:
        async with self.semaphore:
            # Create unique directory for this render
            render_id = str(uuid.uuid4())
            work_dir = self.storage_path / project_id / render_id
            work_dir.mkdir(parents=True, exist_ok=True)
            
            script_path = work_dir / "scene.py"
            with open(script_path, "w") as f:
                f.write(code)
            
            # Output directory for manim
            media_dir = work_dir / "media"
            
            # Simple heuristic to find class name
            class_name = "Solution" # Default expectation from prompt
            for line in code.split("\n"):
                if line.startswith("class "):
                    class_name = line.split(" ")[1].split("(")[0].strip(":")
                    break
            
            output_filename = f"{scene_name}.mp4"
            
            # We run manim from work_dir, so script path should be just the filename
            # Use absolute paths for media_dir to be safe
            
            cmd = [
                "manim",
                "-ql", # Low quality for speed
                "--media_dir", str(media_dir.resolve()),
                "-o", output_filename,
                "scene.py", # Relative to CWD
                class_name
            ]
            
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=str(work_dir.resolve())
            )
            
            stdout, stderr = await process.communicate()
            
            if process.returncode != 0:
                error_msg = stderr.decode()
                # Don't print enormous error logs, just the end usually matters or the whole thing if needed
                print(f"Manim Error in {work_dir}:\n{error_msg}")
                raise Exception(f"Manim failed: {error_msg}")
                
            # Locate the output file
            # Manim output structure: media_dir/videos/scene/quality/output_filename
            video_files = list(media_dir.glob("**/*.mp4"))
            if not video_files:
                raise Exception("No video file generated")
                
            video_file = video_files[0]
            
            # Move video to project storage root for easy serving
            final_path = self.storage_path / project_id / f"{scene_name}_{render_id}.mp4"
            final_path.parent.mkdir(parents=True, exist_ok=True)
            os.rename(video_file, final_path)
            
            # Clean up work dir (optional, maybe keep for debugging)
            # import shutil
            # shutil.rmtree(work_dir)
            
            # Return relative URL path
            return f"/media/{project_id}/{final_path.name}"

manim_service = ManimService()
