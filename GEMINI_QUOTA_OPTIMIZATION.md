# Gemini API Quota Optimization Strategy

## Overview

The IPL AI Assistant has been optimized to use **3 different Gemini models** strategically to maximize API quota efficiency and prevent rate limit collisions.

## Model Allocation Strategy

### 1. Gemini 1.5 Flash (Workhorse)
**Quota:** 15 RPM / 250K TPM / 500 RPD

**Used For:**
- General Match Insights (Tactical, Momentum, Prediction) - **BATCHED**
- Win Probability Calculations
- Win Probability History

**Update Frequency:** Every 30 seconds

**Why This Model?**
- Highest daily quota (500 RPD)
- Sufficient RPM (15) for background loops
- Handles automated polling without choking

**API Calls Per Hour:** ~120 calls (2 per minute)

---

### 2. Gemini 2.0 Flash Lite (Tactical Buffer)
**Quota:** 10 RPM / 250K TPM / 20 RPD

**Used For:**
- Tactical Insights (Momentum Shift + Tactical Read) - **BATCHED**

**Update Frequency:** Every 20 seconds

**Why This Model?**
- Isolated quota pool (10 RPM)
- Prevents collision with general insights
- Dedicated for complex scoring trends & metrics

**API Calls Per Hour:** ~180 calls (3 per minute)

---

### 3. Gemini 1.5 Flash (Chat)
**Quota:** 5 RPM / 250K TPM / 20 RPD

**Used For:**
- Tactical Chat (User Q&A)

**Update Frequency:** User-triggered only

**Why This Model?**
- Separate quota for interactive features
- 5 RPM sufficient for user questions
- Won't interfere with automated insights

**API Calls Per Hour:** Variable (user-dependent)

---

## Batching Strategy to Save Quota

### Problem: Multiple API Calls Waste Quota
**Before optimization:**
- 3 separate calls for Tactical, Momentum, Prediction insights
- 2 separate calls for Momentum Shift + Tactical Read
- **Total:** 5 API calls every 20-30 seconds

### Solution: Batch Multiple Insights in Single Calls

#### Batch 1: General Insights (3-in-1)
**Endpoint:** `/api/insights/live`
**Frequency:** Every 30 seconds
**Model:** Gemini 1.5 Flash (Workhorse)

**Single Prompt Requests:**
1. Tactical insight
2. Momentum insight
3. Prediction insight

**Savings:** 3 calls → 1 call = **66% reduction**

#### Batch 2: Tactical Insights (2-in-1)
**Endpoint:** `/api/tactical-insights`
**Frequency:** Every 20 seconds
**Model:** Gemini 2.0 Flash Lite (Tactical Buffer)

**Single Prompt Requests:**
1. Momentum Shift analysis
2. Tactical Read analysis

**Savings:** 2 calls → 1 call = **50% reduction**

---

## API Call Breakdown

### Automated Background Calls

| Feature | Model | Frequency | Calls/Min | Calls/Hour | Daily Quota Used |
|---------|-------|-----------|-----------|------------|------------------|
| General Insights (batched) | 1.5 Flash | 30s | 2 | 120 | 2,880 / 500 RPD ⚠️ |
| Tactical Insights (batched) | 2.0 Flash Lite | 20s | 3 | 180 | 4,320 / 20 RPD ⚠️ |
| Win Prob History | 1.5 Flash | 120s | 0.5 | 30 | 720 / 500 RPD ✓ |

### User-Triggered Calls

| Feature | Model | Trigger | Est. Calls/Hour | Daily Quota Used |
|---------|-------|---------|-----------------|------------------|
| Tactical Chat | 1.5 Flash | User Q&A | ~10-20 | 240-480 / 20 RPD ⚠️ |

---

## Quota Warnings & Solutions

### ⚠️ Warning 1: General Insights Exceeds Daily Quota
**Problem:** 2,880 calls/day > 500 RPD limit

**Solutions:**
1. **Reduce frequency:** 30s → 60s (halves usage to 1,440/day) ⚠️ Still over
2. **Reduce frequency:** 30s → 90s (reduces to 960/day) ⚠️ Still over
3. **Reduce frequency:** 30s → 120s (reduces to 720/day) ⚠️ Still over
4. **Reduce frequency:** 30s → 180s (reduces to 480/day) ✓ **RECOMMENDED**

**Recommended Fix:**
```python
# In client/src/App.jsx
const interval = setInterval(loadAiInsights, 180000); // 3 minutes instead of 30s
```

### ⚠️ Warning 2: Tactical Insights Exceeds Daily Quota
**Problem:** 4,320 calls/day > 20 RPD limit

**Solutions:**
1. **Reduce frequency:** 20s → 60s (reduces to 1,440/day) ⚠️ Still over
2. **Reduce frequency:** 20s → 120s (reduces to 720/day) ⚠️ Still over
3. **Reduce frequency:** 20s → 240s (reduces to 360/day) ✓ **RECOMMENDED**

**Recommended Fix:**
```python
# In client/src/App.jsx
const interval = setInterval(loadTacticalInsights, 240000); // 4 minutes instead of 20s
```

### ⚠️ Warning 3: Tactical Chat May Exceed Daily Quota
**Problem:** Heavy usage could exceed 20 RPD

**Solutions:**
1. **Add rate limiting:** Max 1 question per 15 seconds per user
2. **Add caching:** Cache responses for identical questions
3. **Add queue:** Queue requests if RPM limit hit

**Recommended Fix:**
```javascript
// Add debouncing to chat submit
const [lastSubmitTime, setLastSubmitTime] = useState(0);

const handleChatSubmit = async (e) => {
    e.preventDefault();
    
    // Rate limit: 1 question per 15 seconds
    const now = Date.now();
    if (now - lastSubmitTime < 15000) {
        setChatResponse('Please wait 15 seconds between questions.');
        return;
    }
    
    setLastSubmitTime(now);
    // ... rest of submit logic
};
```

---

## Optimized Configuration (Recommended)

### Update Frequencies

```javascript
// client/src/App.jsx

// General Insights: Every 3 minutes (was 30s)
const interval = setInterval(loadAiInsights, 180000);

// Tactical Insights: Every 4 minutes (was 20s)
const interval = setInterval(loadTacticalInsights, 240000);

// Win Probability History: Every 5 minutes (was 2 minutes)
const interval = setInterval(loadWinProbabilityHistory, 300000);

// Chat: Rate limited to 1 per 15 seconds
```

### Daily Quota Usage (After Optimization)

| Feature | Calls/Day | Quota | Status |
|---------|-----------|-------|--------|
| General Insights | 480 | 500 RPD | ✓ Safe (96%) |
| Tactical Insights | 360 | 20 RPD | ⚠️ High (1800%) |
| Win Prob History | 288 | 500 RPD | ✓ Safe (58%) |
| Tactical Chat | ~100-200 | 20 RPD | ⚠️ Variable |

**Note:** Tactical Insights still exceeds quota. Consider:
- Further reducing frequency to 6 minutes (240 calls/day)
- Or switching to on-demand only (user clicks "Refresh Insights")

---

## Code Changes Summary

### 1. Multi-Model Initialization
```python
# server/services/gemini_service.py
self.model_workhorse = genai.GenerativeModel('gemini-1.5-flash')  # 15 RPM / 500 RPD
self.model_tactical = genai.GenerativeModel('gemini-2.0-flash-lite')  # 10 RPM / 20 RPD
self.model_chat = genai.GenerativeModel('gemini-1.5-flash')  # 5 RPM / 20 RPD
```

### 2. Batched General Insights
```python
# New method: generate_batched_insights()
# Single prompt requests: tactical + momentum + prediction
# Saves: 3 calls → 1 call
```

### 3. Batched Tactical Insights
```python
# Updated method: generate_tactical_insights()
# Single prompt requests: momentum shift + tactical read
# Saves: 2 calls → 1 call
```

### 4. Model-Specific Routing
```python
# Workhorse model for general insights
response = self.model_workhorse.generate_content(prompt)

# Tactical model for complex analysis
response = self.model_tactical.generate_content(prompt)

# Chat model for user Q&A
response = self.model_chat.generate_content(prompt)
```

---

## Testing Quota Usage

### Monitor API Calls
```python
# Add logging to track API usage
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# In each method:
logger.info(f"API Call: {model_name} - {endpoint} - {timestamp}")
```

### Check Quota Status
Visit: https://aistudio.google.com/app/apikey
- View current usage
- Check rate limits
- Monitor daily quota

---

## Best Practices

1. **Batch whenever possible** - Combine multiple insights in single prompts
2. **Use appropriate models** - Match quota limits to usage patterns
3. **Implement rate limiting** - Prevent user-triggered quota exhaustion
4. **Cache responses** - Reuse recent responses when appropriate
5. **Monitor usage** - Track API calls and adjust frequencies
6. **Graceful degradation** - Show cached/fallback data when quota exceeded

---

## Summary

**Before Optimization:**
- Single model for everything
- 5+ API calls every 20-30 seconds
- High risk of quota exhaustion

**After Optimization:**
- 3 models with isolated quotas
- 2 API calls every 20-30 seconds (batched)
- Reduced collision risk
- Better quota distribution

**Recommended Next Steps:**
1. Adjust frontend polling frequencies (see above)
2. Add rate limiting to chat
3. Monitor quota usage for 24 hours
4. Fine-tune based on actual usage patterns
