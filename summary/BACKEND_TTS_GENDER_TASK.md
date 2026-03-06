# 🛠️ Backend Task: TTS Gender API Endpoints

**File to edit:** `Backend/Backend/server.py`
**Also check:** `Backend/Backend/tts.py` (already has gender support — no changes needed there)

---

## Context

The TTS module (`tts.py`) already fully supports male/female voice selection via the `NRP_TTS_GENDER`
environment variable (lines 29-31 in tts.py). The voice maps are already defined:

```python
# Already in tts.py — DO NOT MODIFY:
_EDGE_VOICES_MALE  = { "ta": "ta-IN-ValluvarNeural",  "en": "en-US-RogerNeural",   "hi": "hi-IN-MadhurNeural" }
_EDGE_VOICES_FEMALE = { "ta": "ta-IN-PallaviNeural",  "en": "en-US-MichelleNeural", "hi": "hi-IN-SwaraNeural" }
_VOICE_GENDER = os.environ.get("NRP_TTS_GENDER", "male").strip().lower()
```

The frontend has already been updated to call these new endpoints.
You just need to add the two REST endpoints in `server.py`.

---

## What to Add in `server.py`

Add the following two endpoints **immediately after** the existing `POST /api/tts/language` endpoint
(around line 5351, before the `@app.get("/api/nodes")` route).

### Pattern to follow
Look at the existing `/api/tts/language` and `/api/tts/status` endpoints above — follow the exact
same structure: try/except, JSONResponse on error, log_message, tts module reload.

---

### Endpoint 1 — GET /api/tts/gender

```python
@app.get("/api/tts/gender")
async def api_tts_get_gender():
    """
    Get current TTS voice gender.

    Returns:
        {
            "success": true,
            "gender": "male" | "female"
        }
    """
    try:
        gender = os.environ.get("NRP_TTS_GENDER", "male").strip().lower()
        if gender not in ("male", "female"):
            gender = "male"
        return {"success": True, "gender": gender}
    except Exception as e:
        log_message(f"TTS get gender API error: {e}", "ERROR")
        return JSONResponse({"success": False, "error": str(e)}, status_code=500)
```

---

### Endpoint 2 — POST /api/tts/gender

```python
@app.post("/api/tts/gender")
async def api_tts_set_gender(request: Request):
    """
    Set TTS voice gender.

    Request body:
        {
            "gender": "male" | "female"
        }

    Returns:
        {
            "success": true,
            "gender": "male" | "female",
            "message": "Voice gender set to Male"
        }
    """
    try:
        try:
            body = await request.json()
        except Exception:
            body = {}

        gender = body.get("gender")

        if not isinstance(gender, str) or not gender.strip():
            return JSONResponse({"success": False, "error": "Missing or invalid 'gender' field"}, status_code=400)

        gender = gender.strip().lower()

        if gender not in ("male", "female"):
            return JSONResponse({"success": False, "error": f"Unsupported gender: {gender}. Use 'male' or 'female'"}, status_code=400)

        # Persist to environment for runtime use
        os.environ["NRP_TTS_GENDER"] = gender

        # Reload TTS module so the worker picks up the new voice map
        try:
            import importlib
            importlib.reload(tts)
        except Exception as reload_error:
            log_message(f"TTS module reload warning (gender change): {reload_error}", "WARNING")

        log_message(f"TTS gender set to {gender} via API", "INFO")

        # Voice: Confirm gender change
        try:
            _lang = os.environ.get("JARVIS_LANG", "en").strip().lower()
            _gender_msgs = {
                "male": {
                    "en": "Voice changed to male.",
                    "ta": "குரல் ஆண் குரலுக்கு மாற்றப்பட்டது.",
                    "hi": "आवाज पुरुष में बदल गई.",
                },
                "female": {
                    "en": "Voice changed to female.",
                    "ta": "குரல் பெண் குரலுக்கு மாற்றப்பட்டது.",
                    "hi": "आवाज महिला में बदल गई.",
                },
            }
            msg = _gender_msgs[gender].get(_lang, _gender_msgs[gender]["en"])
            tts.speak(msg)
        except Exception:
            pass

        label = "Male" if gender == "male" else "Female"
        return {"success": True, "gender": gender, "message": f"Voice gender set to {label}"}

    except Exception as e:
        log_message(f"TTS set gender API error: {e}", "ERROR")
        return JSONResponse({"success": False, "error": str(e)}, status_code=500)
```

---

## Where to Insert (exact location)

Insert both endpoints at **line 5352** in `server.py`, which is the blank line between:

```python
        return {"success": True, "language": lang, "message": f"Language set to {supported[lang]}"}

    except Exception as e:
        log_message(f"TTS set language API error: {e}", "ERROR")
        return JSONResponse({"success": False, "error": str(e)}, status_code=500)

# ← INSERT HERE (line 5352, the blank line before @app.get("/api/nodes"))

@app.get("/api/nodes")
```

---

## Quick Test After Implementation

```bash
# On rover SSH session:

# 1. Get current gender
curl -s http://localhost:5001/api/tts/gender | python3 -m json.tool
# Expected: {"success": true, "gender": "male"}

# 2. Set to female
curl -X POST http://localhost:5001/api/tts/gender \
  -H "Content-Type: application/json" \
  -d '{"gender": "female"}' | python3 -m json.tool
# Expected: {"success": true, "gender": "female", "message": "Voice gender set to Female"}
# Also: rover should speak the confirmation in the current language

# 3. Verify persisted
curl -s http://localhost:5001/api/tts/gender | python3 -m json.tool
# Expected: {"success": true, "gender": "female"}

# 4. Set back to male
curl -X POST http://localhost:5001/api/tts/gender \
  -H "Content-Type: application/json" \
  -d '{"gender": "male"}' | python3 -m json.tool
```

---

## Error Cases (must return 400)

| Scenario | Expected response |
|---|---|
| `{"gender": "unknown"}` | `{"success": false, "error": "Unsupported gender: unknown..."}` |
| `{}` (empty body) | `{"success": false, "error": "Missing or invalid 'gender' field"}` |
| `{"gender": ""}` | `{"success": false, "error": "Missing or invalid 'gender' field"}` |

---

## Summary of All TTS Endpoints After This Change

```
GET  /api/tts/status       ✅ existing — returns enabled, engine, language
GET  /api/tts/languages    ✅ existing — returns [en, ta, hi]
GET  /api/tts/gender       ➕ NEW      — returns current gender
POST /api/tts/control      ✅ existing — enable/disable TTS
POST /api/tts/language     ✅ existing — set language
POST /api/tts/test         ✅ existing — test speak
POST /api/tts/gender       ➕ NEW      — set male/female
```

**Frontend is already updated and waiting for these endpoints.**
**No changes needed to `tts.py` — it already supports gender.**
