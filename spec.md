# Math Fun

## Current State
New project. Only scaffold files exist with no application logic.

## Requested Changes (Diff)

### Add
- Math quiz game with multiple difficulty levels (addition, subtraction, multiplication, division)
- Timed challenges with countdown timer
- Score tracking and streak counter
- Progress display (XP, level, badges earned)
- Encouraging feedback animations on correct/wrong answers
- Multiple question types with randomized generation
- Backend to persist scores and progress per user session

### Modify
- Replace scaffold frontend with full math learning app UI

### Remove
- All scaffold placeholder content

## Implementation Plan
1. Backend: store player progress (score, xp, level, streak, badges) with update and query functions
2. Frontend: game UI with question display, answer input/buttons, timer, score panel, level selector
3. Implement question generation logic in frontend (randomized arithmetic)
4. Add animated feedback (correct/wrong), confetti on level up
5. Show progress dashboard with XP bar, streak, badges
