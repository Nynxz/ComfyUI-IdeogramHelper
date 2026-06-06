"""Breakout nodes for Ideogram Studio.

Symmetric breakouts so you get native graph control without a huge stack of
ports on the studio itself:

    [Override] --IDEOGRAM_OVERRIDE--> [Studio] --IDEOGRAM_SETTINGS--> [Settings] --> width, height

* **Ideogram Override** (input breakout) — text/style fields as native inputs;
  emits a partial ``IDEOGRAM_OVERRIDE`` bundle that plugs into the studio's
  optional ``overrides`` input. Only non-empty fields override the studio.
* **Ideogram Settings** (output breakout) — takes the studio's
  ``IDEOGRAM_SETTINGS`` output and breaks it out into plain values
  (``width``/``height`` for empty-latent, samplers…). More can be added later.
"""

from __future__ import annotations

import re

_HEX = re.compile(r"^#[0-9A-F]{6}$")


def _parse_colors(s: str, limit: int = 16) -> list[str]:
    """Comma-separated hex → list of normalized #RRGGBB. Invalid dropped, capped at limit."""
    out: list[str] = []
    for raw in (s or "").split(","):
        h = raw.strip().upper()
        if not h:
            continue
        if not h.startswith("#"):
            h = "#" + h
        if len(h) == 4:  # #RGB -> #RRGGBB
            h = "#" + "".join(c * 2 for c in h[1:])
        if _HEX.match(h):
            out.append(h)
    return out[:limit]


def apply_override(data: dict, ov: dict | None) -> dict:
    """Apply an override bundle onto a (canonical) caption dict.

    Returns patched data; the studio re-runs build/serialize so key order and
    normalization are reapplied. width/height are handled by the studio (they're
    not part of the caption)."""
    if not isinstance(ov, dict) or not ov:
        return data
    data = dict(data) if isinstance(data, dict) else {}

    if ov.get("high_level_description"):
        data["high_level_description"] = ov["high_level_description"]

    # background + per-element patches both live under compositional_deconstruction
    comp = dict(data.get("compositional_deconstruction") or {})
    comp_changed = False

    if ov.get("background"):
        comp["background"] = ov["background"]
        comp_changed = True

    # Per-element overrides: {1-based index: {field: value}} — overwrite the
    # matching element in the OUTPUT (muted elements aren't in the caption, so
    # indices count the elements as they appear in the output). Out-of-range
    # indices are ignored; serialize_caption reapplies key order afterward.
    elements_ov = ov.get("elements")
    if isinstance(elements_ov, dict) and elements_ov:
        els = list(comp.get("elements") or [])
        for idx, patch in elements_ov.items():
            try:
                i = int(idx) - 1
            except (TypeError, ValueError):
                continue
            if 0 <= i < len(els) and isinstance(patch, dict):
                el = dict(els[i])
                for k, v in patch.items():
                    if v in (None, ""):
                        continue
                    if k == "text" and el.get("type") != "text":
                        continue  # don't bolt text onto a non-text element
                    el[k] = v
                els[i] = el
        comp["elements"] = els
        comp_changed = True

    if comp_changed:
        data["compositional_deconstruction"] = comp

    style = ov.get("style")
    if isinstance(style, dict) and style:
        sd = dict(data.get("style_description") or {})
        for k, v in style.items():
            if v not in (None, "", []):
                sd[k] = v
        data["style_description"] = sd

    return data


def merge_overrides(bundles) -> dict:
    """Deep-merge a list of override bundles into one. Scalar fields take the
    last value; ``style`` and per-index ``elements`` patches are merged."""
    out: dict = {}
    for b in bundles:
        if not isinstance(b, dict):
            continue
        for k, v in b.items():
            if k == "elements" and isinstance(v, dict):
                els = out.setdefault("elements", {})
                for idx, patch in v.items():
                    if isinstance(patch, dict):
                        els.setdefault(idx, {}).update(patch)
            elif k == "style" and isinstance(v, dict):
                out.setdefault("style", {}).update(v)
            else:
                out[k] = v
    return out


# Combo options for the Override node. "(keep)" = don't override.
# (Palettes are intentionally NOT here — they're hand-picked in the studio's
# swatch editor, which is the natural place for visual colour work.)
MEDIA = [
    "(keep)", "photograph", "illustration", "3d_render", "painting",
    "graphic_design", "digital_art", "watercolor", "sketch", "anime",
]


class IdeogramOverride:
    """Input breakout: drive studio fields natively. Non-empty fields win."""

    @classmethod
    def INPUT_TYPES(cls):
        S = lambda **k: ("STRING", {"default": "", **k})
        return {
            "optional": {
                "high_level_description": S(multiline=True),
                "background": S(multiline=True),
                "aesthetics": S(),
                "lighting": S(),
                "medium": (MEDIA, {"default": "(keep)"}),
                "photo": S(tooltip="camera/lens — sets photo mode"),
                "art_style": S(tooltip="art style — sets art mode"),
                "colors": S(tooltip="Comma-separated hex for the image palette (raw, or from an Ideogram Studio Palette node). Max 16"),
            }
        }

    RETURN_TYPES = ("IDEOGRAM_OVERRIDE",)
    RETURN_NAMES = ("overrides",)
    FUNCTION = "run"
    CATEGORY = "Ideogram"
    DESCRIPTION = "Override Ideogram Studio fields natively (only non-empty fields override). Wire into the studio's 'overrides' input."

    def run(self, high_level_description="", background="", aesthetics="",
            lighting="", medium="(keep)", photo="", art_style="", colors="", **kwargs):
        style = {}
        for k, v in (("aesthetics", aesthetics), ("lighting", lighting),
                     ("photo", photo), ("art_style", art_style)):
            if v.strip():
                style[k] = v.strip()
        if medium and medium != "(keep)":
            style["medium"] = medium
        pal = _parse_colors(colors, 16)
        if pal:
            style["color_palette"] = pal

        bundle = {}
        if high_level_description.strip():
            bundle["high_level_description"] = high_level_description.strip()
        if background.strip():
            bundle["background"] = background.strip()
        if style:
            bundle["style"] = style

        return (bundle,)


class IdeogramElementOverride:
    """Overwrite one element (by index) from the graph — e.g. drive 'element 1'
    (a character) programmatically. Feed several into an Override List to patch
    multiple indices, then wire that into the studio's 'overrides' input.
    Non-empty fields win."""

    @classmethod
    def INPUT_TYPES(cls):
        S = lambda **k: ("STRING", {"default": "", **k})
        return {
            "required": {
                "id": ("INT", {"default": 1, "min": 1, "max": 999, "tooltip": "Element number as shown in the studio (starts at 1)"}),
            },
            "optional": {
                "desc": S(multiline=True, tooltip="New description for this element"),
                "text": S(tooltip="New literal text (text elements only)"),
                "colors": S(tooltip="Comma-separated hex colours, e.g. #FF0000, #0a0, FFAA00 (max 5)"),
            },
        }

    RETURN_TYPES = ("IDEOGRAM_OVERRIDE",)
    RETURN_NAMES = ("overrides",)
    FUNCTION = "run"
    CATEGORY = "Ideogram"
    DESCRIPTION = "Overwrite a specific Ideogram Studio element by index. Combine several with an Override List, then wire into the studio's 'overrides' input."

    def run(self, id=1, desc="", text="", colors="", **kwargs):
        patch = {}
        if desc.strip():
            patch["desc"] = desc.strip()
        if text.strip():
            patch["text"] = text.strip()
        pal = _parse_colors(colors, 5)  # per-element palette is capped at 5
        if pal:
            patch["color_palette"] = pal

        bundle = {}
        if patch:
            bundle["elements"] = {int(id): patch}
        return (bundle,)


class IdeogramOverrideList:
    """Merge several override bundles into one. The inputs autogrow in the UI as
    you wire more in — plug each Override / Element Override into a slot and a new
    empty slot appears. Wire the output into the studio's 'overrides' input.

    Only ``overrides_1`` is declared; the frontend adds ``overrides_2``, ``_3`` …
    on connect (ComfyUI resolves linked inputs even when undeclared)."""

    @classmethod
    def INPUT_TYPES(cls):
        return {"optional": {"overrides_1": ("IDEOGRAM_OVERRIDE",)}}

    RETURN_TYPES = ("IDEOGRAM_OVERRIDE",)
    RETURN_NAMES = ("overrides",)
    FUNCTION = "run"
    CATEGORY = "Ideogram"
    DESCRIPTION = "Combine multiple override bundles into one (autogrowing inputs). Wire into the studio's 'overrides' input."

    def run(self, **kwargs):
        items = [(k, v) for k, v in kwargs.items() if re.fullmatch(r"overrides_\d+", k) and isinstance(v, dict)]
        items.sort(key=lambda kv: int(kv[0].rsplit("_", 1)[1]))
        return (merge_overrides([v for _, v in items]),)


class IdeogramPalette:
    """Visually build a colour palette (add/remove swatches, like the studio) and
    output comma-separated hex — wire into an Override's 'colors' input so you can
    pick colours instead of typing raw hex."""

    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {"palette": ("IDEOGRAM_PALETTE", {})}}

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("colors",)
    FUNCTION = "run"
    CATEGORY = "Ideogram"
    DESCRIPTION = "Pick a colour palette visually; outputs comma-separated hex for an Override's 'colors' input."

    def run(self, palette=None, **kwargs):
        cols = palette if isinstance(palette, list) else []
        cleaned = _parse_colors(",".join(str(c) for c in cols), 16)
        return (",".join(cleaned),)


class IdeogramExtras:
    """Output breakout: take the studio's 'extras' bundle and expose its parts —
    the box/text overlay, its alpha mask, and the chosen width/height."""

    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {"extras": ("IDEOGRAM_EXTRAS",)}}

    RETURN_TYPES = ("IMAGE", "MASK", "INT", "INT")
    RETURN_NAMES = ("overlay", "alpha", "width", "height")
    FUNCTION = "run"
    CATEGORY = "Ideogram"
    DESCRIPTION = "Break out the Ideogram Studio 'extras' output into overlay (IMAGE), alpha (MASK), width and height."

    def run(self, extras=None, **kwargs):
        e = extras if isinstance(extras, dict) else {}
        return (e.get("overlay"), e.get("alpha"), int(e.get("width") or 1024), int(e.get("height") or 1024))


NODE_CLASS_MAPPINGS = {
    "IdeogramOverride": IdeogramOverride,
    "IdeogramElementOverride": IdeogramElementOverride,
    "IdeogramOverrideList": IdeogramOverrideList,
    "IdeogramPalette": IdeogramPalette,
    "IdeogramExtras": IdeogramExtras,
}
NODE_DISPLAY_NAME_MAPPINGS = {
    "IdeogramOverride": "Ideogram Studio Override",
    "IdeogramElementOverride": "Ideogram Studio Element Override",
    "IdeogramOverrideList": "Ideogram Studio Override List",
    "IdeogramPalette": "Ideogram Studio Palette",
    "IdeogramExtras": "Ideogram Studio Extras",
}
