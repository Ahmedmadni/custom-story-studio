---
name: model-orchestration
description: Efficiently orchestrate Claude models and agents by assigning each task to the lowest-cost model capable of completing it, minimizing token usage and context waste while preserving quality.
---

# Claude Model Orchestration

## Core Objective

Use the right Claude model for the right cognitive task.

> Maximum useful output per unit of context and model usage.

Minimize:
- Unnecessary context loading
- Repeated file reading
- Repeated explanations
- Full-file rewrites
- Using powerful models for simple tasks
- Asking multiple models to solve the same problem

## 1. Task Classification

### Simple / Mechanical
Examples: rename, typo, CSS value, text, config, small isolated fix.

Use the fastest capable model with minimal context.

### Standard Implementation
Examples: React components, forms, APIs, CRUD, normal refactoring.

Use the balanced coding model. This is the default for most development work.

### Complex Reasoning
Examples: architecture, difficult bugs, performance, security, database design, advanced GSAP/WebGL/R3F systems.

Use the strongest reasoning model only when necessary.

### Review / Verification
Use a focused independent pass for code, security, accessibility, performance, or UX review.

Do not repeat the implementation.

## 2. Two-Phase Strategy

For complex tasks:

### Phase 1 — Think
Use the strongest appropriate model to:
- Analyze the problem
- Identify the root cause
- Define exact files to change
- Create an implementation plan
- Define constraints and validation

### Phase 2 — Execute
Use a lower-cost capable coding model to:
- Apply the plan
- Modify only identified files
- Implement the solution
- Run focused tests

Do not make the execution model rediscover the entire problem.

## 3. Context Budget Rules

Always:

1. Read project instructions.
2. Identify the relevant feature, route, symbol, or error.
3. Search exact names.
4. Read only relevant files.
5. Expand context only when evidence requires it.

Avoid reading the entire repository unless necessary.

Never repeatedly load information already analyzed.

## 4. Compact Handoff Protocol

When transferring work between models, pass a concise handoff:

```text
TASK:
What must be done.

FINDINGS:
What was discovered.

ROOT CAUSE:
The actual problem.

FILES:
Exact paths to change.

PLAN:
Numbered implementation steps.

CONSTRAINTS:
What must not change.

VALIDATION:
How success will be verified.
```

Do not transfer a long reasoning transcript.

## 5. Delegation Rules

Delegate only when specialization creates real value.

Good:

```text
Strong model → architecture and root-cause analysis
Balanced model → implementation
Fast model → mechanical cleanup
Focused reviewer → verification
```

Bad:

```text
Model A → analyze everything
Model B → analyze everything again
Model C → analyze everything again
```

Never duplicate expensive reasoning.

## 6. Parallelization

Parallelize only independent tasks.

Good:
- UI analysis
- Database analysis
- Performance analysis

Then combine findings.

Do not parallelize dependent work.

## 7. One Owner Per File

Avoid multiple models editing the same file simultaneously.

Assign file ownership where possible.

If multiple files are tightly coupled, assign them to one model.

## 8. Minimal Diff Principle

Always prefer the smallest correct change.

Before editing, ask:
- Can one function solve this?
- Can an existing component be reused?
- Can an existing utility be extended?
- Is a new dependency necessary?
- Is a full rewrite really required?

Do not rewrite an entire file for a small change.

## 9. Debugging Escalation

Use the cheapest approach first:

1. Inspect the error and directly relevant file.
2. Trace the immediate call chain.
3. Inspect related state/API/database logic.
4. Escalate to deep architectural reasoning only when needed.

If the first model fails, escalate only the unresolved problem.

## 10. UI and Motion Workflow

For complex UI, GSAP, ScrollTrigger, Framer Motion, Three.js, or R3F work:

### Design Reasoning
Strong model defines:
- Visual hierarchy
- Section structure
- Motion narrative
- Transition system
- Performance constraints

### Implementation
Balanced model implements:
- Components
- Timelines
- Scroll interactions
- Transitions

### Optimization
Focused review checks:
- Performance
- Layout thrashing
- Mobile behavior
- Reduced motion
- Unnecessary animation

Do not ask every model to redesign the interface.

## 11. Failure Recovery

Never restart from zero after failure.

Pass forward:
- What was attempted
- What changed
- Exact error
- Relevant stack trace
- Suspected cause
- Modified files

Ask the next model to solve only the remaining issue.

## 12. Context Compression

At checkpoints, compress the working state:

```text
PROJECT STATE

Current task:
...

Completed:
...

Current issue:
...

Relevant files:
...

Next action:
...
```

Use this instead of repeating the entire conversation.

## 13. Default Workflow

For every non-trivial task:

1. Classify the task.
2. Select the lowest-cost capable model.
3. Load only relevant context.
4. Separate reasoning from execution when complex.
5. Create a concise handoff.
6. Execute the smallest correct change.
7. Run focused validation.
8. Escalate only if necessary.
9. Compress context at checkpoints.

## Final Principle

Strong model for difficult thinking.
Balanced model for implementation.
Fast model for mechanical work.
Focused reviewer for verification.

Never pay for the same reasoning twice.
