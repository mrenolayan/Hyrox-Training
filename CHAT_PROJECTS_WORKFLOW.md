# Claude Chat Projects Workflow for Hyrox Trainer

**Purpose:** Use Claude Chat Projects to plan work and store context; use Claude Code to execute. Avoid usage limits by leveraging Projects' persistent memory.

---

## Setup: Create a Claude Chat Project (One-time)

### Step 1: Create the Project
1. Go to **claude.ai/projects** (web version)
2. Click **"+ New project"**
3. Name it: `Hyrox Trainer`
4. Click **Create**

### Step 2: Add Files to the Project
Add these files so Claude can reference them without consuming tokens:

1. **Architecture & Contract Docs** (foundational):
   - Upload or link: `ARCHITECTURE.md` (design rationale)
   - Upload or link: `DATA_MODEL.md` (schema, RLS policies)
   - Upload or link: `PRODUCT.md` (product contract, features)

2. **Current Implementation State**:
   - Upload: `PHASE7_STATE.md` (complete Phase 7 snapshot)
   - Upload: `CLAUDE.md` (Claude Code guide)

3. **Reference** (optional, for checking):
   - Link to GitHub repo: https://github.com/yourusername/hyrox-trainer (if public)
   - Or upload latest git log/status

**Why these files?** They contain 90% of what you need to understand the project. Claude Chat can reference them without re-reading them into context each time.

### Step 3: Add a Workflow Document (This File)
- Upload: `CHAT_PROJECTS_WORKFLOW.md` (this file)
- This gives Claude the SOP for how to work with you

---

## Workflow: Plan → Code → Execute

### Phase A: Planning in Claude Chat

**In your Chat Project, start with:**

```
I want to work on [feature/bug/task] for Hyrox Trainer.

Context files available in this project:
- PHASE7_STATE.md (current implementation)
- ARCHITECTURE.md (three-layer design)
- DATA_MODEL.md (schema)
- CLAUDE.md (project overview)

Here's what I want to accomplish:
1. [Goal 1]
2. [Goal 2]
3. [Goal 3]

Please create a plan with:
- What needs to change (which files, which functions)
- Step-by-step implementation order
- Testing strategy
- Any potential blockers or questions for me
```

**Chat generates:** A detailed plan with:
- File-by-file changes
- Code snippets showing before/after
- Exact line numbers
- Testing checklist
- Questions or decisions needed

### Phase B: Review & Approve Plan

**In Chat:**
```
Please refine the plan based on:
- [Your feedback on the plan]
- [Any changes to requirements]
- [Decisions on tradeoffs]

Once refined, I'll take this plan to Claude Code for implementation.
```

**Chat updates the plan.** This stays in the Chat Project for reference.

### Phase C: Execute in Claude Code

**In Claude Code terminal:**
```bash
cd /Users/mrenolayan/Desktop/hyrox-trainer
claude
```

**Then in Claude Code:**
```
Here's the plan from Claude Chat:

[Paste the refined plan from Chat Project]

Please implement this plan. For each step:
1. Read the relevant files
2. Make the changes exactly as specified
3. Test locally (npm run dev)
4. Commit with clear messages
5. Show me what changed

When done, give me a summary of what was implemented and any issues found.
```

**Claude Code executes** and gives you:
- Diffs of all changes
- Commit messages
- Test results
- Ready for you to review

### Phase D: Report Back to Chat

**In Chat Project:**
```
Claude Code has completed the implementation. Here's what was done:

[Paste the summary from Claude Code]

Did this work as expected? Any changes needed?
```

**Chat can:**
- Review completeness against the plan
- Suggest refinements
- Plan next steps
- Track progress

---

## Example Workflow in Action

### Chat Session: Plan Phase 8

```
User: I want to start Phase 8 (athlete login/invite). Walk me through it.

Claude (with project context):
Looking at PHASE7_STATE.md and DATA_MODEL.md, here's the plan:

Phase 8: Athlete Login & Invite
==============================

**Current state:**
- require_auth toggle exists on teams (Phase 7)
- Public link flow exists (RLS anon policies)
- Coach can check require_auth=true when creating team

**What needs to happen:**
1. Coach sends athlete invite (email link with token)
2. Athlete clicks link → magic link login (Supabase Auth)
3. Athlete's user_id gets stored → can now log in anytime
4. Athlete sees only their team (RLS enforced)

**Files to change:**
- src/App.jsx: add invite/signup flow
- src/lib/auth.js: add inviteAthlete(), acceptInvite() functions
- src/lib/db.js: add sendInviteEmail(), linkAthleteAuthId()
- Supabase: create athletes_invites table (email, token, team_id)

**Step-by-step:**
1. Design athletes_invites schema
2. Create invite UI (coach dashboard → "Invite athlete" button)
3. Add invite email template
4. Build signup link handler
5. Link athlete user_id on first login
6. Test: send invite → click link → signup → athlete dashboard

**Questions for you:**
- Should invites expire? (suggest: 7 days)
- Can an athlete be invited to multiple teams?
- Should coach see invite status (pending/accepted)?
```

User reviews and answers questions → plan is refined.

### Code Session: Execute Phase 8

```
User (in Claude Code):
Here's the plan from Chat...

[Paste plan]

Please implement this. Start with the schema.

Claude Code:
Reading current db.js and schema...
Creating athletes_invites table...
[Makes changes]
[Tests locally]
[Commits]

Done! Here's what changed:
- migrations/phase8_athlete_invites.sql: new table
- src/lib/db.js: +sendInviteEmail(), +linkAthleteAuthId()
- src/App.jsx: +invite flow
[Diffs shown]
```

---

## Key Rules for Chat ↔ Code Handoff

### In Chat: Make the Plan Explicit
- **File names** (not vague: `fix the auth` → `src/lib/auth.js`)
- **Line numbers** (if available from previous work)
- **Before/after code** (show what changes)
- **Testing steps** (exactly what to test)
- **Commit message** (so Code writes it correctly)

Example:
```
File: src/App.jsx, line 38-58

Current code:
  useEffect(() => {
    const params = new URLSearchParams(...);
    ...
  }, []);

Change to:
  useEffect(() => {
    const params = new URLSearchParams(...);
    // ADD: invite link detection
    const inviteToken = params.get("invite");
    if (inviteToken) {
      // Redirect to signup flow
      ...
    }
  }, []);
```

### In Code: Execute Exactly
- **Read the files first** (don't guess)
- **Show diffs before committing** (Reno reviews)
- **Test locally** (npm run dev)
- **Write clear commit messages** (include *why*, not just *what*)
- **Report back with summary** (what worked, what didn't)

### Back in Chat: Review & Iterate
- **Verify against plan** (was everything done?)
- **Identify gaps** (anything missing?)
- **Plan refinements** (what's next?)
- **Save progress** (update project notes)

---

## Using Chat Project Memory Effectively

### Create a "Status" Note in Your Project

Add a message or saved context like:

```
# Hyrox Trainer — Current Status

**Phase:** 7 (Complete)
**Branch:** docs/rebuild-contract
**Last tested:** 2026-07-01
**Ready for:** Phase 8 planning or Vercel deployment

**Completed:**
- ✅ Three-layer architecture (db.js ← lib/*.js ← UI)
- ✅ Coach dashboard + team management
- ✅ Plan generation
- ✅ Athlete authentication
- ✅ Public team links (no login)
- ✅ Flexible logging with date picker
- ✅ Athlete self-edit

**Pending:**
- ☐ Phase 8: Athlete login/invite for require_auth=true teams
- ☐ Vercel deployment
- ☐ Service role key rotation

**Key files to reference:**
- PHASE7_STATE.md (complete snapshot)
- ARCHITECTURE.md (design)
- DATA_MODEL.md (schema)
```

This stays in your Chat Project so each conversation picks up from the same state.

---

## How to Reference Files in Chat

### Method 1: Upload Files Once, Reference Later
```
Claude, based on the PHASE7_STATE.md in this project, 
what functions do we need for Phase 8 athlete invites?
```

Claude can search your project files without consuming tokens for re-reading.

### Method 2: Paste Specific Sections (for changes)
```
Here's the current saveLog function (from src/lib/db.js):

[Paste relevant code]

I want to add X capability. How should I modify this?
```

### Method 3: Ask Chat to Review Code from Code
```
Claude Code just made these changes to src/App.jsx:

[Paste diffs from Claude Code output]

In the Chat Project context, is this aligned with 
ARCHITECTURE.md's three-layer rule?
```

---

## Avoiding Usage Limits

### What the Chat Project Does
- ✅ Stores uploaded files (referenced, not re-read each time)
- ✅ Saves conversation history (reload without losing context)
- ✅ Allows you to reference files by name in messages

### What It Doesn't Do
- ❌ Automatically include files in every message (you choose what to reference)
- ❌ Replace planning with magic (still need good prompts)
- ❌ Eliminate the need for clear communication

### Best Practice
1. **Upload core docs once** (ARCHITECTURE.md, DATA_MODEL.md, PHASE7_STATE.md)
2. **Reference by name** in your messages ("Based on PHASE7_STATE.md...")
3. **Only paste snippets** when showing specific code to change
4. **Save conversation** as you go (project automatically does this)
5. **Update status notes** between sessions (so each session knows where you left off)

---

## Template: Use This for Each Planning Session

### In Claude Chat Project:

```
# [Feature/Phase Name] Planning Session

## Goal
[What do you want to accomplish?]

## Context
- Reference files: [which docs to check]
- Current branch: [git branch]
- Last working state: [where things stand]

## Requirements
1. [Requirement 1]
2. [Requirement 2]
3. [Requirement 3]

## Questions for Claude
- [Decision 1?]
- [Decision 2?]
- [Potential issue?]

---

## Claude's Plan (auto-filled after response)
[Claude generates plan here]

## Approved Changes
- [Change 1: approved ✓ or needs revision]
- [Change 2: approved ✓ or needs revision]

## Status
- [ ] Plan finalized
- [ ] Sent to Claude Code
- [ ] Implementation started
- [ ] Implementation complete
- [ ] Testing done
- [ ] Deployed / Merged
```

---

## Summary: How This Works

```
Claude Chat Project (persistent memory)
  ↓
  Your planning (show requirements, decisions, blockers)
  ↓
  Claude Chat generates plan (references uploaded docs)
  ↓
  You review & approve plan
  ↓
  You paste plan into Claude Code
  ↓
  Claude Code executes (reads files, makes changes, tests, commits)
  ↓
  Claude Code reports back (diffs, test results, summary)
  ↓
  You paste summary back into Chat Project
  ↓
  Claude Chat verifies & plans next steps
  ↓
  Loop back (or close if done)

No usage limits hit because:
- Chat doesn't re-read full files (project storage)
- Code has fresh context (full repo locally)
- You're not copy-pasting huge files repeatedly
- Conversation history is saved in project
```

---

## Next Steps

1. **Create Chat Project** (`claude.ai/projects`)
2. **Upload these files:**
   - ARCHITECTURE.md
   - DATA_MODEL.md
   - PRODUCT.md
   - PHASE7_STATE.md
   - CLAUDE.md
   - CHAT_PROJECTS_WORKFLOW.md (this file)
3. **Add a status note** (see template above)
4. **Start with Phase 8 planning** in the Chat Project:
   ```
   I want to plan Phase 8 (athlete login/invite flow).
   Based on the files in this project, what should the plan be?
   ```
5. **Once plan is approved**, paste it into Claude Code for execution

---

## Tips for Success

✅ **DO:**
- Be specific in Chat ("Add date picker to log form" not "fix logging")
- Reference project files by name ("per PHASE7_STATE.md...")
- Save conversation between sessions
- Give Claude Code the full plan to execute
- Commit after each Claude Code session
- Update project status notes after major milestones

❌ **DON'T:**
- Paste the entire codebase into chat (reference it instead)
- Ask Claude to guess file paths (be explicit)
- Skip testing locally in Claude Code
- Make changes directly in chat (use Code for actual edits)
- Forget to commit (git log helps future sessions understand state)

---

**Ready?** Create your Chat Project now and start planning Phase 8! 🚀
