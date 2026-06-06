"""Ideogram Studio Ref Sync — push an image to the studio's reference backdrop.

An OUTPUT node: route a generation (or any image) into it, and when it executes
with ``enable`` on it saves the first frame to the temp dir and broadcasts a
websocket event. Any Ideogram Studio with "sync" turned on swaps its trace
backdrop to that image — so you can iterate: generate → see it under your boxes
→ tweak → regenerate.

The image is passed through unchanged, so the node can sit inline.
"""

from __future__ import annotations


class IdeogramRefSync:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "image": ("IMAGE",),
                "enable": ("BOOLEAN", {"default": True}),
            },
        }

    RETURN_TYPES = ("IMAGE",)
    RETURN_NAMES = ("image",)
    OUTPUT_NODE = True
    FUNCTION = "run"
    CATEGORY = "Ideogram"
    DESCRIPTION = "Sync this image to the Ideogram Studio reference backdrop (studios with 'sync' on). Passes the image through."

    @classmethod
    def IS_CHANGED(cls, **kwargs):
        # Always re-run so the image is re-broadcast every execution — otherwise
        # ComfyUI caches the node and the studio never re-syncs after a page
        # refresh (or a repeat run with the same image).
        return float("nan")

    def run(self, image, enable=True, **kwargs):
        ui_images = []
        if enable and image is not None and getattr(image, "ndim", 0) == 4 and image.shape[0] > 0:
            try:
                import os
                import time
                import random
                import numpy as np
                import folder_paths
                from PIL import Image as PILImage
                from server import PromptServer

                out_dir = folder_paths.get_temp_directory()
                os.makedirs(out_dir, exist_ok=True)
                arr = (image[0].cpu().numpy() * 255.0).clip(0, 255).astype(np.uint8)
                fn = f"ideogram_ref_{int(time.time() * 1000)}_{random.randint(0, 9999)}.png"
                PILImage.fromarray(arr).save(os.path.join(out_dir, fn))
                payload = {"filename": fn, "subfolder": "", "type": "temp"}
                PromptServer.instance.send_sync("ideogram-studio.ref-sync", payload)
                ui_images = [payload]
            except Exception as e:
                print(f"[IdeogramRefSync] sync failed: {e}")

        return {"ui": {"images": ui_images}, "result": (image,)}


class IdeogramJsonSync:
    """Push a JSON caption to any Ideogram Studio that has 'json sync' on — the
    studio imports it live into the editor. The string is passed through so the
    node can sit inline (e.g. between a caption source and your sampler)."""

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "json": ("STRING", {"multiline": True, "default": "", "tooltip": "An Ideogram JSON caption (paste, or wire one in)"}),
                "enable": ("BOOLEAN", {"default": True}),
            },
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("json",)
    OUTPUT_NODE = True
    FUNCTION = "run"
    CATEGORY = "Ideogram"
    DESCRIPTION = "Sync a JSON caption to Ideogram Studios with 'json sync' on. Passes the string through."

    @classmethod
    def IS_CHANGED(cls, **kwargs):
        return float("nan")  # always re-broadcast (see IdeogramRefSync)

    def run(self, json="", enable=True, **kwargs):
        if enable and isinstance(json, str) and json.strip():
            import json as _json
            try:
                _json.loads(json)  # validate before broadcasting
            except _json.JSONDecodeError as e:
                # Raise so ComfyUI flags the node (red outline + message) instead
                # of failing silently — the user wants to know it's broken.
                raise ValueError(f"Ideogram Studio JSON Sync: input is not valid JSON — {e}") from e
            try:
                from server import PromptServer
                PromptServer.instance.send_sync("ideogram-studio.json-sync", {"json": json})
            except Exception as e:
                print(f"[IdeogramJsonSync] sync failed: {e}")
        return {"ui": {}, "result": (json,)}


NODE_CLASS_MAPPINGS = {
    "IdeogramRefSync": IdeogramRefSync,
    "IdeogramJsonSync": IdeogramJsonSync,
}
NODE_DISPLAY_NAME_MAPPINGS = {
    "IdeogramRefSync": "Ideogram Studio Ref Sync",
    "IdeogramJsonSync": "Ideogram Studio JSON Sync",
}
