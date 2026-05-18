# Gemini Quota Optimization - Quick Summary

## What Changed

### 3 Models Instead of 1
- **Gemini 1.5 Flash (Workhorse):** General insights - 15 RPM / 500 RPD
- **Gemini 2.0 Flash Lite (Tactical):** Complex analysis - 10 RPM / 20 RPD  
- **Gemini 1.5 Flash (Chat):** User Q&A - 5 RPM / 20 RPD

### Batched Prompts
- **General Insights:** 3 calls → 1 call (Tactical + Momentum + Prediction)
- **Tactical Insights:** 2 calls → 1 call (Momentum Shift + Tactical Read)

## API Calls Per Feature

| Feature | Model | Frequency | Method |
|---------|-------|-----------|--------|
| General Insights | 1.5 Flash | 30s | `generate_batched_insights()` |
| Tactical Insights | 2.0 Flash Lite | 20s | `generate_tactical_insights()` |
| Win Prob History | 1.5 Flash | 120s | `generate_win_probability_history()` |
| Tactical Chat | 1.5 Flash | User-triggered | `answer_tactical_question()` |

## Quota Savings

**Before:** 5 API calls every 20-30 seconds
**After:** 2 API calls every 20-30 seconds
**Savings:** 60% reduction in API calls

## Current Issues

⚠️ **Still exceeding daily quotas with current frequencies**

### Problem 1: General Insights
- Current: 2,880 calls/day (every 30s)
- Quota: 500 RPD
- **Over by 576%**

### Problem 2: Tactical Insights  
- Current: 4,320 calls/day (every 20s)
- Quota: 20 RPD
- **Over by 21,500%**

## Recommended Fixes

### Option 1: Reduce Frequencies (Easy)
```javascript
// client/src/App.jsx

// General Insights: 30s → 3 minutes
setInterval(loadAiInsights, 180000);  // 480 calls/day ✓

// Tactical Insights: 20s → 6 minutes  
setInterval(loadTacticalInsights, 360000);  // 240 calls/day ⚠️ still high

// Win Prob History: 2min → 5 minutes
setInterval(loadWinProbabilityHistory, 300000);  // 288 calls/day ✓
```

### Option 2: On-Demand Only (Best)
```javascript
// Remove automatic polling
// Add "Refresh Insights" button
// User clicks when they want updates
// Saves quota dramatically
```

### Option 3: Hybrid Approach (Balanced)
```javascript
// Slow polling when not focused
// Fast polling when user is active
// Pause when tab is hidden

if (document.hidden) {
    // Slow: Every 10 minutes
    setInterval(loadInsights, 600000);
} else {
    // Fast: Every 3 minutes
    setInterval(loadInsights, 180000);
}
```

## Implementation Status

✅ **Completed:**
- Multi-model architecture
- Batched prompts for general insights
- Batched prompts for tactical insights
- Model-specific routing
- Fallback handling

⚠️ **Needs Adjustment:**
- Frontend polling frequencies (too aggressive)
- Rate limiting for chat
- Quota monitoring/alerts

## Quick Test

```bash
# Check current configuration
conda activate adobehackathon
python test_fixes.py

# Should show:
# - 3 models initialized
# - Batched insights working
# - All tests passing
```

## Files Modified

1. `server/services/gemini_service.py` - Multi-model + batching
2. `server/app.py` - Updated endpoints to use batched methods
3. `client/src/App.jsx` - (Needs update for frequencies)

## Next Steps

1. **Immediate:** Adjust polling frequencies in `client/src/App.jsx`
2. **Short-term:** Add rate limiting to chat
3. **Long-term:** Implement smart polling based on user activity

See `GEMINI_QUOTA_OPTIMIZATION.md` for detailed analysis and code examples.
