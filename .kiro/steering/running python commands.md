---
inclusion: always
---

# Python Environment Setup

## Conda Environment

This project uses a Conda environment named `adobehackathon`. All Python commands must be executed within this environment.

## Execution Rules

**CRITICAL**: Before running any Python script or command, you MUST activate the Conda environment:

```bash
conda activate adobehackathon
```

## Command Patterns

When executing Python operations, use this pattern:

```bash
conda activate adobehackathon && python <script_name>.py
```

Or for multi-line operations:

```bash
conda activate adobehackathon
python <script_name>.py
```

## Applies To

- Running Python scripts (`.py` files)
- Installing Python packages with pip
- Running Python-based tools or utilities
- Any Python REPL or interactive sessions

## Examples

```bash
# Running the Flask server
conda activate adobehackathon && python server/app.py

# Installing dependencies
conda activate adobehackathon && pip install -r server/requirements.txt

# Running tests
conda activate adobehackathon && python -m pytest
```