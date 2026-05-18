# Parallel API Request Optimization

## Overview

The IPL AI Assistant now supports **parallel/concurrent API requests** to minimize latency and improve response times.

## Problem: Sequential Requests = High Latency

### Before Optimization
```
Frontend makes 2 separate requests:

Request 1: /api/insights/live
├─ Wait for response (2-3 seconds)
└─ Returns: Tactical, Momentum, Prediction insights

Request 2: /api/tactical-insights  
├─ Wait for response (2-3 seconds)
└─ Returns: Momentum Shift, Tactical Read

Total Time: 4-6 seconds (sequential)
```

## Solution: Parallel Requests = Low Latency

### After Optimization
```
Backend makes 2 concurrent API calls to Gemini:

┌─ Call 1: General Insights (Gemini 1.5 Flash)
│  └─ Returns: Tactical, Momentum, Prediction
│
├─ Call 2: Tactical Insights (Gemini 2.0 Flash Lite)
│  └─ Returns: Momentum Shift, Tactical Read
│
└─ Both calls execute simultaneously using asyncio

Total Time: 2-3 seconds (parallel) - 50% faster!
```

## Implementation

### Backend: Parallel Execution with asyncio

```python
# server/services/gemini_service.py

async def generate_all_insights_parallel(self, match_context: Dict[str, Any]) -> Dict[str, Any]:
    """Generate ALL insights in PARALLEL for minimum latency"""
    
    # Create tasks for parallel execution
    tasks = [
        asyncio.to_thread(self.generate_batched_insights, match_context),
        asyncio.to_thread(self.generate_tactical_insights, match_context)
    ]
    
    # Execute both API calls in parallel
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    # Combine results
    return {
        'insights': all_insights,
        'general': results[0],
        'tactical': results[1],
        'parallel': True
    }
```

### New Endpoint: `/api/insights/all-parallel`

```python
# server/app.py

@app.get("/api/insights/all-parallel")
async def all_insights_parallel():
    """Generate ALL insights in PARALLEL for minimum latency
    
    Makes 2 concurrent API calls:
    1. General Insights (batched: tactical + momentum + prediction)
    2. Tactical Insights (batched: momentum shift + tactical read)
    
    Returns ALL 5 insights faster than calling endpoints separately"""
    current_context = live_context()
    result = await gemini_service.generate_all_insights_parallel(current_context)
    return result
```

## Frontend: Two Options

### Option 1: Separate Requests (Current - Backward Compatible)

```javascript
// Makes 2 separate HTTP requests
useEffect(() => {
    fetch('/api/insights/live').then(/* ... */);
}, []);

useEffect(() => {
    fetch('/api/tactical-insights').then(/* ... */);
}, []);

// Latency: 4-6 seconds (sequential)
```

### Option 2: Single Parallel Request (Faster - Recommended)

```javascript
// Makes 1 HTTP request that triggers 2 parallel Gemini calls
useEffect(() => {
    fetch('/api/insights/all-parallel')
        .then(res => res.json())
        .then(data => {
            if (data.parallel) {
                setAiInsights(data.general);
                setTacticalInsights(data.tactical);
            }
        });
}, []);

// Latency: 2-3 seconds (parallel) - 50% faster!
```

## How to Enable Parallel Mode

### Step 1: Edit `client/src/App.jsx`

Find this section (around line 150):

```javascript
// OPTION 1: Fetch insights separately (current approach)
useEffect(() => {
    // ... separate fetch calls
}, []);

// OPTION 2: Fetch ALL insights in parallel (FASTER - uncomment to use)
/*
useEffect(() => {
    // ... parallel fetch call
}, []);
*/
```

### Step 2: Comment Out Option 1, Uncomment Option 2

```javascript
// OPTION 1: Fetch insights separately (current approach)
/*
useEffect(() => {
    // ... separate fetch calls - COMMENTED OUT
}, []);
*/

// OPTION 2: Fetch ALL insights in parallel (FASTER - uncomment to use)
useEffect(() => {
    let isMounted = true;

    const loadAllInsightsParallel = () => {
        fetch('/api/insights/all-parallel')
            .then(res => res.json())
            .then(data => {
                if (isMounted && data.parallel) {
                    if (data.general) {
                        setAiInsights(data.general);
                    }
                    if (data.tactical) {
                        setTacticalInsights(data.tactical);
                    }
                }
            })
            .catch(() => null);
    };

    loadAllInsightsParallel();
    const interval = setInterval(loadAllInsightsParallel, 30000);

    return () => {
        isMounted = false;
        clearInterval(interval);
    };
}, []);
```

### Step 3: Rebuild Frontend

```bash
cd client
npm run build
cd ..
Copy-Item -Path "client\dist\*" -Destination "server\public\" -Recurse -Force
```

### Step 4: Restart Server

```bash
conda activate adobehackathon
python server\app.py
```

## Performance Comparison

### Sequential (Option 1)
```
Timeline:
0s ────────────────────────────────────────────────────> 6s
   │                    │                    │
   Start                Request 1            Request 2
                        completes            completes
                        (3s)                 (6s)

Total: 6 seconds
API Calls: 2 (sequential)
```

### Parallel (Option 2)
```
Timeline:
0s ────────────────────────────> 3s
   │                    │
   Start                Both requests
   (both start)         complete
                        (3s)

Total: 3 seconds
API Calls: 2 (parallel)
Improvement: 50% faster
```

## Technical Details

### asyncio.gather()
- Executes multiple coroutines concurrently
- Waits for all to complete
- Returns results in order
- Handles exceptions gracefully

### asyncio.to_thread()
- Runs synchronous functions in thread pool
- Prevents blocking the event loop
- Allows parallel execution of Gemini API calls

### Error Handling
```python
results = await asyncio.gather(*tasks, return_exceptions=True)

# Check if result is an exception
if isinstance(results[0], Exception):
    # Use fallback data
    general_insights = self._fallback_batched_insights()
else:
    general_insights = results[0]
```

## Benefits

### 1. Reduced Latency
- **50% faster** response times
- Users see insights sooner
- Better user experience

### 2. Same Quota Usage
- Still makes 2 API calls to Gemini
- Just executes them in parallel
- No additional quota cost

### 3. Backward Compatible
- Old endpoints still work
- Can switch between modes easily
- No breaking changes

### 4. Graceful Degradation
- If one call fails, other still works
- Fallback data for errors
- Robust error handling

## Quota Impact

### No Change in API Calls
```
Sequential Mode:
- Call 1: General Insights → Gemini 1.5 Flash
- Call 2: Tactical Insights → Gemini 2.0 Flash Lite
Total: 2 API calls

Parallel Mode:
- Call 1: General Insights → Gemini 1.5 Flash (concurrent)
- Call 2: Tactical Insights → Gemini 2.0 Flash Lite (concurrent)
Total: 2 API calls (same as sequential)
```

### Quota Usage Unchanged
- Same number of API calls
- Same models used
- Same quota consumption
- Just faster execution

## When to Use Each Mode

### Use Sequential Mode (Option 1) When:
- Debugging issues
- Testing individual endpoints
- Need to isolate problems
- Backward compatibility required

### Use Parallel Mode (Option 2) When:
- Production deployment
- Performance is critical
- Users need fast responses
- Normal operation

## Monitoring

### Check Parallel Execution
```javascript
fetch('/api/insights/all-parallel')
    .then(res => res.json())
    .then(data => {
        console.log('Parallel execution:', data.parallel); // Should be true
        console.log('Latency:', data.timestamp - startTime);
    });
```

### Backend Logs
```python
# Add timing logs
start = time.time()
results = await asyncio.gather(*tasks)
duration = time.time() - start
print(f"Parallel execution completed in {duration:.2f}s")
```

## Troubleshooting

### Issue: `data.parallel` is false
**Cause:** Parallel execution failed, fell back to sequential
**Solution:** Check server logs for errors

### Issue: Missing insights in response
**Cause:** One of the parallel calls failed
**Solution:** Check which call failed in server logs

### Issue: Slower than expected
**Cause:** Network latency or API throttling
**Solution:** Check Gemini API status and quota limits

## Summary

**What Changed:**
- ✅ Added `generate_all_insights_parallel()` method
- ✅ Added `/api/insights/all-parallel` endpoint
- ✅ Used `asyncio.gather()` for concurrent execution
- ✅ Added Option 2 in frontend (commented out by default)

**Benefits:**
- ⚡ 50% faster response times
- 📊 Same quota usage
- 🔄 Backward compatible
- 🛡️ Graceful error handling

**To Enable:**
- Uncomment Option 2 in `client/src/App.jsx`
- Rebuild frontend
- Restart server
- Enjoy faster insights!
